<!-- version: 1.0 -->
<!-- updated: 2026-05-25 -->

Button Update API

Desktap Agent exposes a local HTTP API that lets your shell scripts dynamically update button appearance on the connected iOS device. This is useful for showing live status, progress indicators, or feedback directly on your deck buttons.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Security model](#security-model)
  - [Rotating the token](#rotating-the-token)
  - [Tooling note](#tooling-note)
- [Authentication](#authentication)
- [Endpoint: POST /api/update-button](#endpoint-post-apiupdate-button)
- [Quick Start](#quick-start)
- [Calling the API from AppleScript](#calling-the-api-from-applescript)
- [Core Concepts](#core-concepts)
  - [The `{{CELL_ID}}` placeholder](#the-cell_id-placeholder)
  - [Partial updates](#partial-updates)
  - [Overlay persistence](#overlay-persistence)
  - [Cross-button updates](#cross-button-updates)
  - [Persistent storage](#persistent-storage)
  - [Process timeout](#process-timeout)
- [Reference](#reference)
  - [Environment variables](#environment-variables)
  - [SF Symbols](#sf-symbols)
  - [Color format](#color-format)
  - [Performance and limits](#performance-and-limits)
  - [JSON safety with dynamic strings](#json-safety-with-dynamic-strings)
- [Other Endpoints](#other-endpoints)
- [Recipe Examples](#recipe-examples)
  - [Live CPU Usage Monitor](#live-cpu-usage-monitor)
  - [Live Bitcoin Price](#live-bitcoin-price)
  - [Pomodoro Timer (cross-button)](#pomodoro-timer-cross-button)
- [MCP (Model Context Protocol)](#mcp-model-context-protocol)
- [Troubleshooting](#troubleshooting)

## Overview

When Desktap Agent is running, it listens on `http://localhost:9848`. Your shell scripts can send HTTP requests to temporarily change a button's title, icon, emoji, or color — without modifying the saved configuration.

These updates are **runtime-only**: they don't persist across app restarts or reconnections.

> **Security:** the API server binds to the loopback interface only (`127.0.0.1`), so it is not reachable from other machines on the network. Combined with the per-user Bearer token (file mode `0600`), only processes running as your user account can call it.

## Getting Started

To use the API you need:

1. **Desktap Agent** installed and running on your Mac (the menu-bar icon must be present).
2. **Desktap iOS app** installed on your iPhone or iPad and **paired** with the Mac. The agent will not accept any update calls until a device is connected — `/api/update-button` returns `503` otherwise.

Once both are running and connected, create a button:

1. Open the **Desktap iOS app** and tap the **edit icon** in the top-right corner of the deck — it looks like a dashed square with a plus inside (SF Symbol `plus.square.dashed`). The grid enters edit mode and existing buttons start wiggling.
2. Tap an empty cell in the grid to add a new button.
3. Choose **Shell Command** as the action type and paste your script into the command field.
4. *(For long-running scripts)* Toggle **Long Running** on inside the same Shell Command section — this disables the 30-second timeout. While any script for this button is running, the section also shows a **Stop Process** button you can use from the editor.
5. *(Optional)* Set a default title, icon, emoji, and color for the button. Runtime API updates layer on top of these defaults; sending `reset:true` returns the button to exactly what you configured here.
6. Tap **Save**.

To trigger the script, simply tap the button on the deck. Changes you make via the API appear immediately — no reload needed.

> **Shell:** all Shell Command actions are executed with `/bin/zsh -c "<your script>"` — not with the user's `$SHELL`. zsh-compatible scripts work as-is; bash-only constructs (e.g. `shopt`, `mapfile`, certain `read -a` forms) need to be rewritten or wrapped with `bash -c '...'`. A `#!/bin/...` shebang at the top of the field is treated as a comment by zsh and does **not** change the executor.

## Security model

Before you start writing scripts that talk to the API, it's worth understanding what the bearer token actually grants.

**The token is a local code-execution credential, not just a "button update key".** The same Bearer token also unlocks `POST /api/execute`, which runs an arbitrary `Command` on your Mac with your user's privileges, **without any approval prompt on the device**. Anyone — or anything — that can read the token file can run code as you.

What this means in practice:

- **Treat `~/.desktap-mcp-token` like an SSH key.** Never paste it into chat logs, commit it to git, screenshot it with the value visible, or upload it to public scripts. The file is created with mode `0600` so it's already unreadable to other users on the machine; the risk is exfiltration *by your own processes* (analytics, sync clients, log shippers) and accidental leaks.
- **The HTTP server only listens on `127.0.0.1`.** It is not reachable over the network, so a token leak does not by itself give a remote attacker access — they would also need code execution on your machine. But once they have either, they have the other.
- **`$DESKTAP_TOKEN` is injected into every action the agent launches from a button** — Shell Commands, AppleScripts (via `do shell script`), any subprocess spawned by them. Other processes on the system, including ones you launch yourself from Terminal or via cron, don't see it through the environment — they have to read the token file.
- **Malicious or buggy `cellId` values can't escape the API contract.** The agent validates the JSON shape, color format, and field whitelist before forwarding anything to the device. The worst a bad payload can do is `400`.
- **Don't hard-code the token in scripts.** Always read it from `$DESKTAP_TOKEN` (button context) or `~/.desktap-mcp-token` (anywhere else) at runtime. That way, rotating the token does not require editing every script.

### Rotating the token

If you suspect the token has leaked:

1. Quit the Desktap Agent (menu-bar icon → **Quit**). This automatically terminates every running button script as part of shutdown, so no process keeps the old token alive.
2. Delete the file: `rm ~/.desktap-mcp-token`.
3. Re-launch the agent. A fresh UUID is generated and written to the same path on startup.
4. Re-press any long-running buttons you want to resume — they were killed in step 1 and need to be launched fresh. They will pick up the new token via `$DESKTAP_TOKEN`.

### Tooling note

A few examples in this document use `python3` (`json.tool`, `json.dumps`). On modern macOS, `python3` is **not** installed by default — it ships with the Xcode Command Line Tools. If `python3 -m json.tool` says "command not found", install it with `xcode-select --install`, or substitute `jq` (Homebrew: `brew install jq`).

## Authentication

All API requests require a Bearer token passed as an `Authorization: Bearer <token>` header.

**If your script runs from a Desktap button**, the token is already available as the `$DESKTAP_TOKEN` environment variable — just use it directly:

```bash
curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '...'
```

**If your script runs outside of Desktap** (e.g., from Terminal, cron, or another app), read the token from the file:

```bash
TOKEN=$(cat ~/.desktap-mcp-token)

curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '...'
```

## Endpoint: POST /api/update-button

### Request Body

| Field    | Type    | Required | Description                                         |
|----------|---------|----------|-----------------------------------------------------|
| `cellId` | String  | **Yes**  | UUID of the button to update                        |
| `title`  | String  | No       | New button label text                               |
| `icon`   | String  | No       | SF Symbol name (e.g. `"checkmark.circle"`)          |
| `emoji`  | String  | No       | Emoji characters (overrides `icon` if both set). The agent doesn't enforce a length, but **1–3 emoji** are recommended — anything longer gets clipped on the button face |
| `color`  | String  | No       | Hex color in `#RRGGBB` format (e.g. `"#FF5733"`)   |
| `reset`  | Boolean | No       | Set to `true` to clear all overrides                |

**Only these fields are accepted.** Any unknown field returns a `400` error.

### Finding the Button UUID

Open the button editor in the Desktap iOS app — the **Button ID** section shows the full UUID in monospaced text and provides a **Copy** button that puts it on the iOS clipboard. Tap it once and you can paste the UUID into another button's script via the system keyboard. You can also fetch the full configuration via `GET /api/config` and look for the `id` field in the cell you want to update.

### Response

**Success (200):**
```json
{"status": "ok"}
```

> **Note:** A `200` response means the agent accepted the update and forwarded it to the connected device. The override is then **stored in memory** under that `cellId` regardless of whether the matching button is currently visible — there is no "this button doesn't exist" error. Two consequences:
>
> - If the button exists but lives on a **different page** than the one the user is viewing, the update is invisible right now and applies the moment the user navigates to that page.
> - If the `cellId` matches **no button at all** (typo, stale UUID, button deleted from the config), the override sits in memory and never displays — it is cleared only when the iOS app restarts or the device disconnects.
>
> Always double-check the UUID via `GET /api/config` if your update appears to do nothing.

**Error (400)** — invalid request body. Possible messages:
- `"Missing request body"`
- `"Invalid JSON"` (also returned when `cellId` is not a valid UUID string)
- `"Unknown field(s): foo, bar. Valid fields: cellId, title, icon, emoji, color, reset."`
- `"Invalid color format. Expected #RRGGBB."`

```json
{"status": "error", "message": "Invalid color format. Expected #RRGGBB."}
```

**Unauthorized (401):**
```json
{"error": "Unauthorized"}
```

**Not Found (404)** — the path is not one of the documented endpoints:
```json
{"error": "Not found"}
```

**No device connected (503):**
```json
{"status": "error", "message": "No device connected"}
```

## Quick Start

A minimal script that updates the button that triggered it:

```bash
curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"Hello!\",\"emoji\":\"👋\",\"color\":\"#30D158\"}"
```

Paste this into a button's shell command field. When pressed, the button updates its own title, emoji, and color.

## Calling the API from AppleScript

The HTTP API works from AppleScript actions exactly as it does from Shell Command — the agent injects `$DESKTAP_TOKEN` and `$DESKTAP_STORAGE` into the `osascript` process's environment, and AppleScript's `do shell script` inherits that environment when it spawns its child shell. So you can read the token straight from `$DESKTAP_TOKEN` without touching disk:

```applescript
set cellId to "{{CELL_ID}}"
set token to do shell script "echo $DESKTAP_TOKEN"
set authHeader to "Authorization: Bearer " & token
set jsonBody to "{\"cellId\":\"" & cellId & "\",\"title\":\"Hello\",\"emoji\":\"👋\"}"
do shell script "curl -s http://localhost:9848/api/update-button -H " & quoted form of authHeader & " -H 'Content-Type: application/json' -d " & quoted form of jsonBody
```

`quoted form of` is the safe AppleScript idiom for handing a string to the shell — it escapes single quotes and other shell metacharacters in the payload, so dynamic values can be passed without manual escaping.

`{{CELL_ID}}` substitution works in AppleScript the same way it does in Shell Command — the agent replaces it with the button's UUID before passing the source to `osascript`.

For most update-loops (timers, monitors, dashboards), prefer Shell Command anyway — it's strictly less ceremony than driving curl through `do shell script`. Reach for AppleScript when you actually need AppleScript-only capabilities, like talking to a specific app's scripting dictionary.

## Core Concepts

### The `{{CELL_ID}}` placeholder

When a script runs from a Desktap button, the placeholder `{{CELL_ID}}` in your shell command or AppleScript is automatically replaced with that button's UUID. This means you don't need to hard-code UUIDs — your script naturally knows which button triggered it.

This works in Shell Commands, AppleScripts, and Text Snippets.

### Partial updates

You only need to send the fields you want to change. For example, sending just `cellId` + `color` changes only the color; the title, icon, and emoji remain as they were. Each subsequent update merges with previous overrides, not replaces them.

```bash
# Only change color — title and icon stay the same
curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cellId": "YOUR-BUTTON-UUID", "color": "#FF0000"}'
```

### Overlay persistence

Runtime updates (overlays) are **not cleared** when the script finishes normally. This is by design — it allows your script to set a final status (like "Success" or "Failed") that remains visible after the script exits.

Overlays are cleared in two ways:

**Per-button clearing** (only the affected `cellId`):
- You send `reset: true` for that `cellId` explicitly.
- The script backing this overlay is **terminated** by the agent. This happens when:
  - You tap **Stop Process** in the iOS button editor.
  - You re-press the same button — a new instance replaces the running one (each `(button, press-type)` slot holds at most one process).

**Mass clearing** (every overlay in memory, including overlays for stale `cellId`s and for buttons whose script never ran):
- The iOS app loses its connection to the Mac. This includes user-initiated disconnect, the agent quitting, the device going to sleep, network interruption — anything that drops the TCP link. The iOS app wipes the entire overlay store and stops processing further updates until reconnect.

A script that **finishes normally** (its process exits cleanly, with no termination signal) does **not** clear its overlay — that's the whole point of the "show a final status, then leave it" pattern.

To clear an overlay, send a reset:

```bash
curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cellId": "YOUR-BUTTON-UUID", "reset": true}'
```

To show a temporary status that auto-resets:

```bash
CELL_ID="{{CELL_ID}}"
# Show result for 3 seconds, then reset
update_button "{\"cellId\":\"$CELL_ID\",\"title\":\"Done!\",\"emoji\":\"✅\"}"
sleep 3
update_button "{\"cellId\":\"$CELL_ID\",\"reset\":true}"
```

### Cross-button updates

A script running from one button can update **any other button** on the deck — not just itself. This enables setups where one button controls the appearance of others (dashboards, controllers, status indicators).

To update another button, use its UUID as the `cellId`. You can find button UUIDs via `GET /api/config` or in the button editor in the iOS app. See the [Pomodoro Timer](#pomodoro-timer-cross-button) recipe for a full example.

### Persistent storage

Use `$DESKTAP_STORAGE` to save state between script runs. The directory is created automatically at `~/Library/Application Support/Desktap/ScriptStorage`.

```bash
# Save a counter that persists between button presses
COUNT_FILE="$DESKTAP_STORAGE/my_counter"

# Read previous count (or start at 0)
COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNT_FILE"

curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"Pressed ${COUNT}x\"}"
```

Other use cases:
- Cache API responses to avoid redundant requests
- Store timestamps for cooldown logic
- Save the last known value when the API is temporarily unavailable
- Save target end-time (epoch) for timers that survive process restarts

### Process timeout

By default, button scripts have a **30-second timeout**. If your script needs more time (e.g., a build process or a monitoring loop), enable the **Long Running** option in the button editor. This removes the timeout entirely.

When a long-running script is terminated — by **Stop Process** in iOS, by re-pressing the same button, or on device disconnect — the agent first sends `SIGTERM`, then `SIGKILL` after **2 seconds** if the process is still alive. Use a `trap ... TERM` handler if you need to clean up state, save progress, or send a final `reset:true` before exiting.

> **Important:** Long-running scripts have two restart scenarios, and both wipe in-memory state:
> - **Device reconnect** — when the iPhone disconnects, the agent saves a snapshot of running scripts, kills them, and **auto-restarts** them from scratch when the same device reconnects.
> - **Agent restart** — when the agent quits, all running scripts are terminated and **not** auto-restarted. You need to re-press the button manually after the agent comes back.
>
> Either way, the script starts with no in-memory state. For timers and countdowns, never rely on an in-memory counter — save the target end-time (epoch seconds) to `$DESKTAP_STORAGE` and compute `remaining = END - NOW` on every iteration. This survives both scenarios.

## Reference

### Environment variables

Scripts executed from Desktap buttons automatically receive these environment variables — you don't need to set them manually:

| Variable          | Description                                                  |
|-------------------|--------------------------------------------------------------|
| `$DESKTAP_TOKEN`  | Auth token for API requests — use this instead of reading `~/.desktap-mcp-token` |
| `$DESKTAP_STORAGE`| Persistent storage directory (`~/Library/Application Support/Desktap/ScriptStorage`) — use it to save/read state between script runs |
| `$PATH`           | Extended to include `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin` (any missing entries are appended) — Homebrew tools work out of the box |

> **Note:** These variables are only available when the script is launched from a Desktap button. If you run the same script manually from Terminal, `$DESKTAP_TOKEN` and `$DESKTAP_STORAGE` will be empty — read the token from `~/.desktap-mcp-token` instead.

### SF Symbols

The `icon` field accepts any [SF Symbols](https://developer.apple.com/sf-symbols/) name. Download the free SF Symbols app from Apple to browse all available icons.

Some commonly used symbols:

| Category   | Examples                                                    |
|------------|-------------------------------------------------------------|
| Status     | `checkmark.circle.fill`, `exclamationmark.triangle.fill`    |
| Actions    | `play.circle.fill`, `magnifyingglass`, `doc.on.doc`         |
| System     | `gearshape`, `terminal.fill`, `timer`, `globe`              |
| Devices    | `desktopcomputer`, `iphone`, `macbook.and.iphone`           |

```bash
# Set a terminal icon on the button
curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cellId": "YOUR-BUTTON-UUID", "icon": "terminal.fill"}'
```

If you set both `icon` and `emoji`, the emoji takes priority.

### Color format

Colors must be exactly `#RRGGBB` — six hex digits with a leading `#`. These are **invalid**:
- `#FFF` (too short)
- `FF0000` (missing `#`)
- `#FF000080` (alpha channel not supported)

Lowercase hex is accepted: `#aabbcc` is valid.

### Performance and limits

There is no per-request rate limiting on the API. The server supports up to **256 simultaneous connections**. In practice, you can send several updates per second without issues — but keep in mind each update travels over the network to the iOS device, so very rapid updates (>10/sec) may queue up or provide no visual benefit.

For monitoring scripts, an interval of 1–10 seconds is a good balance between responsiveness and resource usage.

### JSON safety with dynamic strings

When your payload includes dynamic text (API responses, user input, anything with quotes, backslashes, or non-ASCII characters), shell interpolation will silently produce invalid JSON. Build the payload with `python3 -m json.tool` or `python3 -c` and pipe it to `curl -d @-`:

```bash
PAYLOAD=$(python3 -c "import json,sys; print(json.dumps({'cellId':'{{CELL_ID}}','title':sys.argv[1]}))" "$DYNAMIC_VALUE")

curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

For static text without special characters, inline JSON in `-d '{...}'` is fine.

## Other Endpoints

### GET /api/status

Check if a device is connected:

```bash
curl -s http://localhost:9848/api/status \
  -H "Authorization: Bearer $DESKTAP_TOKEN"
```

Response:
```json
{"connected": true}
```

### GET /api/config

Fetch the full button configuration from the connected device. Useful for discovering button UUIDs:

```bash
curl -s http://localhost:9848/api/config \
  -H "Authorization: Bearer $DESKTAP_TOKEN" | python3 -m json.tool
```

Response includes the full `AppConfig` with all profiles, pages, and cells (each cell has an `id` field — that's the UUID you need).

## Recipe Examples

All long-running examples require **Long Running** enabled in the button editor (otherwise the 30-second timeout will kill the script).

> **Tip:** Use `trap cleanup EXIT TERM` to reset the button when the script is stopped — `EXIT` alone does not fire when the agent kills the process with SIGTERM, so the overlay would stay with the last value. See [Process timeout](#process-timeout).

### Live CPU Usage Monitor

Displays current CPU load (user + system) with color thresholds: green (normal), orange (>50%), red (>80%).

```bash
CELL_ID="{{CELL_ID}}"

update_button() {
  curl -s http://localhost:9848/api/update-button \
    -H "Authorization: Bearer $DESKTAP_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

# Reset button on normal exit AND on SIGTERM (sent when iOS terminates the script)
trap 'update_button "{\"cellId\":\"$CELL_ID\",\"reset\":true}"' EXIT TERM

while true; do
  # top fields on macOS: $3 = user%, $5 = sys%, $7 = idle%. Sum user+sys for total load.
  CPU=$(top -l 1 -n 0 2>/dev/null | awk '/CPU usage/{printf "%.0f", $3 + $5}')
  if [ -n "$CPU" ]; then
    COLOR="#30D158"
    [ "$CPU" -gt 50 ] && COLOR="#FF9500"
    [ "$CPU" -gt 80 ] && COLOR="#FF3B30"
    update_button "{\"cellId\":\"$CELL_ID\",\"title\":\"CPU ${CPU}%\",\"color\":\"$COLOR\"}"
  fi
  sleep 5
done
```

Note: `top -l 1` takes about 1 second to sample, so the actual update interval is ~6 seconds.

### Live Bitcoin Price

Shows the current BTC price in EUR, updated every 60 seconds.

```bash
CELL_ID="{{CELL_ID}}"

update_button() {
  curl -s http://localhost:9848/api/update-button \
    -H "Authorization: Bearer $DESKTAP_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

trap 'update_button "{\"cellId\":\"$CELL_ID\",\"reset\":true}"' EXIT TERM

# Show loading state immediately
update_button "{\"cellId\":\"$CELL_ID\",\"title\":\"Loading...\",\"emoji\":\"₿\"}"

while true; do
  PRICE=$(curl -s 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur' \
    | python3 -c "import sys,json; print(f'{json.load(sys.stdin)[\"bitcoin\"][\"eur\"]:,.0f}')" 2>/dev/null)
  if [ -n "$PRICE" ]; then
    update_button "{\"cellId\":\"$CELL_ID\",\"title\":\"€$PRICE\",\"emoji\":\"₿\"}"
  fi
  sleep 60
done
```

The script silently skips updates if the API returns an empty response (e.g., rate limit) — the button keeps showing the last known price.

CoinGecko's free API allows ~10-30 requests per minute. The 60-second interval stays well within limits.

### Pomodoro Timer (cross-button)

Two buttons work together — a **Start/Stop** control button and a **Timer** display button that shows the countdown. The control button's script updates both itself and the timer button.

The script saves the **target end-time** (epoch seconds) to `$DESKTAP_STORAGE` and computes the remaining time on every iteration. This way the timer survives an agent restart or a device reconnect — without it, a long-running script that gets restarted would silently reset the countdown to its starting value.

**Setup:**
1. Create two buttons side by side
2. Copy the timer display button's UUID (from the button editor)
3. Paste the script below into the **control button's** shell command
4. Replace `TIMER_BUTTON` with the display button's UUID
5. Enable **Long Running** in the control button editor

```bash
CONTROL_BUTTON="{{CELL_ID}}"
TIMER_BUTTON="your-timer-display-button-uuid"

WORK_MINUTES=25
BREAK_MINUTES=5

STATE_FILE="$DESKTAP_STORAGE/pomodoro_${CONTROL_BUTTON}.state"

update_button() {
  curl -s -m 5 http://localhost:9848/api/update-button \
    -H "Authorization: Bearer $DESKTAP_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

# Clean up on exit OR termination (SIGTERM is sent before SIGKILL after 2s)
cleanup() {
  rm -f "$STATE_FILE"
  update_button "{\"cellId\":\"$CONTROL_BUTTON\",\"reset\":true}"
  update_button "{\"cellId\":\"$TIMER_BUTTON\",\"reset\":true}"
}
trap cleanup EXIT TERM

# Resume from a previous run if state exists, otherwise start a new work phase.
# IMPORTANT: parse the state file explicitly — never `source` it. A `source`d file
# would execute any shell code written into it, and $DESKTAP_STORAGE is writable
# by any process running as you (sync clients, other scripts, etc.).
read_state() {
  local key="$1"
  grep -E "^${key}=" "$STATE_FILE" | head -n1 | cut -d'=' -f2- | tr -d '"'
}

write_state() {
  printf 'PHASE=%s\nEND_TIME=%d\n' "$1" "$2" > "$STATE_FILE"
}

if [ -f "$STATE_FILE" ]; then
  PHASE=$(read_state PHASE)
  END_TIME=$(read_state END_TIME)
  # Validate parsed values — fall back to a fresh work phase if either looks wrong.
  case "$PHASE" in
    work|break) ;;
    *) PHASE="work"; END_TIME="" ;;
  esac
  if ! [[ "$END_TIME" =~ ^[0-9]+$ ]]; then
    PHASE="work"
    END_TIME=$(( $(date +%s) + WORK_MINUTES * 60 ))
    write_state "$PHASE" "$END_TIME"
  fi
else
  PHASE="work"
  END_TIME=$(( $(date +%s) + WORK_MINUTES * 60 ))
  write_state "$PHASE" "$END_TIME"
fi

# Show the right control-button label for the current phase. Important on resume:
# if we were killed mid-break, we need "Skip" (not "Stop") right away — the loop
# below only updates the control button on the work→break transition.
if [ "$PHASE" = "work" ]; then
  update_button "{\"cellId\":\"$CONTROL_BUTTON\",\"title\":\"Stop\",\"emoji\":\"⏹\",\"color\":\"#FF3B30\"}"
else
  update_button "{\"cellId\":\"$CONTROL_BUTTON\",\"title\":\"Skip\",\"emoji\":\"⏭\",\"color\":\"#30D158\"}"
fi

while true; do
  REMAINING=$(( END_TIME - $(date +%s) ))

  if [ "$REMAINING" -le 0 ]; then
    if [ "$PHASE" = "work" ]; then
      PHASE="break"
      END_TIME=$(( $(date +%s) + BREAK_MINUTES * 60 ))
      write_state "$PHASE" "$END_TIME"
      update_button "{\"cellId\":\"$CONTROL_BUTTON\",\"title\":\"Skip\",\"emoji\":\"⏭\",\"color\":\"#30D158\"}"
      continue
    else
      update_button "{\"cellId\":\"$TIMER_BUTTON\",\"title\":\"Done!\",\"emoji\":\"✅\",\"color\":\"#30D158\"}"
      sleep 3
      exit 0
    fi
  fi

  MINS=$((REMAINING / 60))
  SECS=$((REMAINING % 60))
  if [ "$PHASE" = "work" ]; then
    update_button "{\"cellId\":\"$TIMER_BUTTON\",\"title\":\"$(printf '%d:%02d' $MINS $SECS)\",\"emoji\":\"🍅\",\"color\":\"#FF3B30\"}"
  else
    update_button "{\"cellId\":\"$TIMER_BUTTON\",\"title\":\"$(printf '%d:%02d' $MINS $SECS)\",\"emoji\":\"☕\",\"color\":\"#30D158\"}"
  fi
  sleep 1
done
```

How it works:
- **Press** → saves `END_TIME = NOW + 25 min` to `$DESKTAP_STORAGE`, starts the countdown, control button shows "Stop".
- **Press "Stop"** → the process is terminated; `trap` fires, deletes the state file, resets both buttons.
- **Device reconnect mid-countdown** → the agent automatically relaunches the script (same device only). The new instance reads the saved `END_TIME` and resumes from the correct remaining time, no user action needed.
- **Agent restart mid-countdown** → the script is killed when the agent quits and is **not** auto-resumed. The state file persists, so the next time you press the button (after the agent comes back), the script reads `END_TIME` and resumes from the correct remaining time.
- **Work phase ends** → switches to a 5-minute break and updates the state file; control button shows "Skip".
- **Break ends** → timer shows "Done!", state file is deleted, both buttons reset.

This demonstrates the key cross-button patterns:
- One script controlling multiple buttons via their UUIDs
- Persistent state in `$DESKTAP_STORAGE` so timers survive restarts
- Cleanup via `trap ... EXIT TERM` (SIGTERM is sent before SIGKILL — see [Process timeout](#process-timeout))

## MCP (Model Context Protocol)

Desktap Agent supports MCP, allowing AI assistants (like Claude) to interact with your deck programmatically — create buttons, update layouts, and execute commands on your Mac.

### Setup

If Claude Desktop is installed, Desktap Agent shows a one-click **Connect to Claude** button in its main window — clicking it writes the MCP entry into Claude's config for you. After the initial connect, the agent automatically keeps the binary path in sync if it changes (e.g. after a rebuild or app move), so you don't need to reconnect manually.

If you're using a different MCP client (or want to configure Claude Desktop by hand), add this to your MCP configuration:

```json
{
  "mcpServers": {
    "desktap": {
      "command": "/path/to/DesktapAgent.app/Contents/MacOS/DesktapAgent",
      "args": ["--mcp"]
    }
  }
}
```

For **Claude Desktop**, the config file is at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

The `--mcp` flag launches the agent in stdio mode (no UI). It communicates with the main Desktap Agent process via the same HTTP API on port 9848.

> **Note:** The main Desktap Agent app must be running for MCP to work — the `--mcp` process is just a bridge.

### MCP tools

The most useful tools for AI assistants:

| Tool                      | Description                                                |
|---------------------------|------------------------------------------------------------|
| `get_available_actions`   | Returns the full schema of supported command types, icons, grid sizes, env vars, and the runtime API contract. **Call this first** — its output is the canonical reference and stays in sync with the agent. |
| `get_profiles`            | List all profiles                                          |
| `get_profile_detail`      | Read a full profile with pages and buttons (UUIDs included) |
| `create_full_profile`     | Create a complete profile with pages and buttons in one call |
| `create_full_page`        | Create a complete page with buttons in one call            |
| `update_button_by_uuid`   | Modify a single button by its UUID (any field)             |
| `update_buttons_by_uuid`  | Batch-modify multiple buttons in one operation             |
| `get_installed_apps`      | List installed apps (for the `openApp` action)             |
| `get_active_app`          | Identify the currently focused app                         |
| `get_available_shortcuts` | List user-defined shortcuts available to bind              |
| `run_probe`               | Execute a one-off shell command on the Mac (with iOS approval) |

Lower-level building blocks (`create_profile`, `create_page`, `add_button`, `update_button`, `delete_button`, `delete_page`, `delete_profile`, `add_buttons_to_client`, `add_pages_to_client`, `deliver_to_client`, `ping`) are also registered — `get_available_actions` enumerates and describes all of them at runtime.

### Config delivery and approval

When an AI assistant creates or modifies buttons via MCP tools, the changes are **sent to your iPhone for approval**. You'll see a confirmation dialog showing what will change. Only after you accept does the change take effect. If you reject, the AI assistant is notified that the change was denied.

This approval flow ensures you always have full control over what appears on your deck.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `401 Unauthorized` | Check that `~/.desktap-mcp-token` exists and your token matches |
| `503 No device connected` | Open the Desktap iOS app and connect to your Mac |
| `Connection refused` | Make sure Desktap Agent is running on your Mac |
| `200 OK` but no visible change | The `cellId` does not match any button on the active page. Verify the UUID via `/api/config` and make sure the matching page is currently selected on the device |
| Button doesn't update | Verify the `cellId` UUID is correct (check via `/api/config`) |
| AppleScript-built request returns `401` | AppleScript can't reference `$DESKTAP_TOKEN` directly — it's a shell variable. Use `do shell script "echo $DESKTAP_TOKEN"` to pull it into an AppleScript variable first. See [Calling the API from AppleScript](#calling-the-api-from-applescript) |
| Color rejected | Use exactly `#RRGGBB` format (6 hex digits, with `#`) |
| Script times out | Enable "Long Running" in button editor for scripts over 30 seconds |
| Unknown field error | Only use: `cellId`, `title`, `icon`, `emoji`, `color`, `reset` |
| Long-running script lost state on agent restart | In-memory variables don't survive restarts. Save state (e.g. timer end-time) to `$DESKTAP_STORAGE` — see the [Pomodoro recipe](#pomodoro-timer-cross-button) |
| Dynamic JSON breaks intermittently | Shell interpolation of values containing quotes/backslashes/non-ASCII produces invalid JSON. Use the `python3 -c "import json; print(json.dumps(...))"` pattern from [JSON safety](#json-safety-with-dynamic-strings) |
| Overlay stuck after script | Send `reset: true` to clear, or terminate the process from iOS |
| Cleanup never runs on stop | A bare `trap ... EXIT` does not fire on SIGTERM. Use `trap cleanup EXIT TERM` so the handler runs when the agent terminates the process |
| `python3: command not found` | Modern macOS doesn't bundle `python3`. Install it with `xcode-select --install`, or replace the example with `jq` (`brew install jq`). See [Tooling note](#tooling-note) |
| Token leaked or committed accidentally | Treat the token like an SSH key — it grants full local code execution via `/api/execute`. Rotate it immediately: see [Rotating the token](#rotating-the-token) |
