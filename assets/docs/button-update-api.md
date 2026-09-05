<!-- version: 1.1.1 -->
<!-- updated: 2026-09-05 -->

Button Update API

Desktap Agent exposes a local HTTP API that lets your shell scripts dynamically update button appearance on the connected iOS device and send local notifications with action buttons to the phone and the Mac. Together with **startup scripts** — scripts the agent keeps running while your device is connected — this turns buttons into live widgets: CPU load, prices, timers, build status, all updating on their own.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Security model](#security-model)
  - [Rotating the token](#rotating-the-token)
  - [Tooling note](#tooling-note)
- [Authentication](#authentication)
- [Quick Start](#quick-start)
- [Endpoint: POST /api/update-button](#endpoint-post-apiupdate-button)
- [Endpoint: POST /api/notify](#endpoint-post-apinotify)
  - [Notification fields](#notification-fields)
  - [Action buttons](#action-buttons)
  - [Targets: phone, Mac, or both](#targets-phone-mac-or-both)
  - [What tapping does](#what-tapping-does)
  - [Notify responses](#notify-responses)
- [Calling the API from AppleScript](#calling-the-api-from-applescript)
- [Core Concepts](#core-concepts)
  - [The `{{CELL_ID}}` placeholder](#the-cell_id-placeholder)
  - [Partial updates](#partial-updates)
  - [Overlay persistence](#overlay-persistence)
  - [Cross-button updates](#cross-button-updates)
  - [Persistent storage](#persistent-storage)
  - [Startup scripts (live widgets)](#startup-scripts-live-widgets)
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
  - [Focus Timer with a "Done" notification](#focus-timer-with-a-done-notification)
  - [Deploy finished — notification with actions](#deploy-finished-notification-with-actions)
  - [Disk space alert (threshold notification)](#disk-space-alert-threshold-notification)
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
2. **Desktap iOS app** installed on your iPhone or iPad and **paired** with the Mac. The agent will not accept any update calls until a device is connected — `/api/update-button` returns `503` otherwise. (Notifications are different: `/api/notify` queues phone notifications while the device is away and delivers them on the next connect.)

Once both are running and connected, create a button:

1. Open the **Desktap iOS app** and tap the **edit icon** in the top-right corner of the deck — it looks like a dashed square with a plus inside (SF Symbol `plus.square.dashed`). The grid enters edit mode and existing buttons start wiggling.
2. Tap an empty cell in the grid to add a new button.
3. Choose **Shell Command** as the action type and paste your script into the command field. This is the **tap** script: it runs when you press the button and is killed after **60 seconds**.
4. *(For live widgets)* Scroll down to the **Startup Script** section and paste the loop there. A startup script is started by the agent as soon as your device connects and keeps running — no timeout — until the device disconnects. It can belong to a button of *any* action type. See [Startup scripts (live widgets)](#startup-scripts-live-widgets).
5. *(Optional)* Set a default title, icon, emoji, and color for the button. Runtime API updates layer on top of these defaults; sending `reset:true` returns the button to exactly what you configured here.
6. Tap **Save**.

The tap script runs when you tap the button; the startup script is already running. Changes you make via the API appear immediately — no reload needed.

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
4. Reconnect the device (or just wait for auto-reconnect). Startup scripts are relaunched on connect and pick up the new token via `$DESKTAP_TOKEN`.

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

## Quick Start

A minimal script that updates the button that triggered it:

```bash
curl -s http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"Hello!\",\"emoji\":\"👋\",\"color\":\"#30D158\"}"
```

Paste this into a button's shell command field. When pressed, the button updates its own title, emoji, and color.

## Endpoint: POST /api/update-button

### Request Body

| Field    | Type    | Required | Description                                         |
|----------|---------|----------|-----------------------------------------------------|
| `cellId` | String  | **Yes**  | UUID of the button to update                        |
| `title`  | String  | No       | New button label text. Shown on up to two lines, wrapping at spaces. The recipes in this document use `Label\|Value` (e.g. `CPU\|42%`) purely as a visual convention — the `\|` is displayed as-is, it is not a line break |
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

**Not Found (404)** — unknown path or method (e.g. `GET /api/update-button`):
```json
{"error": "Not found"}
```

**No device connected (503):**
```json
{"status": "error", "message": "No device connected"}
```

## Endpoint: POST /api/notify

Shows a **local notification** — on the connected iPhone/iPad, on the Mac, or both — with up to four action buttons. Each action carries a regular Desktap command that runs on the Mac when the button is tapped. This is the "loud" channel next to the quiet button overlay: use it for things the user did not trigger and should not miss — a build finished, a meeting is about to start, a backup is stale, a value crossed a threshold.

Notifications are system notifications: title, subtitle, body, sound, and buttons. They cannot render custom content (no images, HTML, or scripts).

```bash
curl -s -m 5 http://localhost:9848/api/notify \
  -H "Authorization: Bearer $DESKTAP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cellId": "{{CELL_ID}}",
    "title": "Deploy finished",
    "body": "main → production, 3m 12s",
    "targets": ["phone", "mac"],
    "actions": [
      { "id": "logs", "title": "Open logs", "command": { "openURL": { "url": "https://ci.example.com/runs/42" } } },
      { "id": "rollback", "title": "Rollback", "destructive": true,
        "command": { "shellCommand": { "command": "./deploy rollback" } } }
    ]
  }'
```

### Notification fields

| Field      | Type     | Required | Description |
|------------|----------|----------|-------------|
| `title`    | String   | **Yes**  | Headline. Keep it short. |
| `body`     | String   | No       | Text under the title. Multi-line is fine — this is where details go (e.g. a list of prices that does not fit on a button). |
| `subtitle` | String   | No       | Second line under the title. |
| `cellId`   | String   | No       | UUID of the button this notification belongs to — use `{{CELL_ID}}`. Tapping the notification body opens that button's page on the phone, action commands run with it as `{{CELL_ID}}`, and notifications from one button are grouped together. Strongly recommended. |
| `targets`  | Array    | No       | `["phone"]` (default), `["mac"]`, or `["phone", "mac"]`. |
| `sound`    | Boolean  | No       | Play the default sound. Default `true`. |
| `actions`  | Array    | No       | Up to **4** action buttons — see below. |
| `id`       | String   | No       | UUID. Send the same `id` again to **replace** the previous notification instead of stacking a new one (progress updates). Generated when omitted. |

**Only these fields are accepted.** Any unknown field returns `400`.

### Action buttons

Each entry in `actions`:

| Field         | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `id`          | String  | **Yes**  | Unique within the notification (e.g. `"logs"`). |
| `title`       | String  | **Yes**  | Button label. |
| `command`     | Object  | No       | A Desktap command in the same JSON shape buttons use. Omit for a plain "dismiss" button. |
| `destructive` | Boolean | No       | Renders the button in the destructive (red) style. |

**An action can run any command a button can run** — the `command` object uses exactly the same JSON shape as a button's command in the configuration. Everything below is valid; the only exception is `switchPage`, which is executed locally on the phone and is not available from a notification (actions always run on the Mac).

| Command | JSON | Notes |
|---------|------|-------|
| Open a URL / file / app link | `{ "openURL": { "url": "https://…" } }` | `https://`, `file:///…`, `slack://…`, `x-apple.systempreferences:…` |
| Launch an app | `{ "launchApp": { "bundleIdentifier": "com.apple.ActivityMonitor" } }` | Bundle id, see `get_installed_apps` |
| Shell command | `{ "shellCommand": { "command": "…" } }` | Same environment and 60 s timeout as a tap script |
| AppleScript | `{ "appleScript": { "code": "tell application \"Music\" to playpause" } }` | |
| System action | `{ "systemAction": { "_0": "mute" } }` | `spotlight`, `missionControl`, `launchpad`, `playPause`, `nextTrack`, `previousTrack`, `volumeUp`, `volumeDown`, `mute`, `brightnessUp`, `brightnessDown`, `screenshot`, `screenshotRegion`, `lockScreen`, `muteMic`, `unmuteMic`, `darkMode`, `lightMode`, `sleep`, `logout`, `emptyTrash` |
| Keyboard shortcut | `{ "keystroke": { "_0": { "keyCode": 49, "modifiers": ["command"] } } }` | Virtual key code + any of `command`, `option`, `control`, `shift` |
| Run a Shortcut | `{ "runShortcut": { "name": "Start Focus" } }` | Name from the Shortcuts app |
| Type text | `{ "textSnippet": { "text": "Thanks, will do!" } }` | Pasted into the active field on the Mac |
| Ping | `{ "ping": {} }` | Handy as a no-op that still flashes the button |

So a single notification can, for example, offer **[Join]** (`openURL` to a Meet link), **[Mute mic]** (`systemAction` `muteMic`), and **[Reply "on my way"]** (`textSnippet`) side by side. Commands that need Accessibility (`keystroke`, `systemAction`, `textSnippet`) are subject to the same permission check as a button press.

A `shellCommand` action gets the same environment as a button script — `$DESKTAP_TOKEN`, `$DESKTAP_STORAGE`, `{{CELL_ID}}` — and the same 60-second timeout. The natural pattern is **the action changes state, the startup script renders it**: `[Restart 25 min]` writes a new end-time to a file, the timer loop picks it up on its next tick.

### Targets: phone, Mac, or both

- **`phone`** — shown on the connected iPhone/iPad, as a banner even while Desktap is on screen. If no device is connected, the notification is **queued on the agent** (up to 20, for 12 hours) and delivered when the device pairs again. Tapping an action sends its command to the Mac exactly like a button press: the button flashes green or red with the result. If the phone was locked or Desktap was in the background, tapping an action brings the app to the foreground first so the connection is alive; the command is queued and sent as soon as the agent is reachable.
- **`mac`** — shown by Desktap Agent through macOS Notification Center. Action commands run locally. The first notification asks for permission; grant it in the dialog (or in System Settings → Notifications → Desktap Agent). macOS shows action buttons on hover for the default *Banners* style — switch the agent to *Alerts* if you want the buttons visible right away.

### What tapping does

| Tap                                  | Result |
|--------------------------------------|--------|
| Notification body (phone)            | Desktap opens the page holding the button with that `cellId`. |
| Notification body (Mac)              | Nothing — dismisses. |
| Action with `command`                | The command runs on the Mac. |
| Action without `command`             | Dismisses. |

Taps keep working after the app or the agent has been restarted — the notification carries everything it needs.

### Notify responses

**Success (200):**
```json
{"status":"ok","delivered":{"phone":"sent","mac":"shown"}}
```

Per target: `phone` is `sent` or `queued` (no device connected — kept for the next connect); `mac` is `shown` or `denied` (notifications not allowed for the agent).

**Error (400)** — same envelope as `/api/update-button` (`{"status":"error","message":…}`). Possible messages:
- `"Missing request body"`
- `"Body must be a JSON object."`
- `"Unknown field(s): foo. Valid fields: actions, body, cellId, id, sound, subtitle, targets, title."`
- `"Invalid notification JSON: …"` (wrong type, e.g. `targets` not an array, `id` not a UUID, or an unknown `command` shape)
- `"title is required."`
- `"At most 4 actions are supported."`
- `"Action ids must be unique."`
- `"Every action needs a non-empty id and title."`

Other status codes (`401`, `404`) behave exactly as for `/api/update-button`.

> **Do not notify from inside a loop unconditionally.** A monitor that fires every iteration is spam. Notify on *transitions* — the value crossed a threshold, the status changed — and remember the last state in `$DESKTAP_STORAGE`. See the [disk space alert](#disk-space-alert-threshold-notification) recipe.

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
  - A **startup script** is stopped, removed, or replaced (Stop in the agent's *Running Scripts* window, the script edited or cleared, a config delivery that changed it).
  - A **tap script** is still running and you save the button in the editor.

Re-pressing a button whose tap script is still running does **not** start a second copy — the tap is rejected until the first one exits (the button flashes red). Each `(button, slot)` — tap, long-press, startup — holds at most one process.

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

### Startup scripts (live widgets)

Every button has an optional **Startup Script** (button editor → *Startup Script* section). It is a shell script the **agent launches automatically when your device connects** and keeps running, with no timeout, until the device disconnects. It applies to every button on every page of every profile — the page does not have to be visible. This is the mechanism for live widgets: instead of tapping a button to "start" a monitor, the widget is simply live whenever your phone is paired.

A typical startup script is a loop:

```bash
# CPU load every 5s
ub() {
  curl -s -m 5 http://localhost:9848/api/update-button \
    -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" \
    -d "$1" >/dev/null
}
refresh() {
  LOAD=$(sysctl -n vm.loadavg | awk '{print $2}')
  ub "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"CPU|$LOAD\"}"
}
refresh                    # show a value right after connect
while true; do
  sleep 5
  refresh
done
```

Lifecycle:

- **Connect** → all startup scripts start (in parallel). **Disconnect** → all are killed (`SIGTERM`, then `SIGKILL` after 2 s — clean up in a `TERM` trap that ends with `exit`, see [Process timeout](#process-timeout)).
- **Editing** the script (in the editor or via MCP) restarts only that script; **clearing** it stops it. Other edits to the button leave the running script alone.
- **Exit 0** means "done" — the script is not restarted. **Non-zero exit** or an external kill is treated as a failure: the agent restarts it with backoff (5, 10, 20, 40, 60 s, up to 5 attempts), then marks it *Failed*. A script that ran for at least a minute before failing gets its attempt counter reset. The agent's *Running Scripts* window shows each script's state with **Stop** and **Restart**; the button editor has a **Restart Startup Script** button. A *Failed* script also gets one fresh attempt on the next config sync from the phone (any save in the editor).
- The tap script stays free for **interaction** and has its own 60-second timeout. Recommended split: the startup script *renders* (read state → `update-button` → sleep), the tap script *changes state* (write a file to `$DESKTAP_STORAGE`, then exit) — the loop picks it up on its next tick. Do not have both update the same button's overlay, or they will overwrite each other.
- Startup scripts start from scratch on every connect, so persist anything that must survive — for timers, the target end-time — in `$DESKTAP_STORAGE`.

The first comment line of a script (`# CPU load every 5s`) is what the *Running Scripts* window shows as its name — always start with one.

### Process timeout

Tap and long-press scripts are killed after **60 seconds**, no exceptions — the whole process group, so child `sleep`/`curl` processes do not survive. Loops, monitors, and anything that must keep running belong in the **startup script**, which has no timeout.

When any script is terminated by the agent — timeout, **Stop Process**, a startup script stopped or replaced, device disconnect — the agent sends `SIGTERM` first and `SIGKILL` **2 seconds** later. Use a `TERM` trap to save state or send a final `reset:true`, and **end the handler with `exit`**:

```bash
cleanup() { ...; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM
```

> **Why `exit` matters.** zsh does not stop the script after a trapped `SIGTERM` — it runs the handler and then *continues the loop* until `SIGKILL` arrives 2 seconds later. Meanwhile the agent has already told the device to clear the overlay. A loop that keeps going can repaint the button with a stale value in that window, and nothing clears it afterwards. `exit` in the handler closes the window; the `EXIT` trap still fires, so cleanup runs exactly once on either path.

> **In-memory state does not survive.** Startup scripts are relaunched from scratch on every device connect (and after an agent restart, on the next connect). For timers and countdowns never rely on an in-memory counter — save the target end-time (epoch seconds) to `$DESKTAP_STORAGE` and compute `remaining = END - NOW` on every iteration.

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

`POST /api/notify` — local notifications with action buttons, see [above](#endpoint-post-apinotify).

The agent also serves three endpoints used by the MCP bridge: `POST /api/execute` (runs any `Command` — see [Security model](#security-model)), `POST /api/deliver` (pushes a config change to the phone for approval) and `POST /api/probe` (approval-gated one-off shell command, see `run_probe`). They are not part of the scripting API and their request shapes may change between releases; scripts should stick to the endpoints documented on this page.

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

Response:
```json
{"connected": true, "config": { "profiles": [ ... ] }}
```

`config` is the full `AppConfig` with all profiles, pages, and cells (each cell has an `id` field — that's the UUID you need). Unlike `/api/update-button`, this endpoint does **not** return `503` without a device: it answers `200` with `"connected": false, "config": null`, so check `connected` before reading `config`.

## Recipe Examples

Every looping example below goes into the button's **Startup Script** field — it starts on connect and runs without a timeout. Use the tap script (Shell Command) for the action you want on press: open the source page, start/stop, refresh now.

> **Tip:** Reset the button when the script is stopped with two traps — `trap cleanup EXIT` and `trap 'cleanup; exit 0' TERM`. `EXIT` alone does not fire when the agent kills the process with SIGTERM, and a `TERM` handler without `exit` lets the loop keep repainting the button for up to 2 seconds after the overlay was cleared. See [Process timeout](#process-timeout).

### Live CPU Usage Monitor

Displays current CPU load (user + system) with color thresholds: green (normal), orange (>50%), red (>80%). Startup script; a good tap action is `launchApp` → Activity Monitor.

```bash
# CPU load every 5s
CELL_ID="{{CELL_ID}}"

update_button() {
  curl -s -m 5 http://localhost:9848/api/update-button \
    -H "Authorization: Bearer $DESKTAP_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

# Reset button on normal exit AND on SIGTERM (sent when the agent stops the script).
# The TERM handler must exit — otherwise the loop keeps running until SIGKILL.
cleanup() { update_button "{\"cellId\":\"$CELL_ID\",\"reset\":true}"; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM

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

Shows the current BTC price in EUR, updated every 60 seconds. Startup script; a good tap action is `openURL` → the CoinGecko page.

```bash
# Bitcoin price in EUR every 60s
CELL_ID="{{CELL_ID}}"

update_button() {
  curl -s -m 5 http://localhost:9848/api/update-button \
    -H "Authorization: Bearer $DESKTAP_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

cleanup() { update_button "{\"cellId\":\"$CELL_ID\",\"reset\":true}"; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM

# Show loading state immediately
update_button "{\"cellId\":\"$CELL_ID\",\"title\":\"Loading...\",\"emoji\":\"₿\"}"

while true; do
  PRICE=$(curl -s -m 10 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur' \
    | python3 -c "import sys,json; print(f'{json.load(sys.stdin)[\"bitcoin\"][\"eur\"]:,.0f}')" 2>/dev/null)
  if [ -n "$PRICE" ]; then
    update_button "{\"cellId\":\"$CELL_ID\",\"title\":\"€$PRICE\",\"emoji\":\"₿\"}"
  fi
  sleep 60
done
```

The script silently skips updates if the API returns an empty response (e.g., rate limit) — the button keeps showing the last known price.

CoinGecko's free API allows ~10-30 requests per minute. The 60-second interval stays well within limits.

### Focus Timer with a "Done" notification

One button, two scripts. The **tap script** starts a 25-minute timer or cancels it; the **startup script** renders the countdown every second and, when time is up, sends a notification whose buttons restart or reset the timer. State lives in one file, so the timer survives reconnects and agent restarts.

**Tap script** (Shell Command):

```bash
# Focus timer: tap starts 25 minutes, tap again cancels
STATE="$DESKTAP_STORAGE/focus_timer"
NOW=$(date +%s)
END=$(cat "$STATE" 2>/dev/null)
if [ -n "$END" ] && [ "$END" -gt "$NOW" ]; then
  rm -f "$STATE"
else
  echo $((NOW + 1500)) > "$STATE"
fi
```

**Startup script:**

```bash
# Focus timer widget — 25-min countdown, notifies when done
api() {
  curl -s -m 5 "http://localhost:9848/api/$1" \
    -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" \
    -d "$2" >/dev/null
}
STATE="$DESKTAP_STORAGE/focus_timer"
LAST=""
show() {                      # send only when the text changed
  [ "$1" = "$LAST" ] && return
  LAST="$1"; api update-button "$2"
}
notify_done() {
  local payload
  payload=$(python3 - "$STATE" <<'PY'
import json, sys
state = sys.argv[1]
print(json.dumps({
  "cellId": "{{CELL_ID}}", "title": "Focus session done",
  "body": "25 minutes are up — take a break.", "targets": ["phone", "mac"],
  "actions": [
    {"id": "again", "title": "Restart 25 min",
     "command": {"shellCommand": {"command": f'echo $(( $(date +%s) + 1500 )) > "{state}"'}}},
    {"id": "reset", "title": "Reset",
     "command": {"shellCommand": {"command": f'rm -f "{state}"'}}},
  ]}))
PY
)
  api notify "$payload"
}
while true; do
  NOW=$(date +%s); END=$(cat "$STATE" 2>/dev/null)
  if [ -z "$END" ]; then
    rm -f "$STATE.notified"
    show idle '{"cellId":"{{CELL_ID}}","title":"Focus|25 min","icon":"timer","color":"#8E8E93"}'
  elif [ "$END" -gt "$NOW" ]; then
    rm -f "$STATE.notified"
    LEFT=$((END - NOW)); COLOR="#30D158"
    [ "$LEFT" -le 300 ] && COLOR="#FF9F0A"
    [ "$LEFT" -le 60 ] && COLOR="#FF453A"
    show "run$LEFT" "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"Focus|$(printf '%02d:%02d' $((LEFT / 60)) $((LEFT % 60)))\",\"icon\":\"timer\",\"color\":\"$COLOR\"}"
  else
    show done '{"cellId":"{{CELL_ID}}","title":"Done!|Tap to restart","icon":"checkmark.circle.fill","color":"#BF5AF2"}'
    if [ ! -f "$STATE.notified" ]; then
      touch "$STATE.notified"      # notify once per session
      notify_done
    fi
  fi
  sleep 1
done
```

Because the notification's actions are ordinary commands that write the same state file, the timer can be restarted from the lock screen or from the Mac's Notification Center without opening Desktap.

### Deploy finished — notification with actions

A tap script that runs a deploy and reports the result with useful buttons. Building the JSON with `python3 json.dumps` keeps dynamic text (commit messages, error output) from breaking the payload.

```bash
# Deploy main and notify with [Open logs] [Rollback]
cd "$HOME/Projects/app" || exit 1
START=$(date +%s)
if ./deploy production > "$DESKTAP_STORAGE/deploy.log" 2>&1; then
  TITLE="Deploy finished"; BODY="main → production in $(( $(date +%s) - START ))s"
else
  TITLE="Deploy FAILED"; BODY=$(tail -n 3 "$DESKTAP_STORAGE/deploy.log")
fi
python3 - "$TITLE" "$BODY" <<'PY' | curl -s -m 5 http://localhost:9848/api/notify \
  -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @- >/dev/null
import json, sys
title, body = sys.argv[1], sys.argv[2]
print(json.dumps({
  "cellId": "{{CELL_ID}}", "title": title, "body": body, "targets": ["phone", "mac"],
  "actions": [
    {"id": "logs", "title": "Open logs",
     "command": {"shellCommand": {"command": "open -a Console \"$DESKTAP_STORAGE/deploy.log\""}}},
    {"id": "rollback", "title": "Rollback", "destructive": True,
     "command": {"shellCommand": {"command": "cd $HOME/Projects/app && ./deploy rollback"}}},
  ]}))
PY
```

### Disk space alert (threshold notification)

A startup script that shows free space on the button and notifies **once** when it drops below 10 GB — and again only after it recovered. The last state is remembered in `$DESKTAP_STORAGE`, so reconnects do not re-fire the alert.

```bash
# Free disk space every 60s, alert below 10 GB
api() {
  curl -s -m 5 "http://localhost:9848/api/$1" \
    -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" \
    -d "$2" >/dev/null
}
FLAG="$DESKTAP_STORAGE/disk_low"
while true; do
  FREE_KB=$(df -k / | awk 'NR==2{print $4}')
  FREE_GB=$((FREE_KB / 1024 / 1024))
  if [ "$FREE_GB" -lt 10 ]; then
    api update-button "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"Disk|${FREE_GB} GB\",\"color\":\"#FF453A\"}"
    if [ ! -f "$FLAG" ]; then
      touch "$FLAG"
      PAYLOAD=$(python3 - "$FREE_GB" <<'PY'
import json, sys
print(json.dumps({
  "cellId": "{{CELL_ID}}", "title": "Disk space low",
  "body": f"{sys.argv[1]} GB left on the startup disk.",
  "actions": [
    {"id": "derived", "title": "Clean DerivedData",
     "command": {"shellCommand": {"command": "rm -rf ~/Library/Developer/Xcode/DerivedData"}}},
    {"id": "storage", "title": "Storage settings",
     "command": {"openURL": {"url": "x-apple.systempreferences:com.apple.settings.Storage"}}},
  ]}))
PY
)
      api notify "$PAYLOAD"
    fi
  else
    api update-button "{\"cellId\":\"{{CELL_ID}}\",\"title\":\"Disk|${FREE_GB} GB\",\"color\":\"#30D158\"}"
    rm -f "$FLAG"
  fi
  sleep 60
done
```

### Pomodoro Timer (cross-button)

Two buttons work together — a **Start/Stop** control button and a **Timer** display button that shows the countdown. The control button's script updates both itself and the timer button. This example keeps the older "one script per press" style to show cross-button updates; for a version that is always live and controllable from a notification, combine it with the [Focus Timer](#focus-timer-with-a-done-notification) pattern.

The script saves the **target end-time** (epoch seconds) to `$DESKTAP_STORAGE` and computes the remaining time on every iteration. This way the timer survives an agent restart or a device reconnect — without it, a script that gets restarted would silently reset the countdown to its starting value.

**Setup:**
1. Create two buttons side by side
2. Copy the timer display button's UUID (from the button editor)
3. Paste the script below into the **control button's Startup Script**
4. Replace `TIMER_BUTTON` with the display button's UUID
5. Keep the control button's tap script empty or use it to delete the state file (stop)

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

# Clean up on exit OR termination (SIGTERM is sent before SIGKILL after 2s).
# The TERM handler exits explicitly: without it the loop would keep repainting
# the timer button until SIGKILL — and nothing clears that button afterwards.
cleanup() {
  rm -f "$STATE_FILE"
  update_button "{\"cellId\":\"$CONTROL_BUTTON\",\"reset\":true}"
  update_button "{\"cellId\":\"$TIMER_BUTTON\",\"reset\":true}"
}
trap cleanup EXIT
trap 'cleanup; exit 0' TERM

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
- **Connect** → the startup script saves `END_TIME = NOW + 25 min` to `$DESKTAP_STORAGE` (or resumes a saved one), starts the countdown, control button shows "Stop".
- **Stop** (Stop in the agent's Running Scripts window, or a tap script that deletes the state file) → `trap` fires, resets both buttons.
- **Device reconnect mid-countdown** → the agent relaunches the script on connect. The new instance reads the saved `END_TIME` and resumes from the correct remaining time, no user action needed.
- **Agent restart mid-countdown** → same thing on the next connect: the state file persists, the script resumes from the correct remaining time.
- **Work phase ends** → switches to a 5-minute break and updates the state file; control button shows "Skip".
- **Break ends** → timer shows "Done!", state file is deleted, both buttons reset.

This demonstrates the key cross-button patterns:
- One script controlling multiple buttons via their UUIDs
- Persistent state in `$DESKTAP_STORAGE` so timers survive restarts
- Cleanup via `trap cleanup EXIT` + `trap 'cleanup; exit 0' TERM` (SIGTERM is sent before SIGKILL — see [Process timeout](#process-timeout))

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
| `get_available_actions`   | Returns the full schema of supported command types, icons, grid sizes, env vars, the runtime API contract, startup-script lifecycle, and the notification endpoint. **Call this first** — its output is the canonical reference and stays in sync with the agent. |
| `get_profiles`            | List all profiles                                          |
| `get_profile_detail`      | Read a full profile with pages and buttons (UUIDs included) |
| `create_full_profile`     | Create a complete profile with pages and buttons in one call |
| `create_full_page`        | Create a complete page with buttons in one call            |
| `update_button_by_uuid`   | Modify a single button by its UUID (any field, including `startupScript`) |
| `update_buttons_by_uuid`  | Batch-modify multiple buttons in one operation             |
| `get_installed_apps`      | List installed apps (for the `openApp` action)             |
| `get_active_app`          | Identify the currently focused app                         |
| `get_available_shortcuts` | List user-defined shortcuts available to bind              |
| `run_probe`               | Execute a one-off shell command on the Mac. **Off by default** — enable *Allow probe commands* in the agent window first; every call then asks for approval on the iPhone. While disabled the tool returns `Probe commands are disabled in Agent settings.` |

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
| Script times out | Tap and long-press scripts are killed after 60 s. Move loops and monitors into the **Startup Script** |
| Unknown field error | Only use: `cellId`, `title`, `icon`, `emoji`, `color`, `reset` |
| Startup script lost state after reconnect | Startup scripts restart from scratch on every connect. Save state (e.g. timer end-time) to `$DESKTAP_STORAGE` — see the [Focus Timer recipe](#focus-timer-with-a-done-notification) |
| Startup script shows *Failed* in Running Scripts | It exited non-zero five times in a row. Check its stderr (the agent's Dev Log), fix, then **Restart**. Any config sync from the phone (saving any button, not just this one) also gives a failed script one fresh attempt |
| Widget stopped updating | The script may have exited with status 0 (not restarted by design) or the device reconnected in the middle of a request. Check Running Scripts; make sure the loop never falls through to `exit 0` |
| No notification appears on the phone | Notifications were denied for Desktap — enable them in iOS Settings → Desktap. Also check the `delivered` field in the `/api/notify` response: `queued` means no device was connected |
| No notification appears on the Mac | `"mac":"denied"` in the response — allow notifications for Desktap Agent in System Settings → Notifications. Buttons hidden? Switch the agent's style from *Banners* to *Alerts* |
| Tapping a notification action does nothing | The command runs on the Mac, so the phone must reach the agent: bring Desktap to the foreground and let it reconnect — the action is queued for up to 10 minutes. On the Mac, check the agent log for the command's error |
| `/api/notify` returns 400 | Only `title` is required; at most 4 actions with unique `id`s; only the documented fields are accepted |
| Dynamic JSON breaks intermittently | Shell interpolation of values containing quotes/backslashes/non-ASCII produces invalid JSON. Use the `python3 -c "import json; print(json.dumps(...))"` pattern from [JSON safety](#json-safety-with-dynamic-strings) |
| Overlay stuck after script | Send `reset: true` to clear, or terminate the process from iOS |
| Cleanup never runs on stop | A bare `trap ... EXIT` does not fire on SIGTERM. Add `trap 'cleanup; exit 0' TERM` so the handler runs when the agent terminates the process |
| Button shows a stale value after Stop | The `TERM` handler did not `exit`, so the loop repainted the button after the overlay was cleared. End the handler with `exit 0` — see [Process timeout](#process-timeout) |
| `python3: command not found` | Modern macOS doesn't bundle `python3`. Install it with `xcode-select --install`, or replace the example with `jq` (`brew install jq`). See [Tooling note](#tooling-note) |
| Token leaked or committed accidentally | Treat the token like an SSH key — it grants full local code execution via `/api/execute`. Rotate it immediately: see [Rotating the token](#rotating-the-token) |
