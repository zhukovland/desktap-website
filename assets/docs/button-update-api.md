<!-- version: 1.1.1 -->
<!-- updated: 2026-09-17 -->

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
- [SVG faces (vector widgets)](#svg-faces-vector-widgets)
  - [A first face](#a-first-face)
  - [The svg object](#the-svg-object)
  - [How the face lives on the button](#how-the-face-lives-on-the-button)
  - [How animation works](#how-animation-works)
  - [Authoring techniques](#authoring-techniques)
  - [Supported SVG subset](#supported-svg-subset)
  - [Orientation and landscapeSource](#orientation-and-landscapesource)
  - [Validation and feedback](#validation-and-feedback)
  - [Performance budget](#performance-budget)
  - [Working with an AI assistant](#working-with-an-ai-assistant)
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
  - [CPU ring (1x1 SVG face)](#cpu-ring-1x1-svg-face)
  - [Memory gauge (1x2 SVG face with a landscape variant)](#memory-gauge-1x2-svg-face-with-a-landscape-variant)
  - [Network speed with a scrolling sparkline (2x1)](#network-speed-with-a-scrolling-sparkline-2x1)
  - [System dashboard (2x2 SVG face)](#system-dashboard-2x2-svg-face)
  - [Analog clock (2x2 SVG face)](#analog-clock-2x2-svg-face)
- [MCP (Model Context Protocol)](#mcp-model-context-protocol)
- [Troubleshooting](#troubleshooting)

## Overview

When Desktap Agent is running, it listens on `http://localhost:9848`. Your shell scripts can send HTTP requests to temporarily change a button's title, icon, emoji, or color — or replace the whole button face with an animated vector drawing (see [SVG faces](#svg-faces-vector-widgets)) — without modifying the saved configuration.

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
| `reset`  | Boolean | No       | Set to `true` to clear all overrides (including an SVG face) |
| `svg`    | Object  | No       | Replace the whole button face with a vector drawing the phone animates between frames: `{source, landscapeSource, duration, easing, fit, remove}`. See [SVG faces](#svg-faces-vector-widgets) |

**Only these fields are accepted.** Any unknown field — at the top level or inside `svg` — returns a `400` error.

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
- `"Unknown field(s): foo, bar. Valid fields: cellId, title, icon, emoji, color, reset, svg; inside svg: source, landscapeSource, duration, fit, easing, remove."`
- `"Invalid color format. Expected #RRGGBB."`
- `"svg.source rejected: …"` and the other `svg.*` messages listed under [Validation and feedback](#validation-and-feedback)

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

## SVG faces (vector widgets)

Everything above changes the *plain* face of a button: a title, an icon or emoji, a color. An **SVG face** replaces the whole button surface with a drawing — a ring, a gauge, bars, a sparkline, a clock, a heatmap — and the phone **animates the drawing between the frames you send**. You never render animation yourself: send a frame whenever the data changes, and the button glides from the previous frame to the new one.

![A deck of live widgets drawn as SVG faces: a system dashboard, an analog clock, a network sparkline, a CPU ring, a memory gauge, next to a plain Deploy button](assets/docs/svg/gallery.svg)

All faces above are single frames straight from the generators in the [recipes](#recipe-examples), shown next to a plain button for scale.

Use a plain face when the widget answers *what* or *whether* (a name, a state, a short value, an action). Use an SVG face when it answers *how much* or *how it changes* (a level, a share, progress, a trend, several values at once, or a shape whose geometry carries the meaning — clock hands, a needle, a compass).

### A first face

Paste this into a button's **Shell Command**. It draws a 72 % ring with the value in the middle — the ring color comes from the button's own accent color via `currentColor`:

```bash
SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle id="track" cx="100" cy="100" r="78" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="16"/>
  <circle id="ring" cx="100" cy="100" r="78" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round"
          stroke-dasharray="490.09 490.09" stroke-dashoffset="137.22" transform="rotate(-90 100 100)"/>
  <text id="value" x="100" y="116" font-size="56" font-weight="bold" text-anchor="middle" fill="#FFFFFF">72</text>
  <text id="label" x="100" y="146" font-size="26" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">cpu %</text>
</svg>'

python3 -c 'import json,sys; print(json.dumps({"cellId": sys.argv[1], "svg": {"source": sys.argv[2], "duration": 0.6}}))' "{{CELL_ID}}" "$SVG" \
  | curl -s -m 5 http://localhost:9848/api/update-button \
      -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @-
```

Tap the button: the icon and label disappear and the ring appears. Send the same document again with a different `stroke-dashoffset` and the ring *moves* to the new value over 0.6 s instead of jumping — that is the whole idea. To go back to the plain face send `{"cellId":"…","svg":{"remove":true}}` or `{"cellId":"…","reset":true}`.

> **JSON safety:** an SVG document is full of quotes, so never splice it into JSON with shell string interpolation. Build the body with `python3 … json.dumps` (as above) or `jq -n --arg`, and post it with `curl -d @-`. See [JSON safety with dynamic strings](#json-safety-with-dynamic-strings).

### The svg object

`svg` is an object inside the usual `/api/update-button` body. It can be combined with `title`, `icon`, `emoji` and `color` in the same request. Every field is optional; a field that is absent keeps its current value.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `source` | String | — | A complete `<svg>` document (UTF-8 text, **≤ 64 KB**). Installs a new frame. Omit it to change only the settings below of the face that is already showing |
| `landscapeSource` | String | — | The same frame laid out for the *transposed* cell the button gets when the phone is rotated. Needed for rectangular buttons (2×1, 1×2), see [Orientation](#orientation-and-landscapesource). Sent together with `source`; a new `source` without it drops the previous landscape frame |
| `duration` | Number | `0.4` | Seconds the transition to this frame takes: interpolation when the structure matches the previous frame, cross-fade otherwise. `0` applies the frame instantly. Range `0…10` |
| `easing` | String | `"easeInOut"` | Timing curve of the glide. `easeInOut` for a value settling on a new state (a ring moving to 72 %); `linear` for continuous motion fed by a stream of frames (a ticker, a spinner, a scrolling chart), where each new frame must pick up the glide at constant speed |
| `fit` | String | `"contain"` | How the `viewBox` maps onto the button. `contain` keeps the whole drawing visible and letterboxes when the aspect differs; `cover` fills the button and clips; `stretch` fills the button and distorts |
| `remove` | Boolean | — | `true` removes the face: the button shows its plain title/icon/color again (including any overrides you set earlier). Other fields in the same request still apply |

Settings stick to the face: once you have sent `"easing":"linear"` you do not need to repeat it with every frame — only `source` (and `landscapeSource`) change per frame. A settings-only request (`{"svg":{"duration":1}}`) when no face is installed is ignored.

Values inside `svg` are validated like the other fields: an unknown key returns `400` with `Unknown field(s): svg.foo …`, a `source` without `<svg` or larger than 64 KB returns `400`, and — this is the useful part — the agent **parses the frame with the same parser the phone uses** before forwarding it. A frame the phone could not draw is rejected with `400` and a reason, and a frame that uses unsupported elements is accepted with a `warnings` array (see [Validation and feedback](#validation-and-feedback)). Always read the response of your *first* frame while developing a widget.

### How the face lives on the button

- The SVG face is an overlay like every other runtime update: it is kept in memory on the phone, survives the end of your script, and is cleared by the same events — `reset:true`, the process being *terminated* (Running Scripts, iOS process management, config delivery), saving the button in the editor, disconnect, app restart. See [Overlay persistence](#overlay-persistence).
- While a face is installed the button's icon, emoji and title are hidden, not lost. `color` still matters: it is the button's accent, and every `currentColor` in your SVG resolves to it. So `{"color":"#FF453A","svg":{"source":…}}` recolors all `currentColor` strokes in one request, and a startup script that paints a ring in `currentColor` follows the color the user picked for the button.
- The face is drawn over the glass card; the drawing's background is transparent unless you draw one.
- `200` means the agent forwarded the frame, not that it is on screen: frames for buttons on a page the user is not looking at are stored and drawn the moment that page opens. The phone keeps only the latest frame per hidden button, so a hidden widget costs nothing while it is off screen.
- Tap, long-press and startup scripts of one button share the same face. Let the startup loop own the drawing; a tap should change *state* (write a file to `$DESKTAP_STORAGE`) and let the loop render it on the next iteration.

### How animation works

The phone does not animate SVG itself — there is no `<animate>`, no CSS. Instead it compares every new frame with the one currently shown:

1. **Structure.** Each frame is reduced to a *structure key*: which elements it has, in which order, their `id`s and kinds, the sequence of path commands (`M`, `L`, `C`, `Z`) in each path, whether each fill and stroke is a color, `none` or `currentColor`, and how many dash lengths each stroke has. **Text content is deliberately not part of the structure.**
2. **Numbers.** Everything else is a number: coordinates and path points, `rx`/`ry`, colors (as RGBA components), `opacity`, `fill-opacity`, `stroke-opacity`, `stroke-width`, `stroke-dasharray` lengths, `stroke-dashoffset`, `font-size`, text position, and every `transform` (as pivot, translation, rotation, scale and shear rather than a raw matrix).
3. **Same structure → glide.** If the new frame has the same structure key, the phone interpolates all the numbers from the old frame to the new one over `duration` with the chosen `easing`, redrawing at up to 30 fps while the glide runs and not at all once it is at rest. Text swaps instantly to the new content while the shapes around it keep moving — a label going from `42%` to `43%` does not cross-fade.
4. **Different structure → cross-fade.** If anything structural changed (an element appeared, a path got one more segment, a stroke went from a color to `none`), the new frame fades in over `duration` on top of the old one.
5. **A frame arriving mid-glide** does not jump: the glide restarts from wherever the drawing currently is and heads for the new frame. With `easing:"linear"` and a `duration` slightly *longer* than your frame interval this produces motion at constant speed with no stops — the right setting for tickers, spinners and scrolling charts. With `easeInOut` keep `duration` *shorter* than the interval so each value settles before the next one arrives.
6. **Rotations take the short way.** A hand going from 350° to 10° turns +20°, not −340°, and a needle drawn with `transform="rotate(a cx cy)"` stays rigid and on its axis while it turns: the pivot is constant between frames and only the angle moves.

![The same ring frame sent with three different values: the arc and its color glide from one value to the next, the number swaps instantly](assets/docs/svg/ring-glide.svg)

*Three frames of one ring, nothing but the numbers changed: the arc and its color glide, the label swaps.*

The practical consequence is one rule: **generate every frame from a template with a fixed element structure and change only the numbers and the text.** Give animated elements an `id` so they are matched by name, keep elements in the same order, keep the same number of points in every polyline and the same command letters in every path.

### Authoring techniques

**Rings and progress arcs.** Draw a *full* circle and animate its dash offset — this moves exactly along the circle and keeps the structure fixed. Do not draw arcs with `A` path commands: an arc is converted to a different number of curve segments depending on its angle, so two frames end up with different structures and cross-fade instead of gliding.

```
C = 2πr                         # circumference
stroke-dasharray  = "C C"
stroke-dashoffset = C · (1 − fraction)
transform         = "rotate(-90 cx cy)"   # start at 12 o'clock
```

For `r = 78`: `C = 490.09`; 72 % → `stroke-dashoffset = 137.22` (the ring in the first example).

**Bars and gauges.** A `<rect>` whose `width` (horizontal) or `y` and `height` (vertical, growing upwards) change. Keep a fixed `rx` for rounded ends.

**Needles, hands, compasses.** One element with `transform="rotate(angle cx cy)"`; change only `angle`.

**Colors that follow the value.** A color is numbers too, so `stroke="#34C759"` → `stroke="#FF453A"` glides through the intermediate hues. If you want the button's accent, use `currentColor`.

**Fading elements in and out.** Do not add or remove elements between frames (that changes the structure). Keep them and animate `opacity` between `0` and `1`.

**A time series must scroll, not morph.** If you shift the samples by one slot and send the series again, the phone interpolates point *i* from its old value to its new value — every point moves vertically and the chart wobbles like liquid. Instead move the whole chart sideways:

- Keep `N + 1` samples; the newest sits in a slot just *outside* the right edge of the `viewBox`.
- Wrap the polyline/area/dot in `<g id="scroll" transform="translate(0 0)">`.
- Per new sample send **two frames**: a *rest* frame with the re-indexed points and `translate(0 0)` with `duration: 0.01` (it looks identical to the end of the previous slide), then a *slide* frame with the same points and `translate(-step 0)`, `easing: "linear"`, and `duration` equal to your loop's **measured** period (sampling + generation + sleep — for example 2.12 s, not 2).
- A slightly early next frame only snaps the unfinished fraction of the slide, which is invisible; a `duration` shorter than the period leaves a pause at the end of every step and reads as jerky.

![A network sparkline scrolling to the left at constant speed while the value stays put](assets/docs/svg/sparkline-scroll.svg)

*The scroll pattern: the chart moves as a whole, points never change height while moving.*

The [Network sparkline recipe](#network-speed-with-a-scrolling-sparkline-2x1) shows the complete pattern.

**Text.** One `<text>` element is one run — no `tspan`, no wrapping; use several elements for several lines. `x`/`y` is the baseline. `text-anchor` (`start`, `middle`, `end`), `font-size`, `font-weight` (`regular`, `medium`/`500`, `semibold`/`600`, `bold`/`700+`) and `fill` are honored; the font is always the system font.

**Layout and sizes.** Match the `viewBox` aspect to the cell or the drawing is letterboxed. The face is scaled to the button, so text must not end up smaller than the standard button label (11–13 pt on the phone):

| Button size | viewBox | Scale on iPhone | Room for | Minimum font-size |
|-------------|---------|-----------------|----------|-------------------|
| 1×1 | `0 0 200 200` | ≈ ×0.42 | one value with a ring, gauge or disc and one short label | 26 (values 56–64) |
| 2×1 | `0 0 400 200` | ≈ ×0.42 | value + label on the left, sparkline or bars on the right; two values side by side; a ticker | 26 |
| 1×2 | `0 0 200 400` | ≈ ×0.42 | a vertical gauge or bar with the value below | 26 |
| 2×2 | `0 0 200 200` | ≈ ×0.88 | rich widgets: ring + value + secondary bar + sparkline, a clock, a 4×4 tile heatmap, five labeled bars | 16 (labels), 22+ (values) |

Pick the size from the content: one number → 1×1; number + trend → 2×1; more than two pieces of information → 2×2. Never squeeze a 2×2 design into a 1×1 — the text becomes unreadable.

**Generators, not inline XML.** Put the drawing code in `$DESKTAP_STORAGE/scripts/` as a small Python script that prints the SVG for given values, and keep the button's script to sampling + `json.dumps` + `curl -d @-`. Long XML in shell quotes is fragile, and the same generator serves the tap script, the startup loop and the landscape variant. Scripts run under **zsh**: an unquoted `$VAR` is *not* word-split, so use `read -r a b c <<< "$LINE"` rather than `set -- $LINE`.

### Supported SVG subset

The phone renders a deliberate subset of SVG 1.1. Anything outside it is either ignored (with a warning from the API) or rejected.

| Category | Supported |
|----------|-----------|
| Root | `<svg viewBox="…">` (or `width`/`height` as a fallback). `xmlns` optional |
| Elements | `g`, `path`, `rect` (with `rx`/`ry`), `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text` |
| Paths | All `d` commands, absolute and relative: `M L H V C S Q T A Z`. Arcs and quadratic curves are converted to cubics |
| Paint | `fill`, `stroke`, `none`, `currentColor` (= the button's accent color), `inherit` |
| Colors | `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, common named colors |
| Stroke | `stroke-width`, `stroke-linecap` (`butt`/`round`/`square`), `stroke-linejoin` (`miter`/`round`/`bevel`), `stroke-dasharray`, `stroke-dashoffset` |
| Opacity | `opacity` (multiplies down the tree), `fill-opacity`, `stroke-opacity` |
| Transforms | `transform` on any element, including groups: `translate`, `scale`, `rotate` (with and without a center), `skewX`, `skewY`, `matrix`. Groups are flattened at parse time |
| Text | one run per `<text>`: `x`, `y`, `text-anchor`, `font-size`, `font-weight`, paint and opacity |
| Style | presentation attributes and the inline `style="fill:…; stroke:…"` attribute (style wins). Attributes inherit from groups |
| Units | plain numbers, `px`, `pt` |

**Not supported** — ignored together with their children, reported in `warnings`: `defs`, `linearGradient`, `radialGradient`, `pattern`, `mask`, `clipPath`, `filter`, `symbol`, `marker`, `style` (CSS), `script`. Unknown elements such as `image`, `use` and `tspan` are also ignored (a `tspan`'s characters still count toward its parent `<text>`, but it cannot be positioned). Use flat fills instead of gradients, several `<text>` elements instead of `tspan`, and frames instead of `<animate>`.

### Orientation and landscapeSource

The deck rotates with the device: in landscape the whole grid turns 90°, so every cell is transposed — a wide 2×1 button becomes a tall 1×2 and vice versa; 1×1 and 2×2 stay square. A plain face simply reflows. An SVG frame has a fixed `viewBox`, so a `400×200` drawing letterboxed into a tall cell shrinks to half its size and its text drops below the standard label.

For every **rectangular** widget send `landscapeSource` with each frame: the same data laid out for the transposed shape (`2×1` → a `200×400` frame, `1×2` → a `400×200` frame — "value left, sparkline right" becomes "value on top, sparkline below"). The phone keeps both variants, draws whichever `viewBox` aspect is closer to the cell it is in, and cross-fades on rotation. Each variant follows the fixed-structure rule within itself, so both keep gliding. Square widgets do not need it. If you cannot provide a landscape layout, prefer a square button over a rectangular one.

If `landscapeSource` fails to parse, the agent rejects the request (`400`, message prefixed `landscapeSource:`) and nothing changes on the phone.

### Validation and feedback

The agent validates `svg` before forwarding:

**Error (400)** — the request is rejected, the phone is not touched:

- `Unknown field(s): svg.foo. Valid fields: cellId, title, icon, emoji, color, reset, svg; inside svg: source, landscapeSource, duration, fit, easing, remove.`
- `svg.source must be an <svg> document.`
- `svg.source is too large (max 64 KB).`
- `svg.duration must be within 0...10 seconds.`
- `svg.source rejected: XML error at line 3, column 41: unescaped '&' or '<' in text or attribute (write &amp; and &lt;)` — malformed XML; the reason names the usual culprits (unclosed tags, unquoted attributes, `&` in text, a document cut short)
- `svg.source rejected: svg needs a viewBox (or width/height)`
- `svg.source rejected: The document draws nothing (no supported elements inside <svg>)`
- `svg.source rejected: path: …` — a `d` attribute the path parser could not read
- the same messages prefixed with `landscapeSource:` for the landscape frame

**Success with warnings (200)** — the frame was forwarded, but parts of it will not render:

```json
{"status": "ok", "warnings": ["Ignored unsupported elements and their children: linearGradient, defs. Gradients, masks, clips, filters, CSS and animation are not rendered; use flat fills and drive motion by sending frames."]}
```

A plain `{"status":"ok"}` means the whole drawing is supported. Check the first frame's response while developing a widget and fix the drawing until the warnings are gone.

### Performance budget

Every frame is parsed on the phone and interpolated at up to 30 fps while a glide is running; a face at rest costs nothing. Keep the whole profile under roughly **10 frames per second in total**:

- 1 frame/s only for things that must tick — clocks, timers, tickers, level meters.
- 2–5 s for system metrics; send a frame **only when the value changed** (compare with the last one).
- Prefer a few 2×2 widgets over many 1×1 rings updating every second.
- Frames every 1–3 s with `duration` 0.4–0.8 s look smooth.

Frames are small (a ring is ~600 bytes, a 2×2 dashboard ~2 KB), so bandwidth is never the limit; the phone's CPU and battery are. On the Mac a frame costs one `python3` plus one `curl`; avoid `top` for sampling (≈ 1.3 CPU-seconds per call) — use `iostat`, `vm_stat`, `sysctl`.

### Working with an AI assistant

If you build widgets through the MCP integration, you do not need to mention SVG at all: the assistant reads the same rules from `get_available_actions` (`widgetFaces` and the `svg` field description) and picks an SVG face whenever the content is a level, a share, progress, a trend or several values. Describe the content — "CPU load with the last minute as a trend", "a countdown ring for the pomodoro" — and check the first frame's API response in its script.

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

SVG faces have their own budget — every frame is parsed and animated on the phone — see [Performance budget](#performance-budget).

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

### CPU ring (1x1 SVG face)

A ring that fills with CPU load, a big percentage in the middle, a frame every 2 seconds. The ring color follows the load (green → orange → red) and glides between values.

Save the generator once (tap script of any button, or Terminal):

```bash
mkdir -p "$DESKTAP_STORAGE/scripts"
cat > "$DESKTAP_STORAGE/scripts/cpu_ring.py" << 'PY'
import math, sys
cpu = max(0.0, min(100.0, float(sys.argv[1])))
color = "#34C759" if cpu < 50 else ("#FF9F0A" if cpu < 80 else "#FF453A")
r = 78
circ = 2 * math.pi * r
offset = circ * (1 - cpu / 100)
print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle id="track" cx="100" cy="100" r="{r}" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="16"/>
  <circle id="ring" cx="100" cy="100" r="{r}" fill="none" stroke="{color}" stroke-width="16" stroke-linecap="round"
          stroke-dasharray="{circ:.2f} {circ:.2f}" stroke-dashoffset="{offset:.2f}" transform="rotate(-90 100 100)"/>
  <text id="value" x="100" y="116" font-size="56" font-weight="bold" text-anchor="middle" fill="#FFFFFF">{cpu:.0f}</text>
  <text id="label" x="100" y="146" font-size="26" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">cpu %</text>
</svg>''')
PY
```

Startup script of the button:

```bash
# CPU ring — a frame every 2 s, only the numbers change between frames
GEN="$DESKTAP_STORAGE/scripts/cpu_ring.py"
post() { curl -s -m 5 http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @- >/dev/null; }
cleanup() { printf '{"cellId":"{{CELL_ID}}","reset":true}' | post; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM
LAST=""
while true; do
  CPU=$(iostat -c 2 -w 1 2>/dev/null | tail -1 | awk '{printf "%.0f", 100-$(NF-3)}'); [ -z "$CPU" ] && CPU=0
  if [ "$CPU" != "$LAST" ]; then   # send a frame only when the value changed
    python3 "$GEN" "$CPU" \
      | python3 -c 'import json,sys; print(json.dumps({"cellId": sys.argv[1], "svg": {"source": sys.stdin.read(), "duration": 0.6}}))' "{{CELL_ID}}" \
      | post
    LAST="$CPU"
  fi
  sleep 2
done
```

The structure never changes — same three elements, same ids — so every frame glides: the dash offset moves along the circle, the stroke color shifts through the intermediate hues, and the number swaps instantly.

### Memory gauge (1x2 SVG face with a landscape variant)

A vertical gauge that fills from the bottom, the percentage and "used of total" below. Because the button is rectangular it sends a second layout for landscape, where the same cell becomes 2×1 and the gauge lies horizontally.

```bash
mkdir -p "$DESKTAP_STORAGE/scripts"
cat > "$DESKTAP_STORAGE/scripts/mem_gauge.py" << 'PY'
import sys
used, total, mode = float(sys.argv[1]), max(1.0, float(sys.argv[2])), sys.argv[3]
pct = min(100.0, used / total * 100)
color = "#34C759" if pct < 50 else ("#FF9F0A" if pct < 80 else "#FF453A")
sub = f"{used/2**30:.1f} of {total/2**30:.0f} GB"
if mode == "portrait":   # 1×2 cell, viewBox 200×400: gauge x 60..140, y 60..300, fills upwards
    h = 240 * pct / 100
    print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400">
  <text id="label" x="100" y="40" font-size="28" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">memory</text>
  <rect id="track" x="60" y="60" width="80" height="240" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
  <rect id="fill" x="60" y="{300 - h:.1f}" width="80" height="{max(h, 48):.1f}" rx="24" fill="{color}"/>
  <text id="value" x="100" y="352" font-size="56" font-weight="bold" text-anchor="middle" fill="#FFFFFF">{pct:.0f}%</text>
  <text id="sub" x="100" y="384" font-size="26" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">{sub}</text>
</svg>''')
else:                    # the same cell in landscape is 2×1, viewBox 400×200: gauge fills to the right
    w = 320 * pct / 100
    print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <text id="label" x="40" y="50" font-size="26" fill="#FFFFFF" fill-opacity="0.6">memory</text>
  <rect id="track" x="40" y="70" width="320" height="56" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
  <rect id="fill" x="40" y="70" width="{max(w, 48):.1f}" height="56" rx="24" fill="{color}"/>
  <text id="value" x="40" y="176" font-size="44" font-weight="bold" fill="#FFFFFF">{pct:.0f}%</text>
  <text id="sub" x="360" y="176" font-size="26" text-anchor="end" fill="#FFFFFF" fill-opacity="0.6">{sub}</text>
</svg>''')
PY
```

Startup script:

```bash
# Memory gauge — every 5 s, portrait + landscape frame in one request
GEN="$DESKTAP_STORAGE/scripts/mem_gauge.py"
post() { curl -s -m 5 http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @- >/dev/null; }
cleanup() { printf '{"cellId":"{{CELL_ID}}","reset":true}' | post; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM
TOTAL=$(sysctl -n hw.memsize)
while true; do
  PAGE=$(sysctl -n hw.pagesize)
  USED=$(vm_stat | awk -v p="$PAGE" '/Pages (active|wired down|occupied by compressor)/ {gsub("\\.", "", $NF); s += $NF} END {print s * p}')
  python3 -c 'import json,subprocess,sys
gen, cell, used, total = sys.argv[1:5]
frame = lambda mode: subprocess.check_output(["python3", gen, used, total, mode], text=True)
print(json.dumps({"cellId": cell, "svg": {"source": frame("portrait"), "landscapeSource": frame("landscape"), "duration": 0.8}}))' \
    "$GEN" "{{CELL_ID}}" "$USED" "$TOTAL" | post
  sleep 5
done
```

### Network speed with a scrolling sparkline (2x1)

Download speed as a big number with the last 12 samples as a sparkline that *scrolls* to the left — the two-frame `rest` + `slide` pattern from [Authoring techniques](#authoring-techniques). The chart keeps 13 points: the newest lives in a slot just outside the right edge of the viewBox and slides into view.

```bash
mkdir -p "$DESKTAP_STORAGE/scripts"
cat > "$DESKTAP_STORAGE/scripts/net_spark.py" << 'PY'
import sys
bps, hist, phase = float(sys.argv[1]), sys.argv[2], sys.argv[3]        # phase: rest | slide
h = [max(0.0, float(v)) for v in hist.split(",") if v.strip()] or [bps]
h = ([h[0]] * (13 - len(h)) + h)[-13:]                                   # 12 visible slots + 1 entering
top = max(h) or 1.0
step = 16.0                                                              # slots 0..11 span x 212..388; slot 12 sits at 404, outside the 400-wide viewBox
pts = [(212 + i * step, 150 - v / top * 110) for i, v in enumerate(h)]
line = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
area = f"M {212 - step:.1f} 160 L {212 - step:.1f} {pts[0][1]:.1f} " + " ".join(f"L {x:.1f} {y:.1f}" for x, y in pts) + f" L {pts[-1][0]:.1f} 160 Z"
shift = -step if phase == "slide" else 0
human = f"{bps/1048576:.1f} MB/s" if bps >= 1048576 else f"{bps/1024:.0f} KB/s"
print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <text id="value" x="20" y="96" font-size="52" font-weight="bold" fill="#FFFFFF">{human}</text>
  <text id="label" x="20" y="136" font-size="28" fill="#FFFFFF" fill-opacity="0.6">download</text>
  <g id="scroll" transform="translate({shift:.2f} 0)">
    <path id="area" d="{area}" fill="currentColor" fill-opacity="0.18"/>
    <polyline id="line" points="{line}" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle id="dot" cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="7" fill="currentColor"/>
  </g>
</svg>''')
PY
```

Startup script — one sample every 2 s, two frames per sample:

```bash
# Network sparkline — rest frame (instant) + slide frame (linear, one loop period long)
GEN="$DESKTAP_STORAGE/scripts/net_spark.py"
IFACE=en0
post() { curl -s -m 5 http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @- >/dev/null; }
frame() {   # $1 = phase, $2 = duration
  python3 "$GEN" "$BPS" "$HIST" "$1" \
    | python3 -c 'import json,sys; print(json.dumps({"cellId": sys.argv[1], "svg": {"source": sys.stdin.read(), "duration": float(sys.argv[2]), "easing": "linear"}}))' "{{CELL_ID}}" "$2" \
    | post
}
cleanup() { printf '{"cellId":"{{CELL_ID}}","reset":true}' | post; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM
HIST=""
PREV=$(netstat -ibn | awk -v i="$IFACE" '$1==i && $3 ~ /</ {print $7; exit}')
while true; do
  sleep 2
  NOW=$(netstat -ibn | awk -v i="$IFACE" '$1==i && $3 ~ /</ {print $7; exit}')
  BPS=$(( (NOW - PREV) / 2 )); PREV=$NOW
  HIST="${HIST:+$HIST,}$BPS"; HIST=$(echo "$HIST" | awk -F, '{s=(NF>13)?NF-12:1; for(i=s;i<=NF;i++) printf "%s%s", $i, (i<NF?",":"")}')
  frame rest 0.01     # re-indexed points, translate(0 0): looks exactly like the end of the previous slide
  frame slide 2.15    # translate(-16 0) over the measured loop period (2 s sleep + sampling + two frames ≈ 2.15 s)
done
```

Measure the real period of your loop (sleep + sampling + generation) and use it as the slide `duration`: too short leaves a pause at the end of every step, slightly too long is invisible because the next `rest` frame snaps the remaining fraction. This widget is 2×1, so for a phone that rotates add a `landscapeSource` with the value on top and the chart below — the [Memory gauge recipe](#memory-gauge-1x2-svg-face-with-a-landscape-variant) shows how to send both frames in one request.

### System dashboard (2x2 SVG face)

Four things on one button: a CPU ring with the value inside, a memory bar, and the last 12 CPU samples as a sparkline that scrolls. This is the flagship shape for a 2×2 face — several values read together, every frame structurally identical to the previous one.

![System dashboard: CPU ring at 42 %, memory bar at 63 %, scrolling CPU sparkline](assets/docs/svg/system2x2.svg)

Generator — save it once:

```bash
mkdir -p "$DESKTAP_STORAGE/scripts"
cat > "$DESKTAP_STORAGE/scripts/system_frame.py" << 'PY'
# system_frame.py <cpu %> <mem %> <history: up to 13 cpu samples, comma-separated> [rest|slide]
import math, sys
cpu = max(0.0, min(100.0, float(sys.argv[1])))
mem = max(0.0, min(100.0, float(sys.argv[2])))
hist = [max(0.0, min(100.0, float(v))) for v in sys.argv[3].split(",") if v.strip()] if len(sys.argv) > 3 else []
hist = ([hist[0]] * (13 - len(hist)) + hist)[-13:] if hist else [cpu] * 13   # 12 visible slots + 1 entering
phase = sys.argv[4] if len(sys.argv) > 4 else "rest"

circ = 2 * math.pi * 56
offset = circ * (1 - cpu / 100)
color = "#34C759" if cpu < 50 else ("#FF9F0A" if cpu < 80 else "#FF453A")
step = 64 / 12                      # slots 0..11 span x 140..198.7; slot 12 sits at 204, outside the viewBox
pts = " ".join(f"{140 + i * step:.1f},{110 - v * 0.8:.1f}" for i, v in enumerate(hist))
shift = -step if phase == "slide" else 0
bar_w = 150 * mem / 100
print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle id="track" cx="72" cy="74" r="56" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="12"/>
  <circle id="ring" cx="72" cy="74" r="56" fill="none" stroke="{color}" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="{circ:.2f} {circ:.2f}" stroke-dashoffset="{offset:.2f}" transform="rotate(-90 72 74)"/>
  <text id="cpu" x="72" y="82" font-size="26" font-weight="bold" text-anchor="middle" fill="#FFFFFF">{cpu:.0f}%</text>
  <text id="cpu-label" x="72" y="100" font-size="14" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">cpu</text>
  <g id="scroll" transform="translate({shift:.2f} 0)">
    <polyline id="spark" points="{pts}" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
  <text id="mem-label" x="20" y="148" font-size="16" fill="#FFFFFF" fill-opacity="0.7">memory</text>
  <text id="mem" x="180" y="148" font-size="16" font-weight="bold" text-anchor="end" fill="#FFFFFF">{mem:.0f}%</text>
  <rect id="mem-track" x="20" y="158" width="160" height="10" rx="5" fill="#FFFFFF" fill-opacity="0.15"/>
  <rect id="mem-bar" x="20" y="158" width="{max(bar_w, 10):.1f}" height="10" rx="5" fill="#BF5AF2"/>
</svg>''')
PY
```

Startup script — one sample per loop, two frames per sample (`rest`, then `slide`):

```bash
# System dashboard — CPU via iostat (cheap), memory via vm_stat, sparkline scrolls one slot per sample
GEN="$DESKTAP_STORAGE/scripts/system_frame.py"
post() { curl -s -m 5 http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @- >/dev/null; }
send() {   # $1 cpu  $2 mem  $3 history  $4 phase  $5 duration
  python3 "$GEN" "$1" "$2" "$3" "$4" \
    | python3 -c 'import json,sys; print(json.dumps({"cellId": sys.argv[1], "svg": {"source": sys.stdin.read(), "duration": float(sys.argv[2]), "easing": "linear"}}))' "{{CELL_ID}}" "$5" \
    | post
}
cleanup() { printf '{"cellId":"{{CELL_ID}}","reset":true}' | post; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM
TOTAL=$(sysctl -n hw.memsize); PAGE=$(sysctl -n hw.pagesize); HIST=""
while true; do
  CPU=$(iostat -c 2 -w 1 2>/dev/null | tail -1 | awk '{printf "%.0f", 100-$(NF-3)}'); [ -z "$CPU" ] && CPU=0
  MEM=$(vm_stat | awk -v t="$TOTAL" -v p="$PAGE" '/Pages (active|wired down|occupied by compressor)/ {gsub("\\.", "", $NF); s += $NF} END {printf "%.0f", s * p / t * 100}')
  HIST="${HIST:+$HIST,}$CPU"; HIST=$(echo "$HIST" | awk -F, '{s=(NF>13)?NF-12:1; for(i=s;i<=NF;i++) printf "%s%s", $i, (i<NF?",":"")}')
  send "$CPU" "$MEM" "$HIST" rest 0.01    # re-indexed points at translate(0): identical to the end of the last slide
  send "$CPU" "$MEM" "$HIST" slide 2.12   # one slot to the left over the measured loop period (1 s sleep + ~1.1 s sampling)
  sleep 1
done
```

Only the ring's dash offset, its color, the memory bar width, the sparkline points and the group translation change between frames; the ring color glides through orange to red as the load rises. `iostat -c 2 -w 1` itself takes about a second, which is why the slide duration is 2.12 s and not 1 s — measure your own loop before choosing the number.

### Analog clock (2x2 SVG face)

Three hands driven by `transform="rotate(angle cx cy)"`, one frame per second. The phone interpolates the *angle* around the fixed pivot, so the hands stay rigid and the second hand takes the short way past 12 o'clock instead of spinning backwards. With `easing: "linear"` and a duration a little longer than one second the second hand sweeps continuously; with the default `easeInOut` and `duration: 1` it ticks like a mechanical watch.

![Analog clock face with hour, minute and second hands and the date below](assets/docs/svg/clock2x2.svg)

```bash
mkdir -p "$DESKTAP_STORAGE/scripts"
cat > "$DESKTAP_STORAGE/scripts/clock_face.py" << 'PY'
# clock_face.py <hour> <minute> <second> <date label>
import math, sys
h, m, s, label = int(sys.argv[1]) % 12, int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
ha, ma, sa = h * 30 + m * 0.5, m * 6 + s * 0.1, s * 6
def tick(a):
    big = a % 90 == 0
    r1, r2 = 72, 62 if big else 66
    return (f'<line x1="{100 + r1 * math.sin(math.radians(a)):.1f}" y1="{88 - r1 * math.cos(math.radians(a)):.1f}" '
            f'x2="{100 + r2 * math.sin(math.radians(a)):.1f}" y2="{88 - r2 * math.cos(math.radians(a)):.1f}" '
            f'stroke="#FFFFFF" stroke-opacity="{0.9 if big else 0.35}" stroke-width="{4 if big else 2}" stroke-linecap="round"/>')
ticks = "\n  ".join(tick(a) for a in range(0, 360, 30))
print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="88" r="78" fill="#FFFFFF" fill-opacity="0.06"/>
  {ticks}
  <line id="hour" x1="100" y1="88" x2="100" y2="48" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" transform="rotate({ha:.1f} 100 88)"/>
  <line id="minute" x1="100" y1="88" x2="100" y2="30" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" transform="rotate({ma:.1f} 100 88)"/>
  <line id="second" x1="100" y1="100" x2="100" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" transform="rotate({sa} 100 88)"/>
  <circle cx="100" cy="88" r="5" fill="currentColor"/>
  <text id="date" x="100" y="188" font-size="18" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.7">{label}</text>
</svg>''')
PY
```

Startup script:

```bash
# Analog clock — one frame per second, the second hand sweeps
GEN="$DESKTAP_STORAGE/scripts/clock_face.py"
post() { curl -s -m 5 http://localhost:9848/api/update-button \
  -H "Authorization: Bearer $DESKTAP_TOKEN" -H "Content-Type: application/json" -d @- >/dev/null; }
cleanup() { printf '{"cellId":"{{CELL_ID}}","reset":true}' | post; }
trap cleanup EXIT
trap 'cleanup; exit 0' TERM
while true; do
  read -r H M S <<< "$(date '+%H %M %S')"
  python3 "$GEN" "$H" "$M" "$S" "$(date '+%a, %b %e')" \
    | python3 -c 'import json,sys; print(json.dumps({"cellId": sys.argv[1], "svg": {"source": sys.stdin.read(), "duration": 1.05, "easing": "linear"}}))' "{{CELL_ID}}" \
    | post
  sleep 1
done
```

The second hand and the center dot use `currentColor`, so they take whatever accent color the button has — change it with a plain `{"color":"#FF453A"}` update and the hands follow.

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
| Unknown field error | Only use: `cellId`, `title`, `icon`, `emoji`, `color`, `reset`, `svg` (inside `svg`: `source`, `landscapeSource`, `duration`, `fit`, `easing`, `remove`) |
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
| `svg.source rejected: XML error at line …` | The frame is not well-formed XML. The reason names the usual cause: an unescaped `&` or `<` in text (write `&amp;`/`&lt;`), an unclosed tag, an unquoted attribute, a document cut short by a shell quoting problem. Print the generator's output to a file and inspect that line |
| SVG frame accepted with `warnings` | The listed elements (gradients, `defs`, `image`, `tspan`, CSS…) are not rendered on the phone. Use flat fills, several `<text>` elements instead of `tspan`, and frames instead of `<animate>`. See [Supported SVG subset](#supported-svg-subset) |
| Face blinks / cross-fades instead of gliding | The two frames have different structures: an element appeared or disappeared, a path changed its command sequence (arcs drawn with `A` do this as the angle changes), a polyline changed its point count, or a paint went from a color to `none`. Keep the structure fixed and change only numbers; drive rings with `stroke-dashoffset`, hide elements with `opacity="0"`. See [How animation works](#how-animation-works) |
| Sparkline "wobbles" vertically | You shifted the samples and re-sent them, so every point interpolates to its neighbour's value. Scroll the chart instead: `rest` + `slide` frames on a `<g transform="translate(…)">` — see [Authoring techniques](#authoring-techniques) |
| Scrolling chart pauses at every step | The `slide` duration is shorter than the loop's real period. Measure the period (sleep + sampling + generation) and use it as the duration; slightly too long is invisible |
| Text on the face is tiny | The `viewBox` does not match the cell aspect (letterboxing), or the design is too dense for the size. Use 200×200 for 1×1/2×2, 400×200 for 2×1, 200×400 for 1×2, and font-size ≥ 26 on 1×1/2×1, ≥ 16 on 2×2. See [Authoring techniques](#authoring-techniques) |
| Face shrinks when the phone rotates | The button is rectangular and the frame has no `landscapeSource`. Send a second layout for the transposed cell with every frame, or use a square button. See [Orientation and landscapeSource](#orientation-and-landscapesource) |
| Face stays after the script stopped | Like every overlay it persists until `reset:true`, `svg.remove:true`, termination, a save in the editor or a disconnect. Send `reset:true` from the script's `TERM`/`EXIT` handlers |
| `svg` settings request does nothing | A request with `duration`/`easing`/`fit` but no `source` only adjusts a face that is already installed; send `source` first |
