<!-- updated: 2026-10-02 -->
# Script API

Desktap Agent serves a small HTTP API on your Mac, and every script a button runs can call it. This page lists each route with its fields, answers, messages and limits. To learn the patterns first, start with [Live widgets](?p=live-widgets).

## Endpoints

A button's scripts can call six routes. All of them are at `http://127.0.0.1:9848`, and all need the script token ([Connecting](#connecting)).

| Request | What it does | Body |
|---|---|---|
| [`POST /api/update-button`](#post-apiupdate-button) | Changes a button's live look: title, icon, emoji, color or SVG face. | JSON, up to 1 MB |
| [`GET /api/view`](#get-apiview) | Tells what the phone shows: the page on screen, its buttons, and which of them are visible. | none |
| [`GET /api/status`](#get-apistatus) | Tells whether a phone is connected, which one, and which agent answers. | none |
| [`POST /api/notify`](#post-apinotify) | Shows a notification on the phone, the Mac or both, with up to four action buttons. | JSON, up to 256 KB |
| [`POST /api/error`](#post-apierror) | Tells the phone why a button doesn't work, or that it works again. | JSON, up to 4 KB |
| [`GET /api/audio/levels`](#get-apiaudiolevels) | Gives the Mac's sound as one line of numbers, for widgets that move with music. | none |

The agent's other routes are for AI apps ([Use with an AI app](?p=ai)) and answer a button script with 403.

## Connecting

Scripts talk to the agent over plain HTTP, on this Mac only. The helpers block in every recipe handles all of this for you ([Live widgets › The helpers](?p=live-widgets#the-helpers)).

| What | How |
|---|---|
| Address | `http://127.0.0.1:9848`. The agent also listens on `[::1]:9848`. Write `127.0.0.1`, never `localhost`. |
| Script token | The header `Authorization: Bearer` with the value of `$DESKTAP_TOKEN`, which curl fills in itself (below). The rules: [How scripts run › The token](?p=scripts#the-token). |
| Body | JSON with a `Content-Length`, which curl's `-d` sets. `Content-Type` is optional. Chunked bodies are refused. |
| Answers | JSON on one line; `/api/audio/levels` answers plain text. Keys come in any order, and `/` may be written `\/`. |
| Keep-alive | A connection stays open between requests (HTTP/1.1), and the answers come back in order. |
| Timeouts | The agent closes a connection that has been idle for 30 s, and its answers carry `Keep-Alive: timeout=20`. Once a request starts, all of it must arrive within 10 s. |
| Who may connect | Programs that run under your macOS account on this Mac. Other accounts are cut off before any answer; web pages get 403. |
| Programs outside Desktap | Programs started from Terminal, cron or a Claude Code hook have no script token: see [Working from your Mac](?p=from-your-mac#let-other-programs-drive-a-button). |

Here is one request in curl. It reads the token from its own environment and writes it into the header, so the token never appears on a command line:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
curl -q -s -m 5 --variable '%DESKTAP_TOKEN=' \
  --expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}' \
  http://127.0.0.1:9848/api/status
```

Put `-q` first: it makes curl ignore `~/.curlrc`. The `=` after the name turns a missing token into a plain 401 instead of a curl error. [Get started › The curl line, explained](?p=start#the-curl-line-explained) goes through every flag.

To read an answer, match a part of it, as in `[[ $answer == *'"visible":false'* ]]`, or ask jq for one field, as in `jq -r .connected`. Never compare the whole text.

A widget that posts every few seconds can start a new curl for each post. Above one post a second, keep one connection open and send everything through it: with a new curl for each post, all scripts together run out of connections at about 540 posts a second. [Scenes and sound › One connection for fast loops](?p=scenes-and-sound#one-connection-for-fast-loops) has a zsh client.

## Status codes

The agent checks a request in the order of this table and answers with the first problem it finds. The first nine answers also close the connection, so a script that keeps one open must open a new one.

<div class="stack-table">

| Code | Answer | When | What to do |
|---|---|---|---|
| 413 | `{"error":"Request too large"}` | The request line and headers are over 16 KB, usually because of a long URL. | Send the data in the body. |
| 400 | `{"error":"Malformed request"}` | A broken request line or header line, or `Host`, `Authorization` or `Content-Length` sent twice. | Use curl, or check the HTTP you write by hand. |
| 400 | `{"error":"Send the body with a numeric Content-Length; Transfer-Encoding is not supported"}` | The body is sent in chunks, or `Content-Length` is not a number. | Send it with curl's `-d` or `-d @-`. |
| 403 | `{"status":"error","message":"Requests from web pages are not accepted."}` | The request has an `Origin` or `Sec-Fetch-Site` header, as browsers send. | Call the agent from a script, not from a web page. |
| 421 | `{"status":"error","message":"Misdirected request: the Host must be localhost, 127.0.0.1 or [::1]."}` | The `Host` header names another host. | Use `http://127.0.0.1:9848`. |
| 401 | `{"error":"Unauthorized"}` | No token, a pasted or old one, or an empty `$DESKTAP_TOKEN`. It is checked before the path. | Use the curl form above. From Terminal: [Working from your Mac](?p=from-your-mac#try-a-script-in-terminal-first). |
| 404 | `{"error":"Not found"}` | No such path, a wrong method such as `GET /api/update-button`, or a trailing `/`. | Check the method and the path in [Endpoints](#endpoints). |
| 403 | `{"status":"error","message":"This endpoint is only for the Desktap MCP server and other programs on this Mac (the agent's local socket), not for button scripts."}` | A route for AI apps, such as `/api/config`. | Use the six routes. Button IDs come from **Advanced › Button ID** or [`GET /api/view`](#get-apiview). |
| 413 | `{"error":"Request too large"}` | A body over the route's limit (1 MB, 256 KB, 4 KB), or any body on a GET. | Send less; a GET takes no body. |
| 400 | `{"status":"error","message":"<reason>"}` | The body is wrong, and the message says how. | Fix what it names: [Errors](#errors), [Notification errors](#notification-errors), [Error report answers](#error-report-answers). |
| 403 | `{"status":"error","message":"Notification actions that run something can only be sent by scripts the Desktap Agent started (startup, tap or long-press scripts)."}` | `notify` only: an action that runs something, from a program the agent did not start. | Send it from the button's script: [Actions and commands](#actions-and-commands). |
| 503 | `{"status":"error","message":"No device connected"}`; for `error`, `{"status":"error","message":"No device connected — errors are shown only while the phone is connected."}` | `update-button` and `error` only: no phone is connected. A wrong body still gets its 400 first. | Send again on the next pass. |
| 429 | `{"status":"error","message":"The agent already keeps errors of 200 buttons that all still fail; this one was not kept. Clear errors that no longer hold."}` | `error` only: the agent keeps 200 errors, and all of them still hold. | Clear the reports that no longer hold. |
| 500 | `{"status":"error","message":"Frame not sent: <reason>"}` | `update-button` only: the update could not go out. | Send again on the next pass. |
| 200 | `{"status":"ok"}`, sometimes with more fields | Accepted. | Read the extra fields: [Answers](#answers), [Notification answers](#notification-answers). |

</div>

## POST /api/update-button

Changes one button's live look: the title, icon, emoji, color or SVG face that scripts show over the look saved in the editor. Send only what changes: each update merges into the earlier ones until something brings the saved look back ([Live widgets › The live look](?p=live-widgets#the-live-look)).

```json title="Body"
{"cellId":"{{CELL_ID}}","title":"412 GB free","icon":"internaldrive.fill","color":"#34C759"}
```

### Fields

| Field | Type | What it does |
|---|---|---|
| `cellId` | string, required | The button's ID, in upper or lower case. A button's own scripts write `{{CELL_ID}}`; for another button, copy its ID from **Advanced › Button ID**. |
| `title` | string | The text under the icon. It wraps at spaces onto up to two lines; a `\|` shows as typed, not as a line break. |
| `icon` | string | An SF Symbol name, drawn in the button's color. It replaces an emoji. |
| `emoji` | string | Emoji in the icon's place; one to three fit, more are drawn smaller. It replaces the icon. |
| `color` | string | The button's color, exactly `#RRGGBB`, in upper or lower case. Any other form gets the whole update refused. |
| `svg` | object | A drawing that covers the title, icon and emoji while it shows: [The svg object](#the-svg-object). |
| `reset` | boolean | `true` brings back the saved look, a saved drawing included. The other fields of that update are ignored. |

- Nothing checks `title`, `icon` or `emoji`. An empty title is accepted with a 200, and so is a misspelt symbol, which leaves the icon blank.
- An update that holds both `icon` and `emoji` shows the emoji. No field goes back to its saved value alone: `reset` brings back all of them.
- An update for an ID that no button has gets the same answer as one for a hidden button, `"visible": false`. Copy an ID rather than type it ([Live widgets › Finding a button's ID](?p=live-widgets#finding-a-buttons-id)).
- An update with any other key, at the top or inside `svg`, is refused with a list of the valid ones ([Errors](#errors)).

**Color.** `color` tints the button and its symbol, and inside an SVG face it is `currentColor`. The editor's six swatches are Gray `#8E8E93`, Red `#FF3B30`, Orange `#FF9500`, Green `#34C759`, Blue `#3478F6`, Purple `#AF52DE`. The agent refuses `#FFF`, `FF0000`, `#FF000080`, `red` and a value with a trailing space. Inside an SVG document any CSS color works ([SVG reference › Supported SVG](?p=svg-reference#supported-svg)).

### The svg object

`svg` carries an SVG face. One update can hold it together with `title`, `icon`, `emoji` and `color`, and every field inside it is optional.

```json title="Body"
{
  "cellId": "{{CELL_ID}}",
  "svg": {
    "source":
      "<svg viewBox='0 0 200 200'><circle cx='100' cy='100' r='60' fill='currentColor'/></svg>",
    "duration": 0.6,
    "easing": "easeInOut",
    "fit": "contain"
  }
}
```

| Field | Type | Default | What it does |
|---|---|---|---|
| `source` | string, up to 64 KB | — | A complete `<svg>` document: the next frame. Leave it out to change only the settings of the face on the button. |
| `landscapeSource` | string, up to 64 KB | — | The landscape variant: the same frame laid out for the turned phone, on Wide and Tall buttons. A `source` without it drops the earlier one. |
| `duration` | number, 0 to 10 | `0.4` | How many seconds the change to this frame takes. `0` shows it at once. |
| `easing` | `"easeInOut"` or `"linear"` | `"easeInOut"` | `easeInOut` for a value that settles; `linear` for motion that never stops, with `duration` 1.25 × your interval (a scrolling chart's slide: the measured period, at most 1.1 × it; see [SVG faces › Charts that scroll](?p=svg-faces#charts-that-scroll)). |
| `fit` | `"contain"`, `"cover"` or `"stretch"` | `"contain"`, or the saved drawing's **Scaling** | How the drawing fills the button: whole with margins, filled and cropped, or stretched to fill. The same as **Fit**, **Fill** and **Stretch** in the editor. |
| `remove` | boolean | — | `true` takes the face away: the saved drawing, or the title, icon and color, show again. The other fields still apply. |

- Send `duration`, `easing` and `fit` with every frame. They carry over from frame to frame, but a face can disappear at any time (a `reset`, a save, a stop), and the next one starts from the defaults.
- On a Wide or Tall button, send `landscapeSource` with every frame that sends `source` ([SVG faces › Sizes and the turned phone](?p=svg-faces#sizes-and-the-turned-phone)).
- An update with settings only, such as `{"cellId":"<ID>","svg":{"duration":1}}`, is answered 200 even when the button shows no face; it then changes nothing.
- A frame the phone cannot draw is refused with 400 and the reason, even with no phone connected ([Errors](#errors)). With a phone connected, **Errors** on the phone also lists it as **Drawing rejected**, with the reason. A frame it draws only in part gets a 200 with `warnings` ([Answers](#answers)).

### Answers

The agent checks every update before anything goes to the phone, and its answer says what happened to it. A 200 may carry extra fields, each only when it applies.

<div class="dt-mount" data-diagram="round-trip" data-mode="full">Where an update goes and what the agent answers: drawn on the button, held for a hidden button, held while the phone is not reading, or refused with the reason.</div>

| Answer | What it means | What to do |
|---|---|---|
| `{"status":"ok"}` | The update is on its way to the button on screen. | Nothing. |
| `"visible": false` | The button is not on screen (another page, Desktap in the background, a page past the Free plan), or no button has this ID. It shows the newest look the moment it appears. | Nothing to resend: an ordinary widget keeps drawing. If the button never changes, check its ID. |
| `"dropped": true` | The phone is not reading right now. The agent keeps the newest look and delivers it when the phone reads again. | Slow down to one update every couple of seconds while the answers say so. Never retry at once. |
| `"warnings": [ ]` | The frame is drawn, but the listed parts are not drawn as written. | Fix them until the key is gone: [SVG reference › Errors and warnings](?p=svg-reference#errors-and-warnings). |
| `"crossFade": "<text>"` | This frame cross-fades instead of gliding. The text names the first difference from the button's previous frame and how to fix it. | Keep one template for every frame: [SVG faces › Frames that glide](?p=svg-faces#frames-that-glide). |

Three answers as the agent writes them, keys in any order:

```json
{"status":"ok"}
{"visible":false,"status":"ok"}
{"status":"ok","dropped":true}
```

For example, a frame that adds a dot to a ring gets `"crossFade": "This frame's structure differs from this button's previous frame, so the phone cross-fades instead of gliding. First difference: element 2 (a circle) is new: 1 element → 2. Keep the same elements in every frame: hide one that is not needed with opacity 0 (the same id, shape and paints) instead of leaving it out."`

A note about the landscape variant starts with `landscapeSource:`, for example `landscapeSource: this frame has none, so the phone drops the previous frame's landscape variant and a turned button cross-fades to source. Send landscapeSource with every frame that sends source.` A button's first frame, and the first after a `reset` or `remove`, carries no `crossFade`.

> [!TIP]
> Check new frames while the phone is connected. `warnings` and `crossFade` come only with a 200, and with no phone connected the answer is the 503 instead.

**Read an answer in a script.** In a finished loop, `post` from the helpers is enough: it succeeds on a 200 and sets `$dropped`. While you build a face, let the script stop on anything but a clean 200. The phone then adds the button to the ⚠ count next to your Mac's name at the top of the deck, and **Errors** shows what the agent answered ([Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work)):

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
# part of a startup script, after the helpers: while you build, stop on anything but a clean 200
post "$body" || { print -u2 "update-button answered $code"; exit 1 }   # a 400 also says why
notes=$(print -r -- "$answer" | jq -r '.warnings[]?, (.crossFade // empty)')
[[ -z $notes ]] || { print -u2 -r -- "$notes"; exit 1 }               # warnings, or a cross-fade
```

`$body` is the update you send. Take the two `exit 1` out when the face is done: a finished widget should carry on after a missed update.

### Errors

A 400 comes back even with no phone connected. With a phone connected and a valid `cellId`, **Errors** on the phone also lists the update as **Drawing rejected**, with the agent's reason. The row holds until an update for the button is accepted, a tap or long-press script of the button ends, its startup script starts again or is stopped, or the phone disconnects. The agent reports the first problem in this order, inside `{"status":"error","message":"…"}`:

| Message | When |
|---|---|
| `Missing request body` | The update has no body. |
| `Unknown field(s): foo, svg.bar. Valid fields: cellId, title, icon, emoji, color, reset, svg; inside svg: source, landscapeSource, duration, fit, easing, remove.` | A key that is not a field, at the top or inside `svg`. |
| `Invalid JSON` | Not JSON, or not a JSON object; `cellId` missing or not an ID (`{{CELL_ID}}` never filled in); a value of the wrong type, such as `"duration":"1"`; `fit` or `easing` misspelt. |
| `Invalid color format. Expected #RRGGBB.` | `color` is not `#` and six hex digits. |
| `svg.source is too large (max 64 KB).` | The document is over 65,536 bytes. |
| `svg.source must be an <svg> document.` | The text holds no `<svg`, or is empty. |
| `svg.landscapeSource is too large (max 64 KB).` and `svg.landscapeSource must be an <svg> document.` | The same for the landscape variant. |
| `svg.duration must be within 0...10 seconds.` | `duration` is below 0 or above 10. |
| `svg.source rejected: <reason>` | The phone cannot draw the frame. For the landscape variant it reads `svg.source rejected: landscapeSource: <reason>`. |

The reasons you will meet most often:

| Reason | Fix |
|---|---|
| `XML error at line 1, column 35: premature end of document: a tag is not closed, the SVG was cut short, or an unescaped '&' / '<' appears in text (write &amp; and &lt;)` | Write `&amp;` and `&lt;` in text, close every tag, and look at the line it names. |
| `svg needs a viewBox (or width/height)` | Give the root `<svg>` a `viewBox`, such as `viewBox="0 0 200 200"`. |
| `The document draws nothing (no supported elements inside <svg>)` | Draw at least one shape, or a text that is not empty. |
| `path: Unexpected '#' at offset 6 of the path data` | A path holds something that is not a number: print the frame and look at that path's `d`. |

Every other reason is listed in [SVG reference › Errors and warnings](?p=svg-reference#errors-and-warnings).

### Icons and emoji

`icon` takes the name of an SF Symbol. Nothing checks the name, so look it up before you send it.

| For | Symbols |
|---|---|
| Live values | `cpu`, `memorychip`, `thermometer.medium`, `battery.100`, `wifi`, `internaldrive`, `clock`, `bolt.fill` |
| Status | `checkmark.circle.fill`, `exclamationmark.triangle.fill`, `play.circle.fill`, `timer` |
| Tools and places | `terminal.fill`, `gearshape`, `globe`, `desktopcomputer` |

- Browse the names in Apple's free SF Symbols app on the Mac, which also shows the iOS version each symbol needs, or in the editor under **Icon › All Symbols…**.
- A misspelt name, or a symbol newer than the phone's iOS, leaves the icon blank.
- The symbol takes the button's color. `icon` and `emoji` share one place: sending one replaces the other. An SVG face covers both.

To set a symbol from a script:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
post "{\"cellId\":\"$cell\",\"icon\":\"terminal.fill\"}"     # part of a script, after the helpers
```

## GET /api/view

Tells a script what the phone shows right now. Use it to find the buttons on screen, and to rest an expensive loop while its button is hidden.

An answer, spread over several lines here:

```json
{
  "connected": true,
  "view": {
    "activePageId": "B8BD85A2-98BB-4A53-90C1-D6F2DF4510F0",
    "activeProfileId": "E8BD730C-088D-43F3-88E8-0ABD9BD23288",
    "cellGap": 12,
    "cellSize": 113.9,
    "cells": [
      {"col": 0, "colSpan": 1,
       "id": "79164AD7-4EE5-4E16-87B3-8C906C956CC9", "row": 0, "rowSpan": 1},
      {"col": 1, "colSpan": 2, "galleryItem": "timer",
       "id": "745B465C-FE3E-4C1C-8C00-2A54EB6BF08A", "row": 0, "rowSpan": 1}
    ],
    "columns": 6,
    "isForeground": true,
    "orientation": "landscape",
    "rows": 8,
    "visibleCellIds": [
      "745B465C-FE3E-4C1C-8C00-2A54EB6BF08A", "79164AD7-4EE5-4E16-87B3-8C906C956CC9"
    ]
  }
}
```

| Field | What it holds |
|---|---|
| `connected` | `true` while a phone is connected. |
| `view` | `null` until the phone has said what it shows, or when no phone is connected. Treat `null` as "not on screen". |
| `visibleCellIds` | The IDs of the buttons on screen now. Empty while Desktap is in the background or shows a page past the Free plan. |
| `cells` | Every button of the page on screen: `id`, `row`, `col`, `rowSpan`, `colSpan`, and `galleryItem` for one made from the Gallery. Empty when `visibleCellIds` is. |
| `columns`, `rows` | The upright grid: 4 × 8 on iPhone, 6 × 8 on iPad. |
| `orientation` | `"portrait"` or `"landscape"`. The positions in `cells` stay those of the upright page. |
| `cellSize`, `cellGap` | One button's side and the gap between two buttons, in points. |
| `isForeground` | `true` while Desktap is the app on screen. |
| `activePageId`, `activeProfileId` | The page and the profile on screen. |

- A button you drag in from another page in edit mode appears only in `visibleCellIds`.
- An ordinary widget keeps drawing while it is hidden: the agent holds its newest look. Only an expensive loop (a scene, several frames a second, music levels) asks for the view on every pass and rests while hidden ([Scenes and sound › Rest while the page is hidden](?p=scenes-and-sound#rest-while-the-page-is-hidden)).
- A scene takes the places of its tiles from `cells`, and turns with `orientation` ([Scenes and sound › Where each button is](?p=scenes-and-sound#where-each-button-is)).

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
# part of a script, after the helpers: is this button on the screen right now?
on_screen() {
  call view || return 0                            # no answer: draw anyway
  print -r -- "$answer" | jq -e --arg id "$cell" \
    '.view != null and (.view.visibleCellIds // [] | any(. == $id))' > /dev/null
}
```

In a loop, `on_screen || { sleep 1; continue }` skips a pass while the button is hidden.

## GET /api/status

Tells whether a phone is connected, which one, and which agent answers. It answers 200 whether or not a phone is connected.

```json
{
  "agent": {"build": "8", "bundleId": "com.desktap.agent", "version": "1.2.3"},
  "connected": true,
  "device": {
    "appVersion": "1.2.3", "deckStorage": "cloudKit", "kind": "pad", "systemVersion": "17.7.11"
  },
  "deckStorage": "cloudKit"
}
```

| Field | What it holds |
|---|---|
| `connected` | `true` while a phone is connected. |
| `device` | The connected phone, or `null`: `kind` (`"phone"` or `"pad"`), `appVersion` (Desktap) and `systemVersion` (iOS or iPadOS). |
| `deckStorage`, `device.deckStorage` | Where the phone keeps its deck: `"cloudKit"` when it syncs through iCloud. `null` with no phone. |
| `agent` | The agent that answers: its `version`, `build` and `bundleId`. |

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
# part of a script, after the helpers: which phone is connected?
call status && kind=$(print -r -- "$answer" | jq -r '.device.kind // "none"')   # phone, pad or none
```

> [!WARNING]
> Never name a variable `status`. zsh keeps it for itself, and `status=$(…)` stops the script with "read-only variable: status".

## POST /api/notify

Shows a notification on the phone, the Mac or both, with up to four action buttons. [Notifications](?p=notifications) teaches when to send one; this section lists the fields, the commands and the messages.

Here is a body as a button's own script would send it. Its fixed `id` makes the banner of each new build replace the previous one:

```json title="Body"
{
  "cellId": "{{CELL_ID}}",
  "id": "9D4A91F7-7AC4-4556-9A00-54BD26B75FB3",
  "title": "Build finished",
  "subtitle": "main",
  "body": "214 tests passed in 3 min 12 s",
  "targets": ["phone", "mac"],
  "actions": [
    {"id": "log", "title": "Open Log", "command": {"openURL": {"url": "https://ci.example.com"}}},
    {"id": "again", "title": "Run Again",
     "command": {"shellCommand": {"command": "touch \"$DESKTAP_STORAGE/build-request\""}}},
    {"id": "ok", "title": "OK"}
  ]
}
```

Build such a body with `jq -n --arg` whenever it holds text your script did not write ([How scripts run › Text in JSON](?p=scripts#text-in-json)).

### Notification fields

| Field | Type | Default | What it does |
|---|---|---|---|
| `title` | string, required | — | The headline. A missing or blank title is refused. |
| `subtitle` | string | — | A line under the title. |
| `body` | string | — | The text; several lines are fine. It shows as you send it. |
| `cellId` | button ID | — | The button it belongs to: write `{{CELL_ID}}`. On the phone, a tap on the notification opens that button's page; actions run as a tap of the button; its notifications are grouped. |
| `targets` | list | `["phone"]` | `"phone"`, `"mac"` or both. |
| `sound` | boolean | `true` | `false` for a silent notification. |
| `actions` | list, up to 4 | — | The action buttons: [Actions and commands](#actions-and-commands). |
| `id` | ID | a new one | Send the same `id` again to replace the earlier notification instead of adding one. |
| `sensitive` | boolean | `false` | The phone shows only the button's name and "Open Desktap to see it", the Mac "See it in Desktap on your phone". Allows only actions without a command. |

- Never send `origin`: the agent sets it from the connection, and a body that holds it is refused.
- Only the top-level names are checked. A misspelt key inside an action or a command passes silently, so copy the shapes below.
- Keep codes, passwords, tokens and amounts out of the text: it shows on the lock screen and the Watch, and the system keeps it. Show the value on the button, or set `sensitive`.
- A notification holds text only: no images, no HTML. It shows exactly the text you send, so let each action's title say what it does ([Notifications › What the person sees](?p=notifications#what-the-person-sees)).

### Actions and commands

Each entry of `actions` is one action button on the notification. Its `command` has the same JSON as a button's own tap action.

| Field | Type | What it does |
|---|---|---|
| `id` | string, required | Unique within the notification. |
| `title` | string, required | The button's text, without line breaks or control characters. |
| `command` | object | What a tap runs. Leave it out for a button that only closes the notification. |
| `destructive` | boolean | Shows the button in red. |

| Command | JSON | Notes |
|---|---|---|
| Open URL | `{"openURL":{"url":"https://example.com"}}` | Web links from any sender. `file:` links, app links such as `slack://` and `x-apple.systempreferences:` only from a button's script. |
| Launch App | `{"launchApp":{"bundleIdentifier":"com.apple.Safari"}}` | To find an app's ID: `osascript -e 'id of app "Safari"'`. |
| Shell Command | `{"shellCommand":{"command":"touch \"$DESKTAP_STORAGE/flag\""}}` | Runs like a tap script of `cellId`: the same environment, 60 s at most. |
| AppleScript | `{"appleScript":{"code":"tell application \"Music\" to playpause"}}` | 60 s at most. |
| System Action | `{"systemAction":{"_0":"muteMic"}}` | The names: [System actions](#system-actions). |
| Key Combination | `{"keystroke":{"_0":{"keyCode":8,"modifiers":["command"]}}}` | `modifiers` is required, `[]` for none: `command`, `option`, `control`, `shift`. The codes: [Key codes](#key-codes). |
| Run Shortcut | `{"runShortcut":{"name":"Start Focus"}}` | The name as the Shortcuts app shows it; 60 s at most. |
| Text Snippet | `{"textSnippet":{"text":"On my way!"}}` | Pasted into the app in front on the Mac. |
| No Action | `{"ping":{}}` | Nothing visible happens. |

- A command is an object with one key, its type. A value without a name of its own goes under `_0`.
- The text of a command (the shell code, the AppleScript, the URL, the snippet) may hold up to 4,000 characters of printable text, line breaks and tabs. Keep it short: let the action change a file that the startup script reads ([Button logic › Taps change state, the loop draws](?p=button-logic#taps-change-state-the-loop-draws)).
- `{{CELL_ID}}` in a Shell Command, AppleScript or Text Snippet becomes the notification's `cellId` when the action runs. In a body that the button's script builds, it is that button's ID already.
- An action **runs something** when it is a Shell Command, AppleScript, Text Snippet, Key Combination or Run Shortcut, an Open URL that is not a web link, or one of the system actions marked so below. The agent accepts such an action only from a tap, long-press or startup script that it started for a button, while that script runs. From anything else, AppleScript and Shortcut buttons included, the whole notification gets 403.
- Such an action runs at once when it is tapped. A program outside Desktap can send one only through the agent's socket, and then the tap shows the whole command and asks first ([Working from your Mac](?p=from-your-mac#let-other-programs-drive-a-button)).
- `switchPage` is accepted, but it fails when tapped. A tap on the notification's text opens the button's page anyway.
- Key Combination, Text Snippet and most system actions need Accessibility. AppleScript and some system actions make macOS ask once for each app they control ([How scripts run › macOS permissions](?p=scripts#macos-permissions)).

### System actions

`systemAction` takes one of 24 names. The editor lists them under **System Action**, in these groups.

| Group | In the editor | Value | Needs Accessibility | Who may send it |
|---|---|---|---|---|
| Media | Play/Pause | `playPause` | yes | anyone |
| Media | Next Track | `nextTrack` | yes | anyone |
| Media | Previous Track | `previousTrack` | yes | anyone |
| Volume | Volume Up | `volumeUp` | yes | anyone |
| Volume | Volume Down | `volumeDown` | yes | anyone |
| Volume | Mute | `mute` | yes | anyone |
| Screen | Screenshot | `screenshot` | yes | anyone |
| Screen | Screenshot Region | `screenshotRegion` | yes | anyone |
| Screen | Eyedropper | `pickColor` | no | a button's script |
| Screen | Copy Last Color | `copyLastColor` | no | a button's script |
| Screen | Lock Screen | `lockScreen` | yes | a button's script |
| Microphone | Mute Mic | `muteMic` | yes | anyone |
| Microphone | Unmute Mic | `unmuteMic` | yes | anyone |
| Spotlight & Navigation | Spotlight | `spotlight` | yes | anyone |
| Spotlight & Navigation | Mission Control | `missionControl` | yes | anyone |
| Spotlight & Navigation | Launchpad | `launchpad` | yes | anyone |
| Brightness | Brightness Up | `brightnessUp` | yes | anyone |
| Brightness | Brightness Down | `brightnessDown` | yes | anyone |
| Appearance | Dark Mode | `darkMode` | yes | anyone |
| Appearance | Light Mode | `lightMode` | yes | anyone |
| System | Sleep | `sleep` | yes | a button's script |
| System | Log Out | `logout` | yes | a button's script |
| System | Empty Trash | `emptyTrash` | yes | a button's script |
| System | Clean Keyboard | `cleanKeyboard` | yes | a button's script |

In the last column, "anyone" means that any sender may put the action in a notification, and it runs on one tap. "A button's script" marks an action that runs something: only a script the agent started for a button may send it ([Actions and commands](#actions-and-commands)).

### Key codes

`keyCode` names a key by its position on a US keyboard. The agent presses the key that types the same character in the layout the Mac uses, so `16` types a Y on a German keyboard too, where the Y sits elsewhere.

| Key | Code | Key | Code | Key | Code | Key | Code |
|---|---|---|---|---|---|---|---|
| A | 0 | B | 11 | C | 8 | D | 2 |
| E | 14 | F | 3 | G | 5 | H | 4 |
| I | 34 | J | 38 | K | 40 | L | 37 |
| M | 46 | N | 45 | O | 31 | P | 35 |
| Q | 12 | R | 15 | S | 1 | T | 17 |
| U | 32 | V | 9 | W | 13 | X | 7 |
| Y | 16 | Z | 6 | 0 | 29 | 1 | 18 |
| 2 | 19 | 3 | 20 | 4 | 21 | 5 | 23 |
| 6 | 22 | 7 | 26 | 8 | 28 | 9 | 25 |
| `-` | 27 | `=` | 24 | `[` | 33 | `]` | 30 |
| `\` | 42 | `;` | 41 | `'` | 39 | `,` | 43 |
| `.` | 47 | `/` | 44 | `` ` `` | 50 | | |

| Key | Code | Key | Code | Key | Code | Key | Code |
|---|---|---|---|---|---|---|---|
| Return | 36 | Tab | 48 | Space | 49 | Delete | 51 |
| Escape | 53 | Forward Delete | 117 | Home | 115 | End | 119 |
| Page Up | 116 | Page Down | 121 | ← | 123 | → | 124 |
| ↓ | 125 | ↑ | 126 | F1 | 122 | F2 | 120 |
| F3 | 99 | F4 | 118 | F5 | 96 | F6 | 97 |
| F7 | 98 | F8 | 100 | F9 | 101 | F10 | 109 |
| F11 | 103 | F12 | 111 | | | | |

- The keys of the second table stay where they are on every keyboard.
- The macOS shortcuts (⇧⌘3, ⇧⌘4 and ⇧⌘5 for screenshots, ⌘\` between windows, ⌃1 to ⌃9 for Spaces and the like) are pressed by position, the way macOS expects them.
- `key code N` inside an AppleScript is not adapted to the layout. For a shortcut, use a Key Combination.

### Notification errors

The agent reports the first problem in this order, inside `{"status":"error","message":"…"}`. All of them are 400 except the last, which is 403.

| Message | When |
|---|---|
| `Missing request body` | The request has no body. |
| `Body must be a JSON object.` | The body is not JSON. |
| `“origin” is set by the Desktap Agent from the connection the notification arrives on; remove it from the body.` | The body has an `origin` key. |
| `Unknown field(s): foo. Valid fields: actions, body, cellId, id, sensitive, sound, subtitle, targets, title.` | A top-level key that is not a field. |
| `Invalid notification JSON: The data couldn’t be read because it is missing.` | No `title`; an action without `id` or `title`; a command without its field, such as a `keystroke` without `modifiers`. |
| `Invalid notification JSON: The data couldn’t be read because it isn’t in the correct format.` | A value of the wrong type; an `id` or `cellId` that is not an ID; an unknown target (`"watch"`), system action or modifier; a list as the body. |
| `title is required.` | The title holds only spaces. |
| `At most 4 actions are supported.` | Five actions or more. |
| `Action ids must be unique.` | Two actions share an `id`. |
| `Every action needs a non-empty id and title.` | An action's `id` is empty, or its `title` blank. |
| `action “<id>”: <rule>` | An action breaks one of the rules below. Only the first broken rule is reported. |
| `Notification actions that run something can only be sent by scripts the Desktap Agent started (startup, tap or long-press scripts).` | 403: an action that runs something, from a sender that is not such a script. |

The part after `Invalid notification JSON:` is macOS's own wording. The rules, in the order they are checked for each action:

| Rule after `action “<id>”:` | Fix |
|---|---|
| `the title contains the control or text-direction character U+XXXX` | Take the line break or the hidden character out of the title. |
| `the notification is "sensitive", which hides its text from the user; a sensitive notification carries only actions without a command — drop "sensitive" (and keep secrets out of its text), or drop this action's command` | Choose one: `sensitive`, or the action's command. |
| `the command type “<type>” is not one this Desktap Agent knows, so the action could not run` | Use a type from [Actions and commands](#actions-and-commands). |
| `the command contains the hidden or control character U+XXXX; only printable text, newlines and tabs are allowed` | Strip escape codes and other hidden characters from the text. |
| `the command is <N> characters long; at most 4000 are allowed — call a script instead` | Let the action change a file, and keep the work in the startup script. |

A body over 256 KB gets the 413 of [Status codes](#status-codes). With no phone connected there is no error: the notification waits ([Notification answers](#notification-answers)).

### Notification answers

A 200 says where the notification went, and adds `reason` when the phone may not show it now:

```json
{"status":"ok","delivered":{"phone":"sent","mac":"shown"}}
{"status":"ok","delivered":{"phone":"sent","mac":"shown"},"reason":"background"}
```

| Key | Value | What it means |
|---|---|---|
| `phone` | `"sent"` | Handed to the connected phone. Without `reason`, Desktap is on screen and shows it at once, if it may show notifications; the phone asks the first time ([Notifications › Where it arrives](?p=notifications#where-it-arrives)). |
| `phone` | `"queued"` | No phone is connected. The agent keeps it (up to 20, for 12 hours, while it runs) and sends it when the phone connects. |
| `mac` | `"shown"` | Shown on the Mac. |
| `mac` | `"denied"` | Notifications are off for Desktap Agent: turn them on in **System Settings › Notifications › Desktap Agent**. **Open System Settings** under **Permissions › Notifications** in the agent window opens that page. |
| `reason` | `"background"` | Desktap is not on screen, so the notification may not show now. For about 30 s after Desktap leaves the screen, it still shows at once; after that, only when Desktap is opened, or never if Desktap is closed first. |

The keys of `delivered` follow the order of `targets`, and `reason` comes after `delivered`. To read one: `jq -r .delivered.phone`, or `[[ $answer == *'"reason":"background"'* ]]` for the reason. Send what must not be missed to the Mac too: with `"targets":["phone","mac"]`, or post it again with `"targets":["mac"]` on that reason.

## POST /api/error

Tells the phone why a button doesn't work, or that it works again. The button joins the ⚠ count at the top of the deck, and **Errors** lists the report with a headline for its kind, a hint and your `message` ([Live widgets › Report what went wrong](?p=live-widgets#report-what-went-wrong)).

```json title="Body"
{"cellId":"{{CELL_ID}}","kind":"auth","message":"GitHub answered 401: Bad credentials"}
```

And once the button works again:

```json title="Body"
{"cellId":"{{CELL_ID}}","clear":true}
```

### Error report fields

| Field | Type | What it does |
|---|---|---|
| `cellId` | string, required | The button whose script reports: `{{CELL_ID}}`, in upper or lower case. A report lasts as long as the run of the button it names. |
| `kind` | string, required unless `clear` | What went wrong: one of the [error kinds](#error-kinds), spelled exactly. |
| `message` | string | A few plain words for the person, with the service's own reason when there is one. At most 500 characters: a longer one is cut. |
| `clear` | boolean | `true`: the button works again. It ends all of the button's reports, or only those of `kind` when you send `kind` too. |

`null` for `kind`, `message` or `clear` counts as a field you left out, and so does `"clear": false`. The phone shows `message` as you wrote it, in the app only; never put a token, a password or code in it. A report for an ID that no button has gets a 200, and nothing shows it.

### Error kinds

A row in **Errors** shows the headline, your `message` below it, then the hint. The headline and the hint come in the phone's language.

<div class="stack-table">

| `kind` | Headline | Hint | Use it when |
|---|---|---|---|
| `network` | No connection | The Mac or the service it talks to can't be reached right now. | curl gets no answer (`000`) |
| `auth` | Access refused | A key, token or password was refused. Update it in the button's script. | a `401` or `403`, an expired sign-in |
| `permission` | Not allowed on the Mac | macOS didn't allow it. Check System Settings › Privacy & Security on the Mac. | macOS refused, and you can't tell which permission |
| `accessibility` | Accessibility access needed | On the Mac, turn on Desktap Agent in System Settings › Privacy & Security › Accessibility. | System Events can't press keys or click |
| `automation` | Automation access needed | On the Mac, let Desktap Agent control the app in System Settings › Privacy & Security › Automation. | AppleScript error -1743 |
| `notFound` | Not found | An app, file or command this button needs isn't on the Mac. | an app, file or tool is missing |
| `notRunning` | App not running | Open the app on the Mac and try again. | the app the button works with is closed |
| `timeout` | No answer in time | The Mac or the service took too long to answer. | a call ran out of time |
| `config` | Button set up wrong | Something in the button's settings is missing or wrong. Edit the button. | a setting at the top of the script is missing or wrong |
| `busy` | Still running | The button's previous run hasn't finished yet. | the job is already under way |
| `other` | Didn't work | — | nothing else fits |

</div>

For `permission`, `accessibility` and `automation`, the row also offers **Open Settings on Mac**, which opens the matching pane of System Settings on the Mac. The phone may also show "Desktap Agent is too old" ("Update Desktap Agent on the Mac."): only the agent sends it, for an action it doesn't know, and a script that sends `unsupported` gets a 400.

### Error report answers

The agent answers at once, without waiting for the phone.

<div class="stack-table">

| Code | Answer | When |
|---|---|---|
| 200 | `{"status":"ok","shownAs":"buttonError"}` | Kept as the button's error. The phone gets it within a second. |
| 200 | `{"status":"ok","shownAs":"actionAnswer"}` | Sent by the button's tap or long-press script while it runs: it answers that tap or long press, even after `exit 0` ([From a tap script](#from-a-tap-script)). |
| 200 | `{"status":"ok"}` | `clear` accepted, also when there was nothing to clear. |
| 413 | `{"error":"Request too large"}` | The body is over 4 KB. |
| 429 | `{"status":"error","message":"The agent already keeps errors of 200 buttons that all still fail; this one was not kept. Clear errors that no longer hold."}` | The agent keeps 200 errors, and all of them still hold. Clear the reports that no longer hold. |
| 503 | `{"status":"error","message":"No device connected — errors are shown only while the phone is connected."}` | No phone: nothing is kept. Report again on the next pass. |
| 404 | `{"error":"Not found"}` | `GET` instead of `POST`, or a typo in the path. |

</div>

A 400 comes as `{"status":"error","message":"…"}`. The agent checks in this order:

| Message | When |
|---|---|
| `Body must be a JSON object: {"cellId": "<button UUID>", "kind": "<kind>", "message": "<what went wrong>"} or {"cellId": "<button UUID>", "clear": true}.` | No body, not JSON, or not an object. |
| `Unknown field(s): title. Valid fields: cellId, kind, message, clear.` | A key other than the four, here `title`. |
| `cellId must be the button's UUID ({{CELL_ID}} in its script).` | `cellId` missing or not an ID, such as a `{{CELL_ID}}` left unreplaced in a Terminal run. |
| `kind must be one of: network, auth, permission, accessibility, automation, notFound, notRunning, timeout, config, busy, other.` | An unknown kind, `unsupported`, or another case, such as `Network`. |
| `message must be a string.` | A `message` that is not text, such as `"message":5`. |
| `clear must be true or false.` | `"clear":1` or `"clear":"true"`. |
| `kind is required: one of network, auth, permission, accessibility, automation, notFound, notRunning, timeout, config, busy, other. Body: {"cellId": "<button UUID>", "kind": "<kind>", "message": "<what went wrong>"} or {"cellId": "<button UUID>", "clear": true}.` | Neither `kind` nor `"clear": true`. |

### How long a report lasts

What each event does to a button's reports:

| Event | The button's reports |
|---|---|
| the same `kind` again | one row: its count goes up, and the newest `message` replaces the old one |
| another `kind` | a row of its own |
| `"clear": true` | end; the row moves to **Earlier** in **Errors** |
| the startup script starts again: **Restart Script** in **Errors**, **Advanced › Restart Startup Script**, **Save** with changes, its restart after a failure | end |
| the startup script is stopped or replaced: **Stop** under **Scripts** in the agent window, a changed script, a profile switch | end |
| the startup script exits by itself, with any code | stay: the last report may say why it gave up; after a failure, until its restart |
| the phone disconnects | end; nothing is kept while no phone is connected |

- An update the agent refuses with a 400 is listed too, as **Drawing rejected** with its reason. `clear` doesn't end that row; the next update the agent accepts for the button does ([Errors](#errors)).
- `get_startup_script_status` gives an AI app the same reports ([Use with an AI app › Tools the assistant gets](?p=ai#tools-the-assistant-gets)).

Report on a change, and `clear` once. The agent sends each row to the phone at most once a second however often a script posts, but every post costs the loop a curl. This function, pasted after the helpers, posts only when the kind or the words change:

<!-- verified 2026-10-02, agent 1.2.3 (build 8), harness -->
```zsh
# part of a startup script, after the helpers: report kind and words on a change, clear once
# report KIND [WORDS] → the phone lists why this button is stale; report ok clears it
reported='ok|'                       # sends changes only; each start begins with nothing reported
report() {
  [[ "$1|$2" == "$reported" ]] && return 0
  if [[ $1 == ok ]]; then
    call error "{\"cellId\":\"$cell\",\"clear\":true}"
  else
    call error "{\"cellId\":\"$cell\",\"kind\":\"$1\",\"message\":$(json "$2")}"
  fi && reported="$1|$2"             # kept only on a 200: after a 503 the next pass sends it again
}
```

Call it as `report auth "GitHub answered 401: Bad credentials"`, and as `report ok` once the call works again. [Live widgets › Report what went wrong](?p=live-widgets#report-what-went-wrong) shows it in a loop.

### From a tap script

A tap or long-press script reports right before it gives up. The toast after the tap, a short note at the bottom of the screen, then shows the kind's headline and your `message`, here "App not running" and "Music is not running", and **Earlier** in **Errors** keeps both:

<!-- verified 2026-10-02, agent 1.2.3 (build 8), harness; shownAs actionAnswer checked against code -->
```zsh
# part of a tap script, after the helpers: say why, then give up
if ! pgrep -xq Music; then
  call error "{\"cellId\":\"$cell\",\"kind\":\"notRunning\",\"message\":\"Music is not running\"}"
  exit 1
fi
```

Run from Terminal, the same lines get `"shownAs":"buttonError"`: nothing was tapped, so the report is the button's error until it is cleared, the button's startup script starts again or is stopped, or the phone disconnects.

## GET /api/audio/levels

Gives the Mac's sound as one line of text, for widgets that move with music. [Scenes and sound › Music levels](?p=scenes-and-sound#music-levels) builds a spectrum on it.

Ask for `/api/audio/levels?client={{CELL_ID}}`. The answer is one line of 25 fields, a word and 24 numbers, one space apart:

```text
ok 1 31 34 1 12 18 25 31 36 34 29 26 22 20 18 16 15 13 11 10 8 6 4 2
```

| Place | Field | Values | What it means |
|---|---|---|---|
| 1 | state | `ok`, `starting`, `error`, `unsupported` | `starting` while the first request sets up listening; `error` while the agent cannot listen; `unsupported` on a Mac that cannot. |
| 2 | audible | 0 or 1 | 1 when there was sound in the last 2 s. |
| 3 | bass | 0 to 40 | The bass, from 35 to 150 Hz. |
| 4 | pulse | 0 to 40 | About 35 right after a beat, back to 0 within a quarter of a second. |
| 5 | beat | 0 or 1 | 1 when a beat came since this client's previous request. |
| 6 to 25 | bars | 0 to 40 | Twenty bars from 35 Hz to 14 kHz. |

- `client` names who asks: pass your `{{CELL_ID}}`. Bars and bass are the peaks since that client's previous request. The agent keeps up to 64 clients and forgets one that has been quiet for 10 s.
- `read -rA f <<< "$answer"` splits the line: `$f[1]` is the state, `$f[6,25]` the bars.
- Ask only while the button is on screen ([`on_screen`](#get-apiview)), up to 15 times a second, over one connection.
- The agent stops listening 5 s after the last request.

> [!NOTE]
> The first request makes macOS ask once whether Desktap Agent may record system audio. If you say no, the line stays `ok` with zeros while music plays: allow it in **System Settings › Privacy & Security › Screen & System Audio Recording**, under **System Audio Recording Only**.

## Limits

Every limit you can run into, in one place. There is no rate limit: the phone shows what it can, the answers say when to slow down, and [Live widgets › Pace](?p=live-widgets#pace) says how often to send.

| Limit | Value |
|---|---|
| Tap and long-press scripts, AppleScript and Shortcuts, also as notification actions | 60 s, with everything they started ([How scripts run › Time limits and stopping](?p=scripts#time-limits-and-stopping)) |
| Startup scripts | no time limit |
| `update-button` body | 1 MB |
| `svg.source` and `svg.landscapeSource` | 64 KB each |
| `svg.duration` | 0 to 10 s |
| `notify` body | 256 KB |
| `error` body | 4 KB |
| An error report's `message` | 500 characters; a longer one is cut |
| Request line and headers | 16 KB |
| A request, from its first byte | 10 s |
| An idle connection | closed after 30 s |
| Open connections | 256 |
| Posts with a new curl for each | about 540 a second, for all scripts together |
| Action buttons | 4 per notification |
| The text of an action's command | 4,000 characters |
| A Text Snippet | 10,000 characters |
| Notifications waiting for the phone | 20, for 12 hours |
| One script | 256 KB ([How scripts run › Storage and size limits](?p=scripts#storage-and-size-limits)) |
| One button with its scripts and saved drawing | 750,000 bytes; the editor says "Button Too Large" |
| Music level clients | 64, each forgotten after 10 s |
| Errors the agent keeps (reports and refused updates) | 200 that still hold; a new report then gets 429 |
| Error updates sent to the phone | at most one a second for each error |
