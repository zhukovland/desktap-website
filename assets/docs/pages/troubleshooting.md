<!-- updated: 2026-10-05 -->
# Troubleshooting

Find what you see in the first column of a table: the exact text of an error, or what the button does. The row says why it happens and what to do, and links to the page with the details.

Most fixes start with the error text. Here is where to read it:

- **The ⚠ count** next to your Mac's name at the top of the deck: tap it for **Errors**, the list that says why. A startup script that fails is there from its first failure, with `Exit code N:` and the end of what it printed to stderr; so is what a script reported, and an update that Desktap Agent, the app on your Mac, refused. The same script error is under **Advanced › Status** and, for a Failed script, under **Scripts** in the agent window on the Mac.
- **A toast**, a short note at the bottom of the screen, after a tap or long press that failed: what went wrong and the start of the error text. **Details** opens the list on it. A tap that worked shows nothing.
- **The agent's answer** to an update. The helpers in these docs print every `400` to stderr, and the list shows the reason too, under **Drawing rejected**.

<div class="link-cards">

- [The phone doesn't connect](#the-phone-doesnt-connect) — the Mac is not in the list, or pairing stops.
- [Nothing changes on the button](#nothing-changes-on-the-button) — the update went out, the button looks the same.
- [A button or widget doesn't work](#a-button-or-widget-doesnt-work) — the ⚠ count, a toast after a tap, a script that ends.
- [Errors from the agent](#errors-from-the-agent) — a status code and a message from Desktap Agent, curl or zsh.
- [SVG faces](#svg-faces) — a frame refused, a cross-fade, a chart that wobbles.
- [Notifications](#notifications) — no banner, or an action button that does nothing.
- [Permissions](#permissions) — what macOS asks, and what a refusal looks like.
- [AI apps](#ai-apps) — the assistant doesn't see Desktap.

</div>

## The phone doesn't connect

Your iPhone or iPad finds the Mac on the same Wi-Fi and pairs with it once, with a code. After that it reconnects by itself.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| "Make sure Desktap Agent is running on your Mac" | The phone finds no agent on this network: Desktap Agent is not running, its **Setup** has not reached **Connect your iPhone or iPad**, or the Mac is on another Wi-Fi. | Open Desktap Agent from Applications and go on in **Setup** to **Connect your iPhone or iPad**. Put the phone and the Mac on the same Wi-Fi. [Get started › Install Desktap Agent on your Mac](?p=start#install-desktap-agent-on-your-mac) |
| "Can't find your Mac? Turn on Local Network for Desktap in Settings." | Desktap has no permission to use the local network, so it can't see the Mac. | Tap **Open Settings** and turn on **Local Network**. [Get started › Pair your iPhone or iPad](?p=start#pair-your-iphone-or-ipad) |
| "Too many incorrect codes." or "Pairing is blocked on this Mac…" | Three wrong codes end one pairing request. Five wrong codes since the last successful pairing block pairing on the Mac. | Tap **Try Again** and pair with the new code. If pairing is blocked, first click **Allow Pairing** on **Overview** or **Devices** in the agent window (**Show Agent Window** in the menu-bar icon's menu), then pair again. [Get started › Pair your iPhone or iPad](?p=start#pair-your-iphone-or-ipad) |
| "“Mac” is in use by another device. Desktap will connect when it's free." | The Mac serves one phone at a time, and the one used most recently wins. | Close Desktap on the other iPhone or iPad. This one connects as soon as the Mac is free. [Working from your Mac › When live widgets don't start](?p=from-your-mac#when-live-widgets-dont-start) |

</div>

## Nothing changes on the button

The update reached the agent, but the button looks the same. Read the agent's answer first: in most cases it says why.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| `"visible": false` in the answer | The button is not on screen: another page, a page past the Free plan, or Desktap in the background. An ID no button has gets the same answer. | Nothing to resend: the button shows its newest look when it appears. If it is on screen, copy its ID again from **Advanced › Button ID**. [Live widgets › Finding a button's ID](?p=live-widgets#finding-a-buttons-id) |
| `"dropped": true` in the answer | The phone is not reading right now: it can't keep up with what the page sends. | Don't resend: the phone gets the newest look when it reads again. Until the answers stop saying so, send one update every few seconds. If it keeps happening, the page asks too much of the phone. [Live widgets › Pace](?p=live-widgets#pace) |
| `503` `No device connected` | No phone is connected to this agent. The agent runs its `400` checks first, so a broken update still says what is wrong. | Open Desktap on the phone and connect to this Mac. If two copies of Desktap Agent are running, such as a Debug build next to the release, quit one. [Script API › Status codes](?p=api#status-codes) |
| Nothing printed, and `$code` is `000` | No answer came, and `-s` keeps curl silent: the agent is not running, its **Setup** is not finished, or it is paused for another macOS user. | Start Desktap Agent and finish **Setup**. If its menu reads "Paused — another user is using this Mac", switch back to your macOS account. [Working from your Mac › The menu](?p=from-your-mac#the-menu) |
| A new `title`, `icon` or `emoji` never shows | The button has an SVG face, saved in the editor or sent by a script, and the face replaces the icon and the name. | Draw the text into the face. Or remove the face: send `"svg":{"remove":true}` for one a script sent, or tap **Remove SVG Drawing** under **Icon › SVG Drawing** for a saved one. [SVG faces › A first face that moves](?p=svg-faces#a-first-face-that-moves) |
| An `svg` update with only `duration`, `easing` or `fit` does nothing | The button has no face yet, and without one the phone ignores the settings. The agent still answers `200`. | Send the settings together with `source`, in every frame. [Script API › The svg object](?p=api#the-svg-object) |
| The button jumps between two looks | Two scripts draw the same button, such as its tap script and its startup script. | Let one script draw. The tap changes a file or the Mac itself; the startup script notices and draws. [Button logic › Taps change state, the loop draws](?p=button-logic#taps-change-state-the-loop-draws) |

</div>

## A button or widget doesn't work

A button that doesn't work keeps its look: Desktap draws nothing on it. The ⚠ count next to your Mac's name counts such buttons, and tapping it opens **Errors**. A tap that fails flashes its button red and says why in a toast.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| ⚠ and a number, orange, next to the Mac's name | At least one button doesn't work now: its startup script ended with an error, its script reported a problem, or the agent refused an update. The number also counts startup scripts that don't run. | Tap it and read the row: what went wrong, the error text and a hint. Fix what it names, then tap **Restart Script**. [Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work) |
| ⚠ and a number, gray | Nothing fails now, but that many startup scripts don't run: each ended with exit code 0, which is never restarted, or was stopped on the Mac. | If a script ends right after each start, it reaches its last line: keep the work inside `while true; do … done`. Then tap **Restart Script**. [How scripts run › Restarts and states](?p=scripts#restarts-and-states) |
| "Script crashed" or "Script keeps failing" | The startup script ends with an error, and the agent starts it again: after 5, 10, 20, 40 and 60 s ("Script crashed"), then every minute ("Script keeps failing"). An error the agent recognizes gets its own headline, such as "Not found". | Read the error text under it: `Exit code N:` and the end of what the script printed to stderr. After the fix the row stays a minute, then moves to **Earlier**. [How scripts run › Restarts and states](?p=scripts#restarts-and-states) |
| "Drawing rejected" | The agent refused an update the script sent, and the error text is its reason. The button keeps its last look. | Fix what the reason names: [Errors from the agent](#errors-from-the-agent), [SVG faces](#svg-faces). The row moves to **Earlier** once the agent accepts an update for the button. |
| A red flash, a shake and a toast, such as "Not found" | The tap or long press failed. The toast names the problem and shows the start of the error text, as in `zsh:3: command not found: ffmpeg`. | Tap **Details**: the row shows more of the error text and, for a known problem, a hint. Touch and hold it for **Copy Error**, which copies all of it. To watch each error as it happens, [try the script in Terminal](?p=from-your-mac#try-a-script-in-terminal-first). |
| "Not connected to a Mac" | The tap was not sent: no Mac is connected. | Tap **Connect**. [The phone doesn't connect](#the-phone-doesnt-connect) |
| "A deck problem is blocking this button", or "1 problem on this deck" | Something on the deck can't run or be shown as it is, and the **Problems** list says why, such as "It overlaps another button…", "It lies outside the grid…" or "Another button uses the same ID…". A blocked button's tap is not sent. | Tap **Review**. In the **Problems** list, **Show Button** finds it; **Delete** the one you don't need, or, for a shared ID, tap **Keep This Copy** on the one you want. [How scripts run › When startup scripts run](?p=scripts#when-startup-scripts-run) |
| A widget shows an old value, and nothing says why | The script survives its failure, such as no network or a refused key, and reports nothing. | Let the script report the problem when it changes, and clear the report once the call works again. [Live widgets › Report what went wrong](?p=live-widgets#report-what-went-wrong) |
| Works in Terminal, fails from Desktap, often with `command not found` | The agent starts scripts with `zsh -f` in `/`: no shell profile, a fixed `PATH`, often no `LANG`. | Use full paths (`cd "$HOME/Projects/app" \|\| exit 1`), put `export LC_ALL=C` at the top, and extend `PATH` in the script: `export PATH="$HOME/.local/bin:$PATH"` for `claude`. [How scripts run › How a script starts](?p=scripts#how-a-script-starts) |
| A dialog to install developer tools keeps coming back | The script calls `python3`, `git` or `swift`. Without the Command Line Tools, each only offers the install, and a failing startup script retries every minute. | Rewrite that part in zsh with awk, sed, curl and jq: every Mac has them. [How scripts run › Tools every Mac has](?p=scripts#tools-every-mac-has) |
| "Another Desktap Agent (…) is already running in this account…" | Two copies of the agent are running, such as a Debug build and the release. Only the one named in parentheses runs live widgets. | Quit one of them. The scripts then start by themselves. [Working from your Mac › When live widgets don't start](?p=from-your-mac#when-live-widgets-dont-start) |
| "Port 9848 is …" or "Another app in this account is using port 9848…" | Another program or the agent of another macOS account holds the port that scripts talk to, or the last run's connections are still closing. | Quit that program (`lsof -nP -iTCP:9848 -sTCP:LISTEN` names it), or the agent in the other account. Live widgets start by themselves as soon as the port is free. [Working from your Mac › When live widgets don't start](?p=from-your-mac#when-live-widgets-dont-start) |
| After **Stop**, the button shows an old value again | The `TERM` trap has no `exit 0`, so the loop keeps drawing until it is killed 2 s later. | End the trap with `exit 0`: `trap '…; exit 0' TERM INT`. [How scripts run › One trap, run once](?p=scripts#one-trap-run-once) |
| The trap's cleanup runs twice, or never | Twice: `trap cleanup EXIT` next to `trap 'cleanup; exit 0' TERM`. Never: in zsh, an EXIT trap alone does not run when the script is stopped. | Use one trap and no EXIT trap: `trap 'cleanup; exit 0' TERM INT`. [How scripts run › One trap, run once](?p=scripts#one-trap-run-once) |
| A button keeps a script's title or face after the script ended | A script that ends by itself leaves its last look. When the agent stops a script, it clears only that script's own button. | Send `reset` before the script exits, and from its trap for every other button it drew. On the phone, save a change to the button or tap **Restart Startup Script**. [Live widgets › What brings back the saved look](?p=live-widgets#what-brings-back-the-saved-look) |
| "Its tap action is larger than 256 KB…" or "Button Too Large" | The limits: 256 KB per script (the message names which one), 64 KB per drawing ("Its drawing is larger than 64 KB…"), 750 KB per button. | Make it smaller: keep data in files in the storage folder, and round the numbers in a drawing to one decimal. [How scripts run › Storage and size limits](?p=scripts#storage-and-size-limits) |
| A second tap does nothing | The first run of the tap script is still going (the button pulses), and the phone sends no new tap until it ends. | Wait, or tap **Stop Process** under **Tap** in the button's editor. A tap script ends after 60 s at the latest. [How scripts run › Time limits and stopping](?p=scripts#time-limits-and-stopping) |
| A tap script stops halfway, with the toast "No answer in time" | Tap and long-press scripts are stopped after 60 s, together with everything they started; the error text reads `Timed out after 60s`. | Let the tap only request the job, and let the startup script do it: it has no time limit. [Recipes: timers, alerts and triggers › Long job with a report](?p=recipes-alerts#long-job-with-a-report) |
| A widget starts over after a reconnect | Each time the phone connects, every startup script starts from scratch, and nothing in memory survives. | Keep what the script must remember, such as an end time, in a file under `$DESKTAP_STORAGE`. [Button logic › Remembering things](?p=button-logic#remembering-things) |

</div>

<div class="shot-pair">
<img src="assets/docs/img/troubleshooting/deck-problems-1.png" width="240" height="521" alt="The deck with the banner “1 problem on this deck” and Review, two overlapping buttons, Notes and Mail, and at the bottom the toast “A deck problem is blocking this button” with Review.">
<img src="assets/docs/img/troubleshooting/deck-problems-2.png" width="240" height="521" alt="The Problems list with one row: Mail, Default › Main · row 2, column 2, “It overlaps another button, so it doesn’t run.”, Show Code, Show Button and Delete.">
</div>

## Errors from the agent

The agent answers every request with a status code and a JSON body; this table lists the answers other than `200`. Key order in a body varies and `/` may come as `\/`, so match a part of the text, never all of it.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| `401` `{"error":"Unauthorized"}` | The request had no valid script token: one pasted into the script (it changes every time the agent starts), or an empty `$DESKTAP_TOKEN`, as in Terminal. | In a button script, use the curl form with `--variable '%DESKTAP_TOKEN='`. In [AppleScript](?p=scripts#using-applescript), run that curl inside `do shell script`: the shell already has the token. From Terminal or another program, see [Working from your Mac](?p=from-your-mac#send-one-update-by-hand). [Get started › The curl line, explained](?p=start#the-curl-line-explained) |
| `403` `Requests from web pages are not accepted.`, `421` `Misdirected request: …` | The request looked like it came from a browser (it had an `Origin` header) or named another host. | Send it from a script or Terminal, straight to `http://127.0.0.1:9848`, with no proxy. [Script API › Status codes](?p=api#status-codes) |
| `403` `This endpoint is only for the Desktap MCP server …` | The route serves the agent's own tools, not button scripts: `/api/config`, for example. | To find button IDs, use **Advanced › Button ID › Copy**, `{{CELL_ID}}` or `GET /api/view`. [Live widgets › Finding a button's ID](?p=live-widgets#finding-a-buttons-id) |
| `404` `{"error":"Not found"}` | No such route: a typo, a slash at the end, or the wrong method, such as `GET` for `update-button`. With `-d`, curl sends `POST`. | A script has six routes: check the path and the method, and send a `GET` without `-d`. [Script API › Endpoints](?p=api#endpoints) |
| `413` `{"error":"Request too large"}` | The body is over the limit: 1 MB for an update, 256 KB for a notification, 4 KB for an error report. Or the URL and headers together pass 16 KB. | Send a smaller frame, a shorter notification or a shorter error report. [Script API › Limits](?p=api#limits) |
| `400` `Malformed request` or `Send the body with a numeric Content-Length; …` | The agent can't read the request as plain HTTP: two `Authorization` headers, a header line without `:`, a chunked body. | Use the curl form from these docs and pass the body with `-d` or `-d @-`. [Script API › Status codes](?p=api#status-codes) |
| `400` `Invalid JSON` or `Missing request body` | No body, or one the agent can't read: `cellId` missing or not an ID, a wrong type (`"title":5`, `"duration":"1"`), an unknown `fit` or `easing`, an unescaped quote or line break, a decimal comma (`0,5`). | Build text with `jq -n --arg` and frames with the `json()` helper. Put `export LC_ALL=C` at the top, so numbers keep their decimal point. [How scripts run › Text in JSON](?p=scripts#text-in-json) |
| `400` `Unknown field(s): …` | The agent doesn't know a field name, often a wrong or misspelled one such as `label` or `svg.src`. | The message lists the valid fields: use one of them. [Script API › Fields](?p=api#fields) |
| `400` `Invalid color format. Expected #RRGGBB.` | `color` is not `#` and six hex digits (`#FFF`, `red`), so the agent refuses the whole update. | Write it like `#30D158`. Inside an SVG, `#FFF`, `rgb()` and color names work too. [Script API › Fields](?p=api#fields) |
| `400` `kind must be one of: …`, `kind is required: …` or `cellId must be the button's UUID ({{CELL_ID}} in its script).` | An error report the agent can't use: an unknown kind (case counts: `network`, not `Network`), no Button ID in `cellId` (in Terminal, a `{{CELL_ID}}` left unreplaced), or neither `kind` nor `"clear": true`. | Send `cellId` with a `kind` and, if you like, a `message`; once it works again, `cellId` with `"clear": true`. [Script API › POST /api/error](?p=api#post-apierror) |
| `500` `Frame not sent: …` | The agent could not hand the update to the connection. | Send the next update as usual. If it keeps happening, reconnect the phone. [Script API › Status codes](?p=api#status-codes) |

</div>

### Errors from curl and zsh

These come from the tools themselves, so they show in the script's error output, not in an answer.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| `curl: option --variable: variable expansion failure` | `$DESKTAP_TOKEN` is not set, and the `=` is missing in `--variable '%DESKTAP_TOKEN='`. | Write the option with the `=` at the end. A missing token then gets a plain `401`. [Get started › The curl line, explained](?p=start#the-curl-line-explained) |
| `Can't assign requested address`, or `000` for every script at once | Too many short connections: above about 540 updates a second, all scripts together, the Mac runs out of ports. | Let a loop that posts more than once a second send everything over one connection. [Scenes and sound › One connection for fast loops](?p=scenes-and-sound#one-connection-for-fast-loops) |
| `read-only variable: status` | In zsh, `status` is a special variable, and the script stops at that line. | Use another name, such as `code`. [How scripts run › Writing zsh for Desktap](?p=scripts#writing-zsh-for-desktap) |
| `no matches found: http://…?…` | zsh reads the `?` in an unquoted URL as a file pattern, finds no file and stops the script. | Put the URL in double quotes: `"…/levels?client=$cell"`. [How scripts run › Writing zsh for Desktap](?p=scripts#writing-zsh-for-desktap) |

</div>

## SVG faces

The agent checks every frame before the phone sees it. A `400` names the problem; a `200` may still carry `warnings` and `crossFade`.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| `svg.source rejected: XML error at line L, column C: premature end of document…` | The frame is not well-formed XML: an `&` or `<` in text, a tag left open, or a frame cut short by shell quoting. | Write `&amp;` and `&lt;` in text. Save the frame to a file and look at the line the message names. [SVG reference › Errors and warnings](?p=svg-reference#errors-and-warnings) |
| `svg.source rejected: svg needs a viewBox (or width/height)` | The `<svg>` element has no size. The answer writes it as `width\/height`. | Give it the viewBox of the button's size, such as `viewBox="0 0 200 200"` for Normal and Large. [SVG faces › Sizes and the turned phone](?p=svg-faces#sizes-and-the-turned-phone) |
| `svg.source rejected: The document draws nothing …` | Nothing in it can be drawn: only unsupported elements, shapes inside `<defs>`, or empty `<text>`. | Draw with `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` and `text`. [SVG reference › Supported SVG](?p=svg-reference#supported-svg) |
| `path: Unknown command n`, `path: Missing y coordinate` or another `path:` error | A number in a path came out as `nan`, `NaN`, `inf` or nothing at all: a division by zero, or a variable with no value. | Guard the math in awk and give empty values a default. Save the frame to a file to find the spot. [SVG reference › Errors and warnings](?p=svg-reference#errors-and-warnings) |
| `SVG is too complex: it expands to N path commands …` | A detailed clip-path, gradient or dash pattern is set on a group of many shapes. | Set it on fewer shapes, or simplify it. [SVG reference › Errors and warnings](?p=svg-reference#errors-and-warnings) |
| `svg.source is too large (max 64 KB).`, `…must be an <svg> document.` | The frame is over 64 KB, or the text holds no `<svg` at all: an empty variable, or a file name instead of the file. | Round numbers to one decimal and use fewer points. For a file, send its content. [Script API › The svg object](?p=api#the-svg-object) |
| `"warnings"` in the answer, or the face looks different on the phone | The phone left out part of the drawing; each warning names what and why. It draws no filters, style sheets, classes, images or `<use>`. | Fix the drawing until the answer has no `warnings`. Paste a frame into **Icon › SVG Drawing** to see the same list. [SVG reference › What is not drawn](?p=svg-reference#what-is-not-drawn) |
| The face cross-fades instead of gliding | Something other than numbers, colors and text changed between two frames, or between the saved drawing and the first frame a script sends. | The answer's `crossFade` names the first difference from the previous frame and the fix. Usual causes: an element added or removed, a changed `id`, a paint switching to `none` or `currentColor`. Build the saved drawing from the same template. [SVG faces › What makes a face cross-fade](?p=svg-faces#what-makes-a-face-cross-fade) |
| A chart wobbles up and down at every sample | Each sample shifts the values by one point, so every point glides up or down to its neighbor's value. | Scroll the chart instead: a rest frame, then a slide frame that moves a group to the left. [SVG faces › Charts that scroll](?p=svg-faces#charts-that-scroll) |
| A scrolling chart pauses or jumps back at every step | The slide's `duration` doesn't match the loop's real period: a shorter one pauses, a longer one jumps back. | Measure the period and use it as the `duration`, at most 1.1 × the period. Keep the period at 1 s or more. [SVG faces › Charts that scroll](?p=svg-faces#charts-that-scroll) |
| A needle, hand or ticker stops and starts | Each glide ends before the next frame arrives. | For motion that never stops, use `"easing":"linear"` and a `duration` of 1.25 × your interval. [SVG faces › Cost on the phone](?p=svg-faces#cost-on-the-phone) |
| Text is invisible, or a shape doesn't cover it | Text without `fill` is black on the dark button. Every `<text>` is drawn above every shape. | Set `fill` on every `<text>`, such as `fill="white"`, and place text where no shape has to cover it. [SVG faces › Text](?p=svg-faces#text) |
| A ring drawn as an arc crumples on a big jump | An arc drawn as a `<path>` folds into a loop on its way to the new angle. | Draw the ring as a `<circle>` with `stroke-dasharray` and `stroke-dashoffset`. [SVG faces › Rings and gauges](?p=svg-faces#rings-and-gauges) |
| Text is tiny, or the face shrinks when the phone turns | The viewBox doesn't match the button's shape, the font is too small, or a Wide or Tall face has no landscape variant for the turned phone. | Use 200×200 for Normal and Large, 400×200 for Wide and 200×400 for Tall, and text of at least 28 (on Large: 16 for labels, 22 for values). Send `landscapeSource` with every frame of a Wide or Tall face. [SVG faces › Sizes and the turned phone](?p=svg-faces#sizes-and-the-turned-phone) |
| An imported icon is all black | It has no `fill`, so it is drawn black, or it colors itself with CSS classes, which the phone ignores. | Export with presentation attributes, and put `fill="currentColor"` on the root `<svg>`. [SVG faces › Icons from design tools](?p=svg-faces#icons-from-design-tools) |

</div>

## Notifications

The answer to `POST /api/notify` says where a notification went. Whether it shows is up to the phone and the Mac.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| No banner on the phone, though the answer says `"phone":"sent"` | "sent" means handed to the phone, not shown. With no `reason` in the answer, Desktap was on screen, so its notifications may be off. | Allow them in Settings › Notifications › Desktap; the phone asks for permission when the first one arrives. [Notifications › Where it arrives](?p=notifications#where-it-arrives) |
| `"reason":"background"` in the answer | Desktap is not on screen, so the banner may not show now. About 30 s after Desktap leaves the screen, iOS suspends it: the banner then shows only when Desktap is opened, or never if it is closed first. | Send what must not be missed to the Mac too: `"targets":["phone","mac"]`, or post it again with `["mac"]` when the answer has this reason. [Notifications › Where it arrives](?p=notifications#where-it-arrives) |
| `"phone":"queued"` | No phone was connected. The agent keeps up to 20 notifications for 12 hours and sends them when the phone connects; quitting the agent drops them. | Connect the phone. [Notifications › Where it arrives](?p=notifications#where-it-arrives) |
| `"mac":"denied"` | Desktap Agent is not allowed to show notifications on this Mac. | Allow it in System Settings › Notifications › Desktap Agent: **Open System Settings** under **Permissions › Notifications** in the agent window opens that page. To keep a notification on screen until you act, set its alert style to **Persistent**. [Notifications › Where it arrives](?p=notifications#where-it-arrives) |
| `403` `Notification actions that run something can only be sent …` | The sender is not a running button script: Terminal, a hook, an AppleScript button, or a job left behind after its script ended. | Send it from the button's startup, tap or long-press script while that script runs, or keep to harmless actions such as an `https` link. For other programs: [Working from your Mac](?p=from-your-mac#let-other-programs-drive-a-button). [Notifications › What the person sees](?p=notifications#what-the-person-sees) |
| `400` `“origin” is set by the Desktap Agent …` | The body has an `origin` field, which the agent sets itself. | Leave `origin` out. [Script API › Notification errors](?p=api#notification-errors) |
| `400` `action “<id>”: …` | The message names the first rule an action breaks: a hidden character, a command over 4,000 characters, a line break in a title, an unknown command type, a command in a `sensitive` notification. | Fix what it names and send again. Put a long command in a script and call that. [Notifications › Action buttons](?p=notifications#action-buttons) |
| `400` `Invalid notification JSON: …` or `Body must be a JSON object.` | The body is not the shape the agent expects. "…is missing": a required key is absent, such as `title` or an action's `id`. "…isn’t in the correct format": a value has the wrong type. | Build the body with `jq -n --arg`. [Script API › Notification errors](?p=api#notification-errors) |
| `400` `title is required.`, `At most 4 actions are supported.` and similar | Exactly what it says: a blank title, more than four actions, two actions with the same `id`, an action without `id` or `title`. | Fix that field. [Script API › Notification errors](?p=api#notification-errors) |
| "Run on your Mac?" (phone) or "Run this from a notification?" (Mac) | The action runs something, and a program on the Mac sent it, not a button's own script. | Tap **Run on Mac** (on the Mac, click **Run**) only if you expected it. Send it from the button's own script, and the question goes away. [Notifications › What the person sees](?p=notifications#what-the-person-sees) |
| Tapping an action does nothing | It runs only on the Mac that sent the notification. The phone waits up to 10 minutes to reach that Mac; success shows nothing. | Connect the phone to that Mac, and unlock the Mac: an action with a command runs only on an unlocked Mac. [Notifications › What the person sees](?p=notifications#what-the-person-sees) |
| An action flashes its button red, with a toast such as "Still running" | The action failed. A shell action runs as a tap on the button in `cellId`, so it is refused while that button's tap script runs ("Process already running for this button"). A Switch Page action never works from a notification. | Wait until the tap script ends. To open a page, tap the notification itself instead: it opens its button's page. [Notifications › Action buttons](?p=notifications#action-buttons) |

</div>

## Permissions

The agent runs every script, so macOS asks in the name of **Desktap Agent** and remembers your answer. **Permissions** in the agent window lists each permission, whether it is granted and what stops working without it.

<div class="stack-table">

| What you see | Why | What to do |
|---|---|---|
| macOS asks whether Desktap Agent may control an app | A script or an action sends Apple Events to that app; macOS asks once per app. After a refusal, such scripts fail with `Not authorized to send Apple events to …`. | Allow it. After a refusal, a toast or the row in **Errors** reads "Automation access needed": the row's **Open Settings on Mac** opens System Settings › Privacy & Security › Automation. Turn on the app under Desktap Agent there. [How scripts run › macOS permissions](?p=scripts#macos-permissions) |
| "Accessibility Access Needed" in the agent window | A key combination, a Text Snippet or most System Actions need Accessibility, and the agent doesn't have it. On the phone, the button flashes red, and the toast reads "Accessibility access needed". | Click **Open Settings** (or **Grant Access** under **Permissions**) and turn on Desktap Agent, or do it in System Settings › Privacy & Security › Accessibility. Or tap **Details**, then **Open Settings on Mac**, on the phone. [How scripts run › macOS permissions](?p=scripts#macos-permissions) |
| Music levels stay at zero while music plays | System Audio Recording was refused for Desktap Agent, and the refusal is silent. | In System Settings › Privacy & Security › Screen & System Audio Recording › System Audio Recording Only, turn on Desktap Agent. [Scenes and sound › Music levels](?p=scenes-and-sound#music-levels) |

</div>

## AI apps

If your AI app doesn't list Desktap's tools, or its card under **AI Assistants** in the agent window shows an orange line, see [Use with an AI app › If the assistant doesn't see Desktap](?p=ai#if-the-assistant-doesnt-see-desktap). A change the assistant makes appears only after you tap **Accept** on the phone ([Use with an AI app › Reviewing a change on the phone](?p=ai#reviewing-a-change-on-the-phone)).
