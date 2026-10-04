<!-- updated: 2026-10-02 -->
# Live widgets

A live widget is a button that keeps itself up to date: free disk space, the song that is playing, the state of a build. A startup script on your Mac does the work while your iPhone or iPad is connected to it, and sends the button a new look whenever the value changes.

<!-- Anchor used by the iOS app (EditorHelpLinks: the Learn More… link under Advanced › Startup Script). Keep this heading text. -->
## Startup scripts

Every button can have a startup script: in the button's editor, tap **Advanced › Startup Script › Write Script** (it is in the main editor only, not under **Long Press**). It is a zsh script, like a tap script (the **Shell Command** a button runs when you tap it). There are two differences: Desktap Agent, the app on your Mac, starts it by itself, and it has no time limit. The editor sums it up under the script: "Runs on the Mac for as long as this device is connected. Use it for live widgets that update this button."

When it runs:

- It starts when the phone connects, and again right after you tap **Add** or **Save** while the phone is connected.
- Every startup script of the active profile runs, not only those on the page you are looking at.
- It keeps running while the phone is locked or Desktap is in the background. The connection stays open, and the button is up to date when you come back.
- It stops when the phone disconnects, when you switch profiles, or when you stop it on the Mac, under **Scripts** in the agent window. The phone has no Stop for it: tap **Remove Startup Script**, then **Save**.
- Saving a button with changes restarts its startup script, even when the script itself did not change. **Save** without changes restarts nothing.

Every start is a fresh start: the script's variables begin empty. The agent may also restart all scripts by itself, for example when it renews the script token. Keep anything a script must remember in a file ([Button logic › Remembering things](?p=button-logic#remembering-things)).

<div class="dt-mount" data-diagram="script-lifecycle" data-mode="short">How the agent starts, restarts and stops a startup script, and how the phone lists it in each state.</div>

<!-- SCREENSHOT lw-advanced: the Advanced screen of a button with a saved, running startup script: the Startup Script row showing "#!/bin/zsh", Status "Running" with its green dot, Restart Startup Script, Remove Startup Script, the footer "Runs on the Mac for as long as this device is connected…", and the Button ID section below. iPhone 17 Pro, English, dark, iOS 26; turn off Settings › Security › Hide Code While Recording or Mirroring first. -->

## Your first live widget: free disk space

This widget shows the free space on your Mac's startup disk and checks it again every 10 seconds.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
#!/bin/zsh
# Free disk space: GB left, checked every 10 s
pause=10                                          # seconds between two checks
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

last="" sent_at=-100                              # nothing sent yet
while true; do
  free=$(df -g / | awk 'NR == 2 { print $4 }')    # free space on the startup disk, in GB
  # Send a change at once, and the same value every 30 s in case something cleared it
  if [[ $free != $last ]] || (( SECONDS - sent_at >= 30 )); then
    title=$(json "$free GB free")
    post "{\"cellId\":\"$cell\",\"title\":$title,\"icon\":\"internaldrive.fill\"}" &&
      last=$free sent_at=$SECONDS                 # sent only when the agent answered 200
  fi
  sleep $pause
done
```

Put it on a button:

1. In edit mode, tap a free spot ([Get started › Your first button](?p=start#your-first-button) shows how). In **New Button**, scroll to the end and tap **No Action**: a button that only shows something needs no tap action, and an empty **Shell Command** would keep **Add** disabled.
2. Under **Appearance**, type a **Name**, such as "Disk". The button shows it until the first value arrives.
3. Tap **Advanced**, then **Write Script**. Paste the script and tap **Done**. Go back and tap **Add**.

> [!SEE]
> Within a second the button shows your free space, such as "412 GB free", with a drive icon. **Advanced › Status** reads **Running**.
>
> <!-- SCREENSHOT lw-disk: the free disk button on the deck reading "412 GB free" with the internaldrive.fill icon, next to ordinary buttons. iPhone 17 Pro, English, dark, iOS 26. -->
>
> Not seeing it? → [When a widget doesn't work](#when-a-widget-doesnt-work)

### The helpers

Every script from here on carries this block, unchanged. The page folds it, and **Copy** still takes the whole script. Here is what each line does:

| Line | What it does |
|---|---|
| `export LC_ALL=C` | Numbers come out as `0.5`, never `0,5`, whatever language the Mac uses. |
| `cell="{{CELL_ID}}"` | The agent writes this button's ID here before the script runs ([The `{{CELL_ID}}` placeholder](#the-cell_id-placeholder)). |
| `api="http://127.0.0.1:9848/api"` | The agent's address. Write `127.0.0.1`, not `localhost`: `localhost` may reach another program while the agent is not running. |
| `call PATH [BODY]` | Sends one request to the agent. It sets `$code` to the HTTP status (`000` when nothing answered) and `$answer` to the reply, and succeeds only on 200. |
| `--variable` and `--expand-header` | curl reads the script token from its own environment and writes it into the header itself, so the token never appears on a command line. [Get started › The curl line, explained](?p=start#the-curl-line-explained) goes through every flag. |
| `[[ $code == 400 ]] && print -u2` | On a 400 the agent says what is wrong. `call` prints that to stderr, so it becomes part of the error text if the script fails. |
| `post BODY` | Sends an update to a button. It also sets `$dropped` to 1 when the phone is not reading right now ([Pace](#pace)). |
| `json TEXT` | Turns text into a JSON string, with quotes, backslashes, line breaks and tabs escaped. Pass any text through it before you put it in a body. |

### Send only what changed

Three habits in the loop keep the button current:

- Send the first value at once, before the first `sleep`, so the button shows something within a second.
- Send the same value again every 30 seconds: another script's `reset` or a stopped tap script may have brought back the saved look.
- Count a value as sent only when `post` succeeded (the `&&`). Otherwise `last` keeps the old value, and the next pass tries again.

### Stopping cleanly

```zsh
trap 'post "{\"cellId\":\"$cell\",\"reset\":true}"; exit 0' TERM INT
```

To stop a script, the agent sends SIGTERM to it and to everything it started, and kills whatever is left 2 seconds later. This trap sends a `reset`, which brings back the saved look, and then ends the script.

- Keep the `exit 0`: without it the loop carries on and draws the old value again until it is killed.
- Use only this trap. The pair `trap cleanup EXIT` plus `trap 'cleanup; exit 0' TERM` runs the cleanup twice, and in zsh an EXIT trap alone never runs on SIGTERM.
- Keep its work short: it has 2 seconds, and about half a second when you quit the agent.

When the agent stops a script, the phone brings back the saved look by itself, except when a tap script reaches its 60-second limit. The trap matters at that limit, when something else stops the script (Ctrl-C in Terminal, for example), and for other buttons the script draws: reset those in the same trap ([Button logic › One script, several buttons](?p=button-logic#one-script-several-buttons)). More in [How scripts run › Time limits and stopping](?p=scripts#time-limits-and-stopping).

## When a widget doesn't work

Nothing is drawn on a widget that doesn't work: it keeps what it showed last. The ⚠ count next to your Mac's name at the top of the deck says how many buttons don't work, as in **⚠ 2** (outside edit mode). Tap it to open **Errors**, the list that says why.

<!-- SCREENSHOT lw-errors: left, the deck's top bar with "⚠ 2" in orange right of the Mac's name; right, the Errors list it opens: Not working now with "Script crashed" ("Disk · Startup script", "Default › Main", `Exit code 3`, "The agent will restart it shortly.", Show Button, Restart Script), and Not running with "Script finished" ("Logs · Startup script", "It won't run again until you restart it."). iPhone 17 Pro, English, dark, iOS 26; Hide Code While Recording or Mirroring off, or the error text is hidden; made-up test scripts only. -->

| The count | What it means |
|---|---|
| no ⚠ | Nothing fails, and every startup script runs. |
| orange | Buttons don't work now: they are in **Not working now**. |
| gray | Nothing fails, but startup scripts don't run: they are in **Not running**. |

| Section of **Errors** | What is in it |
|---|---|
| **Not working now** | A startup script that ended with an error or was ended by another program, from its first failure, while the agent starts it again after 5, 10, 20, 40 and 60 s, then every minute. A script's [report](#report-what-went-wrong). An update the agent refused, as **Drawing rejected**. |
| **Not running** | A startup script that ended with exit code 0 (often a loop that came to an end), which the agent never restarts, or one stopped on the Mac. |
| **Earlier** | Taps that failed, and everything that no longer holds. **Clear** in its header empties it. |

Each row says what went wrong, such as "Script crashed" or "No connection". Then come the button and the part that failed ("Disk · Startup script"), its profile and page, the error text and a hint. A startup script's error text is `Exit code N:` and the end of what it printed to stderr. When the agent recognizes it, as with `command not found`, the headline and the hint name the cause ("Not found"), and the part that failed adds the state: "Disk · Startup script · restarting" or "Disk · Startup script · keeps failing". At the bottom of the row:

- **Show Button** closes the list and outlines the button on its page.
- **Restart Script** starts the button's startup script again.
- **Open Settings on Mac** opens the right pane of System Settings on the Mac, when macOS refused a permission.
- Touch and hold the row for **Copy Error**: the whole text, not only the first 400 characters.

A fixed script leaves **Not working now** after a minute without failing; a finished or stopped one leaves **Not running** as soon as it runs. When the phone disconnects, every row moves to **Earlier**, and each start of Desktap begins with an empty list.

> [!TIP]
> To see it, add `exit 3` right before `done` and save. About 10 seconds later ⚠ 1 appears: tap it to read `Exit code 3`. Remove the line and save; a minute later the count goes away.

A tap that fails makes its button flash red and shake, and a toast, a short note at the bottom of the screen, says what went wrong: the start of the error text, and **Details** to open the list on that tap.

A startup script's state also shows in **Advanced › Status** (Running, Restarting, Failed or Not Running, with the error under it) and on the Mac under **Scripts** in the agent window, which names it by its first comment. So start every script with a comment of up to 60 characters after `#!/bin/zsh` ([Working from your Mac › The Running Scripts window](?p=from-your-mac#the-running-scripts-window)).

<!-- SCREENSHOT lw-running-scripts: the Desktap Agent window on Scripts, with the row "Free disk space: GB left, checked every 10 s" (Startup badge, uptime, Restart, Stop) and a Failed row opened to show "Exit code 3". English, dark. -->

Make the error worth reading: before `exit 1`, print the reason to stderr on one short line, as in `print -u2 "No network"`. The helpers already print every 400 with the agent's reason. More symptoms and fixes: [Troubleshooting › A button or widget doesn't work](?p=troubleshooting#a-button-or-widget-doesnt-work).

## Report what went wrong

A widget that can't get its value, because the network is down or a key was refused, often keeps running, and nothing says why its button stopped changing. Tell the phone with `POST /api/error`: the button joins the ⚠ count, and its row names the problem in the phone's language, with your words under it.

<!-- verified 2026-10-02, agent 1.2.3 (build 8), harness -->
```zsh
# part of a startup script, after the helpers ($url is set at the top): say why it is stale
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

while true; do
  page=$(curl -q -s -m 10 -w '\n%{http_code}' "$url")
  case ${page##*$'\n'} in            # the service's HTTP status, on the last line
    200)     report ok ;;            # then draw the value from ${page%$'\n'*} as usual
    401|403) report auth "The service refused the key" ;;
    000)     report network "The service can't be reached" ;;
    *)       report other "The service answered ${page##*$'\n'}" ;;
  esac
  sleep 60
done
```

- `report KIND WORDS` posts only when the two change, and `report ok` clears the report once the call works again: the row moves to **Earlier**.
- Pick the kind by what the person should do: `auth` when a key must be renewed, `config` when a setting at the top of the script is wrong, `network` or `timeout` when it is out of their hands. Every kind with its headline: [Script API › Error kinds](?p=api#error-kinds).
- Write for a person, as in "GitHub answered 401: Bad credentials", in up to 500 characters. Never put a token or a password in the words.
- Keep the last value on the button: the count already says it is old. Show "—" as well only where an old value passes for a current one, such as a price.
- Report on the script's own button, `$cell`, even in a script that draws several. A report ends with `clear`, the script's next start or stop, or a disconnect. A script that ends by itself leaves it: its last report may say why it gave up.
- A crash needs no report: a startup script that ends with an error is listed with its stderr already.

[A number from the web](?p=recipes-widgets#a-number-from-the-web) uses it in full. A tap script can report too, and its toast then says your words ([Script API › From a tap script](?p=api#from-a-tap-script)).

<!-- Anchor used by the iOS app (EditorHelpLinks: the Learn More… link under Advanced › Button ID). Keep this heading text. -->
## The `{{CELL_ID}}` placeholder

Before the agent runs any script of a button, it replaces every `{{CELL_ID}}` in it with that button's ID, in upper case:

```text
You write:   cell="{{CELL_ID}}"
It runs:     cell="3F2A9C1E-5B7D-4E2A-9C1F-0A8B6D4E2F11"
```

So you never type a button's ID into its own script: the script always knows which button it belongs to, whether a tap started it or the agent did. The API calls this ID `cellId`.

The replacement works in every script of a button: the **Shell Command** of a tap or a long press, **AppleScript**, **Text Snippet** and the startup script. It also works in the commands of a notification's action buttons. URLs, Shortcut names and key combinations are left as typed.

It is a plain text replacement, so it works inside any string: `"$DESKTAP_STORAGE/count-{{CELL_ID}}"` gives each button its own file in the storage folder. In Terminal nothing replaces it: [Working from your Mac › Try a script in Terminal first](?p=from-your-mac#try-a-script-in-terminal-first) shows how to put an ID in yourself.

### Finding a button's ID

Open the button's editor and tap **Advanced**. Under **Button ID**, tap **Copy** (it turns into **Copied**), then paste the ID where you need it, for example into another button's script. The footer says what it is for: "This button's scripts see it as {{CELL_ID}}. Copy it when one script draws several buttons."

<!-- SCREENSHOT lw-button-id: Advanced › Button ID with the ID in monospace and the Copy button just turned into "Copied", with the footer below. iPhone 17 Pro, English, dark, iOS 26. -->

There are three more ways:

- A running script can request `GET /api/view`. Its `cells` hold the ID of every button on the page that is on screen, and stay empty while Desktap is in the background ([Script API › GET /api/view](?p=api#get-apiview)).
- An AI app finds the IDs by itself ([Use with an AI app](?p=ai)).
- A program on your Mac outside Desktap lists them through the agent ([Working from your Mac › List the IDs of every button](?p=from-your-mac#list-the-ids-of-every-button)).

The API takes an ID in upper or lower case. An update for an ID that belongs to no button gets the same answer as one for a hidden button, `"visible": false`, so copy an ID rather than type it.

## The live look

What a script sends is the button's **live look**. It covers the **saved look** (the name, icon and color you set in the editor) until something brings the saved look back.

| Field | What it sets |
|---|---|
| `title` | The text. It wraps at spaces onto two lines; a `\|` is drawn as it is. |
| `icon` | An SF Symbol name, such as `internaldrive.fill`. |
| `emoji` | One emoji, in the icon's place. |
| `color` | The button's color, exactly `#RRGGBB`. For anything else the agent refuses the whole update. |
| `svg` | An SVG face, which hides the title, icon and emoji ([SVG faces](?p=svg-faces)). |
| `reset` | `true` brings back the saved look; the other fields of that update change nothing. |

Send only the fields you change. Each update is merged into what the earlier ones set, so this line turns the button red and keeps its title and icon:

```zsh
post "{\"cellId\":\"$cell\",\"color\":\"#FF3B30\"}"     # part of a script, after the helpers
```

Icon and emoji share one place: sending one replaces the other, and an update that holds both shows the emoji. A single field cannot go back to its saved value: `reset` brings back the whole saved look. A new title rolls its digits into place in about 0.3 s.

Every update gets an answer from the agent, which checks it before anything goes to the phone:

<div class="dt-mount" data-diagram="round-trip" data-mode="full">Where an update goes and what the agent answers: shown on the button, held for a hidden button, held while the phone is not reading, or refused with the reason.</div>

A 400 says what is wrong, even with no phone connected. With one connected, the phone also lists the button as **Drawing rejected** until the agent accepts an update, its tap script ends, or its startup script starts again or stops. A 200 may add `"visible": false`: the button is not on screen, and the agent keeps the newest look and shows it the moment the button appears. `"dropped": true` means the phone is not reading right now ([Pace](#pace)).

The keys come in any order, so look for a part of the answer, as `post` does, or read it with jq. Every answer is listed in [Script API › Answers](?p=api#answers).

### Show a result for a few seconds

A tap script that works leaves no trace on the phone, so this one shows its own result. It checks a website, shows Up or Down for 3 seconds, then brings back the saved look. Use it as a button's tap action: in **New Button**, choose **Shell Command** and paste it into **Command**. Give the button a **Name**, such as "Site": a Shell Command gets none by itself.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Site check: shows Up or Down for 3 seconds
url="https://example.com"                         # the page to check
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

if curl -q -s -o /dev/null -m 10 --fail "$url"; then
  post "{\"cellId\":\"$cell\",\"title\":\"Up\",\"emoji\":\"✅\",\"color\":\"#34C759\"}"
else
  post "{\"cellId\":\"$cell\",\"title\":\"Down\",\"emoji\":\"❌\",\"color\":\"#FF3B30\"}"
fi
sleep 3
post "{\"cellId\":\"$cell\",\"reset\":true}"      # back to the saved look
```

> [!SEE]
> Tap the button. It shows Up with ✅ on green (or Down with ❌ on red) for 3 seconds, then goes back to "Site".
>
> A red flash and a toast instead? **Details** opens its row in **Errors** ([When a widget doesn't work](#when-a-widget-doesnt-work)).
>
> <!-- SCREENSHOT lw-tap-toast: the deck right after a failed tap of a Shell Command whose only line is `nosuchtool`: the button shaking, and the toast at the bottom with the orange symbol, "Not found", "zsh:1: command not found: nosuchtool" and Details. iPhone 17 Pro, English, dark, iOS 26; Hide Code While Recording or Mirroring off, or the error text is left out; a made-up test button. -->

While a tap script runs, the button pulses and further taps are ignored. On a button that also has a startup script, let the startup script do all the drawing; the tap only changes what the loop reads ([Button logic › Taps change state, the loop draws](?p=button-logic#taps-change-state-the-loop-draws)).

### What brings back the saved look

A live look stays until something brings back the saved look: a `reset`, a save of the button with changes, or a disconnect. When the agent stops a script, only that script's own button gets its saved look back, and a script that ends by itself leaves its last look on the button. Every case is in [How scripts run › What brings back the saved look](?p=scripts#what-brings-back-the-saved-look).

## Pace

Send as often as the value changes in a way a person would notice, and no more:

| The widget shows | Send |
|---|---|
| a clock or a timer | every second |
| CPU, memory, network | every 2–5 s |
| disk space, battery | every 10–60 s |
| anything from the web | every 60 s or more |
| an audio spectrum | up to 15 frames a second ([Scenes and sound › Music levels](?p=scenes-and-sound#music-levels)) |

- Sample with `iostat`, `vm_stat`, `sysctl` and `df`. Avoid `top`: each call costs far more CPU time than all four together.
- Keep sending while the button is off screen. The answers then say `"visible": false`, and the agent keeps the newest look and shows it the moment the page opens. Only expensive loops rest while hidden ([Scenes and sound › Rest while the page is hidden](?p=scenes-and-sound#rest-while-the-page-is-hidden)).
- Slow down while answers say `"dropped": true`. The phone is not reading right now, and the agent sends it the newest look later by itself. One line after `post` is enough: `(( dropped )) && sleep 4`.
- For more than one update a second, send them all on one connection ([Scenes and sound › One connection for fast loops](?p=scenes-and-sound#one-connection-for-fast-loops)).

## Next

- [SVG faces](?p=svg-faces): draw a ring or a chart that glides from one value to the next.
- [Button logic](?p=button-logic): switches, counters and timers, and one script for several buttons.
- [Recipes: live widgets](?p=recipes-widgets): widgets to paste, starting with [a number from the web](?p=recipes-widgets#a-number-from-the-web).
- The **Gallery** on the phone: add a ready-made widget, then read its startup script under **Advanced**.
