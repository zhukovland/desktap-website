<!-- updated: 2026-10-02 -->
# Button logic

Most buttons with logic follow one pattern: a tap changes something, and a startup script notices and draws. This page puts that pattern to work, from a switch that shows its state to a timer that spans two buttons. You need no AI app for any of it: every script is plain zsh that you paste into a button on your iPhone or iPad.

## Taps change state, the loop draws

A button with logic usually carries two scripts. The **tap script** (a **Shell Command**) runs when you tap the button. The **startup script** runs on the Mac for as long as the phone is connected, usually as a loop; Desktap Agent starts it by itself. Give each of them one job.

<div class="dt-mount" data-diagram="one-writer" data-mode="default">A tap script writes an end time to a file and exits; the startup script reads the file every second and draws both buttons, and the countdown carries on after a reconnect.</div>

| | Tap script | Startup script |
|---|---|---|
| Runs | when you tap the button | while the phone is connected |
| Time limit | stopped after 60 s | none |
| Its job | change the state, then exit | read the state, draw the button |
| Where its errors show | in a toast, a short note at the bottom of the screen; the button flashes red and shakes | under the ⚠ count next to your Mac's name at the top of the deck, and in **Advanced › Status** |

- **One writer per button.** Only the startup script sends updates to the buttons it draws. Two scripts that draw one button overwrite each other, and the button flickers between their two looks.
- **A tap only changes the state**, the thing the button's look depends on: a file in the [storage folder](#remembering-things), or the Mac itself (its Dark Mode, for example). It does its work in a moment and exits; it never loops.
- **The loop draws whatever it finds.** It reads the state on every pass. After a reconnect the script starts from scratch, and its first pass already shows the right thing.

While a tap script runs, the button pulses and the phone ignores further taps on it. When the script succeeds, the pulse ends and nothing else happens; when it fails, the toast says why, and its **Details** opens the list of errors, scrolled to that tap. To read a startup script's errors, see [Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work).

The action buttons of a notification run like a tap on the button that sent it, so the same rule holds for them: they change the state, and the loop draws ([Notifications › Action buttons](?p=notifications#action-buttons)).

## A switch that shows its state: Dark Mode

The tap switches the Mac between light and dark. Every 2 s the startup script asks the Mac which mode it is in and shows **Light** or **Dark**. It asks the Mac, not the tap script, so the button stays right even when you switch in System Settings.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Dark Mode: switch the Mac between light and dark
osascript -e 'tell application "System Events"' \
  -e 'tell appearance preferences to set dark mode to not dark mode' -e 'end tell'
```

This tap script goes in **Command**; it never talks to the agent, so one command is all it needs. The startup script below goes in **Advanced › Startup Script**. It carries the helpers block from [Live widgets › The helpers](?p=live-widgets#the-helpers) unchanged, folded into its first line: tap that line to read it. **Copy** takes the whole script.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Dark Mode: shows whether the Mac is light or dark
pause=2                              # seconds between two checks
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

shown="" sent_at=-100
while true; do
  if [[ $(defaults read -g AppleInterfaceStyle 2>/dev/null) == Dark ]]; then
    look='"title":"Dark","icon":"moon.fill","color":"#5E5CE6"'
  else
    look='"title":"Light","icon":"sun.max.fill","color":"#FF9F0A"'
  fi
  # Send a change at once and the same look every 30 s; remember it only after a 200
  if [[ $look != $shown ]] || (( SECONDS - sent_at >= 30 )); then
    post "{\"cellId\":\"$cell\",$look}" && shown=$look sent_at=$SECONDS
  fi
  sleep $pause
done
```

The loop sends a new look at once, and the same look again every 30 s in case something cleared the button. It counts a look as sent only after a 200, so a failed send is tried again on the next pass. When the agent stops the script, the phone brings back the saved look by itself. The trap does the same when something else stops it, such as Ctrl-C in Terminal ([Live widgets › Stopping cleanly](?p=live-widgets#stopping-cleanly)).

> [!STEP] 1 · The tap script
> In edit mode, tap a free spot. In **New Button**, tap **Shell Command** under **Scripts**, then **Command**. Paste the first script and tap **Done**.

> [!STEP] 2 · The startup script
> Tap **Advanced**, then **Write Script** under **Startup Script**. Paste the second script, tap **Done** and go back to the form.

> [!STEP] 3 · Name it and add it
> Under **Appearance**, type a **Name** such as "Dark Mode": the button shows it while the phone is not connected. Tap **Add**. Done when you see the button read **Light** or **Dark**.

The agent's Setup already let **Desktap Agent** control **System Events**, so the first tap switches the Mac. If that access was turned off later, every tap flashes red with the toast "Automation access needed": tap **Details**, then **Open Settings on Mac**, and turn on **System Events** under **Desktap Agent**.

> [!SEE]
> Tap the button. The Mac switches, and within 2 s the button follows: **Dark** with a moon, **Light** with a sun. Not seeing it? → [Troubleshooting › Permissions](?p=troubleshooting#permissions)

<!-- SCREENSHOT button-logic-dark-switch: the deck with this button reading "Dark" (indigo, moon icon) next to the same button reading "Light" (orange, sun icon); iPhone 17 Pro, dark appearance, iOS 26 -->

> [!TIP]
> A button that switches one way only needs no script: the **System Action** type has **Dark Mode** and **Light Mode**.

## Remembering things

A script forgets everything when it ends. Whatever it must keep, such as a count, an end time or the last answer from a web service, goes into the storage folder. Every script finds the folder's path in `$DESKTAP_STORAGE`; the agent creates the folder at `~/Library/Application Support/Desktap/ScriptStorage`.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Press counter: counts the taps of this button
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
dir=$DESKTAP_STORAGE/counter          # one folder for this widget
mkdir -p "$dir"                       # the storage folder is empty on a new Mac
file=$dir/$cell                       # one file per button, named by its ID
count=0
[[ -r $file ]] && read -r count < "$file"
[[ $count == <-> ]] || count=0        # anything but a number starts again
(( count++ ))
# Write a new file, then rename it: nothing ever reads half a file
print $count > "$file.tmp" && mv "$file.tmp" "$file"
post "{\"cellId\":\"$cell\",\"title\":\"Pressed $count×\"}"
```

Each tap reads the count, adds one, saves it and shows it on the button: **Pressed 3×**. This button has no startup script, so its tap may draw it: the tap is its only writer. The title stays until the phone disconnects, Desktap restarts or you save a change to the button ([How scripts run › What brings back the saved look](?p=scripts#what-brings-back-the-saved-look)). To show the count from the moment the phone connects, let a startup script draw it, as the timer below does.

The folder is private to your macOS account and stays on this Mac. All your buttons and scripts share it, so five habits keep it in order:

- **One folder per widget, made when needed.** `mkdir -p "$dir"` costs nothing, and on a new Mac the storage folder is empty.
- **One file per button** when each button keeps its own value. Name it after `$cell`, the button's ID, and two counters never share a count.
- **Write a new file, then rename it** (`.tmp`, then `mv`). A loop that reads at the same moment gets the old file or the new one, never half of one.
- **Read values; never run them.** Use `read` or jq. Do not `source` a state file: it holds data, not code.
- **State only, never scripts.** Keep the whole script inside the button. The button travels with your deck to every Mac the phone connects to; this folder does not.

> [!NOTE]
> Keep passwords and API keys out of scripts too: the deck syncs through iCloud. Put a key in `$DESKTAP_STORAGE/secrets/<name>` or in the Keychain on each Mac, and read it from there, for example `read -r key < "$DESKTAP_STORAGE/secrets/weather"`.

## A focus timer on one button

A tap starts a 25-minute session or cancels it. The startup script shows the time left on the same button, second by second. The two scripts share one file in the storage folder, `focus/end`. It holds a single number: the time the session ends.

| `focus/end` | The button shows |
|---|---|
| no file | **Focus**, gray |
| a time still ahead | the time left, such as **24:59**, red |
| a time already past | **Done!**, green |

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Focus timer: start 25 minutes, or cancel
minutes=25                               # try 1 to see the end quickly
dir=$DESKTAP_STORAGE/focus
mkdir -p "$dir"
end=0
[[ -r $dir/end ]] && read -r end < "$dir/end"
if [[ $end == <-> ]] && (( end > $(date +%s) )); then
  rm -f "$dir/end"                       # running: cancel
else
  # Store when it ends, written to a new file and then renamed
  print $(( $(date +%s) + minutes * 60 )) > "$dir/end.tmp" &&
    mv "$dir/end.tmp" "$dir/end"
fi
```

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Focus timer: counts down on this button
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
  sleep $(( 1 - EPOCHREALTIME % 1 ))      # wake on the next whole second
done
```

Put the first script in **Command** and the second in **Advanced › Startup Script**, as with the switch. To watch a session end, set `minutes=1`. The loop wakes on whole seconds with `$EPOCHREALTIME`: with a plain `sleep 1` it would drift and now and then skip a second.

> [!SEE]
> Tap the button: within a second it starts counting down from 25 minutes. Tap again and it reads **Focus**.

<!-- SCREENSHOT button-logic-focus: the focus button counting down (red, timer icon, title such as "24:59"); iPhone 17 Pro, dark appearance, iOS 26 -->

### Why it survives a reconnect

The tap stores when the session ends, not how much of it is left. On every pass the loop subtracts the current time from the end time, so any run of the script picks up where the last one stopped.

A disconnect, a profile switch or a restart of the agent stops the script. The button gets its saved look back, and the file stays. When the phone connects again, the script starts from scratch, reads the file and carries on.

The loop runs only while the phone is connected. A session that ends while the phone is not connected shows **Done!** when it connects again. Nothing tells you at the moment it ends, because no script is running then.

## React within a fraction of a second

The timer notices a tap on its next pass, up to a second later. To react within 0.2 s, let the loop watch the file's modification time while it waits. `zstat` is built into zsh, so each check starts no extra process.

Add this line to the timer's startup script, right after `zmodload zsh/datetime`:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
zmodload -F zsh/stat b:zstat           # zstat reads a file's details inside zsh
```

Then put these lines in place of the `sleep` line at the end of the loop:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
  # Wait in steps of 0.2 s, and stop early when a tap changes the file
  zstat -A seen +mtime -- "$state" 2>/dev/null || seen=none
  repeat 5; do
    sleep $(( 0.2 - EPOCHREALTIME % 0.2 ))
    zstat -A check +mtime -- "$state" 2>/dev/null || check=none
    [[ $check != $seen ]] && break
  done
```

The loop now checks the file more often, but it still sends an update only when the look changes. Without a tap, a pass lasts one second as before, so the countdown keeps its pace.

The same lines work in any loop that must answer a tap at once. That loop needs `zmodload zsh/datetime` as well as the `zstat` line: without them the lines still run, with no error, but the steps drift and an early tap goes unnoticed.

When the state is the Mac itself, as with Dark Mode, give the loop a file to watch. Use this tap script in place of the first one: after the switch, it touches a file. Its `|| exit 1` keeps the red flash and the toast when macOS refuses.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Dark Mode: switch the Mac, then wake the startup script
osascript -e 'tell application "System Events"' \
  -e 'tell appearance preferences to set dark mode to not dark mode' -e 'end tell' || exit 1
mkdir -p "$DESKTAP_STORAGE/darkmode" && touch "$DESKTAP_STORAGE/darkmode/poke"
```

In the Dark Mode startup script, add three lines after the trap: `zmodload zsh/datetime`, the `zstat` line and `state=$DESKTAP_STORAGE/darkmode/poke`. Then put the waiting lines in place of `sleep $pause`, with `repeat $(( pause * 5 ))` in place of `repeat 5`. A pass still lasts 2 s, and a tap shows within 0.2 s.

## One script, several buttons

Any script can draw any button: it puts that button's ID in `cellId`. So one startup script can draw a whole group, such as a timer with its own Start button, a row of status lights or a dashboard. Each button of the group still has one writer: that script.

Here the focus timer moves its countdown to a second button, and the button you tap shows **Start** or **Stop**. Its tap script stays exactly as it was.

1. In edit mode, tap a free spot next to the timer, choose **No Action** (this button only shows the countdown) and tap **Add**.
2. Tap the new button to open it, tap **Advanced**, and under **Button ID** tap **Copy**. It turns into **Copied**.
3. Open the timer, the button you tap. In **Advanced › Startup Script**, replace the script with the one below and paste the ID in place of `PASTE-THE-COUNTDOWN-BUTTON-ID`. Tap **Done**, then **Save**.

<!-- SCREENSHOT button-logic-button-id: Advanced screen of a button, the Button ID section with the ID in monospace, the Copy button and its footer "This button's scripts see it as {{CELL_ID}}. Copy it when one script draws several buttons." with its Learn More… link; iPhone 17 Pro, dark appearance, iOS 26 -->

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Focus timer: Start/Stop here, countdown on a second button
timer="PASTE-THE-COUNTDOWN-BUTTON-ID"    # from Advanced › Button ID › Copy
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
[[ $timer == PASTE* ]] &&
  { print -u2 "Paste the countdown button's ID (Advanced › Button ID)"; exit 1 }
# The agent resets this button when it stops the script; the other one is up to us
reset_both() {
  post "{\"cellId\":\"$cell\",\"reset\":true}"
  post "{\"cellId\":\"$timer\",\"reset\":true}"
}
trap 'reset_both; exit 0' TERM INT
state=$DESKTAP_STORAGE/focus/end         # the tap script writes the end time here
zmodload zsh/datetime                    # gives $EPOCHSECONDS and $EPOCHREALTIME

shown="" timer_shown="" sent_at=$SECONDS
while true; do
  end=0
  [[ -r $state ]] && read -r end < "$state"
  [[ $end == <-> ]] || end=0
  left=$(( end - EPOCHSECONDS ))
  look='"title":"Start","icon":"play.fill","color":"#30D158"'
  if (( end == 0 )); then
    timer_look='"title":"Focus","icon":"timer","color":"#8E8E93"'
  elif (( left > 0 )); then
    look='"title":"Stop","icon":"stop.fill","color":"#FF453A"'
    clock=$(printf '%d:%02d' $(( left / 60 )) $(( left % 60 )))
    timer_look="\"title\":\"$clock\",\"icon\":\"timer\",\"color\":\"#FF453A\""
  else
    timer_look='"title":"Done!","icon":"checkmark.circle.fill","color":"#30D158"'
  fi
  # Every 30 s forget what was sent, so both buttons get their look again
  (( SECONDS - sent_at >= 30 )) && shown="" timer_shown="" sent_at=$SECONDS
  [[ $look != $shown ]] && post "{\"cellId\":\"$cell\",$look}" && shown=$look
  [[ $timer_look != $timer_shown ]] && post "{\"cellId\":\"$timer\",$timer_look}" &&
    timer_shown=$timer_look
  sleep $(( 1 - EPOCHREALTIME % 1 ))      # wake on the next whole second
done
```

- **The guard.** Until you paste the ID, the script stops at once, and ⚠ 1 appears next to your Mac's name. Tap it to read `Exit code 1: Paste the countdown button's ID (Advanced › Button ID)`.
- **The trap resets both.** When the agent stops a script, it brings back the saved look of the script's own button only. Other buttons keep what the script drew, so the trap resets them itself.
- **One profile.** Only the active profile's startup scripts run, so keep the group in one profile, ideally on one page. To bring two buttons together, hold one for a moment in edit mode and drag it to a free spot; its ID stays the same.

Use this version instead of the one-button timer, not next to it: both read `focus/end`. A running script can also read the IDs of the buttons on screen ([Live widgets › Finding a button's ID](?p=live-widgets#finding-a-buttons-id)). [Pomodoro on two buttons](?p=recipes-alerts#pomodoro-on-two-buttons) goes further, with a countdown ring, a break and a notification when work ends.

## A second action: long press

Every button can do a second thing when you hold it. Open the focus timer in the editor and tap **Add Long Press**. Pick **Shell Command**, as for the tap, paste the script below into **Command**, tap **Done**, then **Save**. A button with a long press shows a small triangle in its top-right corner; hold it for 0.35 s to run the long press.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Long Press"
#!/bin/zsh
# Focus timer: 5 more minutes
file=$DESKTAP_STORAGE/focus/end
end=0
[[ -r $file ]] && read -r end < "$file"
# No session running: nothing to add
[[ $end == <-> ]] && (( end > $(date +%s) )) || exit 0
print $(( end + 300 )) > "$file.tmp" && mv "$file.tmp" "$file"
```

This long press gives a running focus session 5 more minutes. Like the tap, it only changes the file, and the startup script shows the new time on its next pass.

> [!SEE]
> Hold the timer while a session runs: within a second the countdown shows 5 more minutes.

- The tap and the long press run independently: one can run while the other does.
- While a long-press **Shell Command** runs, **Stop Process** appears in the **Long Press** section of the editor.
- Use the long press for a second, less common action, or for one that stops, discards or deletes. Keep the main action on the tap: a switch should flip when you tap it.

<!-- SCREENSHOT button-logic-long-press: the focus button on the deck with the small long-press triangle in its top-right corner, and the editor's Long Press section with a Shell Command; iPhone 17 Pro, dark appearance, iOS 26 -->

## Next

- [Notifications](?p=notifications): give this focus timer a "time's up" banner whose action buttons restart it or reset it.
- [Recipes: timers, alerts and triggers](?p=recipes-alerts): Pomodoro on two buttons, a long job that reports when it is done, and a button that lights up when Claude Code needs you.

<div class="recipe-cards" data-set="alerts"></div>
