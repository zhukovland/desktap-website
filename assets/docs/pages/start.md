<!-- updated: 2026-10-05 -->
# Get started

A Desktap button can run a script on your Mac, and the script can change how the button looks. That is how you build live widgets: buttons that keep themselves current, like a CPU ring, a timer or a build status.

<div class="dt-mount" data-diagram="round-trip" data-mode="simple">You tap a button, Desktap Agent runs its script on your Mac, and the script changes the button.</div>

## What you need

You need a Mac with macOS 15 or later and your iPhone or iPad with Desktap, on the same Wi-Fi network. You set them up once.

### Install Desktap Agent on your Mac

> [!STEP] 1 · Download Desktap Agent and allow what it needs
>
> Download Desktap Agent from [desktap.app/download](https://desktap.app/download), drag it to **Applications** and open it. Its **Setup** opens on **Welcome to Desktap**. If the agent runs from Downloads or the disk image, **Welcome** offers **Move to Applications**: click it first, so the agent updates, AI apps find it and it can open at login. The agent opens again from Applications, on **Welcome** again. Then click **Get Started**.
>
> **Allow what buttons need** lists three permissions. Click **Allow** on each and answer macOS:
>
> - **Accessibility** lets buttons press keys, type text and run system actions. After macOS has asked, **Open System Settings** opens its page: turn on Desktap Agent there, and the card changes by itself.
> - **Automation** lets buttons control other apps. Allow it when macOS asks. If you refused, click **Open System Settings** and, under Automation, turn on System Events for Desktap Agent.
> - **Notifications** lets buttons show notifications on this Mac. Allow them when macOS asks. Notifications on your iPhone or iPad don't need it.
>
> You can skip any of them: until all three read **Allowed**, the button at the bottom reads **Skip**, and the agent window's **Permissions** shows what is missing.
>
> Done when each card reads **Allowed** and the bottom button reads **Continue**. Click it: Setup goes on to **Connect your iPhone or iPad**, the next step.

### Pair your iPhone or iPad

> [!STEP] 2 · Pair with a 6-digit code, then finish Setup
>
> Setup's **Connect your iPhone or iPad** lists what to do and waits for the phone. Open Desktap on the phone and allow local network access when iOS asks. A sheet lists the Macs it finds. The connection badge in the middle of the top bar opens this sheet again. No Desktap on the phone yet? **Get it at desktap.app** is in the same window.
>
> 1. Tap your Mac. The phone says "Confirm on your Mac".
> 2. On the Mac, a **Pairing Request** appears in the Setup window: click **Show Code** within 60 seconds.
> 3. Type the code on the phone within 90 seconds.
>
> Setup then reads "iPhone “…” is connected" (or iPad) and "Its buttons now control this Mac.". Once paired, the phone reconnects by itself. A Mac serves one phone at a time. After five wrong codes, the Mac blocks pairing until you click **Allow Pairing**, in Setup or, later, in the agent window (**Overview** or **Devices**). To pair later, skip this step. While Setup is open, a request from the phone brings it back to this step; after Setup, the agent window comes forward on **Devices** with the **Pairing Request**.
>
> The phone's code field, and the Mac's **Pairing Request** in the agent window, where it appears when you pair after Setup.
>
> <div class="shot-pair">
> <img src="assets/docs/img/start/pairing-phone.png" width="200" height="435" alt="The phone asks for the code shown on your Mac: six empty boxes, “Code expires in 1:19” and Cancel, with the number keypad below.">
> <img src="assets/docs/img/start/pairing-mac.png" width="420" height="309" alt="The Desktap Agent window on Devices with a Pairing Request over it: “Enter this code on your iPhone”, the code 482 915 and Cancel.">
> </div>
>
> Then finish Setup. **Connect an AI app** is optional: click **Connect** in a card, or **Skip** (**Continue** when no AI app is found on this Mac; [Use with an AI app](?p=ai)). **You're all set** shows what you did, with **Launch at Login**, a switch that starts the agent when you log in. It is on when the agent runs from Applications; turn it off if you would rather not. Click **Open Desktap Agent**: the agent window opens on **Overview**.
>
> The agent lives in the menu bar, not in the Dock. Its menu holds **Show Agent Window** (⌘O), **Settings…** (⌘,) and **Quit Desktap** (⌘Q). Can't see the icon on a full menu bar? It can hide behind the camera: open Desktap Agent from Applications again, and its window comes back.
>
> Done when the badge on the phone shows your Mac's name and a small grid icon is in the menu bar.

## Your first button

Build a button that greets you for 3 seconds when you tap it.

### The script

This is the whole **tap script**, which your Mac runs at every tap. Its `post` function holds the curl line every Desktap script uses ([explained below](#the-curl-line-explained)). From [Live widgets](?p=live-widgets#the-helpers) on, scripts carry a longer `post` built on the same line: it also reads the agent's answer.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Hello button: greets you for 3 seconds
# post BODY → one update to the agent; curl reads the token from its environment
post() {
  curl -q -s -m 5 --variable '%DESKTAP_TOKEN=' \
    --expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}' \
    -d "$1" http://127.0.0.1:9848/api/update-button
}
post '{"cellId":"{{CELL_ID}}","title":"Hello!","emoji":"👋","color":"#30D158"}'
sleep 3
post '{"cellId":"{{CELL_ID}}","reset":true}'
```

### Getting the code onto your phone

- On the phone, open these docs (in Desktap: **Settings › How to Use**) and tap **Copy** on the script.
- Or copy it on the Mac and paste it on the phone with Universal Clipboard (same Apple Account, Handoff on).

Pasted code runs as it is; only an AI app's changes wait for review.

### Add the button

> [!STEP] 3 · Turn on edit mode
>
> Tap the edit button at the top right: a dashed square with a plus, between the Gallery icon and the page name. On an empty page, **Create a Button**, under **Open Gallery**, opens **New Button** directly.
>
> <picture class="shot-ring" style="--x:78.6%;--y:8.5%;--d:9%"><img src="assets/docs/img/start/edit-button.png" width="280" height="608" alt="The deck on iPhone. In the top bar, between the Gallery icon and the page name “Main”, the edit button, a dashed square with a plus, is ringed in blue. Below it, four buttons (Lock Screen, Screenshot, Mute Mic, Spotlight), two more (Previous, Next) and free spots."></picture>
>
> Done when the buttons wiggle and free spots show a **+**.

> [!STEP] 4 · Add a Shell Command
>
> Tap a free spot. In **New Button**, scroll past **Ready-Made Widgets** to **Scripts** and tap **Shell Command**. Tap **Command**, paste the script (touch and hold, **Paste**) and tap **Done**. On iOS 26 and later, the editor shows **Add**, **Save** and **Done** as a ✓ and **Cancel** as an ✕.
>
> <img src="assets/docs/img/start/new-button.png" width="280" height="472" alt="The New Button list: Launch App, Key Combination, System Action, Open URL, Run Shortcut, Text Snippet and Switch Page, and under Scripts, AppleScript and Shell Command (“A Terminal command, up to 60 s”).">
>
> Done when the **Command** row shows the script's first comment.

> [!STEP] 5 · Name it and add it
>
> Under **Appearance**, type "Hello" as the **Name**: a Shell Command gets no automatic name. Tap **Add**. The first time, a **Drag & Drop** tip appears: tap **Got it**.
>
> <img src="assets/docs/img/start/name-add.png" width="280" height="608" alt="The New Button editor for a Shell Command: Tap › Type “Shell Command”, the Command row reading “Hello button: greet…”, Appearance › Name “Hello”, and the ✓ at the top right.">
>
> Done when the new button sits in the grid.

> [!STEP] 6 · Tap it
>
> Leave edit mode with **Done** at the top left, then tap your button.

> [!SEE]
> The button shows "Hello!" and 👋, tinted green, while its border pulses. After 3 seconds it looks as before.
> Not seeing it? → [If nothing happens](#if-nothing-happens)
>
> <img src="assets/docs/img/start/hello.png" width="280" height="608" alt="The deck with the new button in the second row: a waving hand and “Hello!”, tinted green, with a green border.">

## What just happened

When you tapped, the agent ran the button's **Command**:

1. It first replaced `{{CELL_ID}}` with this button's ID (**Advanced › Button ID**), so the script changes the right button. See [Live widgets › The `{{CELL_ID}}` placeholder](?p=live-widgets#the-cell_id-placeholder).
2. The script sent an update to the agent at `127.0.0.1:9848`, which only programs on this Mac can reach, and the agent passed it to the phone.
3. The second update, `"reset": true`, brought back the **saved look** you set in the editor. A script's changes are never saved: saving a change to the button, or a disconnect, also restores it.

### The curl line, explained

Copy this line as it is. Each part has a job:

| Part | What it does |
|---|---|
| `-q` | Must come first. It makes curl ignore `~/.curlrc`, a settings file another program could have changed. |
| `-s` | Silent: no progress bar. |
| `-m 5` | Gives up after 5 seconds, so a request never hangs your script. |
| `--variable '%DESKTAP_TOKEN='` | Reads the script token from `DESKTAP_TOKEN`, an environment variable the agent sets for every script it starts. The `=` sets an empty default, so a missing token gets a clear `401` instead of a curl error. |
| `--expand-header 'Authorization: Bearer {{DESKTAP_TOKEN}}'` | Puts the token into the request. `{{DESKTAP_TOKEN}}` is curl's own syntax: unlike `{{CELL_ID}}`, Desktap leaves it alone. |
| `-d "$1"` | The body: JSON with the button's `cellId` and what to change. A body makes curl send a POST. |
| `http://127.0.0.1:9848/api/update-button` | The agent on this Mac. Write `127.0.0.1`, not `localhost`: while the agent is not running, `localhost` can reach another program. |

> [!NOTE]
> Three rules for the script token, `$DESKTAP_TOKEN`:
> - Use the variable. The token changes every time the agent starts, and scripts get the new one.
> - Never paste the token into a script.
> - Never put it on a command line, where any app on this Mac can read it, and never print it.

## If nothing happens

- **A red flash, a shake and "Not connected to a Mac"**: the tap was not sent. That toast, a short note at the bottom of the screen, has **Connect**: tap it and connect to your Mac.
- **A red flash, a shake and another toast**: the script failed. The toast says what went wrong, such as "Not found", with the start of the error text: tap **Details** to read more. To see each error as it happens, [try the script in Terminal](?p=from-your-mac#try-a-script-in-terminal-first).
- **The border pulses, but nothing changes**: the agent refused the update, yet curl ended without an error. For the 3 seconds the script runs, ⚠ 1 shows next to your Mac's name at the top of the deck: tap it to read the agent's reason. If no ⚠ shows, the body is not even JSON: copy the script again.
- **Anything else**: [Troubleshooting](?p=troubleshooting).

## What a button can do

**New Button** offers ten types:

| Type | What it does |
|---|---|
| **Launch App** | Open an app on the Mac |
| **Key Combination** | Press keys like ⌘C |
| **System Action** | Media, volume, screenshots, lock… |
| **Open URL** | A website or an app link |
| **Run Shortcut** | From the Shortcuts app |
| **Text Snippet** | Types saved text |
| **Switch Page** | Opens another page |
| **AppleScript** | Control Mac apps with a script |
| **Shell Command** | A Terminal command, up to 60 s |
| **No Action** | The button only shows information, like a live widget. |

You need a script only when no type does the job.

Tap a type to set it up. **Launch App** opens the list of apps on your Mac, with a search field: tap one, and the button takes the app's name and icon.

<img src="assets/docs/img/start/launch-app.png" width="280" height="608" alt="The Launch App list on iPhone: “Search apps” at the top, then App Store, Calculator, Calendar, FaceTime, Mail and more, each with its icon.">

You can't swipe to another page: tap the page name at the top right or a **Switch Page** button. A page can also open itself when you switch to its app on the Mac.

With the same Apple Account, your iPhone and iPad share each page through iCloud. The iPad has 6 columns and the iPhone 4, so a button that reaches into the iPad's last two columns shows only there. In edit mode on the iPhone, a banner such as "On iPad, this page has 2 more buttons" has **Show**, which opens **Only on iPad**. There **Move to iPhone** puts a button in the first spot on the iPhone with room for it, and on the iPad it moves there too, with its ID and scripts.

## Next steps

- [Live widgets](?p=live-widgets): buttons that keep themselves current.
- [SVG faces](?p=svg-faces): drawings that glide between values.
- [Button logic](?p=button-logic): switches, counters and timers.
- [Notifications](?p=notifications): alerts with action buttons.
- [Recipes: live widgets](?p=recipes-widgets) and [Recipes: timers, alerts and triggers](?p=recipes-alerts): copy, paste, adjust.
- [Use with an AI app](?p=ai): describe a button; the AI app builds it.
- Add a live widget from the **Gallery** and read its script in **Advanced › Startup Script**.
