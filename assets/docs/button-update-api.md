<!-- version: 1.2 -->
<!-- updated: 2026-09-20 -->

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
  - [A face saved in the button](#a-face-saved-in-the-button)
  - [The svg object](#the-svg-object)
  - [How the face lives on the button](#how-the-face-lives-on-the-button)
  - [How animation works](#how-animation-works)
  - [Authoring techniques](#authoring-techniques)
  - [Supported SVG subset](#supported-svg-subset)
  - [Gradients and icons from design tools](#gradients-and-icons-from-design-tools)
  - [Orientation and landscapeSource](#orientation-and-landscapesource)
  - [Validation and feedback](#validation-and-feedback)
  - [Previewing a face without the phone](#previewing-a-face-without-the-phone)
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
  - [Setup](#setup)
  - [The widget skill](#the-widget-skill)
  - [MCP tools](#mcp-tools)
  - [Config delivery and approval](#config-delivery-and-approval)
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
2. Tap an empty cell in the grid to add a new button. The editor opens on the list of actions.
3. Choose **Shell Command** (under *Scripts*). Back in the editor, tap the **Command** row, paste your script and tap **Done**. This is the **tap** script: it runs when you press the button and is killed after **60 seconds**.
4. *(For live widgets)* Tap **Advanced**, then **Write Script** under *Startup Script*, paste the loop and tap **Done**. A startup script is started by the agent as soon as your device connects and keeps running — no timeout — until the device disconnects. It can belong to a button of *any* action type — a button that only shows information uses **No Action** as its action. See [Startup scripts (live widgets)](#startup-scripts-live-widgets).
5. *(Optional)* Under *Appearance*, set a default name, icon or emoji, and color for the button. Runtime API updates layer on top of these defaults; sending `reset:true` returns the button to exactly what you configured here.
6. Tap **Add**.

On iOS 26, **Done** and **Add** are the ✓ in the top-right corner of the editor, and **Cancel** is the ✕.

The tap script runs when you tap the button; the startup script is already running. Changes you make via the API appear immediately — no reload needed.

> **Shell:** all Shell Command actions are executed with `/bin/zsh -c "<your script>"` — not with the user's `$SHELL`. zsh-compatible scripts work as-is; bash-only constructs (e.g. `shopt`, `mapfile`, certain `read -a` forms) need to be rewritten or wrapped with `bash -c '...'`. A script that **starts with a shebang** (`#!/bin/bash`, `#!/usr/bin/env python3`, …) is the exception: the agent writes it to a temporary file and runs it directly, so the shebang picks the interpreter. `{{CELL_ID}}`, the environment variables, the timeout and process handling work exactly the same; a missing interpreter is reported as an error that quotes the shebang line.

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

Paste this as the **Command** of a Shell Command button. When pressed, the button updates its own title, emoji, and color.

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

Open the button editor in the Desktap iOS app — **Advanced › Button ID** shows the full UUID in monospaced text and provides a **Copy** button that puts it on the iOS clipboard. Tap it once and you can paste the UUID into another button's script via the system keyboard. You can also fetch the full configuration via `GET /api/config` and look for the `id` field in the cell you want to update.

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

<!-- Anchor used by the iOS app (EditorHelpLinks in the MacroDeck repo): do not rename this heading. -->

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
  - A **tap script** is still running and you save a change to the button in the editor.

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

To update another button, use its UUID as the `cellId`. You can find button UUIDs via `GET /api/config` or in the button editor in the iOS app (Advanced › Button ID). See the [Pomodoro Timer](#pomodoro-timer-cross-button) recipe for a full example.

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

<!-- Anchor used by the iOS app (EditorHelpLinks in the MacroDeck repo): do not rename this heading. -->

### Startup scripts (live widgets)

Every button has an optional **Startup Script** (button editor → *Advanced* › *Startup Script*). It is a shell script the **agent launches automatically when your device connects** and keeps running, with no timeout, until the device disconnects. It applies to every button on every page of the **active profile** — the page does not have to be visible. Switching profiles stops the scripts of the previous profile and starts those of the new one. This is the mechanism for live widgets: instead of tapping a button to "start" a monitor, the widget is simply live whenever your phone is paired.

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
- **Saving a changed button** in the editor restarts its startup script and clears the button's overlay, even when the script itself did not change. **Save with no changes** just closes the editor and restarts nothing — to restart on purpose, use *Advanced* › **Restart Startup Script**. A change made via MCP restarts only the scripts that changed; **clearing** the field stops the script.
- **Exit 0** means "done" — the script is not restarted. **Non-zero exit** or an external kill is treated as a failure: the agent restarts it with backoff (5, 10, 20, 40 s, then every 60 s) and **never gives up**: after five failures in a row the script is shown as *Failed* (the button gets a warning badge), but it is still retried every 60 s. A script that ran for at least a minute before failing gets its attempt counter reset. The agent's *Running Scripts* window shows each script's state with **Stop** and **Restart**; the button editor has **Restart Startup Script** under *Advanced*. A *Failed* script also gets one fresh attempt on the next config sync from the phone (any saved change in the editor).
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

<!-- Anchor used by the iOS app (EditorHelpLinks in the MacroDeck repo): do not rename this heading. -->

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

Tap the button: the icon and label disappear and the ring appears. Send the same document again with a different `stroke-dashoffset` and the ring *moves* to the new value over 0.6 s instead of jumping — that is the whole idea. To take the face off send `{"cellId":"…","svg":{"remove":true}}` or `{"cellId":"…","reset":true}` — the button returns to what is saved in it: its icon and label, or its [saved SVG face](#a-face-saved-in-the-button) if it has one.

> **JSON safety:** an SVG document is full of quotes, so never splice it into JSON with shell string interpolation. Build the body with `python3 … json.dumps` (as above) or `jq -n --arg`, and post it with `curl -d @-`. See [JSON safety with dynamic strings](#json-safety-with-dynamic-strings).

### A face saved in the button

A frame sent through the API is temporary: it lives in the phone's memory and needs a script to put it there. A button can also **keep an SVG face in its own settings** — no script, no API call. It is drawn over the whole button instead of the icon and label, is saved with the profile, and syncs through iCloud like every other button setting.

![Three buttons: a rocket drawn as a saved SVG face; an empty grey ring saved as the start state of a widget; the same ring at 72 % as a live frame](assets/docs/svg/static-face.svg)

**In the app.** Open the button editor and go to **Icon › SVG Drawing**:

- **SVG Document** — type the document, tap **Paste**, or tap **Import from File…** to pick an `.svg` from Files; replacing a document you already have asks first. The file's *content* is copied into the button (up to 64 KB); the file itself is not referenced, so the button looks the same on every device the profile syncs to.
- **Scaling** — *Fit* (`contain`), *Fill* (`cover`) or *Stretch*, the same three modes as the API's `fit`.
- **Landscape Variant** — offered for 2×1 and 1×2 buttons only, for the same reason as [`landscapeSource`](#orientation-and-landscapesource).
- The preview at the top of the screen draws the face with the real renderer. A document that cannot be drawn shows the line and the reason, and **Save** stays disabled; anything the renderer ignores (a drop shadow, a CSS class, `<use>` — see the [supported subset](#supported-svg-subset)) is listed under the document, so an imported file never just looks wrong without telling you why. An icon exported from Figma or another design tool can usually be used as it is — see [Gradients and icons from design tools](#gradients-and-icons-from-design-tools).
- The **button name** stays: it is not drawn, but VoiceOver reads it and AI tools see it.
- The **icon** stays too and can still be changed on the Icon screen: the button shows it when the drawing is removed or cannot be drawn. **Remove SVG Drawing** turns the drawing off.

`currentColor` resolves to the button's color, so a drawing made with `currentColor` follows the color picker in the editor.

**With a live widget.** Live frames always draw *on top of* the saved face and never change it. That makes the saved face the widget's resting state:

- it is on screen from the moment the app opens, before the startup script has sent anything — instead of an icon that is about to be replaced;
- when frames stop — `svg.remove`, `reset:true`, a terminated script, a disconnect — the button falls back to the saved face, not to the icon and label;
- if the saved face has the **same structure** as the frames the script sends (same elements, ids and path commands — see [How animation works](#how-animation-works)), the first live frame *glides* out of it: an empty grey ring fills up to the current value instead of cross-fading from a picture.

The recipe is to save one frame of your own template with neutral numbers. For the ring from [A first face](#a-first-face) that is the same document with `stroke-dashoffset="490.09"` (nothing filled), a grey `stroke`, and `–` for the value.

Do not save a face for anything that changes over time — a saved face is a picture, and keeping it current is what live frames are for.

**Through MCP.** Every tool that creates or updates a button takes three more parameters: `svgFace` (the document), `svgFaceLandscape` and `svgFaceFit`. In update tools an omitted `svgFace` keeps the current face and an empty string removes it (the icon and label come back). The document is parsed before the change is offered to the phone: an invalid one fails the call with the line and the reason, and ignored parts come back as warnings in the tool result. `get_profile_detail` returns the same three fields. See [MCP tools](#mcp-tools).

### The svg object

`svg` is an object inside the usual `/api/update-button` body. It can be combined with `title`, `icon`, `emoji` and `color` in the same request. Every field is optional; a field that is absent keeps its current value.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `source` | String | — | A complete `<svg>` document (UTF-8 text, **≤ 64 KB**). Installs a new frame. Omit it to change only the settings below of the face that is already showing |
| `landscapeSource` | String | — | The same frame laid out for the *transposed* cell the button gets when the phone is rotated. Needed for rectangular buttons (2×1, 1×2), see [Orientation](#orientation-and-landscapesource). Sent together with `source`; a new `source` without it drops the previous landscape frame |
| `duration` | Number | `0.4` | Seconds the transition to this frame takes: interpolation when the structure matches the previous frame, cross-fade otherwise. `0` applies the frame instantly. Range `0…10` |
| `easing` | String | `"easeInOut"` | Timing curve of the glide. `easeInOut` for a value settling on a new state (a ring moving to 72 %); `linear` for continuous motion fed by a stream of frames (a ticker, a spinner, a scrolling chart), where each new frame must pick up the glide at constant speed |
| `fit` | String | `"contain"` | How the `viewBox` maps onto the button. `contain` keeps the whole drawing visible and letterboxes when the aspect differs; `cover` fills the button and clips; `stretch` fills the button and distorts |
| `remove` | Boolean | — | `true` removes the face: the button shows its [saved SVG face](#a-face-saved-in-the-button) if it has one, otherwise its plain title/icon/color again (including any overrides you set earlier). Other fields in the same request still apply |

Settings belong to the face that is currently installed, and that face can disappear at any moment — a `reset` from another script, `svg.remove`, a terminated tap process, a saved change in the editor. The next frame then starts from the defaults again. So **send `duration`, `easing` and `fit` with every frame** (it costs a few bytes) and do not rely on them sticking. A settings-only request (`{"svg":{"duration":1}}`) adjusts the installed face and is ignored when there is none.

Values inside `svg` are validated like the other fields: an unknown key returns `400` with `Unknown field(s): svg.foo …`, a `source` without `<svg` or larger than 64 KB returns `400`, and — this is the useful part — the agent **parses the frame with the same parser the phone uses** before forwarding it. A frame the phone could not draw is rejected with `400` and a reason, and a frame in which *anything* was ignored — an unsupported element, an unsupported attribute, a value the parser could not read — is accepted with a `warnings` array that names each case (see [Validation and feedback](#validation-and-feedback)). Always read the response of your *first* frame while developing a widget.

### How the face lives on the button

- A face sent through the API is an overlay like every other runtime update: it is kept in memory on the phone, survives the end of your script, and is cleared by the same events — `reset:true`, the process being *terminated* (Running Scripts, iOS process management, config delivery), saving a change to the button in the editor, disconnect, app restart. See [Overlay persistence](#overlay-persistence).
- When the overlay is cleared the button shows what is saved in it — its [saved SVG face](#a-face-saved-in-the-button) if it has one, otherwise the icon and label.
- While a face is installed the button's icon, emoji and title are hidden, not lost. `color` still matters: it is the button's accent, and every `currentColor` in your SVG resolves to it. So `{"color":"#FF453A","svg":{"source":…}}` recolors all `currentColor` strokes in one request, and a startup script that paints a ring in `currentColor` follows the color the user picked for the button.
- The face is drawn over the glass card; the drawing's background is transparent unless you draw one.
- `200` means the agent forwarded the frame, not that it is on screen: frames for buttons on a page the user is not looking at are stored and drawn the moment that page opens. The phone keeps only the latest frame per hidden button, so a hidden widget costs the phone next to nothing while it is off screen (the script on the Mac keeps running). That frame is put on screen **at once, without a glide**: what the button last showed is as old as its absence, and gliding from there would replay the missed seconds as a fast-forward. The frames after it glide as usual. The same happens when the app comes back from the background. For a button that *is* on screen, frames are drawn in the order they arrive; if they arrive faster than the phone can show them, only the newest two wait and older ones are dropped — sending faster than the phone draws is wasted.
- Tap, long-press and startup scripts of one button share the same face. Let the startup loop own the drawing; a tap should change *state* (write a file to `$DESKTAP_STORAGE`) and let the loop render it on the next iteration.

### How animation works

The phone does not animate SVG itself — there is no `<animate>`, no CSS. Instead it compares every new frame with the one currently shown:

1. **Structure.** Each frame is reduced to a *structure key*: the **size** of the `viewBox`; which elements it has, in which order, their `id`s and kinds; the sequence of path commands (`M`, `L`, `C`, `Z`) in each path; whether each fill and stroke is a color, `none` or `currentColor`; `stroke-linecap` and `stroke-linejoin`; how many dash lengths each stroke has; and for text its `font-weight`, `text-anchor` and `dominant-baseline`. **Text content is deliberately not part of the structure.**
2. **Numbers.** Everything else is a number: coordinates and path points, `rx`/`ry`, colors (as RGBA components), `opacity`, `fill-opacity`, `stroke-opacity`, `stroke-width`, `stroke-dasharray` lengths, `stroke-dashoffset`, `font-size`, text position, every `transform` (as pivot, translation, rotation, scale and shear rather than a raw matrix), and the **origin** of the `viewBox` — so panning the viewBox between frames glides too.
3. **Same structure → glide.** If the new frame has the same structure key, the phone interpolates all the numbers from the old frame to the new one over `duration` with the chosen `easing`, redrawing at up to 30 fps while the glide runs and not at all once it is at rest. Text swaps instantly to the new content while the shapes around it keep moving — a label going from `42%` to `43%` does not cross-fade.
4. **Different structure → cross-fade.** If anything structural changed (an element appeared, a path got one more segment, a stroke went from a color to `none`), the new frame fades in over `duration` on top of the old one.
5. **A frame arriving mid-glide** does not jump: the glide restarts from wherever the drawing currently is and heads for the new frame. With `easing:"linear"` and a `duration` slightly *longer* than your frame interval this produces motion at constant speed with no stops — the right setting for tickers, spinners and scrolling charts. With `easeInOut` keep `duration` *shorter* than the interval so each value settles before the next one arrives.
6. **Rotations take the short way.** A hand going from 350° to 10° turns +20°, not −340°, and a needle drawn with `transform="rotate(a cx cy)"` stays rigid and on its axis while it turns: the pivot is constant between frames and only the angle moves.

![The same ring frame sent with three different values: the arc and its color glide from one value to the next, the number swaps instantly](assets/docs/svg/ring-glide.svg)

*Three frames of one ring, nothing but the numbers changed: the arc and its color glide, the label swaps.*

The practical consequence is one rule: **generate every frame from a template with a fixed element structure and change only the numbers and the text.** Give animated elements an `id` so they are matched by name, keep elements in the same order, keep the same number of points in every polyline and the same command letters in every path. The structure never depends on the *values* of the numbers: a bar may shrink to zero width, an arc may sweep any angle, a label may be empty — none of that changes it.

### Authoring techniques

**Rings and progress arcs.** Draw a *full* circle and animate its dash offset — the end of the stroke then moves exactly along the circle. An arc drawn with the `A` path command glides too (every arc becomes the same four curve segments, whatever its angle), but its points are interpolated in a straight line, so on a large jump the arc cuts the corner instead of following the circle. Prefer the dash technique for rings and gauges.

```
C = 2πr                         # circumference
stroke-dasharray  = "C C"
stroke-dashoffset = C · (1 − fraction)
transform         = "rotate(-90 cx cy)"   # start at 12 o'clock
```

For `r = 78`: `C = 490.09`; 72 % → `stroke-dashoffset = 137.22` (the ring in the first example).

**Bars and gauges.** A `<rect>` whose `width` (horizontal) or `y` and `height` (vertical, growing upwards) change; it may go all the way down to 0. For rounded ends keep `rx` either zero or non-zero across frames: a rounded rect has more path commands than a sharp one, so switching between the two is a structure change. An open gauge is the ring technique on an arc path: `stroke-dasharray="L L"` and `stroke-dashoffset = L · (1 − fraction)`, with `L` the length of the arc.

**Needles, hands, compasses.** One element with `transform="rotate(angle cx cy)"`; change only `angle`.

**Colors that follow the value.** A color is numbers too, so `stroke="#34C759"` → `stroke="#FF453A"` glides through the intermediate hues. If you want the button's accent, use `currentColor`.

**Fading elements in and out.** Do not add or remove elements between frames (that changes the structure). Keep them and animate `opacity` between `0` and `1` (`display` and `visibility` are not supported). To blank a label send an empty `<text>` — it stays in the structure.

**A time series must scroll, not morph.** If you shift the samples by one slot and send the series again, the phone interpolates point *i* from its old value to its new value — every point moves vertically and the chart wobbles like liquid. Instead move the whole chart sideways:

- Keep `N + 1` samples; the newest sits in a slot just *outside* the right edge of the `viewBox`.
- Wrap the polyline/area/dot in `<g id="scroll" transform="translate(0 0)">`.
- Per new sample send **two frames**: a *rest* frame with the re-indexed points and `translate(0 0)` with `duration: 0.01` (it looks identical to the end of the previous slide), then a *slide* frame with the same points and `translate(-step 0)`, `easing: "linear"`, and `duration` equal to your loop's **measured** period (sampling + generation + sleep — for example 2.12 s, not 2).
- A slightly early next frame only snaps the unfinished fraction of the slide, which is invisible; a `duration` shorter than the period leaves a pause at the end of every step and reads as jerky.

![A network sparkline scrolling to the left at constant speed while the value stays put](assets/docs/svg/sparkline-scroll.svg)

*The scroll pattern: the chart moves as a whole, points never change height while moving.*

The [Network sparkline recipe](#network-speed-with-a-scrolling-sparkline-2x1) shows the complete pattern.

**Text.** One `<text>` element is one run — no `tspan`, no wrapping; use several elements for several lines. By default `x`/`y` is the baseline; `dominant-baseline="middle"` (or `central`) centres the line on `y` — together with `text-anchor="middle"` the easy way to centre a value in a ring — and `hanging` puts the capital tops on `y`. `dx`/`dy` shift the run (numbers or `em`, e.g. `dy=".35em"`). `text-anchor` (`start`, `middle`, `end`), `font-size`, `font-weight` (`regular`, `medium`/`500`, `semibold`/`600`, `bold`/`700+`) and `fill` are honored. The font is always the system font with fixed-width digits, so a changing number does not jitter sideways.

**Layout and sizes.** Match the `viewBox` aspect to the cell or the drawing is letterboxed. The face is scaled to the button, so text must not end up smaller than the standard button label (11–13 pt on the phone):

| Button size | viewBox | Scale on iPhone | Room for | Minimum font-size |
|-------------|---------|-----------------|----------|-------------------|
| 1×1 | `0 0 200 200` | ≈ ×0.42 | one value with a ring, gauge or disc and one short label | 26 (values 56–64) |
| 2×1 | `0 0 400 200` | ≈ ×0.42 | value + label on the left, sparkline or bars on the right; two values side by side; a ticker | 26 |
| 1×2 | `0 0 200 400` | ≈ ×0.42 | a vertical gauge or bar with the value below | 26 |
| 2×2 | `0 0 200 200` | ≈ ×0.88 | rich widgets: ring + value + secondary bar + sparkline, a clock, a 4×4 tile heatmap, five labeled bars | 16 (labels), 22+ (values) |

Pick the size from the content: one number → 1×1; number + trend → 2×1; more than two pieces of information → 2×2. Never squeeze a 2×2 design into a 1×1 — the text becomes unreadable.

**One self-contained script per widget.** Write the widget as a single startup script with a `#!/usr/bin/env python3` shebang: a function that returns the SVG for the current values, `json.dumps` for the request body, `urllib` (or `curl -d @-`) to post it — every [recipe](#recipe-examples) below is built this way. Do **not** keep the drawing code in a separate file under `$DESKTAP_STORAGE/scripts/`: your buttons sync through iCloud to every Mac you pair, but that folder does not, so a button that calls a local file is broken on your other Mac. `$DESKTAP_STORAGE` is for runtime state only. If you do write a widget in shell, remember that scripts without a shebang run under **zsh**: an unquoted `$VAR` is *not* word-split, so use `read -r a b c <<< "$LINE"` rather than `set -- $LINE`.

### Supported SVG subset

The phone renders a deliberate subset of SVG 1.1. Nothing outside it is dropped silently: it is either rejected (`400`) or ignored **and named in the `warnings` of the response**.

| Category | Supported |
|----------|-----------|
| Root | `<svg viewBox="…">` (or `width`/`height` as a fallback). `xmlns` optional |
| Elements | `g`, `path`, `rect` (with `rx`/`ry`), `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text` |
| Paths | All `d` commands, absolute and relative: `M L H V C S Q T A Z`. Arcs and quadratic curves are converted to cubics (an arc always to four). Anything in `d` that is not path data is an error, not a silently shorter path |
| Paint | `fill`, `stroke`, `none`, `currentColor` (= the button's accent color), `inherit` |
| Colors | `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`, `hsl()`/`hsla()`, every CSS color name, `transparent` |
| Stroke | `stroke-width`, `stroke-linecap` (`butt`/`round`/`square`), `stroke-linejoin` (`miter`/`round`/`bevel`), `stroke-dasharray`, `stroke-dashoffset` |
| Opacity | `opacity` (multiplies down the tree), `fill-opacity`, `stroke-opacity` — a number or a percentage, clamped to 0…1 |
| Transforms | `transform` on any element, including groups: `translate`, `scale`, `rotate` (with and without a center), `skewX`, `skewY`, `matrix` — plain numbers only (no `deg`, no `px`); a transform with an unreadable argument is ignored as a whole and reported. Groups are flattened at parse time |
| Text | one run per `<text>`: `x`, `y`, `dx`, `dy` (numbers or `em`), `text-anchor`, `dominant-baseline` (`alphabetic`, `middle`/`central`, `hanging`), `font-size`, `font-weight`, paint and opacity |
| Style | presentation attributes and the inline `style="fill:…; stroke:…"` attribute (style wins). Attributes inherit from groups |
| Units | plain finite decimal numbers, optionally with `px` or `pt`. Percentages and `em` are not lengths (`%` is accepted for opacity, `em` for `dx`/`dy`); `nan`, `inf` and hex are not numbers |
| Gradients | `<linearGradient>` and `<radialGradient>` with `<stop offset stop-color stop-opacity>` (`stop-color` may be `currentColor`), used as `fill="url(#id)"` or `stroke="url(#id)"`; a fallback color after `url()` is honored. `gradientUnits` `objectBoundingBox` (default, coordinates `0…1` or `%`) and `userSpaceOnUse`; `gradientTransform` (a non-uniform scale gives an elliptical radial gradient); `href` / `xlink:href` templates. Gradients may be inside `<defs>` or not, before or after the shapes that use them |
| Fill rule | `fill-rule="evenodd"` — holes in compound paths |
| Clipping | `clip-path="url(#id)"` with a `<clipPath>` of shapes (`userSpaceOnUse`); nested clips intersect. A `<mask>` is approximated as a clip to the outline of its shapes (reported). Nothing is drawn outside the `viewBox`, as with a root `<svg>` in a browser — a sparkline's hidden slot stays hidden |

**Not supported.** Elements ignored together with their children: `filter` (drop shadows and blurs — the shape is drawn without the effect), `pattern`, `symbol`, `marker`, `style` (CSS), `script`; unknown elements such as `image` and `use`. Shapes inside `<defs>` are templates and are not drawn, as in a browser. A `tspan` inside `<text>` only contributes its characters — its own position, size and color are ignored. Not rendered: `class`, `filter`, soft or partly transparent masks, a radial gradient's focal point (`fx`/`fy`), `spreadMethod` `reflect`/`repeat` (the gradient is padded), a gradient on `<text>` (its first stop is used), `clipPathUnits="objectBoundingBox"`, `display`/`visibility` (hide with `opacity="0"`), `transform-origin` (write `rotate(angle cx cy)`), `pathLength` (dash lengths are in user units: a ring of radius r is 2πr long), `letter-spacing`, `textLength`. An unknown keyword (`text-anchor="center"`, `stroke-linecap="rounded"`) keeps the inherited value. **Every one of these is reported in `warnings`.** Use several `<text>` elements instead of `tspan`, and frames instead of `<animate>`.

### Gradients and icons from design tools

An icon exported from Figma, Sketch or Illustrator is ordinary SVG built from the same few things every time: paths with `fill-rule="evenodd"`, linear and radial gradients collected in a `<defs>` block **at the end of the file**, a `clip-path` wrapped around the artboard, sometimes a mask. All of that is drawn, so such a file works as a [saved face](#a-face-saved-in-the-button) or as a frame without editing:

![An icon exported from a design tool — a gradient tile with an even-odd ring and a radial highlight — drawn as a button](assets/docs/svg/figma-icon.svg)

```xml
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#clip0)">
    <rect width="48" height="48" rx="12" fill="url(#paint0_linear)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M24 10C16.268 10 … 16 24 16Z" fill="white"/>
  </g>
  <defs>
    <linearGradient id="paint0_linear" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF5F6D"/>
      <stop offset="1" stop-color="#FFC371"/>
    </linearGradient>
    <clipPath id="clip0"><rect width="48" height="48" fill="white"/></clipPath>
  </defs>
</svg>
```

What to expect from an export:

- **Effects are not drawn.** A drop shadow, a blur or a glow is an SVG `filter`; the shape appears without it and the warning says so. Flatten the effect in the design tool if it matters, or draw the shadow as a second, darker shape.
- **Bitmap fills are not drawn.** An image fill becomes a `<pattern>` with an embedded `<image>`; the shape is left unpainted, with a warning.
- **Masks are approximated.** "Use as mask" with a solid shape works — the content is clipped to the shape's outline. A mask with a soft edge or partial transparency loses those.
- **Text** is best converted to outlines on export ("Outline text"): `<text>` is drawn in the system font, not in the font of the design.
- **`<use>` is not drawn.** Shapes kept in `<defs>` as templates and instanced with `<use>` (Illustrator and Sketch do this for repeated symbols; Figma rarely does) do not appear; the warning names `use`. Expand the instances on export.
- **Keep it light.** A saved face can be up to 64 KB. Export the icon frame alone, without hidden layers.

**Gradients in live frames.** A gradient glides like every other part of a frame when its *structure* matches between frames: the same kind (linear or radial), the same `gradientUnits`, the same number of stops. Then its coordinates, its `gradientTransform` (a rotation takes the shortest arc), and every stop's offset, color and opacity interpolate — a sheen that sweeps across a tile, a fill that warms from blue to red, the area under a sparkline fading to transparent:

```xml
<linearGradient id="area" x1="0" y1="40" x2="0" y2="160" gradientUnits="userSpaceOnUse">
  <stop stop-color="#34C759" stop-opacity="0.5"/>
  <stop offset="1" stop-color="#34C759" stop-opacity="0"/>
</linearGradient>
<path id="fill" d="M20 160 L20 120 L60 90 … L180 160 Z" fill="url(#area)"/>
```

Keep the ids and the stop count fixed and change only numbers.

> **Strokes: use `userSpaceOnUse`.** The default `gradientUnits="objectBoundingBox"` maps the gradient onto the shape's box — and a straight line has none: a horizontal `<line>`, a level line, a sparkline whose samples all became equal. SVG paints nothing in that case; so that a live widget does not blink out, Desktap paints the gradient's **last stop color** instead and reports it in `warnings`. For any stroke that can become straight, write `gradientUnits="userSpaceOnUse"` with coordinates in the `viewBox`, as in the example above.

**Clips glide too.** The points of a `<clipPath>` are numbers like any others: a clip rectangle whose `width` changes reveals a bar smoothly, and a clip on a group that moves travels with it. Keep the clip's shapes the same between frames and change only their numbers. A rotating gradient (`gradientTransform="rotate(angle cx cy)"`) turns around the center you name, by the shortest arc.

A gradient costs more to draw than a flat color, so on a page full of gliding widgets (see [Performance budget](#performance-budget)) use it on the few shapes where it carries the look.

### Orientation and landscapeSource

The deck rotates with the device: in landscape the whole grid turns 90°, so every cell is transposed — a wide 2×1 button becomes a tall 1×2 and vice versa; 1×1 and 2×2 stay square. A plain face simply reflows. An SVG frame has a fixed `viewBox`, so a `400×200` drawing letterboxed into a tall cell shrinks to half its size and its text drops below the standard label.

For every **rectangular** widget send `landscapeSource` with each frame: the same data laid out for the transposed shape (`2×1` → a `200×400` frame, `1×2` → a `400×200` frame — "value left, sparkline right" becomes "value on top, sparkline below"). The phone keeps both variants, draws whichever `viewBox` aspect is closer to the cell it is in, and cross-fades on rotation. Each variant follows the fixed-structure rule within itself, so both keep gliding. Square widgets do not need it. If you cannot provide a landscape layout, prefer a square button over a rectangular one.

**Where a button lands in landscape** is fixed, whichever way the device is turned: landscape column = the button's portrait `row`, landscape row = (portrait columns − 1) − its portrait `col`. So portrait row 0 becomes the **left** edge and portrait column 0 becomes the **bottom** row — a 4×8 iPhone page turns into 8 wide × 4 tall. This matters when one picture spans many buttons of a page meant for landscape: lay the tiles out by this mapping, or the skyline ends up with the street on top.

If `landscapeSource` fails to parse, the agent rejects the request (`400`, `svg.source rejected: landscapeSource: …`) and nothing changes on the phone. Warnings about the landscape frame carry the same `landscapeSource:` prefix.

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
- `svg.source rejected: path: …` — a `d` attribute the path parser could not read, including stray characters after the last command (`Unexpected '#' at offset 12 of the path data`)
- the same messages for the landscape frame, as `svg.source rejected: landscapeSource: …`

**Success with warnings (200)** — the frame was forwarded, but something in it was ignored:

```json
{
  "status": "ok",
  "warnings": [
    "Ignored unsupported elements and their children: filter. Filters (shadows, blurs), patterns, CSS and animation are not rendered; drive motion by sending frames.",
    "fill=\"url(#pattern0)\": no <linearGradient> or <radialGradient> has this id (patterns and images are not supported); the fallback colour after url(), or nothing, is painted.",
    "<rect width=\"50%\">: not a plain finite number and was ignored (units other than px/pt and percentages are not supported).",
    "<text text-anchor=\"center\">: not supported, the inherited value is kept. Supported: start, middle, end."
  ]
}
```

Each warning names the element, the attribute and what to write instead. The same complaint is listed once however many elements repeat it, and after 12 attribute warnings the list ends with `…and N more attribute warning(s) not listed` — fix the ones you see and send the frame again.

A plain `{"status":"ok"}` means nothing was ignored. Check the first frame's response while developing a widget and fix the drawing until the warnings are gone. Inside a startup script the response is easy to lose — its standard output is discarded — so while developing, post one frame by hand (Terminal, a tap script, or `run_probe` over MCP) and read the JSON. Posting needs a connected phone: without one the agent answers `503` before it reports warnings. An AI assistant has a way that needs no phone at all — see the next section.

The agent and the phone app update independently, and each parses frames with its own copy of the parser. Keep both up to date: a phone app older than the agent may not know syntax the agent already accepts.

### Previewing a face without the phone

An assistant connected over MCP can **look at a face before it delivers it**. The `render_preview` tool draws an SVG document with the same engine the phone uses and returns the picture (PNG) together with every parser warning — nothing is sent to the device, no approval is asked, and the phone does not have to be connected.

| Parameter | Meaning |
|---|---|
| `svg` | the complete `<svg>` document (required) |
| `nextFrame` | a later frame of the same widget — another value, the other end of the scale |
| `steps` | how many in-between frames to draw between the two, 0–6 (default 3) |
| `colSpan`, `rowSpan` | the button's size in cells, 1–4; by default it follows the `viewBox` shape (wide → 2×1, tall → 1×2, square → 1×1), so pass both for a 2×2 widget |
| `fit` | `contain` (default), `cover` or `stretch` — the value you will send with the face |
| `color` | the button's accent as `#RRGGBB` — what `currentColor` resolves to |

With `nextFrame` the reply says whether the phone will **glide** between the two frames (same structure) or **cross-fade** (the structure differs — usually a mistake), and when they glide the picture becomes a **storyboard**: the first frame, the in-between frames the phone passes through, the last frame. The in-between frames are computed with the engine's own interpolation — rotations by the shortest arc, every other number blended — so the things a still picture hides show up: a hand that turns the long way round, a shape that collapses halfway, a looping element that flies back across the button. Timing is not shown; `duration` and `easing` only change how fast the same frames go by.

A few properties worth knowing:

- The preview button is about **twice the size** the phone shows. Judge text by the minimum sizes in [Authoring techniques](#authoring-techniques), not by eye.
- Long storyboards wrap into rows (reading order), and the picture never exceeds 2000 px on its long side; when it had to be reduced, the reply says so.
- A `landscapeSource` is previewed by a separate call with that document as `svg`.
- An argument of the wrong type is an error, not a silent fallback — `nextFrame` must be the document itself (a string), not the live API's `{ "source": … }` object.

### Performance budget

What costs on the phone is **gliding**, not frames. While a face glides it is redrawn at up to 30 fps and re-composited by the system; a face at rest costs nothing, and parsing a frame is minor by comparison. So the question is how many visible buttons are gliding *at the same moment*:

- Keep `duration` clearly **shorter than the interval** between frames — a 0.4–0.8 s glide for a frame every 2–5 s — and the face rests most of the time. Dozens of such widgets on a page are fine.
- `duration` ≥ interval (tickers, scrolling charts, spinners, a sweeping second hand) keeps the face gliding **permanently**. Measured on an iPhone 17: a page of 32 continuously gliding 1×1 faces took about three quarters of one CPU core (the app plus the system compositor; debug build) — it works, but it is a stress test, not an always-on page. Count roughly 2–3 % of a core per continuously gliding 1×1 face, more for bigger or busier drawings: a handful per page, not a wall.
- Send a frame **only when the value changed** (compare with the last one), plus a keyframe every 30 s or so in case another script reset the face.
- More than 2–3 frames per second to one button is wasted unless the motion is continuous: the glide already interpolates at 30 fps, and the phone drops frames it cannot show in time.
- 1 frame/s only for things that must tick — clocks, timers, tickers, level meters; 2–5 s for system metrics.

Frames are small (a ring is ~600 bytes, a 2×2 dashboard ~2 KB), so bandwidth is never the limit; the phone's CPU and battery are. On the Mac every widget is a live process: a `python3` or `zsh` loop takes 2–15 MB, while a `#!/usr/bin/swift` script runs in the Swift interpreter at 150–300 MB — use that only when you need a system framework. Avoid `top` for sampling (≈ 1.3 CPU-seconds per call) — use `iostat`, `vm_stat`, `sysctl`.

### Working with an AI assistant

If you build widgets through the [MCP integration](#mcp-model-context-protocol), you do not need to mention SVG at all. Describe what the button should **show**, and the assistant chooses the face:

- a name, an action, a state, or a single number you read as a number — "how much disk space is left" → `412 GB free` — stays a **plain** face: label, icon, color, live text;
- a level or a share you read at a glance — CPU load, battery, progress, the time left of a timer — a trend, or several values together becomes an **SVG** face. The same disk is a number or a ring depending on the question: "how much is left" is a number, "how full is it" is a level.

Say "CPU load with the last minute as a trend" or "a countdown ring for the pomodoro" rather than "make an SVG widget". If the assistant is unsure it builds the plain face first; ask for the chart or the ring and it upgrades the button in one step.

Before delivering an SVG face the assistant can [preview it](#previewing-a-face-without-the-phone) and fix what it sees — overlapping text, a label outside the button, a needle turning the wrong way — so the first version that reaches your phone has already been looked at. The rules it follows come from the agent itself: a short set of instructions sent when the client connects, the reference in `get_available_actions` (`widgetFaces`, with the technical part in `widgetFaces.svgReference`), and — optionally — [the widget skill](#the-widget-skill).

## Reference

<!-- Anchor used by the iOS app (EditorHelpLinks in the MacroDeck repo): do not rename this heading. -->

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

SVG faces have their own budget — what costs is a face that is gliding, not the number of frames — see [Performance budget](#performance-budget).

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
2. Copy the timer display button's UUID (button editor → Advanced › Button ID)
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
A ring that fills with CPU load, a big percentage in the middle, a new value about every two seconds. The ring color follows the load (green → orange → red) and glides between values.

Startup script of the button — the whole widget is this one script:

```python
#!/usr/bin/env python3
# CPU ring — a frame every 2 s, only the numbers change between frames
import atexit, json, math, os, signal, subprocess, sys, time, urllib.error, urllib.request

CELL = "{{CELL_ID}}"
URL = "http://localhost:9848/api/update-button"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # localhost must never go through a system HTTP proxy

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + os.environ["DESKTAP_TOKEN"], "Content-Type": "application/json"})
    try:
        with OPENER.open(req, timeout=5) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:       # 400: the body says what is wrong with the frame
        sys.stderr.write(error.read().decode() + "\n")
    except Exception:                             # agent restarting, no device yet: keep looping
        pass
    return False

atexit.register(lambda: post({"cellId": CELL, "reset": True}))   # back to the saved face (or icon + label) when the script stops
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))            # the agent stops scripts with SIGTERM

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout
R = 78
C = 2 * math.pi * R                     # ring length: the dash pattern is "C C", the offset hides the unfilled part

def cpu():                              # iostat is cheap (top costs over a CPU-second per call); the sample itself takes 1 s
    out = run("iostat", "-c", "2", "-w", "1").split()
    return max(0.0, min(100.0, 100 - float(out[-4]))) if len(out) >= 4 else 0.0

def frame(pct):                         # ONE template: only numbers, the colour value and the label text change
    color = "#34C759" if pct < 50 else "#FF9F0A" if pct < 80 else "#FF453A"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle id="track" cx="100" cy="100" r="{R}" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="16"/>
  <circle id="ring" cx="100" cy="100" r="{R}" fill="none" stroke="{color}" stroke-width="16" stroke-linecap="round"
          stroke-dasharray="{C:.2f} {C:.2f}" stroke-dashoffset="{C * (1 - pct / 100):.2f}" transform="rotate(-90 100 100)"/>
  <text id="value" x="100" y="116" font-size="56" font-weight="bold" text-anchor="middle" fill="#FFFFFF">{pct:.0f}</text>
  <text id="label" x="100" y="146" font-size="26" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">cpu %</text>
</svg>'''

last, sent_at = None, 0.0
while True:
    pct = round(cpu())
    # Send when the value changed, plus a keyframe every 30 s: another script may have reset the face meanwhile.
    if pct != last or time.time() - sent_at > 30:
        if post({"cellId": CELL, "svg": {"source": frame(pct), "duration": 0.6}}):
            last, sent_at = pct, time.time()
    time.sleep(1)
```

The structure never changes — same four elements, same ids — so every frame glides: the dash offset moves along the circle, the stroke color shifts through the intermediate hues, and the number swaps instantly. The script sends a frame only when the value changed, repeats it every 30 s in case another script reset the face, and clears its frame when the agent stops it.

**Start state.** Save this document as the button's [SVG face](#a-face-saved-in-the-button) (Icon › SVG Drawing in the editor, or `svgFace` through MCP). It is the same template with nothing filled, so the button shows a ring from the moment the app opens, the first live frame fills it with a glide, and the ring — not an icon — is what remains when the script stops:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle id="track" cx="100" cy="100" r="78" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="16"/>
  <circle id="ring" cx="100" cy="100" r="78" fill="none" stroke="#8E8E93" stroke-width="16" stroke-linecap="round" stroke-dasharray="490.09 490.09" stroke-dashoffset="490.09" transform="rotate(-90 100 100)"/>
  <text id="value" x="100" y="116" font-size="56" font-weight="bold" text-anchor="middle" fill="#FFFFFF">–</text>
  <text id="label" x="100" y="146" font-size="26" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">cpu %</text>
</svg>
```

### Memory gauge (1x2 SVG face with a landscape variant)
A vertical gauge that fills from the bottom, the percentage and "used of total" below. Because the button is rectangular it sends a second layout for landscape, where the same cell becomes 2×1 and the gauge lies horizontally.

```python
#!/usr/bin/env python3
# Memory gauge — every 5 s, portrait + landscape frame in one request
import atexit, json, math, os, signal, subprocess, sys, time, urllib.error, urllib.request

CELL = "{{CELL_ID}}"
URL = "http://localhost:9848/api/update-button"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # localhost must never go through a system HTTP proxy

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + os.environ["DESKTAP_TOKEN"], "Content-Type": "application/json"})
    try:
        with OPENER.open(req, timeout=5) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:       # 400: the body says what is wrong with the frame
        sys.stderr.write(error.read().decode() + "\n")
    except Exception:                             # agent restarting, no device yet: keep looping
        pass
    return False

atexit.register(lambda: post({"cellId": CELL, "reset": True}))   # back to the saved face (or icon + label) when the script stops
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))            # the agent stops scripts with SIGTERM

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout
def memory():                           # (used, total) in bytes
    total, page, used = int(run("sysctl", "-n", "hw.memsize")), int(run("sysctl", "-n", "hw.pagesize")), 0
    for line in run("vm_stat").splitlines():
        if line.startswith(("Pages active", "Pages wired down", "Pages occupied by compressor")):
            used += int(line.split()[-1].rstrip("."))
    return used * page, max(1, total)

def frame(used, total, landscape):
    pct = min(100.0, used / total * 100)
    color = "#34C759" if pct < 50 else "#FF9F0A" if pct < 80 else "#FF453A"
    sub = f"{used / 2**30:.1f} of {total / 2**30:.0f} GB"
    if not landscape:                   # 1×2 cell, viewBox 200×400: gauge x 60..140, y 60..300, fills upwards
        h = 240 * pct / 100
        return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400">
  <text id="label" x="100" y="40" font-size="28" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">memory</text>
  <rect id="track" x="60" y="60" width="80" height="240" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
  <rect id="fill" x="60" y="{300 - h:.1f}" width="80" height="{h:.1f}" rx="24" fill="{color}"/>
  <text id="value" x="100" y="352" font-size="56" font-weight="bold" text-anchor="middle" fill="#FFFFFF">{pct:.0f}%</text>
  <text id="sub" x="100" y="384" font-size="26" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">{sub}</text>
</svg>'''
    w = 320 * pct / 100                 # the same cell in landscape is 2×1, viewBox 400×200: the gauge fills to the right
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <text id="label" x="40" y="50" font-size="26" fill="#FFFFFF" fill-opacity="0.6">memory</text>
  <rect id="track" x="40" y="70" width="320" height="56" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
  <rect id="fill" x="40" y="70" width="{w:.1f}" height="56" rx="24" fill="{color}"/>
  <text id="value" x="40" y="176" font-size="44" font-weight="bold" fill="#FFFFFF">{pct:.0f}%</text>
  <text id="sub" x="360" y="176" font-size="26" text-anchor="end" fill="#FFFFFF" fill-opacity="0.6">{sub}</text>
</svg>'''

while True:
    used, total = memory()
    post({"cellId": CELL, "svg": {"source": frame(used, total, False), "landscapeSource": frame(used, total, True), "duration": 0.8}})
    time.sleep(5)
```

Both layouts travel in one request, and each keeps its own fixed structure. The rounded bar is allowed to shrink to nothing: the structure of a rounded `<rect>` does not depend on its size.

### Network speed with a scrolling sparkline (2x1)
Download speed as a big number with the last 12 samples as a sparkline that *scrolls* to the left — the two-frame `rest` + `slide` pattern from [Authoring techniques](#authoring-techniques). The chart keeps 13 points: the newest lives in a slot just outside the right edge of the viewBox and slides into view.

Startup script — one sample every 2 s, two frames per sample:

```python
#!/usr/bin/env python3
# Network sparkline — rest frame (instant) + slide frame (linear, one loop period long)
import atexit, json, math, os, signal, subprocess, sys, time, urllib.error, urllib.request

CELL = "{{CELL_ID}}"
URL = "http://localhost:9848/api/update-button"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # localhost must never go through a system HTTP proxy

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + os.environ["DESKTAP_TOKEN"], "Content-Type": "application/json"})
    try:
        with OPENER.open(req, timeout=5) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:       # 400: the body says what is wrong with the frame
        sys.stderr.write(error.read().decode() + "\n")
    except Exception:                             # agent restarting, no device yet: keep looping
        pass
    return False

atexit.register(lambda: post({"cellId": CELL, "reset": True}))   # back to the saved face (or icon + label) when the script stops
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))            # the agent stops scripts with SIGTERM

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout
IFACE = "en0"
STEP = 16.0                             # slots 0..11 span x 212..388; slot 12 sits at 404, outside the 400-wide viewBox

def rx_bytes():
    for line in run("netstat", "-ibn").splitlines():
        f = line.split()
        if len(f) > 6 and f[0] == IFACE and f[2].startswith("<Link"):
            return int(f[6])
    return 0

def frame(bps, hist, slide):
    h = ([hist[0]] * (13 - len(hist)) + hist)[-13:]          # 12 visible slots + 1 entering; padded so the point count never changes
    top = max(h) or 1.0
    pts = [(212 + i * STEP, 150 - v / top * 110) for i, v in enumerate(h)]
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    area = f"M {212 - STEP:.1f} 160 L {212 - STEP:.1f} {pts[0][1]:.1f} " + " ".join(f"L {x:.1f} {y:.1f}" for x, y in pts) + f" L {pts[-1][0]:.1f} 160 Z"
    human = f"{bps / 1048576:.1f} MB/s" if bps >= 1048576 else f"{bps / 1024:.0f} KB/s"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <text id="value" x="20" y="96" font-size="52" font-weight="bold" fill="#FFFFFF">{human}</text>
  <text id="label" x="20" y="136" font-size="28" fill="#FFFFFF" fill-opacity="0.6">download</text>
  <g id="scroll" transform="translate({-STEP if slide else 0:.2f} 0)">
    <path id="area" d="{area}" fill="currentColor" fill-opacity="0.18"/>
    <polyline id="line" points="{line}" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle id="dot" cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="7" fill="currentColor"/>
  </g>
</svg>'''

def send(bps, hist, slide, duration):
    post({"cellId": CELL, "svg": {"source": frame(bps, hist, slide), "duration": duration, "easing": "linear"}})

hist, period = [], 2.1                  # the period is a first guess; from the second loop on it is measured
prev, stamp = rx_bytes(), time.time()
while True:
    started = time.time()
    time.sleep(2)
    now, clock = rx_bytes(), time.time()
    bps = max(0, now - prev) / max(0.001, clock - stamp); prev, stamp = now, clock
    hist = (hist + [bps])[-13:]
    send(bps, hist, False, 0.01)        # re-indexed points at translate(0): looks exactly like the end of the previous slide
    send(bps, hist, True, period)       # one slot to the left over one REAL loop period — the belt never stops
    period = time.time() - started
```

The script measures the real period of its loop (sleep + sampling + two requests) and uses it as the slide `duration`: too short leaves a pause at the end of every step, slightly too long is invisible because the next `rest` frame snaps the remaining fraction. This widget is 2×1, so for a phone that rotates add a `landscapeSource` with the value on top and the chart below — the [Memory gauge recipe](#memory-gauge-1x2-svg-face-with-a-landscape-variant) shows how to send both frames in one request.

### System dashboard (2x2 SVG face)
Four things on one button: a CPU ring with the value inside, a memory bar, and the last 12 CPU samples as a sparkline that scrolls. This is the flagship shape for a 2×2 face — several values read together, every frame structurally identical to the previous one.

![System dashboard: CPU ring at 42 %, memory bar at 63 %, scrolling CPU sparkline](assets/docs/svg/system2x2.svg)

Startup script — one sample per loop, two frames per sample (`rest`, then `slide`):

```python
#!/usr/bin/env python3
# System dashboard — CPU ring, memory bar and a CPU sparkline that scrolls one slot per sample
import atexit, json, math, os, signal, subprocess, sys, time, urllib.error, urllib.request

CELL = "{{CELL_ID}}"
URL = "http://localhost:9848/api/update-button"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # localhost must never go through a system HTTP proxy

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + os.environ["DESKTAP_TOKEN"], "Content-Type": "application/json"})
    try:
        with OPENER.open(req, timeout=5) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:       # 400: the body says what is wrong with the frame
        sys.stderr.write(error.read().decode() + "\n")
    except Exception:                             # agent restarting, no device yet: keep looping
        pass
    return False

atexit.register(lambda: post({"cellId": CELL, "reset": True}))   # back to the saved face (or icon + label) when the script stops
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))            # the agent stops scripts with SIGTERM

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout
C = 2 * math.pi * 56
STEP = 64 / 12                          # slots 0..11 span x 140..198.7; slot 12 sits at 204, outside the viewBox

def cpu():
    out = run("iostat", "-c", "2", "-w", "1").split()
    return max(0.0, min(100.0, 100 - float(out[-4]))) if len(out) >= 4 else 0.0

def memory():
    total, page, used = int(run("sysctl", "-n", "hw.memsize")), int(run("sysctl", "-n", "hw.pagesize")), 0
    for line in run("vm_stat").splitlines():
        if line.startswith(("Pages active", "Pages wired down", "Pages occupied by compressor")):
            used += int(line.split()[-1].rstrip("."))
    return min(100.0, used * page / max(1, total) * 100)

def frame(pct, mem, hist, slide):
    h = ([hist[0]] * (13 - len(hist)) + hist)[-13:]          # 12 visible slots + 1 entering
    color = "#34C759" if pct < 50 else "#FF9F0A" if pct < 80 else "#FF453A"
    pts = " ".join(f"{140 + i * STEP:.1f},{110 - v * 0.8:.1f}" for i, v in enumerate(h))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle id="track" cx="72" cy="74" r="56" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="12"/>
  <circle id="ring" cx="72" cy="74" r="56" fill="none" stroke="{color}" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="{C:.2f} {C:.2f}" stroke-dashoffset="{C * (1 - pct / 100):.2f}" transform="rotate(-90 72 74)"/>
  <text id="cpu" x="72" y="82" font-size="26" font-weight="bold" text-anchor="middle" fill="#FFFFFF">{pct:.0f}%</text>
  <text id="cpu-label" x="72" y="100" font-size="14" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.6">cpu</text>
  <g id="scroll" transform="translate({-STEP if slide else 0:.2f} 0)">
    <polyline id="spark" points="{pts}" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
  <text id="mem-label" x="20" y="148" font-size="16" fill="#FFFFFF" fill-opacity="0.7">memory</text>
  <text id="mem" x="180" y="148" font-size="16" font-weight="bold" text-anchor="end" fill="#FFFFFF">{mem:.0f}%</text>
  <rect id="mem-track" x="20" y="158" width="160" height="10" rx="5" fill="#FFFFFF" fill-opacity="0.15"/>
  <rect id="mem-bar" x="20" y="158" width="{160 * mem / 100:.1f}" height="10" rx="5" fill="#BF5AF2"/>
</svg>'''

def send(pct, mem, hist, slide, duration):
    post({"cellId": CELL, "svg": {"source": frame(pct, mem, hist, slide), "duration": duration, "easing": "linear"}})

hist, period = [], 2.1                  # first guess; measured from the second loop on
while True:
    started = time.time()
    pct, mem = cpu(), memory()          # the iostat sample takes about a second
    hist = (hist + [pct])[-13:]
    send(pct, mem, hist, False, 0.01)   # re-indexed points at translate(0): identical to the end of the last slide
    send(pct, mem, hist, True, period)  # one slot to the left over one real loop period
    time.sleep(1)
    period = time.time() - started
```

Only the ring's dash offset, its color, the memory bar width, the sparkline points and the group translation change between frames; the ring color glides through orange to red as the load rises. `iostat -c 2 -w 1` itself takes about a second, which is why the loop period — and with it the slide duration — comes out at about 2.1 s and not 1 s; the script measures it instead of guessing.

### Analog clock (2x2 SVG face)
Three hands driven by `transform="rotate(angle cx cy)"`, one frame per second. The phone interpolates the *angle* around the fixed pivot, so the hands stay rigid and the second hand takes the short way past 12 o'clock instead of spinning backwards. With `easing: "linear"` and a duration a little longer than one second the second hand sweeps continuously; with the default `easeInOut` and `duration: 1` it ticks like a mechanical watch.

![Analog clock face with hour, minute and second hands and the date below](assets/docs/svg/clock2x2.svg)

```python
#!/usr/bin/env python3
# Analog clock — one frame per second, the second hand sweeps
import atexit, json, math, os, signal, subprocess, sys, time, urllib.error, urllib.request

CELL = "{{CELL_ID}}"
URL = "http://localhost:9848/api/update-button"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # localhost must never go through a system HTTP proxy

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + os.environ["DESKTAP_TOKEN"], "Content-Type": "application/json"})
    try:
        with OPENER.open(req, timeout=5) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:       # 400: the body says what is wrong with the frame
        sys.stderr.write(error.read().decode() + "\n")
    except Exception:                             # agent restarting, no device yet: keep looping
        pass
    return False

atexit.register(lambda: post({"cellId": CELL, "reset": True}))   # back to the saved face (or icon + label) when the script stops
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))            # the agent stops scripts with SIGTERM

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout
def tick(a):
    big = a % 90 == 0
    r1, r2 = 72, 62 if big else 66
    return (f'<line x1="{100 + r1 * math.sin(math.radians(a)):.1f}" y1="{88 - r1 * math.cos(math.radians(a)):.1f}" '
            f'x2="{100 + r2 * math.sin(math.radians(a)):.1f}" y2="{88 - r2 * math.cos(math.radians(a)):.1f}" '
            f'stroke="#FFFFFF" stroke-opacity="{0.9 if big else 0.35}" stroke-width="{4 if big else 2}" stroke-linecap="round"/>')
TICKS = "\n  ".join(tick(a) for a in range(0, 360, 30))

def frame(t):
    h, m, s = t.tm_hour % 12, t.tm_min, t.tm_sec
    ha, ma, sa = h * 30 + m * 0.5, m * 6 + s * 0.1, s * 6
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="88" r="78" fill="#FFFFFF" fill-opacity="0.06"/>
  {TICKS}
  <line id="hour" x1="100" y1="88" x2="100" y2="48" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" transform="rotate({ha:.1f} 100 88)"/>
  <line id="minute" x1="100" y1="88" x2="100" y2="30" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" transform="rotate({ma:.1f} 100 88)"/>
  <line id="second" x1="100" y1="100" x2="100" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" transform="rotate({sa} 100 88)"/>
  <circle cx="100" cy="88" r="5" fill="currentColor"/>
  <text id="date" x="100" y="188" font-size="18" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.7">{time.strftime("%a, %b %e", t)}</text>
</svg>'''

while True:
    post({"cellId": CELL, "svg": {"source": frame(time.localtime()), "duration": 1.05, "easing": "linear"}})
    time.sleep(1)
```

The second hand and the center dot use `currentColor`, so they take whatever accent color the button has — change it with a plain `{"color":"#FF453A"}` update and the hands follow. A sweeping second hand keeps this face gliding all the time, which is the expensive mode — see [Performance budget](#performance-budget).

## MCP (Model Context Protocol)

Desktap Agent supports MCP, allowing AI assistants (like Claude) to interact with your deck programmatically — create buttons, update layouts, and execute commands on your Mac.

### Setup

Open the Desktap Agent window: the **AI Integration** section lists the AI apps found on your Mac, each with a one-click **Connect**. Apps that are not installed are not shown; if none is found, the section says what Desktap works with and links to the downloads.

| Client | What Connect does |
|---|---|
| **Claude Desktop** | adds the `desktap` entry to `~/Library/Application Support/Claude/claude_desktop_config.json`, keeping your other servers and preferences. Restart Claude afterwards. |
| **Claude Code** | registers the server for every project through Claude Code's own CLI (`claude mcp add-json -s user desktap …`). The same registration serves the CLI, its IDE extensions and the Code tab of the desktop app. A session that is already open picks it up with `/mcp`. |
| **ChatGPT / Codex** | adds a `[mcp_servers.desktap]` table to `~/.codex/config.toml` — the config shared by the ChatGPT desktop app (which includes Codex), the Codex CLI and the IDE extension. Only that table is touched: comments, ordering and other servers stay as they are, and the original is kept once as `config.toml.before-desktap`. Restart Codex or start a new session afterwards. |

A connected row shows a green check. **Reconnection Required** means the client is registered with another copy of the agent — for instance a path left over after the app was moved; **Reconnect** points it at the running one. A path that no longer exists is repaired by the agent on launch.

The agent never overwrites a config it cannot read or does not fully understand. If `~/.codex/config.toml` defines `mcp_servers` as an inline table or through dotted keys, Desktap shows an error instead and offers **Copy Entry** — a one-line entry to add to your existing definition by hand. A Claude config that is not valid JSON, or a config file without read permission, is likewise left untouched.

For any other MCP client — or to configure one of the above by hand — expand **Connect Other MCP Clients** in the same section and copy the snippet, JSON or TOML, with the path already filled in:

```json
{
  "mcpServers": {
    "desktap": {
      "command": "/Applications/Desktap Agent.app/Contents/MacOS/Desktap Agent",
      "args": ["--mcp"]
    }
  }
}
```

```toml
[mcp_servers.desktap]
command = "/Applications/Desktap Agent.app/Contents/MacOS/Desktap Agent"
args = ["--mcp"]
```

The `--mcp` flag launches the agent in stdio mode (no UI). It communicates with the main Desktap Agent process via the same HTTP API on port 9848.

> **Note:** The main Desktap Agent app must be running for MCP to work — the `--mcp` process is just a bridge. One exception: `render_preview` draws entirely inside the bridge and needs neither the app's connection nor the phone.

When a client connects, the server sends it a short set of **instructions** — look at the deck first, how to choose between a plain face and an SVG face, put live data in a startup script, preview an SVG face before delivering it, let one script draw a group of related buttons. Clients pass them to the model on their own, so they apply without installing anything.

### The widget skill

For Claude Code and Codex the agent can also install a **skill** — a folder of guidance and two script templates that helps the assistant build live widgets well: when a plain button is the better answer, how to keep frames gliding instead of flickering, how to spread one scene across a whole page, how to use an icon exported from a design tool. It matters most with smaller models; the largest ones get most of it from the server's own reference.

The skill is optional and installed only on request: once a client is connected, its row shows **Widget skill — Install**. It is copied to `~/.claude/skills/desktap-widgets` or `~/.codex/skills/desktap-widgets` and from then on follows the agent's version. A skill folder you put there yourself is never replaced silently — the row offers **Update**, and on click your version is moved to the Trash, not deleted; a folder that is a symbolic link is left alone entirely.

### MCP tools

The most useful tools for AI assistants:

| Tool                      | Description                                                |
|---------------------------|------------------------------------------------------------|
| `get_available_actions`   | Returns the full schema of supported command types, icons, grid sizes, env vars, the runtime API contract, startup-script lifecycle, and the notification endpoint. **Call this first** — its output is the canonical reference and stays in sync with the agent. |
| `get_profiles`            | List all profiles                                          |
| `get_profile_detail`      | Read a full profile with pages and buttons (UUIDs included) |
| `render_preview`          | Draw an SVG face with the phone's engine and return the picture, the parser's warnings and — with a second frame — a storyboard of the glide. See [Previewing a face without the phone](#previewing-a-face-without-the-phone) |
| `create_full_profile`     | Create a complete profile with pages and buttons in one call |
| `create_full_page`        | Create a complete page with buttons in one call            |
| `update_button_by_uuid`   | Modify a single button by its UUID (any field, including `startupScript` and the saved `svgFace`) |
| `update_buttons_by_uuid`  | Batch-modify multiple buttons in one operation             |
| `get_installed_apps`      | List installed apps (for the `openApp` action)             |
| `get_active_app`          | Identify the currently focused app                         |
| `get_available_shortcuts` | List user-defined shortcuts available to bind              |
| `run_probe`               | Execute a one-off shell command on the Mac. **Off by default** — enable *Allow probe commands* in the agent window first; every call then asks for approval on the iPhone. While disabled the tool returns `Probe commands are disabled in Agent settings.` |

Every tool that creates or updates a button accepts `svgFace`, `svgFaceLandscape` and `svgFaceFit` — a [face saved in the button](#a-face-saved-in-the-button). Ask the assistant to "draw an icon for this button" or "give the CPU widget a start state" and it will use them.

Tools that only read — `ping`, every `get_*` tool and `render_preview` — are marked read-only, so clients that ask before each tool call (Codex, for one) run them without a prompt. Anything that changes the deck still goes through the approval described below, and `run_probe` through its own.

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
| Codex or ChatGPT does not list any Desktap tools | The agent is older than 1.2.2 — it could not complete Codex's MCP handshake, and Codex dropped the server without an error. Update the agent, then restart Codex |
| An AI client row says *Reconnection Required* | The client is registered with another copy of the agent (a moved app, a development build). Click **Reconnect** |
| Claude Code is connected but the open session has no Desktap tools | A running session does not reload its servers: run `/mcp` in it, or start a new session |
| Codex **Connect** fails with "cannot edit safely" | Your `config.toml` defines `mcp_servers` inline or with dotted keys. Click **Copy Entry** and add the line to that definition yourself; the row turns green when you return to the agent |
| Overlay stuck after script | Send `reset: true` to clear, or terminate the process from iOS |
| Cleanup never runs on stop | A bare `trap ... EXIT` does not fire on SIGTERM. Add `trap 'cleanup; exit 0' TERM` so the handler runs when the agent terminates the process |
| Button shows a stale value after Stop | The `TERM` handler did not `exit`, so the loop repainted the button after the overlay was cleared. End the handler with `exit 0` — see [Process timeout](#process-timeout) |
| `python3: command not found` | Modern macOS doesn't bundle `python3`. Install it with `xcode-select --install`, or replace the example with `jq` (`brew install jq`). See [Tooling note](#tooling-note) |
| Token leaked or committed accidentally | Treat the token like an SSH key — it grants full local code execution via `/api/execute`. Rotate it immediately: see [Rotating the token](#rotating-the-token) |
| `svg.source rejected: XML error at line …` | The frame is not well-formed XML. The reason names the usual cause: an unescaped `&` or `<` in text (write `&amp;`/`&lt;`), an unclosed tag, an unquoted attribute, a document cut short by a shell quoting problem. Print the generator's output to a file and inspect that line |
| SVG frame accepted with `warnings` | Something in the frame was ignored, and each warning names it: an unsupported element (`filter`, `image`, `use`, CSS…), an unsupported attribute (`class`, `filter`, `pathLength`…), something that is only approximated (a mask, a gradient's focal point, a gradient on a shape without a box), a `tspan`, or a value the parser could not read (an unknown color, `rotate(45deg)`, `width="50%"`, `text-anchor="center"`). Fix the drawing until the response is a plain `{"status":"ok"}`. See [Supported SVG subset](#supported-svg-subset) |
| Face blinks / cross-fades instead of gliding | The two frames have different structures: an element appeared or disappeared, a path changed its command sequence, a polyline changed its point count, a paint went from a color to `none`, a `<rect>` switched between sharp and rounded (`rx` zero ↔ non-zero), or a text changed its `text-anchor`, `font-weight` or `dominant-baseline`. Keep the structure fixed and change only numbers; drive rings with `stroke-dashoffset`, hide elements with `opacity="0"`. See [How animation works](#how-animation-works) |
| Sparkline "wobbles" vertically | You shifted the samples and re-sent them, so every point interpolates to its neighbour's value. Scroll the chart instead: `rest` + `slide` frames on a `<g transform="translate(…)">` — see [Authoring techniques](#authoring-techniques) |
| Scrolling chart pauses at every step | The `slide` duration is shorter than the loop's real period. Measure the period (sleep + sampling + generation) and use it as the duration; slightly too long is invisible |
| Text on the face is tiny | The `viewBox` does not match the cell aspect (letterboxing), or the design is too dense for the size. Use 200×200 for 1×1/2×2, 400×200 for 2×1, 200×400 for 1×2, and font-size ≥ 26 on 1×1/2×1, ≥ 16 on 2×2. See [Authoring techniques](#authoring-techniques) |
| Face shrinks when the phone rotates | The button is rectangular and the frame has no `landscapeSource`. Send a second layout for the transposed cell with every frame, or use a square button. See [Orientation and landscapeSource](#orientation-and-landscapesource) |
| Face stays after the script stopped | Like every overlay it persists until `reset:true`, `svg.remove:true`, termination, a saved change in the editor or a disconnect. Send `reset:true` from the script's `TERM`/`EXIT` handlers |
| `svg` settings request does nothing | A request with `duration`/`easing`/`fit` but no `source` only adjusts a face that is already installed; send `source` first |
