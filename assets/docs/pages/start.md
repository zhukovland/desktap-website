<!-- updated: 2026-10-02 -->
# Get started

A Desktap button can run a script on your Mac, and the script can change how the button looks. That is how you build live widgets: buttons that keep themselves current, like a CPU ring, a timer or a build status.

<div class="dt-mount" data-diagram="round-trip" data-mode="simple">You tap a button, Desktap Agent runs its script on your Mac, and the script changes the button.</div>

## What you need

You need a Mac with macOS 15 or later and your iPhone or iPad with Desktap, on the same Wi-Fi network. You set them up once.

### Install Desktap Agent on your Mac

> [!STEP] 1 · Download and grant two permissions
>
> Download Desktap Agent from [desktap.app/download](https://desktap.app/download), drag it to **Applications** and open it. Its **Setup** opens on **Welcome to Desktap**: click **Get Started**. Then it asks for two permissions:
>
> - **Turn On Accessibility**: click **Grant Access**, then **Open System Settings** in the window that opens, turn on Desktap Agent and click **Continue**.
> - **Turn On Automation**: click **Check Access**, allow it when macOS asks, and click **Continue**. If you refused, click **Open System Settings**, turn on System Events for Desktap Agent, then click **Retry**.
>
> At **All Set!** click **Done**: the agent window opens on **Overview**. The agent lives in the menu bar, not in the Dock. Its menu holds **Show Agent Window** (⌘O), **Settings…** (⌘,) and **Quit Desktap** (⌘Q). Allow notifications when it asks.
>
> <!-- SCREENSHOT start-menu-bar: the Mac menu bar with the Desktap Agent icon (3×2 grid) and its open menu: status line, Show Agent Window ⌘O, Settings… ⌘, and Quit Desktap ⌘Q (take it with a Release build: Debug adds Dev Log and Reset Setup) -->
>
> Done when a small grid icon appears in the menu bar.

### Pair your iPhone or iPad

> [!STEP] 2 · Pair with a 6-digit code
>
> Open Desktap and allow local network access when iOS asks. A sheet lists the Macs it finds. The connection badge in the middle of the top bar opens this sheet again.
>
> 1. Tap your Mac. The phone says "Confirm on your Mac".
> 2. On the Mac, the agent window comes forward with a **Pairing Request**: click **Show Code** within 60 seconds.
> 3. Type the code on the phone within 90 seconds.
>
> Once paired, the phone reconnects by itself. A Mac serves one phone at a time. After five wrong codes, the Mac blocks pairing until you click **Allow Pairing** in the agent window (**Overview** or **Devices**).
>
> <!-- SCREENSHOT start-pairing: side by side, the phone's "Enter the code shown on your Mac" sheet with "Code expires in" and the Mac's agent window showing the 6-digit code ("Enter this code on your iPhone") -->
>
> Done when the badge shows your Mac's name.

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
> <!-- SCREENSHOT start-edit-button: the deck's top bar on iPhone, the edit button (dashed square with a plus) ringed, Gallery icon to its left and the page name to its right -->
>
> Done when the buttons wiggle and free spots show a **+**.

> [!STEP] 4 · Add a Shell Command
>
> Tap a free spot. In **New Button**, scroll past **Ready-Made Widgets** to **Scripts** and tap **Shell Command**. Tap **Command**, paste the script (touch and hold, **Paste**) and tap **Done**. On iOS 26 and later, the editor shows **Add**, **Save** and **Done** as a ✓ and **Cancel** as an ✕.
>
> <!-- SCREENSHOT start-new-button: the New Button catalog scrolled so that Scripts › Shell Command ("A Terminal command, up to 60 s") is visible -->
>
> Done when the **Command** row shows the script's first comment.

> [!STEP] 5 · Name it and add it
>
> Under **Appearance**, type "Hello" as the **Name**: a Shell Command gets no automatic name. Tap **Add**. The first time, a **Drag & Drop** tip appears: tap **Got it**.
>
> <!-- SCREENSHOT start-name-add: the editor form with Tap › Type Shell Command, the Command row showing the comment, Appearance › Name "Hello", and the ✓ at the top right -->
>
> Done when the new button sits in the grid.

> [!STEP] 6 · Tap it
>
> Leave edit mode with **Done** at the top left, then tap your button.

> [!SEE]
> The button shows "Hello!" and 👋, tinted green, while its border pulses. After 3 seconds it looks as before.
> Not seeing it? → [If nothing happens](#if-nothing-happens)
>
> <!-- SCREENSHOT start-hello: the deck with the new button tinted green, "Hello!" and 👋, its border pulsing (take it within the 3 seconds) -->

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

<!-- SCREENSHOT start-launch-app: the Launch App list on iPhone, "Search apps" at the top, rows with app icons and names -->

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
