<!-- updated: 2026-10-05 -->
# Notifications

A script can show a notification on your iPhone or iPad, on your Mac, or on both. Like any system notification, it has a title, a subtitle, a body and a sound, but no pictures or HTML. It can carry up to four action buttons, and each can run a command on the Mac when you tap it.

Use a notification for news that must reach you while you look elsewhere: a disk that fills up, a timer that runs out, a long job that finishes. For everything else, change the button itself.

## Your first notification: low disk space

This is the free-disk widget from [Live widgets](?p=live-widgets#your-first-live-widget-free-disk-space) with a warning added. The button shows the free space: green, or red below 10 GB. The first time the space drops below 10 GB, the script warns you on the phone and on the Mac. It warns again only after the space has recovered and dropped again.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Disk space alert: free GB, warns below 10 GB
pause=10                                          # seconds between two checks
limit=10                                          # warn below this many GB free
# ── Desktap helpers (the same in every recipe) ──
export LC_ALL=C                      # awk and printf write 0.5, never 0,5
cell="{{CELL_ID}}"                   # Desktap puts this button's ID here
api="http://127.0.0.1:9848/api"

# call PATH [BODY] → $code (HTTP status, 000 = no answer) and $answer; curl reads the token itself
call() {
  local out; local -a data
  [[ -n $2 ]] && data=(-H 'Content-Type: application/json' -d "$2")
  out=$(curl -q -s -m 5 --variable '%DESKTAP_TOKEN=' \
    --expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}' \
    $data -w '\n%{http_code}' "$api/$1")
  code=${out##*$'\n'} answer=${out%$'\n'*}
  [[ $code == 400 ]] && print -u2 -r -- "$1: $answer"   # the agent says what is wrong
  [[ $code == 200 ]]
}
# post BODY → update-button; $dropped = 1 when the phone is not reading right now
post() {
  dropped=0
  call update-button "$1" || return
  [[ ${answer// /} == *'"dropped":true'* ]] && dropped=1
  return 0
}
# json TEXT → TEXT as a JSON string (quotes, backslashes, line breaks escaped)
json() {
  local s=$1
  s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/\\n}; s=${s//$'\r'/\\r}; s=${s//$'\t'/\\t}
  print -rn -- "\"$s\""
}
# ── end of helpers ──

# When the agent stops the script: back to the saved look, then end
trap 'post "{\"cellId\":\"$cell\",\"reset\":true}"; exit 0' TERM INT

marker=$DESKTAP_STORAGE/disk-alert/warned         # exists while a warning is out
mkdir -p "${marker:h}"

# warn FREE → one notification on the phone and the Mac, with a Storage Settings button
warn() {
  call notify "$(jq -nc --arg cell "$cell" --arg free "$1" '{
    cellId: $cell, title: "Disk space low", body: "\($free) GB left on the startup disk.",
    targets: ["phone", "mac"],
    actions: [{id: "storage", title: "Storage Settings",
      command: {openURL: {url: "x-apple.systempreferences:com.apple.settings.Storage"}}}]}')"
}

last="" sent_at=-100                              # nothing sent yet
while true; do
  free=$(df -g / | awk 'NR == 2 { print $4 }')    # free space on the startup disk, in GB
  if (( free < limit )); then color="#FF3B30"; else color="#34C759"; fi    # red or green
  if [[ $free != $last ]] || (( SECONDS - sent_at >= 30 )); then
    look="\"title\":$(json "$free GB free"),\"icon\":\"internaldrive.fill\",\"color\":\"$color\""
    post "{\"cellId\":\"$cell\",$look}" && last=$free sent_at=$SECONDS
  fi
  # Warn when the space drops below the limit, and again only after it recovered
  if (( free < limit )) && [[ ! -e $marker ]]; then
    warn $free && : > "$marker"                   # remembered only when the agent said 200
  elif (( free >= limit )); then
    rm -f "$marker"
  fi
  sleep $pause
done
```

Put it on a button as in Live widgets: **No Action** as the tap, a **Name** such as "Disk", the script in **Advanced › Startup Script › Write Script**, then **Add**.

> [!SEE]
> To try it now, set `limit` above your free space, for example `limit=10000`, and tap **Save**. The button turns red, and the notification arrives on the phone and on the Mac, with a **Storage Settings** button:
>
> ```text
> Disk space low
> 412 GB left on the startup disk.
> ```
>
> Not seeing it? → [Troubleshooting › Notifications](?p=troubleshooting#notifications)

What is new compared with the widget:

- `warn` builds the body with `jq -n --arg`, because `df` wrote the number, not you ([How scripts run › Text in JSON](?p=scripts#text-in-json)). `call notify` sends it and prints the agent's message to stderr if the body is wrong.
- `targets` names both the phone and the Mac: a full disk is the Mac's problem, so the Mac shows the warning too, even while Desktap is in the background on the phone ([Where it arrives](?p=notifications#where-it-arrives)).
- The one action button opens **Storage** in System Settings on the Mac. It deletes nothing, on purpose: an action sent by your own script runs on one tap, without asking first.

Finder may show more free space than `df`, because it also counts space that macOS can free up.

## Send on changes, not on every pass

The loop checks the disk every 10 seconds. A notification on each pass would buzz as often, so the script sends one only when something changes: here, when the space drops below the limit.

The file `disk-alert/warned` in the storage folder remembers that a warning is out:

- The script creates it only after the agent answers 200, so a warning that did not go out is tried again on the next pass.
- The script deletes it when the space has recovered.
- Every connection starts the script from scratch, and the file keeps a reconnect from warning twice ([Button logic › Remembering things](?p=button-logic#remembering-things)).

For news that keeps changing, such as the progress of a long job, give each notification the same `id`: the new one replaces the one before instead of piling up. The `id` must be a UUID, and the button's own ID is one:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
# Part of a startup script, after the helpers. Each call replaces the notification before it.
progress() {   # progress 40 → title "Backup", body "40% copied"
  call notify "$(jq -nc --arg cell "$cell" --arg done "$1" '{
    id: $cell, cellId: $cell, title: "Backup", body: "\($done)% copied", sound: false}')"
}
```

`sound: false` keeps the updates quiet.

## Action buttons

Each action button is an object in `actions`, at most four per notification:

| Field | Needed | What it is |
|---|---|---|
| `id` | required | a name for the button, unique in this notification, such as `"storage"` |
| `title` | required | the label on the button, one line that says what it does |
| `command` | optional | what runs on the Mac when someone taps it; without it, the button only closes the notification |
| `destructive` | optional | `true` draws the button in red |

Write the `command` as one of these objects. The full list, with every system action and key code, is in [Script API › POST /api/notify](?p=api#post-apinotify).

| The action button | `command` |
|---|---|
| opens a web page | `{"openURL":{"url":"https://example.com"}}` |
| opens a settings pane or an app link | `{"openURL":{"url":"x-apple.systempreferences:com.apple.settings.Storage"}}` |
| opens an app (find the ID with `osascript -e 'id of app "Activity Monitor"'`) | `{"launchApp":{"bundleIdentifier":"com.apple.ActivityMonitor"}}` |
| runs a shell command | `{"shellCommand":{"command":"open -a Console"}}` |
| runs a system action, here **Mute Mic** | `{"systemAction":{"_0":"muteMic"}}` |
| presses keys, here ⌘Space (`modifiers` is required: `[]` for none) | `{"keystroke":{"_0":{"keyCode":49,"modifiers":["command"]}}}` |
| types text | `{"textSnippet":{"text":"On my way"}}` |

One notification can mix them: **Join** (a meeting link), **Mute Mic** and **Reply** (typed text) side by side. Rules for every command:

- **It runs like a tap** of the button in `cellId`: the same environment, the same 60 s limit, and `{{CELL_ID}}` is that button's ID. It needs the same permissions too: keys, text and most system actions need Accessibility ([How scripts run › macOS permissions](?p=scripts#macos-permissions)).
- **It starts in `/`**, so `./deploy` fails. Write `cd "$HOME/Projects/app" && ./deploy rollback`, or use `$DESKTAP_STORAGE` and `$HOME`.
- **Keep it to a short line**: the notification shows the action's title, not its command, and an action from the button's own script runs on one tap ([What the person sees](?p=notifications#what-the-person-sees)). For more, let the startup script write a helper into the storage folder and have the action run it: `zsh "$DESKTAP_STORAGE/backup/retry.zsh"`.
- **Leave out `switchPage`**: the agent accepts it, but a tap on it fails ("switchPage is a local command and should not reach the agent"). To open the button's page, let the person tap the notification itself.

### Restart the focus timer from the notification

The focus timer on [Button logic](?p=button-logic#a-focus-timer-on-one-button) ends silently. This version of its startup script sends a notification when the time is up, with two action buttons: **Restart 25 min** and **Reset**. They do what a tap does: they change the file `focus/end`. The startup script is the only one that draws, and it shows the result on its next pass.

<div class="dt-mount" data-diagram="one-writer" data-mode="notification">A tap and a notification's action button both change one file in the storage folder; only the startup script draws the button.</div>

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Focus timer: counts down, notifies when the time is up
# ── Desktap helpers (the same in every recipe) ──
export LC_ALL=C                      # awk and printf write 0.5, never 0,5
cell="{{CELL_ID}}"                   # Desktap puts this button's ID here
api="http://127.0.0.1:9848/api"

# call PATH [BODY] → $code (HTTP status, 000 = no answer) and $answer; curl reads the token itself
call() {
  local out; local -a data
  [[ -n $2 ]] && data=(-H 'Content-Type: application/json' -d "$2")
  out=$(curl -q -s -m 5 --variable '%DESKTAP_TOKEN=' \
    --expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}' \
    $data -w '\n%{http_code}' "$api/$1")
  code=${out##*$'\n'} answer=${out%$'\n'*}
  [[ $code == 400 ]] && print -u2 -r -- "$1: $answer"   # the agent says what is wrong
  [[ $code == 200 ]]
}
# post BODY → update-button; $dropped = 1 when the phone is not reading right now
post() {
  dropped=0
  call update-button "$1" || return
  [[ ${answer// /} == *'"dropped":true'* ]] && dropped=1
  return 0
}
# json TEXT → TEXT as a JSON string (quotes, backslashes, line breaks escaped)
json() {
  local s=$1
  s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/\\n}; s=${s//$'\r'/\\r}; s=${s//$'\t'/\\t}
  print -rn -- "\"$s\""
}
# ── end of helpers ──
trap 'post "{\"cellId\":\"$cell\",\"reset\":true}"; exit 0' TERM INT
state=$DESKTAP_STORAGE/focus/end         # the tap script writes the end time here
zmodload zsh/datetime                    # gives $EPOCHSECONDS and $EPOCHREALTIME

# New: the notification. Its two action buttons change the same file the tap script changes.
told=$DESKTAP_STORAGE/focus/told         # the end time we already sent a notification for
again='f="$DESKTAP_STORAGE/focus/end"; date -v+25M +%s > "$f.tmp" && mv "$f.tmp" "$f"'
stop='rm -f "$DESKTAP_STORAGE/focus/end"'
times_up() {
  call notify "$(jq -nc --arg cell "$cell" --arg again "$again" --arg stop "$stop" '{
    cellId: $cell, title: "Focus time is up", body: "Take a break, or start another round.",
    targets: ["phone", "mac"],
    actions: [{id: "again", title: "Restart 25 min", command: {shellCommand: {command: $again}}},
              {id: "reset", title: "Reset", command: {shellCommand: {command: $stop}}}]}')"
}

shown="" sent_at=-100
while true; do
  end=0
  [[ -r $state ]] && read -r end < "$state"
  [[ $end == <-> ]] || end=0             # no file, or not a number: no timer
  left=$(( end - EPOCHSECONDS ))
  if (( end == 0 )); then
    look='"title":"Focus","icon":"timer","color":"#8E8E93"'
  elif (( left > 0 )); then
    clock=$(printf '%d:%02d' $(( left / 60 )) $(( left % 60 )))
    look="\"title\":\"$clock\",\"icon\":\"timer\",\"color\":\"#FF453A\""
  else
    look='"title":"Done!","icon":"checkmark.circle.fill","color":"#30D158"'
  fi
  if [[ $look != $shown ]] || (( SECONDS - sent_at >= 30 )); then
    post "{\"cellId\":\"$cell\",$look}" && shown=$look sent_at=$SECONDS
  fi
  # New: notify once per finished timer, even after a restart (remembered only after a 200)
  told_end=0
  [[ -r $told ]] && read -r told_end < "$told"
  if (( end > 0 && left <= 0 && end != told_end )); then
    times_up && print $end > "$told"
  fi
  sleep $(( 1 - EPOCHREALTIME % 1 ))      # wake on the next whole second
done
```

The tap script stays as it is; the new parts of the startup script are marked `New`. The file `focus/told` holds the end time of the last round that got its notification, so each round gets exactly one, even when the script restarts. The loop runs only while the phone is connected: a round that ends while the phone is away gets its notification when the phone connects again.

> [!SEE]
> Set `minutes=1` in the tap script and tap the button. A minute later it reads **Done!** and the notification arrives. Tap **Restart 25 min**: within a second the button counts down again.

## What the person sees

The notification shows your title, subtitle and body exactly as you send them, and your action buttons. The agent adds nothing and cuts nothing. The focus timer's notification reads "Focus time is up" and "Take a break, or start another round.", with the action buttons **Restart 25 min** and **Reset**.

So an action's title is all the person reads before a tap runs it. Make it say what happens, such as **Restart 25 min** rather than **OK**. The command shows only when a tap asks first.

### When a tap asks first

The sender decides whether a tap runs an action at once:

| The action button | When you tap it |
|---|---|
| opens a web page (http or https) or an app, or runs a system action for media, volume, the microphone, brightness, Spotlight, Mission Control, Launchpad, Dark or Light Mode, or screenshots | it runs, whoever sent the notification |
| does anything else (a shell command, AppleScript, keys, text, a shortcut, another kind of link, Lock Screen, Sleep, Log Out, Empty Trash), sent by a button's script | it runs |
| does anything else, sent by another program on your Mac ([Working from your Mac](?p=from-your-mac#let-other-programs-drive-a-button)) | the full command shows first, and it runs only after the person confirms |

A button's script is its **Shell Command** (tap or long press) or its startup script, while it runs, with the programs it started.

These do not count: an **AppleScript** or **Run Shortcut** button, a background job that outlived its script, a script you try in Terminal. If their notification has an action that runs something, the agent refuses it with 403 "Notification actions that run something can only be sent by scripts the Desktap Agent started (startup, tap or long-press scripts)." To try the disk alert in Terminal, remove its action button first.

> [!SEE]
> When an action from another program asks first, the phone shows **Run on your Mac?** with the full command, **Run on Mac** and **Cancel**. The Mac shows **Run this from a notification?** with **Cancel** and **Run**.

<img src="assets/docs/img/notifications/run-sheet.png" width="280" height="608" alt="The phone’s “Run on your Mac?” sheet: “The notification action “Open Log” will run on MacBook Pro:”, the notification “Backup finished”, the command “open -a Console /tmp/desktap-demo/backup.log”, “Only run it if you expected this notification and recognize this command.”, and the buttons Run on Mac and Cancel.">

### What a tap does

| You tap | On the Mac | On the phone |
|---|---|---|
| the notification itself | nothing happens | Desktap opens the page of the button in `cellId`, switching profiles if needed |
| an action button without `command` | the notification closes | the notification closes |
| an action button with a command | it runs at once, or asks first as above; the Mac must be unlocked | Desktap opens, asks first if needed, and sends the command to the Mac that sent the notification; while that Mac is not connected, it waits up to 10 minutes |

Success is silent. When a command tapped on the phone fails, the button in `cellId` flashes red, and a toast, a short note at the bottom of the screen, says why, with **Details**; a failure on the Mac shows nothing.

> [!TIP]
> The Mac shows a notification's action buttons when you point at it. To keep notifications on screen, set Desktap Agent's alert style to **Persistent** in System Settings › Notifications.

### Sensitive notifications

Notification text shows on the lock screen and on the Apple Watch, and the system keeps it. Keep codes, passwords, tokens and amounts out of it: put the value on the button, and send a notification marked `sensitive`:

```json title="Body"
{"cellId":"{{CELL_ID}}","title":"New code","sensitive":true}
```

Then none of your text shows:

| Where | Title | Text |
|---|---|---|
| on the phone | the button's name | Open Desktap to see it |
| on the Mac | Desktap | See it in Desktap on your phone |

A tap opens the button's page, where the value is. A sensitive notification can carry only action buttons without a command.

## Where it arrives

`targets` says where the notification goes:

| `targets` | Shown on |
|---|---|
| `["phone"]`, or no `targets` | the phone |
| `["mac"]` | the Mac, from Desktap Agent |
| `["phone", "mac"]` | both |

- Notifications reach the phone over its connection to the agent, with no push service in between. With no phone connected, the agent keeps up to 20 notifications for 12 hours and sends them when the phone connects. They are lost if the agent quits.
- While Desktap is on screen, or for about 30 s after you leave it, a notification shows at once. Later it may not show: iOS has suspended Desktap. It then appears only when you open Desktap, as a new one without the time it was sent, or never if iOS or you close Desktap first.
- Banners appear even while Desktap is on screen. The notifications of one button are grouped, and tapping one opens that button's page, so always send `cellId`.
- The phone asks for permission when the first notification arrives (Settings › Notifications › Desktap). The agent asks only when you click **Allow** at **Notifications**, on the **Permissions** step of its **Setup** or under **Permissions** in the agent window (System Settings › Notifications › Desktap Agent). If nobody did, a notification for the Mac is not shown and the answer says `"mac":"denied"`.

The answer says what happened, and adds `reason` when the phone may not show it now:

```json
{"status":"ok","delivered":{"phone":"sent","mac":"shown"}}
{"status":"ok","delivered":{"phone":"sent","mac":"shown"},"reason":"background"}
```

| In the answer | Means |
|---|---|
| `"phone":"sent"` | handed to the phone; without `reason`, Desktap is on screen and shows it at once, if notifications are allowed for it |
| `"phone":"queued"` | no phone connected: the agent keeps it for 12 hours |
| `"reason":"background"` | sent while Desktap was not on screen: it may not show now |
| `"mac":"shown"` | on the Mac's screen |
| `"mac":"denied"` | notifications are not allowed for Desktap Agent: **Permissions › Notifications** in the agent window has **Allow** until macOS has been asked, then **Open System Settings**, which opens the page to allow them |

After `call notify` the answer is in `$answer`: `[[ $answer == *'"phone":"queued"'* ]]` tells you the phone was away, and `[[ $answer == *'"reason":"background"'* ]]` that it may not show the notification now. A 400 names what is wrong with the body; every message is listed in [Script API › Notification errors](?p=api#notification-errors).

Send what must not be missed to both, as the disk alert does. To keep the Mac quiet while Desktap is open, `must_see` sends to the phone and repeats on the Mac only on that `reason`. The phone may still show it later, so it can arrive twice. Give it a body without `targets`:

<!-- verified 2026-10-02, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
# Part of a startup script, after the helpers. The Mac gets it when the phone may not show it.
must_see() {   # must_see BODY → the phone, and the Mac too when the answer says "background"
  call notify "$1" || return
  [[ $answer == *'"reason":"background"'* ]] || return 0
  call notify "$(jq -c '.targets = ["mac"]' <<< "$1")"
}
```

## Next

- [Recipes: timers, alerts and triggers](?p=recipes-alerts): a long job that reports when it is done, a button that lights up when Claude Code needs you, a Terminal command that tells you when it finishes.
- [Working from your Mac](?p=from-your-mac#let-other-programs-drive-a-button): send notifications from a hook, a cron job or Terminal.
- [Script API › POST /api/notify](?p=api#post-apinotify): every field, command and error message.

<div class="recipe-cards" data-set="alerts"></div>
