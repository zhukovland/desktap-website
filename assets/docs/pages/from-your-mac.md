<!-- updated: 2026-10-09 -->
# Working from your Mac

You build a button on your iPhone or iPad, but you test it, debug it and connect it to other programs on the Mac. This page shows how to move code between the two, try a script in Terminal before it goes on a button, send an update by hand and let other programs change a button. It ends with a tour of Desktap Agent: its menu and its windows.

## Moving code between Mac and phone

| You want to | Do this |
|---|---|
| Put code from these docs on the phone | Open the docs on the phone (**Settings › How to Use** opens them inside Desktap), tap **Copy** on the block and paste it into the code sheet. **Copy** takes the whole block, including folded parts. |
| Put code from the Mac on the phone | Copy it on the Mac and paste it on the phone. Universal Clipboard carries it when both use the same Apple Account, with Wi-Fi, Bluetooth and Handoff on. |
| Read a script on the Mac | While it runs, open [Scripts](#the-running-scripts-window) in the agent window, expand its row and use the copy button. |
| Get a Button ID to the Mac | **Advanced › Button ID › Copy** uses the normal clipboard, so Universal Clipboard takes it across. Or [list every ID on the Mac](#list-the-ids-of-every-button). |
| Put an SVG file on a button | Get the file into the Files app with AirDrop or iCloud Drive, then use **Icon › SVG Drawing › Import from File…**. Or copy its text and tap **Paste** on the same screen. |

> [!NOTE]
> One exception: **Copy All** in the ⋯ menu of the phone's code sheet. Its copy stays on the phone and leaves the clipboard after 120 s.

## Try a script in Terminal first

On the phone, what a script writes to standard error shows only once the script has failed: a startup script's under the ⚠ count next to your Mac's name at the top of the deck, and a tap script's in a toast, a short note at the bottom of the screen. In Terminal you see each error as it happens, and Ctrl-C stops the script.

1. In edit mode, tap a free spot, choose **No Action** and tap **Add**. The script comes later.
2. Tap the new button to open it, then **Advanced › Button ID › Copy**, then **Cancel**.
3. Save the script on the Mac as `widget.zsh` in your home folder. Open a new Terminal window, which starts there, paste the ID into the first line and run:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal, harness -->
```zsh title="Terminal"
ID=PASTE-THE-BUTTON-ID                      # Advanced › Button ID › Copy
sed "s/{{CELL_ID}}/$ID/g" widget.zsh > try.zsh
DESKTAP_STORAGE="$HOME/Library/Application Support/Desktap/ScriptStorage" \
  PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin \
  DESKTAP_TOKEN=$(<~/.desktap-mcp-token) zsh -f try.zsh
```

4. When the button shows what you expect, press Ctrl-C. Paste the script into the button's **Advanced › Startup Script › Write Script** (a tap script into **Shell Command › Command**), tap **Done**, then **Save**.

What the lines do:

- `sed` puts the ID where Desktap would put it. Without it, every update fails with `400` and `Invalid JSON`.
- `DESKTAP_STORAGE` is the storage folder the button's own scripts use. Without it, a script that keeps files there, such as a timer, cannot write them.
- `PATH` is the agent's: a tool that only your Terminal finds, such as one in `~/.local/bin`, fails here too.
- `~/.desktap-mcp-token` holds the agent's current script token, the one a button's scripts get as `$DESKTAP_TOKEN`, with or without an AI app. Read it only for test runs.
- zsh reads `$(<file)` itself, so the token goes into the script's environment and never onto a command line. `-f` skips your `~/.zshrc`, as the agent does.

> [!SEE]
> The button changes with the script's first update, and Terminal stays empty: the helpers print only a `400`. Press Ctrl-C: the button gets back its saved look. Not seeing it? → [Troubleshooting](?p=troubleshooting#nothing-changes-on-the-button)

To see every answer while you test, add `print -r -- "$code $answer"` after a `post`: `200` means the update went through, `503` that no phone is connected.

A test run shows no toast, since nothing was tapped. Two things still reach the ⚠ count: an update the agent refuses, listed as **Drawing rejected** until the agent accepts one for the button, and a report to `/api/error`, listed until your script sends `clear`. Both also end when the button's startup script starts again or is stopped, or when the phone disconnects ([Script API › POST /api/error](?p=api#post-apierror)).

Debugging a script already on a button? Skip step 1. Before step 3, stop its startup script in the agent window's [Scripts](#the-running-scripts-window): two copies of one loop draw over each other and change the same files. The fixed script starts it again in step 4; **Restart** does too.

A few things still differ from the agent:

| | In Terminal | When Desktap runs it |
|---|---|---|
| Language | yours | usually none; the helpers' `export LC_ALL=C` makes numbers read `0.5`, never `0,5` |
| Current folder | wherever you are | `/` |
| Output | in the window | standard output is dropped; when a script fails, its error text shows on the phone: a startup script's under the ⚠ count, a tap script's in its toast |
| The script token | read once; after the agent restarts, run the lines again | always current |
| A notification with an action button that runs something | refused with `403`, which the helpers do not print | sent |

Test such a notification without its action buttons, or on the button with a short time, such as `minutes=1` in the [focus timer](?p=notifications#restart-the-focus-timer-from-the-notification).

## Send one update by hand

Programs you start on the Mac talk to the agent through the agent's socket, a file in your Library folder. Only your own programs can reach it, so it needs no token. Use it to change a button once, to check a frame or to read the whole deck.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal, harness -->
```zsh title="Terminal"
ID=PASTE-THE-BUTTON-ID                      # Advanced › Button ID › Copy
sock="$HOME/Library/Application Support/Desktap/LocalAPI/agent.sock"
jq -nc --arg id "$ID" '{cellId: $id, title: "From Terminal", color: "#0A84FF"}' |
  curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
    -d @- http://localhost/api/update-button
```

The `localhost` in the URL is only a name: curl sends the request through the socket file, not over the network. The agent answers as it answers a button script ([Script API › Answers](?p=api#answers)), and the key order varies:

```text
{"status":"ok"}
{"visible":false,"status":"ok"}
```

The first answer means the button now reads "From Terminal" on blue. The second means the button is not on screen (another page, or Desktap in the background) or no button has that ID. The agent keeps the update and shows it when the button appears.

When the update does not go through, you get one of these:

| Answer | What it means |
|---|---|
| `400` and the reason | The body is broken. `Invalid JSON` here means the ID is not pasted yet. |
| `503` | The body is valid, but no phone is connected. |
| No output at all, and `echo $?` prints `7` | Nobody answers on the socket: the agent is not running, its **Setup** is not finished, or it is paused because another macOS user is active. |

Give the button back its saved look the same way:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal, harness -->
```zsh title="Terminal"
jq -nc --arg id "$ID" '{cellId: $id, reset: true}' |
  curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
    -d @- http://localhost/api/update-button
```

The CPU ring from [SVG faces › Your first live SVG widget](?p=svg-faces#your-first-live-svg-widget-the-cpu-ring), saved as `ring.zsh`, prints the body of one frame when you run it with `--frame`. Pipe that body into the socket to check the frame before it goes live. The body carries a made-up Button ID, so the phone shows nothing:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal, svgrender -->
```zsh title="Terminal"
zsh ring.zsh --frame 42 |
  curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
    -d @- http://localhost/api/update-button
```

> [!SEE]
> `{"visible":false,"status":"ok"}` and nothing more: the frame is fine. A `400`, or a `warnings` list while the phone is connected, says what to fix. Not seeing it? → [Troubleshooting](?p=troubleshooting#svg-faces)

A `crossFade` line compares this frame with the last one sent to the same made-up ID, which may be another widget's. To check a glide, send two frames in a row ([SVG faces › Check a face before it goes live](?p=svg-faces#check-a-face-before-it-goes-live)).

### List the IDs of every button

The agent asks the phone for the whole deck, so Desktap must be open on the phone. This command prints one line per button: its ID, then profile › page › name.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal, harness -->
```zsh title="Terminal"
sock="$HOME/Library/Application Support/Desktap/LocalAPI/agent.sock"
curl -q -s -m 10 --unix-socket "$sock" http://localhost/api/config | jq -r '
  if .config == null then "No deck came back: open Desktap on the phone and try again"
  else .config.profiles[] | .name as $profile | .pages[] | .title as $page | .cells[]
  | (.widget.button._0.label // "" | gsub("\\s+"; " ")) as $name
  | "\(.id)  \($profile) › \($page) › \($name)" end'
```

```text
3F2B8C1D-6E4A-4F0B-9A7C-2D5E8F1A3B6C  Work › Main › Mute
```

End the command with `| grep -i mute` to find one button. A button's own scripts don't need this list: each gets its own ID as `{{CELL_ID}}`, and the IDs of other buttons come from **Advanced › Button ID** ([Live widgets › Finding a button's ID](?p=live-widgets#finding-a-buttons-id)).

## Let other programs drive a button

A Claude Code hook, a cron job or a build script can change a button without the script token or a Button ID. The program writes a small file into the storage folder, and the button's own startup script draws it:

1. The program writes the state into a file in the storage folder, `~/Library/Application Support/Desktap/ScriptStorage`. Every copy of Desktap Agent on your account uses this same folder.
2. The button's startup script reads that file, here `$DESKTAP_STORAGE/build/state`, every second and draws it when it changes.
3. A tap clears it: the button's **Shell Command** `rm -f "$DESKTAP_STORAGE/build/state"` deletes the file, and the loop gives the button back its saved look.

The program's part is three lines. They work in `sh`, `bash` and `zsh`: save them as a script for cron or a hook, or join them with `;` on one line:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal (sh, bash and zsh), harness -->
```zsh title="Terminal"
dir="$HOME/Library/Application Support/Desktap/ScriptStorage/build"
mkdir -p "$dir"
printf 'failed\n' > "$dir/state.tmp" && mv -f "$dir/state.tmp" "$dir/state"
```

Writing `state.tmp` first and then renaming it means the button never reads half a file. The pattern also:

- needs neither the script token nor a Button ID;
- keeps the state while the phone is away, and shows it when the phone connects;
- leaves one script in charge of the button, so nothing fights over it.

The recipe [Claude Code needs input](?p=recipes-alerts#claude-code-needs-input) is the full version, with the hook settings, a red "Needs input" face and the tap.

> [!NOTE]
> A hook or a cron job needs no script token: the flag file needs none, and neither does [the agent's socket](#send-one-update-by-hand). Keep `~/.desktap-mcp-token` for test runs in Terminal. A program that sends with it gets `403` for a notification action that runs something, and `401` after the agent restarts if it read the file only once.

A program can also send a notification through the socket. An action button on it that runs something shows the full command and asks first: **Run on your Mac?** on the phone, **Run this from a notification?** on the Mac ([Notifications › When a tap asks first](?p=notifications#when-a-tap-asks-first)). The recipe [Tell me when a command finishes](?p=recipes-alerts#tell-me-when-a-command-finishes) sends one when a Terminal command ends.

## The agent on your Mac

Desktap Agent runs in the menu bar, with no Dock icon. Its icon is a rounded square, the key from the Desktap app icon, filled in while the phone is connected. A dot on its corner means an AI app's change or command waits for your answer on the phone. Its menu opens the agent window, which shows which scripts run and why a widget is waiting.

### The menu

| Item | What it does |
|---|---|
| First line | The status: **Connected**, **Waiting for connection…**, **Pairing request…**, **Pairing locked**, **Paused — another user is using this Mac**, or a Keychain problem that **Security** in the window explains |
| "Waiting for your answer on your iPhone or iPad" | Only while something waits: one item per change or command, such as "AI suggests: 1 page and 12 buttons" or "AI wants to run a command". Click one to open **AI Assistants**. |
| **Show Agent Window** (⌘O) | Opens the **Desktap Agent** window on the section you saw last |
| **Settings…** (⌘,) | Opens the window on **General** |
| **Update to** *version*… | Shown only when a new version is out ([Quitting and updates](#quitting-and-updates)) |
| **Quit Desktap** (⌘Q) | Stops every script, then the agent |

### The agent window

<img src="assets/docs/img/from-your-mac/agent-window.png" width="760" height="524" alt="The Desktap Agent window on Overview: a sidebar with Overview, AI Assistants, Devices, Security, Permissions, Scripts and General, and four tiles: iPhone “Connected · 12 min”, AI Assistants “1 app connected”, Permissions “All granted” and Scripts “2 scripts running” with Stop All.">

A sidebar on the left lists its sections. An orange dot next to one means something there needs you, such as a permission that is off. A phone that asks to pair brings the window forward on **Devices**.

| Section | What it is for |
|---|---|
| **Overview** | Banners, only when something needs you, such as [When live widgets don't start](#when-live-widgets-dont-start) or **Update Available**. Then four tiles; click one to open its section. |
| **AI Assistants** | Connect an AI app ([Use with an AI app](?p=ai)) |
| **Devices** | **Trusted Devices**: your paired phones; **Remove** one, or **Remove All**. With none, the steps to pair one. |
| **Security** | How Desktap protects this Mac, pairing and the local API right now, Keychain problems, and the **Allow AI to Run Commands** switch: [Security](#security) |
| **Permissions** | **Accessibility**, **Automation**, **Notifications** and **System Audio Recording**: what each lets buttons do, its state and how to turn it on |
| **Scripts** | What your buttons run on this Mac: [the list described below](#the-running-scripts-window) |
| **General** | **Launch at Login**, **Check for Updates…** and the agent's version |

The tiles read, for example, "Connected · 12 min", "1 app connected", "All granted" and "2 scripts running", with **Stop All**. An AI app counts as connected when it is set up to start this agent, open or not. With no phone connected, the phone tile names the Mac to choose in Desktap.

### Security

**Security** opens with a banner only when something needs you, then **How Desktap protects this Mac** in four points: **Encrypted**, **Only your devices**, **Everything goes through your Accept**, and **Websites, other accounts and sandboxed apps are kept out**. Under them, **Right now** shows the state at this moment and changes while the section is open:

| Row | What it shows |
|---|---|
| **Pairing new devices** | **Allowed**: a new device still needs your click on this Mac and the code. **Blocked** after several incorrect codes, with **Allow Pairing**; trusted devices still connect. **Paused** while another user's session is active, **Unavailable** while a Keychain problem in the banner lasts, **Unreachable** when port 9847 can't take new connections from phones (the caption says why). |
| **Trusted devices** | How many devices this Mac trusts, or **None**; **Can’t read** while the banner reports a Keychain problem. **Manage** opens **Devices**, where removing a device cuts it off at once. |
| **This Mac's fingerprint** | Four groups of characters, such as `3f2a 91c0 7b11 04de`. Desktap on your iPhone or iPad shows the same one under this Mac in **Paired Macs**; if you don't see it there, update the app. **Not available**, with "The pairing key can’t be read from Keychain.", goes with the Keychain banner on top. |
| **Local API** | Who serves the local API of this macOS account: **This agent**, **Another agent** or **Stopped**. The caption reads "Serves button scripts and AI tools of this macOS account." when all works, and "The agent is opening its local API: live widgets and AI tools wait for it." while it starts. Otherwise it turns orange with the line **Overview** shows ([When live widgets don't start](#when-live-widgets-dont-start)), even next to **This agent**, or with "Button scripts and AI tools can’t reach the agent right now." |
| **Allow AI to Run Commands** | The switch, off at first: AI tools can run Terminal commands on your Mac, and you approve each one on your iPhone or iPad ([Use with an AI app › Commands on your Mac](?p=ai#commands-on-your-mac)) |

While the agent reads its pairing key and trusted devices from Keychain, the rows read **Loading…**. The banners on top:

| Banner | What to do |
|---|---|
| "Can't read the pairing key from Keychain (status …)." or "Can't access the trusted devices in Keychain (status …)." | Click **Retry**. Until it's fixed, no iPhone or iPad can connect to this Mac, paired ones included. If the saved item is damaged, the banner also offers **Reset Pairing Key** or **Remove All Paired Devices…**; after either, every device has to pair with this Mac again. |
| "Couldn't finish resetting this Mac's pairing key (status …). New devices can't pair until it's done." | Click **Retry**. |
| "Couldn't save the pairing to Keychain (status …).", "Couldn't remove … (status …)." | Click **Dismiss** and try again. |
| "This Mac's pairing key was reset. Pair your devices again." | Pair each iPhone or iPad again ([Get started › Pair your iPhone or iPad](?p=start#pair-your-iphone-or-ipad)), then click **Dismiss**. |
| "The Desktap app on the connected iPhone or iPad keeps its deck where any app on your Macs can change it. Update the app." | Update Desktap on that iPhone or iPad. |

### The Running Scripts window

<img src="assets/docs/img/from-your-mac/running-scripts.png" width="760" height="640" alt="The agent window on Scripts, with Open in Separate Window and Stop All at the top: a running script, a running startup script (Startup badge, uptime, Restart, Stop) opened to show its Shell Command, and a failed startup script with “Exit code 1: icalBuddy: no calendar named &quot;Work&quot;”.">

Choose **Scripts** in the agent window's sidebar. It lists every shell script the agent is running (tap, long press and startup scripts) and every startup script that is not running right now. **Open in Separate Window** shows the same list in a window of its own, **Running Scripts**.

| What you see | What it means |
|---|---|
| The name | The script's first `#` comment, up to 60 characters. Without one: "Shell script (12 lines)". Give every script a name on line 2. |
| **Startup**, **Long Press** | The kind of script; a tap script has no badge |
| A running time | How long it has run |
| The chevron | The full text under **Shell Command**, with a copy button |
| **Restart** | Starts a startup script again |
| **Stop** | Stops the script; the button gets back its saved look. A stopped startup script waits until you click **Restart**, change its script, or the phone connects again. |
| **Stop All** | Stops every script; it shows at the top while something runs (in the separate window, in its toolbar) |

A startup script that is not running shows its state under its name:

| State | What it means |
|---|---|
| **Exited** | It ended by itself with exit code 0. |
| **Stopped** | You stopped it. |
| **Restarting in 10s (attempt 2)** | It exited with an error and starts again by itself. |
| **Failed — retrying in 60s (attempt 6)** | It keeps exiting with an error; the agent still retries it every 60 s. Its chevron, **Show Error**, shows `Exit code N:` and the last 2 KB of what it wrote to standard error. |

The phone lists the same error under the ⚠ count next to the Mac's name ([Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work)). What a script reports through `/api/error` shows on the phone, not in this list.

### When live widgets don't start

The quoted lines below show on **Overview**, above the tiles. While one of them shows, startup scripts wait. They start by themselves, with a new script token, as soon as the agent can serve them again.

| You see | What happened | What to do |
|---|---|---|
| "Another Desktap Agent (…) is already running in this account. Quit it to use this one." | Two copies of the agent run on your account; the one named in parentheses runs your scripts and AI tools | Quit one of them |
| "Port 9848 is used by another user on this Mac. Live widgets start as soon as it's free." | The agent of another macOS account on this Mac still holds the port | Wait a moment, or quit the agent in that account |
| "Another app in this account is using port 9848 — perhaps an older Desktap Agent. Live widgets start as soon as it's free." | Some program of yours listens on 9848 | `lsof -nP -iTCP:9848 -sTCP:LISTEN` names it; quit it |
| "Port 9848 is still busy. Live widgets start as soon as it's free." | Connections of the last run are still closing | Nothing: it clears by itself |
| "Live widgets can't start: port 9848 can't be opened (…). The agent keeps trying." | The agent could not open the port; the reason is in parentheses | Nothing at first: the agent keeps trying by itself |
| "Live widgets and AI tools can't start: the agent can't create its folder … (…). It keeps trying." | The agent could not create its folder `~/Library/Application Support/Desktap/LocalAPI`; the reason is in parentheses | Fix what the reason names, such as a full disk; the agent keeps trying |
| **Paused — another user is using this Mac** in the menu, **Paused** on the phone tile | Another macOS account is in front. Only its agent serves; this one has stopped its scripts. | Switch back; the phone connects to the agent of the account in front |

One more case: the Mac takes one phone at a time, and the one used most recently wins.

### Quitting and updates

- **Quit Desktap** stops every script at once. A script's trap gets about half a second, the script token ends, and every button returns to its saved look. **Launch at Login** in **General** starts the agent again when you log in.
- After a crash, the agent stops the scripts the old copy left behind when it next starts.
- The agent looks for updates once a day without asking. A new version adds **Update to** *version*… to the menu, **Update Available** to **Overview**, and "Desktap Agent *version* is ready to install" under **General › Updates**. Nothing pops up by itself. **Check for Updates…** in **General** checks at once and shows what it finds, up to date or not. Gallery widgets arrive with agent updates.

## Next

- [How scripts run](?p=scripts): the environment a script gets, its time limits and permissions.
- [Troubleshooting](?p=troubleshooting): an exact error and what to do about it.
- [Recipes: timers, alerts and triggers](?p=recipes-alerts): buttons that other programs drive.
