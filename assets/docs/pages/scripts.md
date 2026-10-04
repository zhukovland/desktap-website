<!-- updated: 2026-10-02 -->
# How scripts run

The rules behind every script a button runs on your Mac: how it starts, what it gets, how long it may run, how it stops and what macOS asks for. The learning pages teach the patterns; this page is where you look them up.

The short version:

- A script [runs in zsh](#how-a-script-starts), from the folder `/`, with a fixed `PATH` and none of your shell setup.
- A tap gets [60 s](#time-limits-and-stopping); a [startup script](#when-startup-scripts-run) runs as long as your iPhone or iPad is connected.
- A stop leaves a script 2 s to finish, or 0.5 s when the agent quits: use [the one trap](#one-trap-run-once) that ends in `exit 0`.
- Text your script did not write goes into JSON [through jq or `json`](#text-in-json).
- Errors [show on the phone](#restarts-and-states): tap the ⚠ count next to your Mac's name at the top of the deck for the list, and a failed tap says why in a toast, a short note at the bottom of the screen.

## Kinds of scripts

A button can run a script when you tap it, when you hold it, and the whole time the phone is connected: that last one is its startup script. Each kind has its own place in the button editor.

| Kind | Where in the editor | Runs | Time limit |
|---|---|---|---|
| Tap script | **Tap** › **Type**: **Shell Command** › **Command** | on every tap | 60 s |
| AppleScript | **Tap** › **Type**: **AppleScript** › **Script** | on every tap | 60 s |
| Shortcut | **Tap** › **Type**: **Run Shortcut** | on every tap | 60 s |
| Long press | **Long Press** › **Add Long Press**, then the same rows as Tap | when you hold the button | 60 s |
| Startup script | **Advanced › Startup Script › Write Script** | while the phone is connected ([When startup scripts run](#when-startup-scripts-run)) | none |
| Notification action | the `command` of an action button in `POST /api/notify` | when you tap that action button | 60 s, run as a tap of the notification's button |

- Tap, long press and the startup script are independent: one button can run all three at once.
- While a tap script runs, the button's border pulses and the phone sends no further taps. **Stop Process** in the editor's **Tap** or **Long Press** section ends it.
- The agent does not track AppleScript and Shortcut runs: they have no **Stop Process**, do not appear under **Scripts** in the agent window on the Mac, and end on their own or at 60 s.

> [!SEE]
> Success is silent. A tap or long press that fails flashes the button red, shakes it and shows a toast: what went wrong, the start of the error text and **Details**, which opens its row in **Errors**.

## How a script starts

The agent writes the script to a private temporary file and runs that file. Nothing from your Terminal setup comes along.

| What | How |
|---|---|
| Interpreter | `/bin/zsh -f <file>`. A first line such as `#!/bin/bash` picks another interpreter; the agent adds `-f` to zsh and `-I` to python. |
| Your shell setup | not read: no `~/.zshenv`, `~/.zprofile` or `~/.zshrc`, no aliases, no exported variables |
| Working folder | `/`. Use absolute paths, or `cd "$HOME/Projects/app" \|\| exit 1`. |
| Input | empty: a `read` gets end of file at once |
| `{{CELL_ID}}` | replaced with the button's ID before the file is written ([Placeholders](#placeholders)) |
| Syntax check | none on the phone for shell scripts. On the Mac, `zsh -n try.zsh` checks a copy without running it. |
| A syntax error | the lines before it have already run; the error gives the line number, as in `zsh:12:` |
| A missing interpreter | `Cannot run script with interpreter '<your first line>' — is it installed? (<reason>)` |
| Name under **Scripts** on the Mac | the first `#` comment before any code, up to 60 characters. Without one: "Shell script (N lines)". |
| Output of a startup script | stdout is thrown away; when it fails, `Exit code N:` and the last 2 KB of stderr are its error text in **Errors** and **Advanced › Status** |
| Output of a tap or long-press script | stdout is never shown; when it fails, stderr is its error text: `Exit code N` when it printed nothing, `Timed out after 60s` at the limit |
| The token in any output | replaced with `‹redacted›` before the agent keeps it |

Write your own messages to stderr (`print -u2 "No network"`): that is the error text the phone shows when the script fails. The helpers block at the top of every script in these docs ([Live widgets › The helpers](?p=live-widgets#the-helpers)) already does this whenever the agent answers 400, with the agent's reason. Print one short line right before `exit 1`, and little else to stderr: a toast shows the first 90 characters of the error text, and a row in **Errors** the first 400.

To name the kind of problem as well, a tap script reports it right before `exit 1`, and its toast then shows your words ([Script API › From a tap script](?p=api#from-a-tap-script)). A startup script reports a failure it survives, such as a network that is down ([Live widgets › Report what went wrong](?p=live-widgets#report-what-went-wrong)).

<!-- Anchor used by the iOS app (EditorHelpLinks: the Learn More… link in the code editor's Variables menu). Keep this heading text. -->
## Environment variables

Every script a button runs gets the same small environment, which the agent builds from scratch. The code editor's ⋯ › **Variables** menu lists the three entries you write in scripts.

| In the Variables menu | What it is |
|---|---|
| `$DESKTAP_TOKEN` · "token for the agent's local API (new each time the agent starts)" | The script token. Let curl read it, never copy it ([The token](#the-token)). |
| `$DESKTAP_STORAGE` · "folder on the Mac for the script's files" | `~/Library/Application Support/Desktap/ScriptStorage`, for what a script must remember ([Storage and size limits](#storage-and-size-limits)). |
| `{{CELL_ID}}` · "replaced with the button's ID" | Not a variable: text the agent replaces with this button's ID before the script runs ([Placeholders](#placeholders)). |

The menu shows all three for **Command** and **Startup Script**, and only `{{CELL_ID}}` for an AppleScript's **Script**. The environment is the same everywhere, though: AppleScript, long-press scripts, Shortcut runs and notification action commands get it too.

| Variable | Value |
|---|---|
| `PATH` | always `/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin` |
| `HOME`, `USER`, `LOGNAME`, `SHELL` | your account's |
| `TMPDIR` | your account's private temporary folder |
| `PYTHONNOUSERSITE` | `1` |
| `LANG`, `LC_*` | passed on only when the agent has them, which it often does not |
| `SSH_AUTH_SOCK` | passed on when it is a socket of yours, so `ssh` can use the keys in your ssh-agent |
| anything else | not set, apart from a few macOS system variables |

What this means for a script:

- System folders come first, so `bash` and `curl` are always the system's, even when Homebrew has newer ones. A tool that only Homebrew has (`ffmpeg`, say) is still found.
- Add any other folder in the script itself: `export PATH="$HOME/.local/bin:$PATH"` before you call `claude`.
- Put `export LC_ALL=C` at the top whenever you format numbers, or a German or Russian locale writes `0,5`. The helpers block already does.
- In Terminal, none of the three menu entries works. `$DESKTAP_TOKEN` and `$DESKTAP_STORAGE` are empty (the agent answers 401), and `{{CELL_ID}}` stays as typed (400 `Invalid JSON`). [Working from your Mac › Try a script in Terminal first](?p=from-your-mac#try-a-script-in-terminal-first) shows how to test there.

### The token

`$DESKTAP_TOKEN` lets a script talk to the agent at `http://127.0.0.1:9848`. Only programs on this Mac that run under your account can reach the agent.

> [!NOTE]
> Three rules cover the token:
>
> 1. Use `$DESKTAP_TOKEN`.
> 2. Never paste the token into a script: it changes every time the agent starts.
> 3. Never put it on a command line or print it: let curl read it with `--variable '%DESKTAP_TOKEN=' --expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}'`.

| When | What happens |
|---|---|
| Desktap Agent starts, or its API starts again (after another macOS user's session, for example) | a new token (`dtw_…`); startup scripts get it, and running ones are stopped and started again with it |
| the agent quits | the token stops working at once |
| the agent's API is not serving (another Desktap Agent on this account serves it, for example) | `$DESKTAP_TOKEN` is empty in this agent's tap scripts, so their updates fail (401 from the other agent); its startup scripts wait |
| a script uses it | it reaches six routes: status, view, update-button, notify, error and audio levels; the agent's other routes answer 403 ([Script API › Endpoints](?p=api#endpoints)) |

Think the token leaked? Quit Desktap Agent (menu-bar icon › **Quit Desktap**, ⌘Q) and open it again.

An AI app that checks a startup script gets a note when the script breaks rule 2 or 3: "uses a pasted API token, which stops working at every agent start; use $DESKTAP_TOKEN" or "puts the API token on a command line, where any app on this Mac can read it; use the curl --variable form from the guide".

Programs you start yourself (from Terminal, cron or a Claude Code hook) have no token and need none: see [Working from your Mac › Let other programs drive a button](?p=from-your-mac#let-other-programs-drive-a-button).

## Placeholders

A placeholder is text the agent replaces before a script runs. Only `{{CELL_ID}}` belongs to the agent; the others look alike, but someone else fills them in.

| Placeholder | Replaced in | With |
|---|---|---|
| `{{CELL_ID}}` | tap, long-press and startup scripts, AppleScript, Text Snippet, notification action commands | this button's ID, in upper case. In a notification action: the notification's `cellId`, or a stand-in ID when it has none. |
| `{{CELL_ID}}` | Open URL, Shortcut names, key combinations | nothing: it stays as typed |
| `{{CELL_ID:<ref>}}` | scripts an AI app creates in one request | the ID of the new button with that `ref`, filled in by the AI tools before delivery ([Use with an AI app](?p=ai)) |
| `{{DESKTAP_TOKEN}}` | nowhere: it is curl's own syntax | curl fills it in from `--variable '%DESKTAP_TOKEN='` |

You never replace `{{CELL_ID}}` by hand. To update another button, paste its ID from **Advanced › Button ID › Copy** into a named variable ([Button logic › One script, several buttons](?p=button-logic#one-script-several-buttons)).

## Tools every Mac has

Every example in these docs uses only tools that come with macOS 15 and later. Three more look installed but are not.

| Tool | Use it for |
|---|---|
| `zsh` | every script (version 5.9) |
| `awk`, `sed` | numbers and text; `printf "%.1f"` in awk under `LC_ALL=C` |
| `curl` | the agent and the web (version 8.7; the `--variable` form needs 8.3 or later) |
| `jq` | building JSON and reading answers (`/usr/bin/jq`; `jq .` pretty-prints) |
| `osascript` | AppleScript, and through it the apps on your Mac |
| `date`, `sysctl`, `vm_stat`, `iostat`, `netstat`, `df`, `pmset` | time, CPU, memory, network, disks, battery |
| `route`, `defaults`, `open` | the network interface in use, settings, opening apps and URLs |

> [!WARNING]
> On a Mac without the Command Line Tools, `python3`, `git` and `swift` are stubs that open an install dialog. A failing startup script retries every minute, so the dialog keeps coming back. `command -v python3` finds the stub and proves nothing.

`bash` is version 3.2: no `mapfile`, no associative arrays, and `#!/bin/bash` gets the same 3.2. Write zsh.

## Writing zsh for Desktap

Most surprises come from bash habits that zsh does not share, and from the agent's bare environment. Every row below is a mistake that broke a real script.

**bash habits**

| Instead of | Write | Why |
|---|---|---|
| `for w in $list` | `for w in ${=list}`, or `read -rA words <<< "$line"` | zsh does not split `$list` into words |
| `read -a arr` | `read -rA arr` | zsh's array option is `-A` |
| `mapfile -t lines < file` | `lines=("${(@f)$(<file)}")` | zsh and bash 3.2 have no `mapfile`; `$(<file)` reads the file without `cat` |
| `shopt -s nullglob` | `setopt null_glob`, or `*(N)` on one pattern | `shopt` is bash only |
| `status=$(curl …)` | `answer=$(curl …)` | `status` is read-only in zsh |
| `${a[-13,-1]}` on a short array | pad the array to 13 items first | the slice is empty when the array is shorter |

**Numbers, text and time**

| Instead of | Write | Why |
|---|---|---|
| `$(( used * 100.0 / total ))` | awk with `printf "%.1f"` | zsh prints floats such as `0.17999999999999999` |
| `printf "50%"` | `printf "50%%"` | a single `%` starts a format |
| `\x27` in awk | `\047`, or a quote passed in with `-v` | macOS awk reads `\x27a` as one hex number |
| a log line straight into a notification | `sed $'s/\e\\[[0-9;]*m//g'` first | terminal color codes show as garbage |
| `$EPOCHSECONDS` on its own | `zmodload zsh/datetime` first | without it, `$EPOCHSECONDS` and `$EPOCHREALTIME` are empty and `strftime` is not found, so a timed step never runs |
| `sleep 1` in a clock or a timer | `sleep $(( 1 - EPOCHREALTIME % 1 ))` | the loop's own work adds 10–30 ms a pass, so `sleep 1` drifts and now and then skips a second; this form wakes just after every whole second |
| `timeout 10 cmd` | the function in [A time limit for any command](#a-time-limit-for-any-command) | macOS has no `timeout` |

**Files, paths and processes**

| Instead of | Write | Why |
|---|---|---|
| `cd app` | `cd "$HOME/Projects/app" \|\| exit 1` | scripts start in `/` |
| `claude -p "…"` | `export PATH="$HOME/.local/bin:$PATH"` first | `~/.local/bin` is not in `PATH` |
| `source "$state"` | `read -r end < "$state"`, or jq | a state file is data, not code |
| `nohup`, `disown`, `setsid` | nothing: keep everything inside the script | they escape the agent's stop and keep running |

**The Mac's own tools**

| Instead of | Write | Why |
|---|---|---|
| `netstat -ibn` fields counted from the left | count from the end: `$(NF-4)` bytes in, `$(NF-1)` bytes out | rows without an address column shift |
| `en0` as the network interface | `route -n get default \| awk '/interface:/ { print $2 }'` | the interface in use is not always `en0` |
| `iostat` idle from its first line | `iostat -c 2 -w 1`, then `$(NF-3)` of the last line | the first line is the average since startup |
| `vm_stat` pages × 4096 | the page size from `vm_stat`'s first line | Apple silicon pages are 16 KB |

## Text in JSON

Text you write yourself can go into the body as it is. Text your script did not write (a song title, a log line, an answer from the web) must be escaped first: otherwise the agent refuses the update, or the text changes without an error.

| Text pasted straight into `"title":"…"` | What the agent does |
|---|---|
| `Disk OK`, `Ünïcödé 🚀`: letters, accents, emoji | accepts it |
| `He said "hi"` | 400 `Invalid JSON`: the quote ends the string |
| `back\slash` | 400 `Invalid JSON` |
| a line break or a tab | 400 `Invalid JSON` |
| `C:\new` | accepts it, but `\n` turns into a line break: the title changes without an error |

A script that ignores the agent's answer never sees the 400. The helpers block prints it to stderr, so a failing startup script shows it as its error. Both fixes below are parts of a script that starts with the helpers block; `$line` holds the text, for example `line=$(tail -n 1 "$log")`.

For one update, let jq build the whole body:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
# One update with text you did not write: jq builds the whole body
post "$(jq -nc --arg id "$cell" --arg t "$line" '{cellId: $id, title: $t}')"
```

In a loop that posts often, use `json` from the helpers instead: it starts no program. It escapes quotes, backslashes, line breaks and tabs, so replace other control characters first:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
# Many updates in a loop: json() escapes the text without starting a program
line=${line//[[:cntrl:]]/ }   # other control characters (color codes) break JSON
post "{\"cellId\":\"$cell\",\"title\":$(json "$line")}"
```

## Time limits and stopping

Tap, long-press, AppleScript and Shortcut runs end after 60 s; a startup script has no limit. Whenever the agent stops a script, it first sends SIGTERM (a request to end) to the script and everything it started. SIGKILL ends them 2 s later, or as little as 0.5 s later when the agent quits.

| What stops the script | Time between SIGTERM and SIGKILL |
|---|---|
| the 60 s limit of a tap or long-press script | 2 s |
| **Stop Process** on the phone; **Stop**, **Stop All** or **Restart** under **Scripts** on the Mac | 2 s |
| a changed, removed or replaced startup script; a profile switch; an accepted change from an AI app | 2 s |
| the phone disconnects | 2 s |
| **Quit Desktap**, or the agent relaunching after an update | 0.5 to 2 s: plan for 0.5 s |

- A `sleep` or `curl` in progress stops with the script, so a trap runs at once.
- Once a tap script has exited, the agent no longer tracks or stops anything it left running in the background (`(…) &`). Never use `nohup`, `disown` or `setsid`.
- Work that may take longer than a minute belongs in a startup script: the tap writes a request file, and the startup script does the job ([Recipes: timers, alerts and triggers › Long job with a report](?p=recipes-alerts#long-job-with-a-report)).

### One trap, run once

Every script in these docs has this line right after the helpers block:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
trap 'post "{\"cellId\":\"$cell\",\"reset\":true}"; exit 0' TERM INT
```

In a script that draws an SVG face, the recipes send `\"svg\":{\"remove\":true}` in place of `\"reset\":true`. It takes away only the face and keeps any title, icon or color the script set; `reset` brings back the whole saved look. When a script sets nothing but the face, the two do the same.

How the common traps compare:

| Traps in a zsh script | What runs on SIGTERM |
|---|---|
| `trap '…; exit 0' TERM INT` | the trap, once; then the script ends. Use this one. |
| `trap cleanup EXIT` and `trap 'exit 0' TERM` | `cleanup`, once; it also runs when the script ends by itself |
| `trap '…' TERM` without `exit` | the trap, once; the loop runs on until SIGKILL and may repaint an old value that stays until a save, restart or disconnect |
| `trap cleanup EXIT` alone | nothing: zsh skips the EXIT trap on SIGTERM (bash runs it) |
| `trap cleanup EXIT` and `trap 'cleanup; exit 0' TERM` | `cleanup`, twice |

- When you or the agent stop a script (**Stop Process**, **Stop**, a changed script, a disconnect), the phone returns that button to its saved look by itself; at the 60 s limit it does not. The trap matters for the other buttons a script drew, for state it must save, and when something else stops it (Activity Monitor, `pkill`).
- With `exit 0`, an outside stop counts as finished, and the agent does not restart the startup script. Without a trap, the stop counts as a failure and the script is restarted.
- Keep the trap to one quick post: whatever still runs at SIGKILL is cut off.

### A time limit for any command

curl has `-m` and AppleScript has `with timeout`, but other programs can hang for minutes, and macOS has no `timeout` command. Add this function below the helpers block:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh
# timeout N COMMAND [ARGS] → runs COMMAND and stops it after N seconds (status 124)
timeout() {
  local n=$(( $1 * 5 )) p; shift
  "$@" & p=$!
  while kill -0 $p 2>/dev/null; do
    (( n-- > 0 )) || { kill $p; wait $p; return 124 }
    sleep 0.2
  done
  wait $p
}

load=$(timeout 10 ssh -o BatchMode=yes my-server uptime) || load="No answer"
```

It returns the command's own exit status, or 124 when it had to stop the command. Wrap a single program (`ssh`, `osascript`, `nc`): a command that starts programs of its own may leave them running.

## Restarts and states

A startup script that fails starts again after 5, 10, 20, 40 and 60 s, then every minute, for as long as the phone is connected. A run that lasts a minute or more resets the count.

<div class="dt-mount" data-diagram="script-lifecycle" data-mode="full">A startup script's states and where each one shows, then what the first two seconds after a stop look like with and without exit 0 in the trap.</div>

| Phone: **Advanced › Status** | Phone: **Errors** | Mac: **Scripts** | What happened |
|---|---|---|---|
| Running | not listed; after a failure, its row moves to **Earlier** once it has run a minute | listed with its uptime and a **Startup** badge | it runs |
| Restarting | **Not working now** · "Script crashed" · orange&nbsp;⚠ | Restarting in 10s (attempt 2) | it failed 1 to 5 times in a row: a non-zero exit, a failed start or a stop from outside |
| Failed | **Not working now** · "Script keeps failing" · orange&nbsp;⚠ | Failed — retrying in 60s (attempt 6) | the 6th failure in a row or later; it is still retried every minute |
| Not Running | **Not running** · "Script finished" · gray&nbsp;⚠ | Exited | it exited with 0, which means finished: never restarted by itself |
| Not Running | **Not running** · "Script stopped" · gray&nbsp;⚠ | Stopped | **Stop** or **Stop All** on the Mac |

The ⚠ count is orange while any button fails, and gray when only scripts that don't run are left. When the agent recognizes the error text, the row names it instead of "Script crashed" or "Script keeps failing": "Not found" for `command not found`, "Automation access needed" for AppleScript error -1743, "No connection" for curl's `Could not resolve host`. The line under it then reads "Startup script · restarting" or "Startup script · keeps failing" after the button's name.

Three places show the error, no AI app needed:

- **Errors**, from the ⚠ count next to your Mac's name: the error text (`Exit code N:` and the last 2 KB of stderr), a hint, **Show Button** and **Restart Script**. The row shows the first 400 characters; touch and hold it for **Copy Error**, the whole text. After a failure, the row moves to **Earlier** once the script has run a minute again. While the screen is recorded or mirrored, the error text is covered, unless **Settings › Security › Hide Code While Recording or Mirroring** is off.
- **Advanced › Status** in the button editor, with the same error under it.
- **Scripts** in the agent window on the Mac (menu-bar icon › **Show Agent Window**, then **Scripts** in the sidebar): the chevron on a Failed row shows the error. **Open in Separate Window** shows the same list as the **Running Scripts** window ([Working from your Mac › The Running Scripts window](?p=from-your-mac#the-running-scripts-window)).

<!-- SCREENSHOT scripts-running-window: the Desktap Agent window on Scripts (sidebar visible; Open in Separate Window and Stop All at the top) with one running startup script (Startup badge, uptime, Restart and Stop) and one Failed row expanded by its chevron, showing the error. -->

A script starts over from attempt 0 after **Restart Script** in **Errors** or **Restart Startup Script** in **Advanced**, **Restart** under **Scripts** on the Mac, **Save** with changes, a reconnect, a profile switch or the agent's next start. A Stopped script stays stopped until one of these. A Failed one also gets a fresh attempt when any startup script of the active profile changes; saving a button that changes no startup script does nothing.

## When startup scripts run

Every startup script of the active profile runs while the phone is connected, on every page, whether or not its button is on screen. Each start is from scratch, so keep whatever must survive in the storage folder.

| Event | Startup scripts |
|---|---|
| the phone connects | all of the active profile start at once, iPad-only buttons too |
| you tap **Add** or **Save** with a new or changed script | that script starts from scratch |
| **Save** with other changes, script unchanged | that script restarts |
| **Save** with no changes | nothing happens |
| a profile switch | the old profile's scripts stop, and so do its running tap and long-press scripts; the new profile's start |
| the phone locks, or Desktap goes to the background | they keep running; the agent keeps the newest look of hidden buttons (`"visible": false`) and sends it when they are back on screen |
| the connection drops (about 25 s after the Wi-Fi is really gone) | all stop |
| another phone connects | all stop; the new phone's active profile starts |
| the agent gets a new token while connected | all stop and start again with it, including the ones you stopped |
| another Desktap Agent on this account serves the API, or port 9848 is busy | held until this agent can serve; **Overview** in its window says why ([Working from your Mac › When live widgets don't start](?p=from-your-mac#when-live-widgets-dont-start)) |
| several macOS accounts are logged in | only the active account's agent runs scripts |
| a button with a deck problem: a shared ID, outside the grid, overlapping another, a script over 256 KB | its scripts never run; **Review** in the banner "1 problem on this deck" opens the **Problems** list, which says why |

## What brings back the saved look

What a script sets is the button's live look; the saved look is the name, icon, color and drawing from the editor. Only a few events bring the saved look back.

| Event | Back to the saved look |
|---|---|
| the script exits by itself, with any exit code | nothing: the live look stays |
| a tap script reaches the 60 s limit | nothing |
| a startup script fails and waits to restart | nothing |
| the agent stops the script: **Stop Process**, **Stop**, **Stop All**, **Restart**, a changed or removed startup script, a profile switch, an accepted AI change | this button only; other buttons the script drew keep their look |
| **Save** with changes | this button |
| an update with `"reset": true` | the button it names |
| the phone disconnects, or Desktap restarts | every button |
| the phone locks, or Desktap goes to the background | nothing |

## Storage and size limits

A script lives inside its button; what it remembers lives in the storage folder on this Mac. Both have limits.

| What | Limit |
|---|---|
| The storage folder | `$DESKTAP_STORAGE`: private to your account, on this Mac only, never synced. Every button shares it; give each widget a folder ([Button logic › Remembering things](?p=button-logic#remembering-things)). |
| One script (tap, long press or startup) | 256 KB; a larger one does not run |
| One button: its scripts, face and icon together | 750,000 bytes. A larger one gets **Button Too Large** on Save: "This button is N KB, over the 750 KB sync limit. Make its scripts, drawing or icon smaller." |
| The script itself | always inline. iCloud carries buttons to your other devices but never the storage folder: a button that calls a script file breaks on another Mac. |

## macOS permissions

macOS asks once for each permission, in the name of **Desktap Agent** and with the agent's own explanation. From then on, every script has what Desktap Agent was allowed.

**Permissions** in the agent window lists four of them: Accessibility, Automation (for System Events), Notifications and System Audio Recording. Each row shows its state, such as **Granted** or **Not Granted**, what stops working without it and how to turn it on. An orange dot next to **Permissions** in the sidebar means Accessibility is off, or Automation or Notifications were refused.

| When a script… | macOS asks for | Notes |
|---|---|---|
| controls an app with AppleScript (`osascript`, `tell application "Music"`) | Automation, once for each app: System Events, Finder, Music… | if refused, the script fails and the phone reads "Automation access needed": **Open Settings on Mac** in **Errors** opens System Settings › Privacy & Security › Automation, where you allow it again |
| presses keys through System Events | Accessibility | Desktap Agent asks for it in its first-launch setup |
| takes a screenshot with `screencapture` | Screen Recording | System Settings › Privacy & Security › Screen & System Audio Recording |
| reads calendars or reminders, opens the Downloads folder, uses Bluetooth | access to that | the Gallery's widgets ask the same way |
| follows what the Mac plays | System Audio Recording, at the first `GET /api/audio/levels` and never otherwise | [Scenes and sound › Music levels](?p=scenes-and-sound#music-levels) |
| uses the microphone | nothing | refused without a prompt |

Buttons without a script need Accessibility too: Key Combination, Text Snippet and every System Action except **Eyedropper** and **Copy Last Color**. Without it, the agent refuses them at once: the button flashes red, a toast reads "Accessibility access needed", and the Desktap Agent window shows the alert **Accessibility Access Needed** with **Open Settings** and **Later**. On the phone, **Details** › **Open Settings on Mac** opens the same pane.

## Using AppleScript

An AppleScript gets the same environment as a shell script, and `do shell script` passes it on to the shell it starts. So curl inside it reads the token in the usual way, and the token never appears in the AppleScript text.

| Rule | Why |
|---|---|
| Call curl inside `do shell script`, with the `--variable` form | the token stays in the environment |
| Build the JSON with `jq --arg` | `quoted form of` protects the text from the shell, not the JSON from a quote in a song title |
| Tap **Validate** in the code sheet | it compiles the script on the Mac and shows **Valid** or the error |
| Name variables so they do not clash with the app's words | inside `tell application "Music"`, `playing` and `song` already mean something, and the script will not compile |
| Put loops into a startup script in zsh that calls `osascript` | an AppleScript run is not tracked: no **Stop Process**, not under **Scripts** on the Mac, and it ends at 60 s |
| Send notifications whose actions run something from a Shell Command or a startup script | the agent refuses them from an AppleScript button (403) |

Set as a button's tap, this AppleScript shows the song that is playing on the button for 5 seconds:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```applescript title="AppleScript"
-- Song on tap: shows the song that is playing for 5 seconds
set trackName to "Nothing playing"
if application "Music" is running then
  tell application "Music"
    if player state is playing then set trackName to name of current track
  end tell
end if

-- curl reads the token from the environment; this text never holds it
set curlCmd to "curl -q -s -m 5 --variable '%DESKTAP_TOKEN=' " & ¬
  "--expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}' " & ¬
  "-H 'Content-Type: application/json' http://127.0.0.1:9848/api/update-button -d "
-- jq turns the title into valid JSON, quotes and all
set body to do shell script "/usr/bin/jq -nc --arg id '{{CELL_ID}}' --arg t " & ¬
  quoted form of trackName & " '{cellId: $id, title: $t, icon: \"music.note\"}'"
do shell script curlCmd & quoted form of body
delay 5
do shell script curlCmd & quoted form of "{\"cellId\":\"{{CELL_ID}}\",\"reset\":true}"
```
