<!-- updated: 2026-10-02 -->
# Recipes: timers, alerts and triggers

This page holds four recipes: a timer that survives a reconnect, a job that runs longer than the 60 seconds a tap allows, a button that a Claude Code hook turns red, and a notification on your iPhone or iPad when a long Terminal command ends. Each recipe is complete. Copy its scripts, put them where its **Where it goes** table says, and adjust the settings at the top.

<div class="recipe-cards" data-set="alerts"></div>

The scripts go onto a button as in [Recipes: live widgets › How to add a recipe](?p=recipes-widgets#how-to-add-a-recipe). In edit mode, tap a free spot: a tap script goes into **Shell Command › Command**, a startup script into **Advanced › Startup Script › Write Script**.

The three button recipes follow the pattern from [Button logic › Taps change state, the loop draws](?p=button-logic#taps-change-state-the-loop-draws). A tap, an action button on a notification or another program only changes a file in the storage folder (`$DESKTAP_STORAGE`), and one startup script does all the drawing:

| Recipe | The file, and what changes it |
|---|---|
| [Pomodoro on two buttons](#pomodoro-on-two-buttons) | `pomodoro/state`: a tap, and **Skip Break** and **Stop** on the notification |
| [Long job with a report](#long-job-with-a-report) | `deploy/request`: a tap, and **Roll Back** on the notification |
| [Claude Code needs input](#claude-code-needs-input) | `claude/needs-input`: three Claude Code hooks, and a tap |

Two more recipes of this kind sit next to what they teach: the focus timer on [Button logic](?p=button-logic#a-focus-timer-on-one-button) and the low disk space alert on [Notifications](?p=notifications#your-first-notification-low-disk-space).

## Pomodoro on two buttons

Start/Stop on one button, a countdown ring on the next: 25 minutes of work, a 5-minute break, a notification in between.

<img src="assets/docs/img/recipes-alerts/pomodoro-states.png" width="384" height="128" alt="Three states of the countdown button: a full gray ring around 25:00 with the word ready; a red ring three quarters full around 18:42 with the word focus; a green ring around 3:10 with the word break">

The countdown at rest, during work and during the break, drawn by Desktap.

**Where it goes**

| | Start/Stop | Countdown |
|---|---|---|
| Size | Normal (1×1) | Normal (1×1), next to it |
| Tap | **Shell Command**: the tap script | **No Action** |
| Startup Script | the startup script | none |
| SVG Drawing | none | optional: the start state below |
| Name and icon | "Start" with a play icon: the look while the timer rests | any |

1. In edit mode, tap a free spot and choose **No Action**, the last type in the list. Tap **Add**. This is the countdown button.
2. Tap the countdown button to open it. Tap **Advanced › Button ID › Copy**, then **Cancel**.
3. Tap the free spot next to it and choose **Shell Command**. Tap **Command**, paste the tap script below and tap **Done**. Under **Appearance**, name the button "Start" and give it a play icon.
4. Tap **Advanced › Startup Script › Write Script** and paste the startup script. Replace `PASTE-THE-COUNTDOWN-BUTTON-ID` with the ID you copied. Tap **Done**, then **Add**.

The tap script only changes the state file:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Pomodoro: start, or stop
state="$DESKTAP_STORAGE/pomodoro/state"
if [[ -e $state ]]; then
  rm -f "$state"                      # running: stop
else
  # idle: save the moment of the tap; the startup script starts the work from it
  mkdir -p "${state:h}"
  print start $(date +%s) > "$state.tmp" && mv -f "$state.tmp" "$state"
fi
```

The startup script draws both buttons, once a second:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender, render_preview -->
```zsh title="Startup Script"
#!/bin/zsh
# Pomodoro: Start/Stop here, the countdown next to it
# the countdown button's ID, from its Advanced › Button ID
timer="PASTE-THE-COUNTDOWN-BUTTON-ID"
# minutes of work and of break; try work=1 rest=1 to see the notification soon
work=25 rest=5
# "work 1767225600": the phase, and the Unix time when it ends
state="$DESKTAP_STORAGE/pomodoro/state"
told="$DESKTAP_STORAGE/pomodoro/told"    # the end of the last break announced
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
trap 'post "{\"cellId\":\"$cell\",\"reset\":true}"
  post "{\"cellId\":\"$timer\",\"svg\":{\"remove\":true}}"; exit 0' TERM INT
[[ $timer == PASTE* ]] &&
  { print -u2 "Paste the countdown button's ID (Advanced › Button ID)"; exit 1 }
zmodload zsh/datetime                     # $EPOCHSECONDS and $EPOCHREALTIME

# ring LEFT TOTAL COLOR LABEL → the countdown face
# (the same four elements in every phase, so it always glides)
ring() {
  local off clock
  off=$(awk -v l=$1 -v t=$2 'BEGIN { printf "%.2f", 490.09 * (1 - l / t) }')
  printf -v clock '%d:%02d' $(( $1 / 60 )) $(( $1 % 60 ))
  print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
<circle cx='100' cy='100' r='78' fill='none' stroke='#FFFFFF'
 stroke-opacity='0.15' stroke-width='14'/>
<circle cx='100' cy='100' r='78' fill='none' stroke='$3' stroke-width='14'
 stroke-linecap='round' stroke-dasharray='490.09 490.09'
 stroke-dashoffset='$off' transform='rotate(-90 100 100)'/>
<text x='100' y='98' font-size='48' font-weight='bold' text-anchor='middle'
 dominant-baseline='middle' fill='#FFFFFF'>$clock</text>
<text x='100' y='142' font-size='28' text-anchor='middle'
 fill='#FFFFFF' fill-opacity='0.6'>$4</text>
</svg>"
}

# What the notification's buttons run. Like a tap, they only change the file.
# Skip Break saves the moment it was tapped: it counts with the phone away too.
skip='f="$DESKTAP_STORAGE/pomodoro/state"; '
skip+='print start $(date +%s) > "$f.tmp" && mv -f "$f.tmp" "$f"'
stop='rm -f "$DESKTAP_STORAGE/pomodoro/state"'

# announce → "Time for a break", with Skip Break and Stop
announce() {
  call notify "$(jq -nc --arg cell "$cell" --arg min "$rest" \
      --arg skip "$skip" --arg stop "$stop" '{
    id: $cell, cellId: $cell, targets: ["phone", "mac"],
    title: "Time for a break",
    body: "Work is done. Your \($min)-minute break has started.",
    actions: [
      {id: "skip", title: "Skip Break",
       command: {shellCommand: {command: $skip}}},
      {id: "stop", title: "Stop",
       command: {shellCommand: {command: $stop}}}
    ]}')"
}

# save FILE TEXT: write a new file, then rename it
save() { print -r -- "$2" > "$1.tmp" && mv -f "$1.tmp" "$1" }

mkdir -p "${state:h}"
shown="" drawn="" sent_at=-100
while true; do
  now=$EPOCHSECONDS phase=idle end=0 told_end=0
  [[ -r $state ]] && read -r phase end < "$state"    # read it; never source it
  [[ $end == <-> ]] || end=0
  if [[ $phase == start ]]; then                     # a tap or Skip Break
    (( end )) || end=$now
    phase=work end=$(( end + work * 60 )); save $state "$phase $end"
  fi
  if [[ $phase == work ]] && (( end <= now )); then  # work is over: a break
    phase=rest end=$(( end + rest * 60 )); save $state "$phase $end"
  fi
  if [[ $phase == rest ]] && (( end <= now )); then  # the break is over
    rm -f "$state"; phase=idle
  fi
  # one notification per break, even after a restart: saved only after a 200
  [[ -r $told ]] && read -r told_end < "$told"
  if [[ $phase == rest ]] && (( end != told_end )); then
    announce && save $told $end
  fi
  left=$(( end - now ))
  case $phase in
    work) total=$(( work * 60 )) color='#FF453A' label=focus ;;
    rest) total=$(( rest * 60 )) color='#30D158' label=break ;;
    *)    total=$(( work * 60 )) left=$total color='#8E8E93' label=ready ;;
  esac
  (( left < 0 )) && left=0
  (( left > total )) && left=$total
  # every 30 s, send both looks again
  (( now - sent_at >= 30 )) && shown="" drawn="" sent_at=$now
  # Start/Stop: its saved look at rest, Stop while the timer runs
  if [[ $label == ready ]]; then look='"reset":true'
  else look='"title":"Stop","icon":"stop.fill","color":"#FF453A"'; fi
  [[ $look != $shown ]] && post "{\"cellId\":\"$cell\",$look}" && shown=$look
  frame=$(ring $left $total $color $label)
  if [[ $frame != $drawn ]]; then
    body="{\"cellId\":\"$timer\",\"svg\":{\"source\":$(json "$frame"),"
    post "$body\"duration\":1.25,\"easing\":\"linear\"}}" && drawn=$frame
  fi
  (( dropped )) && sleep 4                # the phone is not reading: slow down
  sleep $(( 1 - EPOCHREALTIME % 1 ))      # wake on the next whole second
done
```

To give the countdown a start state, copy this drawing and open the countdown button. Tap **Appearance › Icon › SVG Drawing**, then **SVG Document › Paste**, **Done** and **Save**. The drawing is the frame the script shows at rest: the first live frame glides out of it, and the button shows it again when the script stops.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), svgrender -->
```svg title="SVG Drawing"
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
<circle cx='100' cy='100' r='78' fill='none' stroke='#FFFFFF'
 stroke-opacity='0.15' stroke-width='14'/>
<circle cx='100' cy='100' r='78' fill='none' stroke='#8E8E93' stroke-width='14'
 stroke-linecap='round' stroke-dasharray='490.09 490.09'
 stroke-dashoffset='0.00' transform='rotate(-90 100 100)'/>
<text x='100' y='98' font-size='48' font-weight='bold' text-anchor='middle'
 dominant-baseline='middle' fill='#FFFFFF'>25:00</text>
<text x='100' y='142' font-size='28' text-anchor='middle'
 fill='#FFFFFF' fill-opacity='0.6'>ready</text>
</svg>
```

> [!SEE]
> The countdown shows a gray 25:00. Tap **Start**: within a second that button reads **Stop**, and a red ring around the time starts to drain. When work ends, "Time for a break" arrives and the ring refills in green.
> Not seeing it? → [Troubleshooting › A button or widget doesn't work](?p=troubleshooting#a-button-or-widget-doesnt-work)

What each button shows:

| What happens | Start/Stop | Countdown |
|---|---|---|
| The timer rests | **Start**, its saved look | 25:00 in gray, "ready" |
| You tap **Start** | **Stop** | 25:00, 24:59, 24:58… in red, "focus" |
| The 25 minutes are up | **Stop** | 5:00 in green, "break"; the notification arrives |
| The break is over | **Start** | 25:00 in gray |
| You tap **Stop** | **Start** | 25:00 in gray |

How it works:

- **The script keeps no time in memory.** A tap and **Skip Break** save `start` and the moment they happened. The loop turns that into `work` and the moment the work ends, as a Unix time (the number `date +%s` prints), and reads the file every second.
- **One notification per break.** The file `pomodoro/told` holds the end of the last break that got its notification. The script writes it only after the agent answers 200, so a notification that did not go out is sent on the next pass, and a restart never sends one twice.
- **When the phone disconnects, it shows every button's saved look, and the agent stops the script.** The state file stays: when the phone connects again, the countdown carries on where it should be. Locking the phone stops nothing.
- **When the agent stops the script while the phone stays connected**, for example after a saved change or a profile switch, only this button gets its saved look back ([How scripts run › What brings back the saved look](?p=scripts#what-brings-back-the-saved-look)). That is why the trap resets the countdown itself.
- **Skip Break** and **Stop** on the notification change the same file a tap does. They run on one tap, because this button's own script sent them ([Notifications › When a tap asks first](?p=notifications#when-a-tap-asks-first)). **Skip Break** clicked on the Mac while the phone is away counts from that moment.
- **If work ends while the phone is away**, the notification comes when the phone connects again, as long as the break is not over. Once sent, it shows on the Mac at once, which is why the recipe sends it to both. On the phone it shows at once while Desktap is on screen, or for about 30 s after you leave it. Later, with the phone locked for example, it may not show until you open Desktap, or not at all if Desktap is closed first ([Notifications › Where it arrives](?p=notifications#where-it-arrives)).

**Make it yours**

- **Other lengths**: `work=50 rest=10`, or `work=1 rest=1` to see a whole round in two minutes. Change 25:00 in the start state too.
- **Other colors**: `#FF453A` for work and `#30D158` for the break, in the loop's `case`.
- **Other words**: `focus`, `break` and `ready` are the labels under the time. Keep them short.
- **A notification when the break ends**: copy `announce`, give it new words, and call it where the break is over.
- **Skip a break with a long press**: tap **Add Long Press**, choose **Shell Command**, and use the command of **Skip Break** as its command: `f="$DESKTAP_STORAGE/pomodoro/state"; print start $(date +%s) > "$f.tmp" && mv -f "$f.tmp" "$f"`. During work it starts the round again.

For a single-button timer with a chime at zero, add **Timer** from the Gallery.

**If it doesn't work**: ⚠ 1 next to your Mac's name at the top of the deck and a countdown that never changes mean the ID is missing. Tap the count to read `Exit code 1: Paste the countdown button's ID (Advanced › Button ID)`.

## Long job with a report

Tap to start a deploy that may take ten minutes. The button counts the time, and a notification reports the result.

> [!WARNING]
> A tap script is stopped after 60 seconds, as the note under **Command** says: "Runs for up to 60 seconds. Put loops and live updates in the Startup Script." A deploy run from a tap would be cut off halfway, with no report. Here the tap only asks for a run; the startup script, with no time limit, does the job.

<!-- SCREENSHOT recipes-alerts-deploy: three moments of the Deploy button on iPhone 17 Pro, English, dark, iOS 26: running ("Deploy" / "1:23", hourglass, blue), finished ("Done", green check), and the notification banner "Deploy finished" / "It took 3 min 12 s." expanded with Open Log and Roll Back -->

**Where it goes**

| | The Deploy button |
|---|---|
| Size | Normal (1×1) |
| Tap | **Shell Command**: the tap script |
| Startup Script | the startup script; set `dir`, `job` and `undo` at its top |
| Name and icon | "Deploy": the look until the first run |
| Color | any |

The tap script writes the request:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Deploy: ask for a run
box="$DESKTAP_STORAGE/deploy"
[[ -e $box/running ]] && exit 0               # one run at a time
mkdir -p "$box"
# the startup script picks the request up within a second
print deploy > "$box/request.tmp" && mv -f "$box/request.tmp" "$box/request"
```

The startup script runs the job and reports the result:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Deploy: runs it and reports the result
# where the job runs: scripts start in /, not in your home folder
dir="$HOME/Projects/app"
job=(./deploy production)                 # the long command
undo=(./deploy rollback)                  # what Roll Back runs
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
box="$DESKTAP_STORAGE/deploy"             # request, running, job.log

# show TITLE ICON COLOR → this button's live look
show() {
  local look="\"title\":$(json "$1"),\"icon\":\"$2\",\"color\":\"$3\""
  post "{\"cellId\":\"$cell\",$look}"
}

# What the notification's buttons run. Roll Back asks for a run, like a tap.
open_log='open -a Console "$DESKTAP_STORAGE/deploy/job.log"'
roll_back='f="$DESKTAP_STORAGE/deploy/request"; '
roll_back+='print rollback > "$f.tmp" && mv -f "$f.tmp" "$f"'

# report TITLE BODY → a notification on the phone and the Mac, with two buttons
report() {
  call notify "$(jq -nc --arg cell "$cell" --arg title "$1" --arg body "$2" \
      --arg log "$open_log" --arg undo "$roll_back" '{
    cellId: $cell, title: $title, body: $body, targets: ["phone", "mac"],
    actions: [
      {id: "log", title: "Open Log",
       command: {shellCommand: {command: $log}}},
      {id: "undo", title: "Roll Back", destructive: true,
       command: {shellCommand: {command: $undo}}}
    ]}')"
}

# run deploy|rollback → runs the job in the background, shows how long it takes
run() {
  local name=Deploy started=$SECONDS t clock took pid rc last
  local -a cmd=($job)
  [[ $1 == rollback ]] && name=Rollback cmd=($undo)
  cd "$dir" || { report "$name failed" "There is no folder $dir."; return }
  "${cmd[@]}" > "$box/job.log" 2>&1 &
  pid=$!
  while kill -0 $pid 2>/dev/null; do
    (( t = SECONDS - started ))
    printf -v clock '%d:%02d' $(( t / 60 )) $(( t % 60 ))
    show "$name $clock" hourglass '#0A84FF'
    sleep 1
  done
  wait $pid; rc=$?
  (( t = SECONDS - started ))
  took="$(( t / 60 )) min $(( t % 60 )) s"
  if (( rc == 0 )); then
    show Done checkmark.circle.fill '#30D158'
    report "$name finished" "It took $took."
  else
    show Failed xmark.octagon.fill '#FF453A'
    # the last lines of the log, without terminal colors
    # (keep secrets out of what the job prints)
    last=$(tail -n 3 "$box/job.log" | sed $'s/\e\\[[0-9;]*m//g')
    report "$name failed (exit $rc)" "$last"
  fi
}

mkdir -p "$box"
# a request made while this script was not running: ignore it
rm -f "$box/request"
# the script was stopped in the middle of a run: say so
if [[ -e $box/running ]]; then
  read -r what < "$box/running"; rm -f "$box/running"
  name=Deploy; [[ $what == rollback ]] && name=Rollback
  report "$name stopped" "It was stopped before it finished. Check the log."
fi
while true; do
  if [[ -e $box/request ]]; then
    mv -f "$box/request" "$box/running"
    read -r what < "$box/running"
    run $what
    rm -f "$box/running"
  fi
  sleep 1
done
```

> [!SEE]
> Tap the button. Within a second it reads "Deploy 0:00" and counts up. At the end it turns green with "Done" or red with "Failed", and a notification with **Open Log** and **Roll Back** arrives.
> Not seeing it? → [Troubleshooting › A button or widget doesn't work](?p=troubleshooting#a-button-or-widget-doesnt-work)

How it works:

- **The tap writes `deploy` into `$DESKTAP_STORAGE/deploy/request`** and ends at once. While a job runs, a tap does nothing.
- **The startup script looks for that file every second.** It renames it to `running` and starts the job in the background. Until the job ends, the button shows how long it has been running.
- **The report is built with `jq --arg`**, so quotes and line breaks in the job's output cannot break it. A failure shows the last three lines of the log, without terminal color codes. They appear on the lock screen too, so keep passwords and tokens out of what your job prints.
- **Open Log** opens the log in Console. **Roll Back** writes `rollback` into the request file, so the rollback also runs in the startup script and gets its own report. Both run on one tap, because this button's own script sent them.
- **The job runs only while the phone is connected.** A disconnect, a profile switch or a saved change to the button stops the script and the job with it, and the next start reports "Deploy stopped". Locking the phone does not stop it.
- **A request made while the script was not running is dropped** when the script starts. A **Roll Back** tapped on the Mac while the phone was away never runs hours later.

**Make it yours**

- **Your own job**: `job=(make release)`, or any command run from `dir`. The script gets a fixed `PATH`, so give the full path of tools installed elsewhere ([How scripts run › Environment variables](?p=scripts#environment-variables)).
- **No rollback**: delete the second action, the comma before it and the `undo` line.
- **Other words**: the titles "Deploy" and "Rollback" are set in `run`.
- **A job that must not stop with the phone**: run it in Terminal with [`tellme`](#tell-me-when-a-command-finishes).

**If it doesn't work**: when a tap changes nothing, open **Advanced** and check that **Status** reads Running. A failed startup script shows its error there, and under the ⚠ count.

## Claude Code needs input

When Claude Code waits for you, a hook turns the button red and names the project. A tap or your next prompt clears it.

<img src="assets/docs/img/recipes-alerts/claude-needs-input.png" width="160" height="160" alt="A red button face: Needs input in large white letters, and the project folder my-app below">

**Where it goes**

| | The Claude button |
|---|---|
| Size | Normal (1×1) |
| Tap | **Shell Command**: the tap script |
| Startup Script | the startup script |
| Name and icon | "Claude" or anything: the look while Claude needs nothing |
| On the Mac | a hook script, and three hooks in `~/.claude/settings.json` |

The tap script clears it:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Claude Code: I've seen it
rm -f "$DESKTAP_STORAGE/claude/needs-input"
```

The startup script draws the red face:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender -->
```zsh title="Startup Script"
#!/bin/zsh
# Claude Code: turns red when it waits for you
# a Claude Code hook writes this file, a tap deletes it
flag="$DESKTAP_STORAGE/claude/needs-input"
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
trap 'post "{\"cellId\":\"$cell\",\"svg\":{\"remove\":true}}"; exit 0' TERM INT

# face PROJECT → the red face, the project folder's name under "Needs input"
face() {
  local name=$1 LC_ALL=en_US.UTF-8              # count characters, not bytes
  (( ${#name} > 10 )) && name="${name[1,9]}…"
  name=${name//&/&amp;}; name=${name//</&lt;}   # & and < would break the SVG
  print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
<rect width='200' height='200' fill='#FF3B30'/>
<text x='100' y='76' font-size='44' font-weight='bold' text-anchor='middle'
 dominant-baseline='middle' fill='#FFFFFF'>Needs</text>
<text x='100' y='120' font-size='44' font-weight='bold' text-anchor='middle'
 dominant-baseline='middle' fill='#FFFFFF'>input</text>
<text x='100' y='162' font-size='28' text-anchor='middle'
 dominant-baseline='middle' fill='#FFFFFF' fill-opacity='0.8'>$name</text>
</svg>"
}

shown="none" sent_at=-100
while true; do
  svg='{"remove":true}'                    # no file: the button's saved look
  if [[ -e $flag ]]; then
    project=""; read -r project < "$flag"  # the folder Claude Code works in
    project=${${project:t}//[[:cntrl:]]/}  # its last part, no control codes
    svg="{\"source\":$(json "$(face "$project")"),\"duration\":0.3}"
  fi
  # send on a change, and again every 30 s
  if [[ $svg != $shown ]] || (( SECONDS - sent_at > 30 )); then
    post "{\"cellId\":\"$cell\",\"svg\":$svg}" && shown=$svg sent_at=$SECONDS
  fi
  sleep 1
done
```

Then, on the Mac, paste this into Terminal. It saves the hook script `~/.claude/hooks/desktap-needs-input.zsh`, which Claude Code runs:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness; zsh -f with a scratch HOME, the script run with Claude Code's hook input -->
```zsh title="Terminal"
mkdir -p ~/.claude/hooks
cat > ~/.claude/hooks/desktap-needs-input.zsh <<'END'
#!/bin/zsh
# Claude Code hook for the Desktap button "Claude Code needs input"
# set: save the folder Claude Code works in; clear: delete the file
f="$HOME/Library/Application Support/Desktap/ScriptStorage/claude/needs-input"
if [[ $1 == set ]]; then
  mkdir -p "${f:h}"
  jq -r .cwd > "$f.tmp" && mv -f "$f.tmp" "$f"   # a new file, then rename it
else
  rm -f "$f"
fi
exit 0             # always succeed, so the hook never holds Claude Code up
END
```

Add the three hooks to `~/.claude/settings.json`. Without that file, save this block as the whole file:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness; jq parses it; each command run in sh, bash and zsh -->
```json
{
  "hooks": {
    "Notification": [{
      "matcher": "permission_prompt|idle_prompt",
      "hooks": [{ "type": "command",
        "command": "zsh ~/.claude/hooks/desktap-needs-input.zsh set" }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{ "type": "command",
        "command": "zsh ~/.claude/hooks/desktap-needs-input.zsh clear" }]
    }],
    "PostToolUse": [{
      "hooks": [{ "type": "command",
        "command": "zsh ~/.claude/hooks/desktap-needs-input.zsh clear" }]
    }]
  }
}
```

If the file already has `"hooks"`, add the three events to that object. If one of them is already there, put the new `{ … }` object into its list, after the ones you have: never write the same event name twice. Then check the file: `jq . ~/.claude/settings.json` prints it back, or names the line with the mistake.

Claude Code reads hooks when a session starts. Start a new session, or review the new hooks in `/hooks` in the session you have open.

> [!SEE]
> Ask Claude Code for something that needs your permission. Within a second the button turns red, with "Needs input" and the folder's name. Answer in Terminal or tap the button, and it gets its saved look back.
> Not seeing it? → [Troubleshooting › A button or widget doesn't work](?p=troubleshooting#a-button-or-widget-doesnt-work)

How it works:

| Hook | What it does |
|---|---|
| **Notification** | When Claude asks for a permission, or has waited for you for a minute, the hook script writes the working folder into `claude/needs-input` in the storage folder. |
| **UserPromptSubmit** | When you send a prompt, the hook script deletes the file. |
| **PostToolUse** | When a tool has finished, for example after you allowed it, the hook script deletes the file. |

The `matcher` of **Notification** leaves out Claude Code's other notifications, such as a finished login.

- **The hooks need no token and no Button ID**, and the file waits while the phone is away. This is the pattern of [Working from your Mac › Let other programs drive a button](?p=from-your-mac#let-other-programs-drive-a-button): the hook script writes a new file, then renames it, so the button never reads half of one.
- **The startup script checks the file every second.** It draws the red face, or gives the button its saved look back. Long folder names are cut to fit.
- **Several sessions share one file**: the last one to ask wins, and any prompt clears it.

**Make it yours**

- **Red when Claude has finished, too**: add a `"Stop"` event written like `"UserPromptSubmit"`, with `set` in place of `clear`.
- **Bring your terminal forward**: add `open -a Terminal` to the tap script. It runs on the Mac.
- **Another color**: `#FF3B30` in `face`.

**If it doesn't work**: run `print '{"cwd":"/tmp/test"}' | zsh ~/.claude/hooks/desktap-needs-input.zsh set` in Terminal, and tap the button afterwards to clear it. If it turns red with "test", Claude Code did not run the hooks: check them in `/hooks`, or start a new session.

## Tell me when a command finishes

Put `tellme` in front of a long Terminal command. When it ends, your phone and your Mac show its result and how long it took.

**Where it goes**: not on a button, but in `~/.zshrc` on your Mac. Open a new Terminal window afterwards, then run, for example, `tellme make build`.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), zsh with the real curl on a missing and a stand-in socket; body checked against the agent's code, never sent -->
```zsh title="Terminal"
# Tell me when a command finishes: tellme make build
tellme() {
  local started=$SECONDS rc took title answer
  local sock="$HOME/Library/Application Support/Desktap/LocalAPI/agent.sock"
  "$@"; rc=$?
  took="$(( (SECONDS - started) / 60 )) min $(( (SECONDS - started) % 60 )) s"
  title="Finished: $1"; (( rc )) && title="Failed (exit $rc): $1"
  answer=$(jq -nc --arg title "$title" --arg body "$* · $took" \
      --arg app "${__CFBundleIdentifier:-com.apple.Terminal}" '{
      title: $title, body: $body, targets: ["phone", "mac"],
      actions: [{id: "show", title: "Show Terminal",
                 command: {launchApp: {bundleIdentifier: $app}}}]
    }' |
    curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
      -d @- -w '\n%{http_code}' http://localhost/api/notify)
  # no answer on the socket: the agent is not there
  [[ $answer == *$'\n'000 ]] && answer="Desktap Agent is not running"
  [[ $answer == *$'\n'200 ]] || print -u2 -r -- "tellme: ${answer%$'\n'*}"
  return $rc
}
```

<!-- SCREENSHOT recipes-alerts-tellme: the Mac notification banner "Failed (exit 2): make" with the body "make build · 3 min 12 s" and the Show Terminal button on hover -->

> [!SEE]
> The notification reads "Finished: make" or "Failed (exit 2): make", with the command and its duration. Its **Show Terminal** button brings your terminal to the front.
> Not seeing it? → [Troubleshooting › Notifications](?p=troubleshooting#notifications)

How it works:

- **A command in Terminal has no script token**, because it is not a Desktap script. `tellme` talks to the agent through the agent's socket, a file that only your macOS account can open ([Working from your Mac › Send one update by hand](?p=from-your-mac#send-one-update-by-hand)).
- An action from a program like this one **runs at once only when it is harmless**: it opens an app or a web page, or it is a system action such as Play/Pause. An action that runs code shows the full command first and asks: **Run on your Mac?** on the phone, **Run this from a notification?** on the Mac ([Notifications › When a tap asks first](?p=notifications#when-a-tap-asks-first)). That is why **Show Terminal** opens an app.
- **Show Terminal** opens the app the command ran in: macOS sets `$__CFBundleIdentifier` in the shells of Terminal, iTerm2, Ghostty and other terminal apps.
- **With the phone away**, its notification waits on the Mac and arrives when the phone connects. The Mac shows its own at once.
- **`tellme` ends with the command's exit code**, so `tellme make && make install` still works.
- **The notification shows the whole command line**, on the lock screen too: don't put `tellme` in front of a command that carries a password.

**Make it yours**

- **Only the phone**: `targets: ["phone"]`. It then shows at once only while Desktap is on screen, or for about 30 s after you leave it.
- **No sound**: add `sound: false,` before `actions`.
- **Only after long commands**: add `(( SECONDS - started < 60 )) && return $rc` on the line after `"$@"; rc=$?`.

**If it doesn't work**: "tellme: Desktap Agent is not running" means nothing answered on the agent's socket. Start Desktap Agent. If it is running, its menu or **Overview** in its window says why it does not answer: **Paused — another user is using this Mac**, or a line about AI tools ([Working from your Mac › The agent on your Mac](?p=from-your-mac#the-agent-on-your-mac)).

## Next

- [Notifications](?p=notifications): every field, the action buttons, and where a notification arrives.
- [Working from your Mac](?p=from-your-mac): try a script in Terminal, and let other programs drive a button.
- [Recipes: live widgets](?p=recipes-widgets): widgets that show what your Mac is doing.
- [Troubleshooting](?p=troubleshooting): an error text or a symptom, and its fix.
