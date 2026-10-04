<!-- updated: 2026-10-02 -->
# Scenes and sound

A scene is one picture spread across several buttons on your iPhone or iPad, and one startup script draws all of it. This page builds one, a ticker across four buttons, and then gives the rules behind it. The last part makes a button follow the music your Mac plays.

Read [Live widgets](?p=live-widgets) and [SVG faces](?p=svg-faces) first.

## A ticker across four buttons

The time, the load average and the free disk space slide across four buttons as one strip.

<img src="assets/docs/img/scenes-and-sound/ticker.png" width="640" height="160" alt="Four buttons side by side. Two colored lines run across all four, and the texts 14:05, Load 2.31 and 412 GB free pass through them; the part of a text that crosses a gap between buttons is hidden.">

| Where it goes | |
|---|---|
| Size | four **Normal** (1×1) buttons side by side in one row |
| Tap | **No Action** on all four |
| Startup Script | on the leftmost button only |
| SVG Drawing | optional, the same on all four (step 4) |
| Color | the same on all four: the two lines use it |

> [!STEP] 1 · Make four buttons in a row
> In edit mode, add four buttons next to each other, each with **No Action** and the same **Color**. Done when you see the four in one row.

> [!STEP] 2 · Collect the IDs of the other three
> Put the script together first, for example in Notes. On the second button, open **Advanced › Button ID**, tap **Copy** and put the ID in place of `PASTE-SECOND-BUTTON-ID`. Do the same for the third and fourth. The first button's ID goes in by itself, as `{{CELL_ID}}`. Done when no `PASTE` is left in the script.

> [!STEP] 3 · Give the script to the first button
> On the leftmost button, open **Advanced › Startup Script › Write Script**, paste the script and save. Done when the strip moves.

> [!STEP] 4 · Optional: a saved drawing
> Paste the drawing that follows the script into all four buttons (**Icon › SVG Drawing › SVG Document**). The lines then stay on the buttons while the script is not running, and the texts fade in over them when it starts.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender, render_preview -->
```zsh title="Startup Script"
#!/bin/zsh
# Ticker: time, load and free disk across four buttons
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
zmodload zsh/zselect zsh/datetime || exit 1

# This button and the three to its right, left to right (Advanced › Button ID › Copy)
tiles=( $cell PASTE-SECOND-BUTTON-ID PASTE-THIRD-BUTTON-ID PASTE-FOURTH-BUTTON-ID )
step=50                              # units the text moves per second; a tile is 200 wide
font=48                              # text size, in the same units
space=360                            # from one text to the next: more than the longest text

[[ ${tiles[*]} == *PASTE* ]] &&
  { print -u2 "Paste the other tiles' IDs (Advanced › Button ID)"; exit 1 }

# stop → every tile goes back to its saved look; a new connection, as a request may be half done
stop() {
  sock=""
  for t in $tiles; do post "{\"cellId\":\"$t\",\"svg\":{\"remove\":true}}"; done
  exit 0
}
trap stop TERM INT

# item N → the text of item N; read again each time the item starts a new run
item() {
  case $1 in
    1) date +%H:%M ;;
    2) sysctl -n vm.loadavg | awk '{ print "Load " $2 }' ;;
    3) df -g / | awk 'NR == 2 { print $4 " GB free" }' ;;
  esac
}

# look → 0 while this page is on screen; $pitch = how far one window is from the next
integer pitch=240
look() {
  local side=0 gap=0
  call view && [[ ${(U)answer} == *"\"${(U)cell}\""* ]] || return 1
  [[ $answer =~ '"cellSize":([0-9.]+)' ]] && side=$match[1]
  [[ $answer =~ '"cellGap":([0-9.]+)' ]] && gap=$match[1]
  (( side > 0 )) && (( pitch = 200 + 200 * gap / side ))
  return 0
}

# frame K → $svg: tile K's window onto the strip (K counts from 0). Every tile holds the
# same elements in the same order on every pass: only numbers change, so every frame glides.
frame() {
  local i
  svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='$(( $1 * pitch )) 0 200 200'>"
  svg+="<rect x='-200' y='30' width='$(( right + 400 ))' height='6' fill='currentColor'/>"
  svg+="<rect x='-200' y='164' width='$(( right + 400 ))' height='6' fill='currentColor'/>"
  for i in 1 2 3; do
    svg+="<text x='$x[i]' y='100' font-size='$font' font-weight='bold' fill='white'"
    svg+=" dominant-baseline='middle' opacity='$shown[i]'>$text[i]</text>"
  done
  svg+="</svg>"
}

# ── One connection for fast loops (paste it before the first request; it replaces call) ──
zmodload zsh/net/tcp zsh/system || exit 1
trap '' PIPE                         # a connection the agent closed must not end the script
sock=""
# call PATH [BODY] → $code and $answer, as before, over one connection that stays open
call() {
  local where=${${api#*//}%%/*} method=GET head buf chunk line try
  integer len close
  [[ -n $2 ]] && method=POST
  for try in 1 2; do                 # no answer: connect again, once
    code=000 answer="" buf="" len=0 close=0
    [[ -n $sock ]] || { ztcp ${where%:*} ${where#*:} 2>/dev/null && sock=$REPLY } || return 1
    head="$method /api/$1 HTTP/1.1"$'\r\n'"Host: $where"$'\r\n'
    head+="Authorization: Bearer $DESKTAP_TOKEN"$'\r\n'   # print is a builtin: no command line
    [[ -n $2 ]] && head+="Content-Type: application/json"$'\r\n'"Content-Length: ${#2}"$'\r\n'
    if print -rn -u $sock -- "$head"$'\r\n'"$2" 2>/dev/null; then
      while [[ $buf != *$'\r\n\r\n'* ]] && sysread -i $sock -t 3 chunk; do buf+=$chunk; done
    fi
    if [[ $buf != *$'\r\n\r\n'* ]]; then ztcp -c $sock 2>/dev/null; sock=""; continue; fi
    head=${buf%%$'\r\n\r\n'*} answer=${buf#*$'\r\n\r\n'}
    for line in ${(f)head}; do
      line=${(L)line%$'\r'}
      [[ $line == content-length:* ]] && len=${line#*:}
      [[ $line == connection:*close* ]] && close=1
    done
    while (( ${#answer} < len )) && sysread -i $sock -t 3 chunk; do answer+=$chunk; done
    line=${head%%$'\r'*}
    code=${${line#* }%% *}
    (( close )) && { ztcp -c $sock 2>/dev/null; sock="" }
    [[ $code == 400 ]] && print -u2 -r -- "$1: $answer"   # the agent says what is wrong
    [[ $code == 200 ]]
    return
  done
  return 1
}
# ── end of the connection block ──

integer right far i k v now pace=1 slow
text=( "$(item 1)" "$(item 2)" "$(item 3)" )
x=( 0 $space $(( 2 * space )) ) shown=( 1 1 1 )
glide=1.25                           # linear, 1.25 × the pass: the text never stops
while true; do
  if ! look; then zselect -t 100; continue; fi   # page not on screen: rest, look again in 1 s
  (( right = ($#tiles - 1) * pitch + 200 ))      # where the strip ends on the right
  for i in 1 2 3; do
    if (( x[i] + ${#text[i]} * font * 2 / 3 > 0 )); then   # not yet past the left end
      if (( shown[i] )); then (( x[i] -= step ))           # running
      else shown[i]=1; fi                                  # 3 · show it where it is
    elif (( shown[i] )); then shown[i]=0                   # 1 · hide it where it is
    else                                                   # 2 · move it while hidden
      far=0; for v in $x; do (( v > far )) && far=$v; done
      (( x[i] = far + space > right ? far + space : right ))
      text[i]=$(item $i)
    fi
  done
  motion="\"duration\":$glide,\"easing\":\"linear\",\"fit\":\"stretch\""
  slow=0
  for (( k = 0; k < $#tiles; k++ )); do
    frame $k
    post "{\"cellId\":\"$tiles[k+1]\",\"svg\":{\"source\":$(json "$svg"),$motion}}" &&
      (( dropped )) && slow=1
  done
  # The phone is behind: a pass every 3 s, glides 1.25 × as long, until it catches up
  if (( slow )); then pace=3 glide=3.75; else pace=1 glide=1.25; fi
  (( now = EPOCHREALTIME * 100 ))                # wake on a whole second: passes never drift
  zselect -t $(( pace * 100 - now % (pace * 100) ))
done
```

<!-- verified 2026-10-01, agent 1.2.3 (build 8), svgrender -->
```svg title="SVG Drawing"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="0" y="30" width="200" height="6" fill="currentColor"/>
  <rect x="0" y="164" width="200" height="6" fill="currentColor"/>
</svg>
```

> [!SEE]
> Within a second, two lines span all four buttons and the texts slide from right to left, vanishing for a moment into each gap. A text that leaves on the left returns on the right, updated. Not seeing it? → [Troubleshooting](?p=troubleshooting#nothing-changes-on-the-button)

<!-- SCREENSHOT scenes-ticker-phone: iPhone 17 Pro, English, dark, iOS 26: a deck page with the ticker running across one row of four buttons, a text crossing a gap. -->

**Make it yours**

- **Other texts:** change the three cases in `item()`; the strip always carries three. The texts go into SVG, so write `&amp;` for `&` and `&lt;` for `<`.
- **Speed:** `step`, in units per second (a tile is 200 wide).
- **More or fewer tiles:** list their IDs in `tiles`, left to right.
- **Landscape:** turned, the row becomes a column and the strip runs down it. To read it straight in landscape, stack the four buttons in one column instead, the first at the top.

**If it doesn't work:** ⚠ 1 next to your Mac's name at the top of the deck means step 2 is not finished. Tap it to read `Exit code 1: Paste the other tiles' IDs (Advanced › Button ID)`.

## One loop draws the whole page

<div class="dt-mount" data-diagram="scene-windows" data-mode="default">Four buttons look at one world through their own windows; a text that loops is hidden, moved and shown again, or leaves a ghost when it moves in sight.</div>

- **One startup script, on one tile, draws every tile.** To let taps steer the scene, have each tap write a line to a file that the loop reads ([Button logic › Taps change state, the loop draws](?p=button-logic#taps-change-state-the-loop-draws)).
- **Every tile is a window onto one world.** Draw everything in one set of coordinates, and give each tile a viewBox onto its own part of it. Send `"fit": "stretch"` with every frame. Text on a 200-unit tile needs at least 28 units, as on a Normal face.
- **Space the windows as the buttons stand.** Each window starts `200 + 200 × cellGap / cellSize` units after the previous one; both numbers come from [`GET /api/view`](#where-each-button-is). A text then vanishes into each gap for exactly as long as it takes to cross it.
- **One clock for everything that moves.** Every tile that shows motion gets a frame on the same pass, with the same `duration` and `easing`. Otherwise a text that spans two buttons pulls apart at the gap.
- **Decide each tile's contents once.** Every frame of a tile holds the same elements in the same order; only numbers change. A mover that visits a tile only now and then stays in it all the time, parked outside the window at `opacity="0"`. It leaves and returns by the [invisible jump](#motion-that-never-stops).
- **Make the parked copy an exact twin** of the visible one: the same element, `id`, path commands, kinds of fill and stroke, `stroke-linecap`, `stroke-linejoin` and number of dashes, and for a text `font-weight`, `text-anchor` and `dominant-baseline`. One difference, and the tile cross-fades whenever the mover arrives or leaves ([SVG reference › What keeps a glide](?p=svg-reference#what-keeps-a-glide)).
- **Give the tiles light saved drawings.** Put the still parts of each window in the tile's **Icon › SVG Drawing**, with **Scaling** set to **Stretch**. The page then looks whole before the script runs, and the scene fades in over it. Keep them under about 50 KB per page.
- **Keep it light:** every tile moves all the time. Draw large areas with `rect`, `circle` and `ellipse`, cut a long `path` into one piece per window, move shapes with `transform` instead of rewriting their points, and keep gradients, clips and masks off whatever moves. Build one scene per page, made to be watched, not left on all day ([SVG faces › Cost on the phone](?p=svg-faces#cost-on-the-phone)).

## Where each button is

`GET /api/view` tells a script what the phone shows right now, and where each button stands.

```json
{
  "connected": true,
  "view": {
    "activePageId": "5D0A4C1E-8B2F-4D7A-9C3E-1F2A3B4C5D6E",
    "activeProfileId": "0B7C9E2D-4A1F-4E8B-8D2C-6A5B4C3D2E1F",
    "cellGap": 16.7,
    "cellSize": 80,
    "cells": [
      {"col": 0, "colSpan": 1, "galleryItem": "cpu",
       "id": "9A41C7D2-3E5B-4F60-8172-A3B4C5D6E7F8", "row": 0, "rowSpan": 1},
      {"col": 0, "colSpan": 1,
       "id": "3F2A1C9E-7B6D-4E5F-8A9B-0C1D2E3F4A5B", "row": 2, "rowSpan": 1}
    ],
    "columns": 4,
    "isForeground": true,
    "orientation": "portrait",
    "rows": 8,
    "visibleCellIds": ["3F2A1C9E-7B6D-4E5F-8A9B-0C1D2E3F4A5B",
                       "9A41C7D2-3E5B-4F60-8172-A3B4C5D6E7F8"]
  }
}
```

| Field | What it tells you |
|---|---|
| `connected` | a phone is connected |
| `view` | `null` while no phone is connected, and for a moment after one connects, until it has said what it shows |
| `visibleCellIds` | the ID of every button on screen |
| `cells` | the page's buttons on screen: `id`, `row`, `col`, `rowSpan`, `colSpan`, and `galleryItem` for a button added from the Gallery |
| `columns`, `rows` | the grid held upright: 4×8 on an iPhone, 6×8 on an iPad |
| `orientation` | `portrait` or `landscape` |
| `isForeground` | Desktap is the app in front |
| `cellSize`, `cellGap` | the side of one cell and the gap between two, in points |
| `activePageId`, `activeProfileId` | the page and the profile on screen |

Desktap Agent sends it as one line without spaces, spread out here for reading. Take values from it with `jq` or a pattern match, as the scripts on this page do.

`row` and `col` count from 0 at the top left of the page held upright, and stay the same when the phone turns. Only the place on screen changes, counted from the top left:

| Phone | Screen column | Screen row |
|---|---|---|
| upright | `col` | `row` |
| turned | `row` | `columns − 1 − col − (colSpan − 1)` |

Wide and Tall buttons also swap shapes when the phone turns.

<div class="dt-mount" data-diagram="landscape" data-mode="default">A 4×8 page turns sideways: row 0 becomes the left edge and column 0 the bottom, and a readout works out each button's new place with the formula.</div>

- IDs come in upper case. Compare them in upper case too: `${(U)id}` in zsh, `ascii_upcase` in jq.
- A Gallery scene finds its own tiles by `galleryItem` (`aquarium.r0c0` and so on). Your own buttons have none, so list their IDs, as the ticker does.
- An iPhone draws `col` 0 to 3 only. In edit mode, its banner "On iPad, this page has N more buttons" › **Show** opens **Only on iPad**, each button with **Move to iPhone**. The list leaves out Gallery scene tiles but not your own scene's: moving a tile breaks the picture.

To see the numbers yourself, give any button this tap script (**Shell Command**):

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Shell Command"
#!/bin/zsh
# Where am I: shows where this button stands on screen
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
# Where this button stands on screen, counted from 0 at the top left
place=$(call view && print -r -- "$answer" | jq -r --arg id "$cell" '.view as $v
  | $v.cells[]? | select((.id | ascii_upcase) == ($id | ascii_upcase))
  | if $v.orientation == "landscape"
    then "column \(.row), row \($v.columns - 1 - .col - (.colSpan - 1))"
    else "column \(.col), row \(.row)" end')
post "{\"cellId\":\"$cell\",\"title\":$(json "${place:-Not on screen}")}"
sleep 3
post "{\"cellId\":\"$cell\",\"reset\":true}"
```

> [!SEE]
> Tap the button: for three seconds its name reads something like "column 2, row 5". Turn the phone, tap again, and the numbers change as the table says.

### Rest while the page is hidden

Let an expensive loop rest while its page is off screen: a scene, anything that sends several frames a second, a widget that follows the sound, or one that samples over the network or with `osascript`. An ordinary widget, with a frame every few seconds, keeps drawing: the agent holds its newest frame until the button appears ([Live widgets › Pace](?p=live-widgets#pace)).

The [music spectrum](#music-spectrum) further down checks with this function:

```zsh
# shown → 0 while the phone shows this button. Right after the phone connects, "view" can
# be null for a moment: that counts as hidden until the phone says.
shown() {
  call view && [[ ${(U)answer} == *"\"${(U)cell}\""* ]]
}
```

- Ask `GET /api/view` on every pass, and draw only while your own button's ID is in the answer. While it is not, look again every second.
- `cells` and `visibleCellIds` are empty while Desktap is in the background, and on a page the Free plan locks.
- A `null` view, right after the phone connects, counts as hidden too.
- A loop that sends frames only when something changes, like the spectrum in a quiet room, still looks every 2 s: while it posts nothing, no answer can say `"visible": false`.

## Motion that never stops

<div class="dt-mount" data-diagram="pacing" data-mode="default">A value that settles glides and then rests; continuous motion at 1.0 × the interval stops whenever a frame is late, at 1.25 × it never stops.</div>

| Motion | `easing` | `duration` |
|---|---|---|
| continuous: a ticker, a spinner, bars that follow the sound | `linear` | 1.25 × the time between two frames (1.2–1.35 × works): it never pauses, even when Wi-Fi brings a frame late |
| a value that settles | `easeInOut` | 0.4–0.8 s |
| a move the eye should follow | any | 0.3 s or more |
| a jump in plain sight | any | `0` |

- **Keep the pass steady.** `sleep 1` drifts a little on every pass. Wake on whole seconds instead, as the ticker does with `$EPOCHREALTIME` and `zselect`.
- **Bring a mover back unseen: the invisible jump.** Anything that loops (a text, a cloud, a fish) must never be seen traveling back. Use three frames:
  1. Hide it where it is: set `opacity="0"` and change nothing else.
  2. On the next frame, move it while it is hidden.
  3. On a later frame, show it where it is.

  Move it in the frame that hides it, and a faint ghost slides across the picture.
- **To fade out something that keeps moving** (a cloud drifting off at dusk), freeze its numbers for the two frames after the one that sets `opacity="0"` (three frames at 1.35 ×), and only then move it on. Move it sooner, and it vanishes before its fade ends.
- **When the phone falls behind** (`"dropped": true` while the page is on screen), send less often and stretch every glide to 1.25 × the new pace, as the ticker does: a pass every 3 s, 3.75 s glides. That is first aid: the real fix is a lighter scene, since a pace that is slow by design only makes continuous motion jerkier.

## One connection for fast loops

If a script posts more than once a second, send all its requests over one connection that stays open. Each `curl` opens a new connection, and every closed connection keeps one of the Mac's ports busy for 30 s. From about 540 posts a second, for all scripts together, every script's posts then fail with `Can't assign requested address`. A widget that posts every few seconds can keep using `curl`.

Paste this block after the helpers, anywhere before the script's first request: the ticker and the spectrum keep it just above their loop. It replaces `call`, so `post` and the rest work as before:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness -->
```zsh title="Startup Script"
# ── One connection for fast loops (paste it before the first request; it replaces call) ──
zmodload zsh/net/tcp zsh/system || exit 1
trap '' PIPE                         # a connection the agent closed must not end the script
sock=""
# call PATH [BODY] → $code and $answer, as before, over one connection that stays open
call() {
  local where=${${api#*//}%%/*} method=GET head buf chunk line try
  integer len close
  [[ -n $2 ]] && method=POST
  for try in 1 2; do                 # no answer: connect again, once
    code=000 answer="" buf="" len=0 close=0
    [[ -n $sock ]] || { ztcp ${where%:*} ${where#*:} 2>/dev/null && sock=$REPLY } || return 1
    head="$method /api/$1 HTTP/1.1"$'\r\n'"Host: $where"$'\r\n'
    head+="Authorization: Bearer $DESKTAP_TOKEN"$'\r\n'   # print is a builtin: no command line
    [[ -n $2 ]] && head+="Content-Type: application/json"$'\r\n'"Content-Length: ${#2}"$'\r\n'
    if print -rn -u $sock -- "$head"$'\r\n'"$2" 2>/dev/null; then
      while [[ $buf != *$'\r\n\r\n'* ]] && sysread -i $sock -t 3 chunk; do buf+=$chunk; done
    fi
    if [[ $buf != *$'\r\n\r\n'* ]]; then ztcp -c $sock 2>/dev/null; sock=""; continue; fi
    head=${buf%%$'\r\n\r\n'*} answer=${buf#*$'\r\n\r\n'}
    for line in ${(f)head}; do
      line=${(L)line%$'\r'}
      [[ $line == content-length:* ]] && len=${line#*:}
      [[ $line == connection:*close* ]] && close=1
    done
    while (( ${#answer} < len )) && sysread -i $sock -t 3 chunk; do answer+=$chunk; done
    line=${head%%$'\r'*}
    code=${${line#* }%% *}
    (( close )) && { ztcp -c $sock 2>/dev/null; sock="" }
    [[ $code == 400 ]] && print -u2 -r -- "$1: $answer"   # the agent says what is wrong
    [[ $code == 200 ]]
    return
  done
  return 1
}
# ── end of the connection block ──
```

- It talks HTTP itself, through zsh's own TCP module, and writes the token with `print`, a zsh builtin: the token never appears on a command line.
- The answers come back in the order of the requests.
- The agent closes a connection after 30 s without a request; `call` then connects again.
- In the stop trap, set `sock=""` first. The signal can arrive in the middle of a request, and the last posts then go over a fresh connection.

## Music levels

`GET http://127.0.0.1:9848/api/audio/levels?client={{CELL_ID}}` answers with one line of text: the levels of whatever the Mac is playing. It takes the script token, like every other request.

```text
ok 1 31 34 1 12 18 25 31 36 34 29 26 22 20 18 16 15 13 11 10 8 6 4 2
```

| Field | Values | Use it for |
|---|---|---|
| `state` | `ok`, `starting`, `error`, `unsupported` | anything but `ok`: draw flat and keep asking |
| `audible` | 0 or 1 | 1 = sound within the last 2 s: pick a playing look or a quiet one |
| `bass` | 0–40 | the low end, 35–150 Hz: a glow, a pulsing ring |
| `pulse` | 0–40 | about 35 right after a beat, back to 0 within a quarter of a second |
| `beat` | 0 or 1 | a beat since your previous request: flash on this, not on a `pulse` level |
| `l0` … `l19` | 0–40 | 20 bands from 35 Hz to 14 kHz, lowest first; a bar's height is its level / 40 |

- **Ask as yourself:** pass `client={{CELL_ID}}`. The levels are the peaks since *your* previous request, so two widgets that share a client steal each other's beats.
- **Ask at most 15 times a second,** over one connection, and at least every 5 s while you draw, or beats are lost.
- **Ask only while the button is on screen,** from the very start: look at `/api/view` before the first request. The agent stops listening 5 s after the last request.
- **macOS asks once.** The first request makes the Mac ask whether Desktap Agent may record system audio. The prompt explains: "Desktap listens to the sound your Mac plays so live widgets on your iPhone or iPad can show music levels. Nothing is recorded or sent anywhere else." The agent never asks on its own: a widget that waits for its page brings up the prompt when you first open that page.
- **A refusal is silent:** `state` stays `ok`, and the bars stay flat while music plays. In the agent window, **Permissions** lists **System Audio Recording** without a button: it reads **Not asked yet** before the first request, **Asked** after it, and **Granted** once sound has come through. If it stays at **Asked** while music plays and the widget is on screen, turn on Desktap Agent in System Settings › Privacy & Security › Screen & System Audio Recording, under **System Audio Recording Only**.
- **Title and artist** are not in the line. Ask the player with `osascript`, and only while it is running: a plain `tell application "Music"` launches it.

<!-- SCREENSHOT scenes-audio-prompt: the macOS prompt on the Mac that asks to let Desktap Agent record system audio, with the line "Desktap listens to the sound your Mac plays…". -->

### Music spectrum

Twenty bars follow the sound your Mac plays at about 11 frames a second, and rest while the button is off screen.

<img src="assets/docs/img/scenes-and-sound/spectrum.png" width="160" height="160" alt="A button with twenty bars in its Color, tall on the left for the bass and falling toward the high notes on the right.">

| Where it goes | |
|---|---|
| Size | **Normal** (1×1) |
| Tap | **No Action** |
| Startup Script | the script below |
| Color | the bars use it |

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender, render_preview -->
```zsh title="Startup Script"
#!/bin/zsh
# Music spectrum: 20 bars that follow the sound of the Mac
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
zmodload zsh/zselect || exit 1
typeset -F SECONDS                   # seconds with fractions
# On stop: back to the saved look, on a new connection (a request may be half done)
trap 'sock=""; post "{\"cellId\":\"$cell\",\"svg\":{\"remove\":true}}"; exit 0' TERM INT

# shown → 0 while the phone shows this button. Right after the phone connects, "view" can
# be null for a moment: that counts as hidden until the phone says.
shown() {
  call view && [[ ${(U)answer} == *"\"${(U)cell}\""* ]]
}

# levels → $bars: 20 numbers 0…40, from the lowest notes to the highest; flat unless "ok"
levels() {
  local -a f
  bars=( $flat )
  call "audio/levels?client=$cell" || return
  f=( ${=answer} )                   # <state> <audible> <bass> <pulse> <beat> <20 levels>
  [[ $#f == 25 && $f[1] == ok && ${(j::)f[2,25]} == <-> ]] && bars=( $f[6,25] )
}

# frame → $svg: one template, 20 bars; only their y and height change
frame() {
  local v
  integer i=0 h
  svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>"
  for v in $bars; do
    (( h = v * 7 / 2 ))              # 40 → 140 units
    svg+="<rect x='$(( 21 + i * 8 ))' y='$(( 170 - h ))' width='6' height='$h'"
    svg+=" fill='currentColor'/>"
    (( i += 1 ))
  done
  svg+="</svg>"
}

# ── One connection for fast loops (paste it before the first request; it replaces call) ──
zmodload zsh/net/tcp zsh/system || exit 1
trap '' PIPE                         # a connection the agent closed must not end the script
sock=""
# call PATH [BODY] → $code and $answer, as before, over one connection that stays open
call() {
  local where=${${api#*//}%%/*} method=GET head buf chunk line try
  integer len close
  [[ -n $2 ]] && method=POST
  for try in 1 2; do                 # no answer: connect again, once
    code=000 answer="" buf="" len=0 close=0
    [[ -n $sock ]] || { ztcp ${where%:*} ${where#*:} 2>/dev/null && sock=$REPLY } || return 1
    head="$method /api/$1 HTTP/1.1"$'\r\n'"Host: $where"$'\r\n'
    head+="Authorization: Bearer $DESKTAP_TOKEN"$'\r\n'   # print is a builtin: no command line
    [[ -n $2 ]] && head+="Content-Type: application/json"$'\r\n'"Content-Length: ${#2}"$'\r\n'
    if print -rn -u $sock -- "$head"$'\r\n'"$2" 2>/dev/null; then
      while [[ $buf != *$'\r\n\r\n'* ]] && sysread -i $sock -t 3 chunk; do buf+=$chunk; done
    fi
    if [[ $buf != *$'\r\n\r\n'* ]]; then ztcp -c $sock 2>/dev/null; sock=""; continue; fi
    head=${buf%%$'\r\n\r\n'*} answer=${buf#*$'\r\n\r\n'}
    for line in ${(f)head}; do
      line=${(L)line%$'\r'}
      [[ $line == content-length:* ]] && len=${line#*:}
      [[ $line == connection:*close* ]] && close=1
    done
    while (( ${#answer} < len )) && sysread -i $sock -t 3 chunk; do answer+=$chunk; done
    line=${head%%$'\r'*}
    code=${${line#* }%% *}
    (( close )) && { ztcp -c $sock 2>/dev/null; sock="" }
    [[ $code == 400 ]] && print -u2 -r -- "$1: $answer"   # the agent says what is wrong
    [[ $code == 200 ]]
    return
  done
  return 1
}
# ── end of the connection block ──

flat=(); repeat 20 flat+=(0)
# linear, 1.25 × one pass (0.08 s of waiting + the two requests): bars that never stop
motion='"duration":0.11,"easing":"linear"'
visible=0 last=""                    # start hidden: no levels before the phone shows it
typeset -F sent=-100 looked=-100
while true; do
  # Hidden: ask for no levels, look again in 1 s. Shown: look again after 2 s without
  # a frame (quiet music sends none, so no answer says the page was left)
  if (( ! visible || SECONDS - looked > 2 )); then
    shown && visible=1 || visible=0
    looked=$SECONDS
    (( visible )) || { zselect -t 100; continue }
  fi
  levels
  frame
  if [[ $svg != $last ]] || (( SECONDS - sent > 30 )); then
    if post "{\"cellId\":\"$cell\",\"svg\":{\"source\":$(json "$svg"),$motion}}"; then
      last=$svg sent=$SECONDS looked=$SECONDS
      [[ ${answer// /} == *'"visible":false'* ]] && visible=0
      (( dropped )) && zselect -t 200              # the phone is behind: pause 2 s
    fi
  fi
  zselect -t 8                       # 0.08 s: zselect counts hundredths
done
```

> [!SEE]
> Open the page and play some music. The Mac asks once: allow it. Then the bars move with the sound. Flat bars while music plays: the permission was refused (see above).

**Make it yours:** inside `levels()`, `$f[3]` is the bass and `$f[5]` the beat. Use them for a glow, or a flash on every beat.

## Learn from the Gallery scenes

<img src="assets/docs/img/scenes-and-sound/gallery-scenes.png" width="620" height="100" alt="The Gallery pictures of three scenes: a neon town at night whose buildings carry app names, a grid of colored music bars, and a fish tank.">

The Gallery's **Unusual** collection holds three whole-page scenes built this way: **Mac Town**, **Visualizer** and **Aquarium**. Each is zsh and awk, about 1,500 to 2,000 lines with long comments. Once added, it is your own copy to read and change.

1. Open the **Gallery**, pick a scene under **Unusual** and tap **Add Page**.
2. Find its startup script on the page's top-left tile (bottom left with the phone turned), under **Advanced › Startup Script**.
3. It reads better on the Mac: under **Scripts** in the agent window, expand the scene's row with its arrow and copy the script ([Working from your Mac › The Running Scripts window](?p=from-your-mac#the-running-scripts-window)).

| Scene | Read it for |
|---|---|
| **Mac Town** | a picture of the Mac itself: your most recent apps as buildings, a busy Mac as traffic, a tap that switches apps |
| **Visualizer** | the music levels across 48 buttons (32 on an iPhone), a tap that shows controls for the effect and the colors |
| **Aquarium** | creatures that cross button borders, parked movers, a tap that drops food where you touch |

On the Free plan, only the first two pages of each profile open: a scene on a later page stays still.

<!-- SCREENSHOT scenes-gallery-unusual: iPhone 17 Pro, English, dark, iOS 26: the Gallery with the Unusual collection showing Mac Town, Visualizer and Aquarium. -->

## Next

- [Recipes: live widgets](?p=recipes-widgets): a memory gauge, network speed, a dashboard and a clock to take apart.
- [SVG reference](?p=svg-reference): every element Desktap draws and what keeps a glide.
- [Working from your Mac](?p=from-your-mac#try-a-script-in-terminal-first): try a script in Terminal before it goes on a button.

<div class="recipe-cards" data-set="widgets"></div>
