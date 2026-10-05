<!-- updated: 2026-10-02 -->
# Recipes: live widgets

Each recipe is a complete live widget: a startup script that runs on your Mac and keeps its button current. The script starts when your iPhone or iPad connects and runs with no time limit until the phone disconnects or you switch profiles. If it fails, Desktap Agent starts it again ([Live widgets › Startup scripts](?p=live-widgets#startup-scripts)).

Because the script starts by itself, the tap stays free for another action. The scripts use only zsh and tools every Mac has, such as awk, curl, jq, iostat and vm_stat, so there is nothing to install. Copy a script, put it where its **Where it goes** table says, and change the settings at the top.

<div class="recipe-cards" data-set="widgets"></div>

Four more live widgets sit on the pages that teach them: free disk space on [Live widgets](?p=live-widgets#your-first-live-widget-free-disk-space), the CPU ring on [SVG faces](?p=svg-faces#your-first-live-svg-widget-the-cpu-ring), the Dark Mode switch on [Button logic](?p=button-logic#a-switch-that-shows-its-state-dark-mode) and the music spectrum on [Scenes and sound](?p=scenes-and-sound#music-spectrum).

## How to add a recipe

Every recipe goes onto its button the same way. A recipe with an SVG face also needs a start state: the empty drawing the button shows before the first frame arrives and after the script stops. The script prints it on your Mac, and Universal Clipboard carries each piece to the phone, one per step. Here for the Memory gauge:

1. **On the Mac**, copy the script and save it in Terminal. The clipboard still holds the script.

   <!-- verified 2026-10-01, zsh -f (a saved copy of every drawn recipe prints its start states); pbpaste and pbcopy not run -->
   ```zsh title="Terminal"
   pbpaste > memory.zsh                 # the script you copied
   ```

2. **On the phone**, in edit mode, tap a free spot. **New Button** opens. Choose the tap action from the recipe's **Where it goes** table: **Launch App**, **Open URL**, or **No Action** for a button that only shows something.
3. Under **Appearance**, set the **Size**, and the **Color** if the table names one. A bigger button needs free spots to its right and below it.
4. Tap **Advanced › Startup Script › Write Script**, paste the whole script and tap **Done**. A recipe without an SVG face goes on to step 7.
5. **The start state.** On the Mac, put it on the clipboard in place of the script:

   <!-- verified 2026-10-01, zsh -f (the --face output of every drawn recipe; svgrender, svgdiff: it glides into the first live frame); pbcopy not run -->
   ```zsh title="Terminal"
   zsh memory.zsh --face | pbcopy
   ```

   On the phone, tap **Appearance › Icon › SVG Drawing**, then **SVG Document**, **Paste** and **Done**.
6. **The turned start state**, for a Wide or Tall button only. On the Mac:

   <!-- verified 2026-10-01, zsh -f (the --face landscape output of the Memory gauge and Network speed; svgrender); pbcopy not run -->
   ```zsh title="Terminal"
   zsh memory.zsh --face landscape | pbcopy
   ```

   On the phone, tap **Landscape Variant** on the same screen, then **Paste** and **Done**.
7. Tap **Add**. While the phone is connected, the widget starts at once.

Without a start state, the button shows its icon and name until the first frame arrives; then the face replaces them at once. So with only the phone at hand, copy the script on this page and skip steps 1, 5 and 6. Do them later from the Mac, with the button open in edit mode, and tap **Save**.

Every script has the same shape, so you always know where to look:

- **Line 2 names the script** on the Mac, under **Scripts** in the agent window.
- **Settings come next**: how often it samples, its thresholds, its URL.
- **The helpers block** follows. It is the same in every recipe, so this page folds it; [Live widgets › The helpers](?p=live-widgets#the-helpers) explains it line by line.
- **One trap** gives the button its saved look back when the script stops.
- **SVG recipes test themselves.** `--face` prints the start state; `--frame` prints one update, which you can send to the agent to check it ([SVG faces › Check a face before it goes live](?p=svg-faces#check-a-face-before-it-goes-live)).

When you change a drawing, change its numbers, colors and texts as you like, but keep its elements: the same ones, in the same order, in every frame. [SVG faces › What makes a face cross-fade](?p=svg-faces#what-makes-a-face-cross-fade) lists the changes that turn a glide into a cross-fade.

## A number from the web

Puts a number from a web API in the button's title once a minute, and tells the phone why when the API fails.

<img src="assets/docs/img/recipes-widgets/web-number.png" width="280" height="608" alt="The deck with the first button showing an orange bitcoin symbol and “€74,985”, next to Lock Screen, Screenshot and Mute Mic.">

**Where it goes**

| | This button |
|---|---|
| Size | Normal (1×1), or Wide (2×1) for a long number |
| Tap | **Open URL**: the page the number comes from, such as `https://www.coingecko.com/en/coins/bitcoin` |
| Startup Script | the script below |
| SVG Drawing | none: a plain face; the script sets its title and icon |
| Color | any, such as Orange |

<!-- verified 2026-10-02, agent 1.2.3 (build 8), harness (also with LC_ALL=de_DE.UTF-8; no network, and a 401, a 429, a 404 and an answer without a number from a test API, each report once and keep the last number; the next number clears the report; pick='.bitcoin.usd' reports config; the dash of Make it yours too) -->
```zsh title="Startup Script"
#!/bin/zsh
# Bitcoin price: a number from a web API, once a minute
#
# Paste the whole script into Advanced › Startup Script. Any API that answers with JSON works:
# change url and pick, and the text around the number.
url='https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'
pick='.bitcoin.eur'                  # where the number is in the answer, as a jq path
format='round | tostring | gsub("(?<=\\d)(?=(\\d{3})+$)"; ",")'   # 74251.37 → 74,251
before='€' after=''                  # text in front of the number and after it
icon='bitcoinsign.circle.fill'       # an SF Symbol name
pause=60                             # seconds between requests: free APIs limit how often you ask

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

# show TEXT → this button's title and icon. jq writes the JSON, so any text is safe in it.
show() {
  post "$(jq -nc --arg c "$cell" --arg t "$1" --arg i "$icon" '{cellId: $c, title: $t, icon: $i}')"
}
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

show 'Loading…'
while true; do
  out=$(curl -q -s -m 10 -w '\n%{http_code}' "$url")
  web=${out##*$'\n'}                 # the API's HTTP status; 000 when nothing answered
  value=$(print -r -- "${out%$'\n'*}" | jq -r "$pick | numbers | $format" 2>/dev/null)
  if [[ -n $value ]]; then
    show "$before$value$after"; report ok
  else                               # no number: the button keeps the last one, the phone says why
    case $web in
      000)     report network "The API can't be reached" ;;
      401|403) report auth "The API refused the request ($web)" ;;
      429)     report other "The API was asked too often (429): raise pause" ;;
      200)     report config "The answer has no number at $pick" ;;
      *)       report other "The API answered $web" ;;
    esac
  fi
  sleep $pause
done
```

The settings at the top are the part you change:

| Setting | What it does | Here |
|---|---|---|
| `url` | the API to ask; any API that answers with JSON works | CoinGecko, the Bitcoin price in euros |
| `pick` | where the number sits in the answer, as a jq path | `.bitcoin.eur` |
| `format` | turns the number into text | rounded, with a comma every three digits |
| `before`, `after` | text in front of the number and after it | `€` in front |
| `icon` | the SF Symbol next to the number | `bitcoinsign.circle.fill` |
| `pause` | seconds between requests | `60`: free APIs limit how often you may ask, and once a minute stays well within CoinGecko's free limit |

To find `pick`, look at the API's answer once in Terminal. For CoinGecko:

<!-- verified 2026-10-01, Terminal (zsh -f, /usr/bin/jq): five indented lines, the price under bitcoin, then eur -->
```zsh title="Terminal"
curl -s 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur' | jq .
```

The price sits under `bitcoin`, then `eur`, so `pick` is `.bitcoin.eur`.

> [!SEE]
> "Loading…" appears at once, and a second later the price, such as €74,985 next to the Bitcoin sign. It refreshes once a minute. Not seeing it? → [Troubleshooting › Nothing changes on the button](?p=troubleshooting#nothing-changes-on-the-button)

If an answer holds no number, the button keeps the last number it showed, and the script tells the phone why: the button joins the ⚠ count next to your Mac's name at the top of the deck, and **Errors**, the list the count opens, says what happened. jq builds the update, so any text you put around the number stays valid JSON.

| The API | **Errors** shows | The error text |
|---|---|---|
| can't be reached | No connection | The API can't be reached |
| answers 401 or 403 | Access refused | The API refused the request (401) |
| answers 429 | Didn't work | The API was asked too often (429): raise pause |
| answers 200, but `pick` finds no number | Button set up wrong | The answer has no number at .bitcoin.eur |
| answers anything else | Didn't work | The API answered 404 |

The next answer with a number clears the report, and the row moves to **Earlier**. To see it, set `pick='.bitcoin.usd'` and save: within seconds ⚠ 1 appears. Put `.bitcoin.eur` back and save.

<img src="assets/docs/img/recipes-widgets/web-number-error.png" width="280" height="608" alt="The Errors list opened from ⚠ 1: under Not working now, “Button set up wrong” for Bitcoin · Reported by the script, with “The answer has no number at .bitcoin.usd”, Show Button and Restart Script.">

**Make it yours**

- **Another currency**: `usd` instead of `eur` in `url`, `pick='.bitcoin.usd'` and `before='$'`.
- **One decimal place**: `format='. * 10 | round / 10 | tostring'`.
- **The pace**: keep `pause` at 60 or more for anything from the web.
- **A dash while it fails**: an old price can pass for a current one. Put `show '—'` before `case $web in`, and the button shows a dash until the next number arrives.
- **Another number altogether**: the temperature where you are, from Open-Meteo, which needs no account. Replace the settings with these, put in your own latitude and longitude, and give line 2 a new name:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (the whole script with these settings: "22.8°C") -->
```zsh
url='https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m'
pick='.current.temperature_2m'       # the temperature now, in °C
format='. * 10 | round / 10 | tostring'                           # 13.46 → 13.5
before='' after='°C'                 # text in front of the number and after it
icon='thermometer.medium'            # an SF Symbol name
pause=300                            # the weather changes slowly
```

**If it doesn't work**: a title stuck on "Loading…" means no answer held a number. Tap the ⚠ count to read why; for "Button set up wrong", run the Terminal command above with your `url` and check `pick` against what it prints.

## Memory gauge

Shows the memory in use as a tall gauge, with the percentage and gigabytes below. The gauge lies on its side when the phone turns.

<p><img src="assets/docs/img/recipes-widgets/memory.png" width="104" height="200" alt="The memory gauge upright: a green column two thirds full under the word memory, 63% in large type, 22.7 GB of 36 GB below"> <img src="assets/docs/img/recipes-widgets/memory-landscape.png" width="200" height="104" alt="The same gauge turned: a green bar across the button, 63% on the left, 22.7 GB of 36 GB on the right"></p>

The gauge at 63%, upright and turned, drawn by Desktap.

**Where it goes**

| | This button |
|---|---|
| Size | Tall (1×2) |
| Tap | **Launch App** › Activity Monitor |
| Startup Script | the script below |
| SVG Drawing | the start state, from `--face`; **Landscape Variant**: `--face landscape` |
| Color | any: the gauge draws its own colors |

`sample()` is where the numbers come from. Change it, and the gauge shows something else:

```zsh
# sample [PCT] → "PCT USED TOTAL", in percent and GB. Used = app memory (anonymous minus
# purgeable pages) + wired + compressed, close to Activity Monitor's Memory Used.
# With PCT it makes up a reading at that percent, for tests.
sample() {
  vm_stat | awk -v total=$(sysctl -n hw.memsize) -v test=$1 '
    /page size of/ { for (i = 1; i <= NF; i++) if ($i == "of") page = $(i + 1) }
    /^(Anonymous pages|Pages wired down|Pages occupied by compressor):/ { sub(/\./, "", $NF)
      used += $NF }
    /^Pages purgeable:/ { sub(/\./, "", $NF); used -= $NF }
    END { u = test == "" ? used * page : total * test / 100; p = u / total * 100
      printf "%.0f %.1f %.0f\n", (p > 100 ? 100 : p), u / 2^30, total / 2^30 }'
}
```

"Used" counts app memory, wired memory and compressed memory, as Activity Monitor's Memory Used does, so the two come out close.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (also with LC_ALL=de_DE.UTF-8), svgrender -->
```zsh title="Startup Script"
#!/bin/zsh
# Memory gauge: memory in use, on a Tall button
#
# Paste the whole script into Advanced › Startup Script of a Tall (1×2) button.
# Try it in Terminal first (save it as memory.zsh):
#   zsh memory.zsh --frame 63         prints the body of one live frame at 63%
#   zsh memory.zsh --face             prints the start state for Icon › SVG Drawing
#   zsh memory.zsh --face landscape   prints the start state for its Landscape Variant
pause=5                              # seconds between samples
warn=75 alarm=90                     # orange from this percent, red from this one

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

# sample [PCT] → "PCT USED TOTAL", in percent and GB. Used = app memory (anonymous minus
# purgeable pages) + wired + compressed, close to Activity Monitor's Memory Used.
# With PCT it makes up a reading at that percent, for tests.
sample() {
  vm_stat | awk -v total=$(sysctl -n hw.memsize) -v test=$1 '
    /page size of/ { for (i = 1; i <= NF; i++) if ($i == "of") page = $(i + 1) }
    /^(Anonymous pages|Pages wired down|Pages occupied by compressor):/ { sub(/\./, "", $NF)
      used += $NF }
    /^Pages purgeable:/ { sub(/\./, "", $NF); used -= $NF }
    END { u = test == "" ? used * page : total * test / 100; p = u / total * 100
      printf "%.0f %.1f %.0f\n", (p > 100 ? 100 : p), u / 2^30, total / 2^30 }'
}

# frame PCT USED TOTAL [landscape] → one SVG. Both layouts keep their elements in every frame:
# only numbers, the color and the texts change. PCT - is the start state: an empty gauge.
frame() {
  local -a v
  v=( $(awk -v p=$1 -v warn=$warn -v alarm=$alarm 'BEGIN {
    color = p == "-" ? "#8E8E93" : p < warn ? "#34C759" : p < alarm ? "#FF9F0A" : "#FF453A"
    printf "%.1f %.1f %.1f %s", 192 * p / 100, 260 - 192 * p / 100, 336 * p / 100, color
  }') )
  local value=$1% used="$2 GB" total="of $3 GB"
  [[ $1 == - ]] && value=– used='– GB'
  if [[ $4 == landscape ]]; then        # the turned phone: the gauge lies on its side
    print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200'>
  <rect x='32' y='64' width='336' height='48' rx='20' fill='#FFFFFF' fill-opacity='0.15'/>
  <rect x='32' y='64' width='$v[3]' height='48' rx='20' fill='$v[4]'/>
  <text x='32' y='46' font-size='28' fill='#FFFFFF' fill-opacity='0.6'>memory</text>
  <text x='32' y='178' font-size='48' font-weight='bold' fill='#FFFFFF'>$value</text>
  <text x='368' y='148' font-size='28' text-anchor='end' fill='#FFFFFF'>$used</text>
  <text x='368' y='178' font-size='28' text-anchor='end'
    fill='#FFFFFF' fill-opacity='0.6'>$total</text>
</svg>"
  else                                  # upright: a column that fills from the bottom
    print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 400'>
  <rect x='60' y='68' width='80' height='192' rx='20' fill='#FFFFFF' fill-opacity='0.15'/>
  <rect x='60' y='$v[2]' width='80' height='$v[1]' rx='20' fill='$v[4]'/>
  <text x='100' y='48' font-size='28' text-anchor='middle'
    fill='#FFFFFF' fill-opacity='0.6'>memory</text>
  <text x='100' y='318' font-size='56' font-weight='bold' text-anchor='middle'
    fill='#FFFFFF'>$value</text>
  <text x='100' y='352' font-size='28' text-anchor='middle' fill='#FFFFFF'>$used</text>
  <text x='100' y='382' font-size='28' text-anchor='middle'
    fill='#FFFFFF' fill-opacity='0.6'>$total</text>
</svg>"
  fi
}

# body PCT USED TOTAL → the update. Both layouts travel together in every update; a 0.8 s glide
# settles long before the next sample.
body() {
  local up=$(json "$(frame $@)") turned=$(json "$(frame $@ landscape)")
  print -rn -- "{\"cellId\":\"$cell\",\"svg\":{\"source\":$up,\"landscapeSource\":$turned,"
  print -rn -- '"duration":0.8,"easing":"easeInOut"}}'
}

case $1 in
  --frame)
    [[ ${2:-63} == <-> ]] || { print -u2 "usage: ${0:t} --frame [percent]"; exit 2 }
    # Outside Desktap nobody replaces the placeholder, and the API wants an ID: use a dummy one.
    [[ $cell == \{* ]] && cell=00000000-0000-0000-0000-000000000000
    body $(sample ${2:-63}); print; exit ;;
  --face)
    [[ ${2:-portrait} == (portrait|landscape) ]] || { print -u2 "usage: ${0:t} --face [landscape]"
      exit 2 }
    m=( $(sample) ); frame - - $m[3] $2; exit ;;
  "") ;;
  *)
    print -u2 "usage: ${0:t} [--frame [percent] | --face [landscape]]"
    exit 2 ;;
esac

last="" sent_at=-100
while true; do
  now=$(sample)
  # Send when the reading changed, plus a keyframe every 30 s (the face may have been cleared).
  if [[ $now != $last ]] || (( SECONDS - sent_at > 30 )); then
    post "$(body ${=now})" && last=$now sent_at=$SECONDS   # sent only on 200
  fi
  (( dropped )) && sleep 4             # the phone is not reading: slow down
  sleep $pause
done
```

Three rules keep it gliding:

- **One template per layout.** Each layout has the same six elements in every frame: two bars and four texts. Between frames, only the bar, its color and the texts change.
- **The bar grows upward.** `y` and `height` change together, with `y` = 260 − `height`. A height of 0 is fine, and the bar keeps `rx='20'` in every frame, the start state included.
- **Both layouts travel in every update.** A Tall button turns wide in landscape, so each update carries `source` (200×400) and `landscapeSource` (400×200).

The color follows the level: green, orange from 75%, red from 90%.

> [!SEE]
> The empty gauge fills to the current level within a second of **Add**, and moves when memory use changes. Turn the phone: the gauge cross-fades onto its side and goes on gliding there. Not seeing it? → [Troubleshooting › SVG faces](?p=troubleshooting#svg-faces)

**Make it yours**

- **Thresholds**: `warn=75 alarm=90` at the top.
- **The pace**: `pause=5`. Memory changes slowly, so every 5–10 s is plenty.
- **The label**: change `memory` in both layouts of `frame()`.

The Gallery's **Memory** widget (System) is a Normal-sized gauge that also shows memory pressure: add it and read its startup script in **Advanced**.

**If it doesn't work**: the gauge stays empty. Tap the ⚠ count next to the Mac's name, or open **Advanced › Status**, to see whether the script failed and why ([Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work)).

## Network speed

Tracks the download speed: the number in large type and a chart of about the last 22 seconds that scrolls left without stopping.

<p><img src="assets/docs/img/recipes-widgets/network.png" width="200" height="104" alt="The network button: 12.3 in large type above ↓ MB/s, a blue chart with a shaded area on the right, a dot at its right end"> <img src="assets/docs/img/recipes-widgets/network-landscape.png" width="104" height="200" alt="The same button turned: 12.3 and ↓ MB/s on top, the chart below"></p>

The button at 12.3 MB/s, upright and turned, drawn by Desktap in Blue.

**Where it goes**

| | This button |
|---|---|
| Size | Wide (2×1) |
| Tap | **Launch App** › Activity Monitor, or **No Action** |
| Startup Script | the script below |
| SVG Drawing | the start state, from `--face`; **Landscape Variant**: `--face landscape` |
| Color | **Blue**, or any: the chart and its dot take the button's Color |

`rx()` reads the bytes received so far; the loop turns two readings into a speed:

```zsh
# rx → "INTERFACE BYTES": bytes received so far on the interface of the default route
# (Wi-Fi or Ethernet). Ibytes is counted from the end of the line: some rows have fewer columns.
rx() {
  local iface=$(route -n get default 2>/dev/null | awk '/interface:/ { print $2 }')
  [[ -n $iface ]] && netstat -ibn -I $iface | awk -v i=$iface '$3 ~ /^<Link/ {
    print i, $(NF-4); exit }'
}
```

It asks which interface the default route uses, so the button follows Wi-Fi and Ethernet alike. It counts the byte column from the end of the line, because some rows have fewer columns. Speeds are 1000-based, like Activity Monitor's.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (also with LC_ALL=de_DE.UTF-8), svgrender (every rest frame matches the end of the slide before it) -->
```zsh title="Startup Script"
#!/bin/zsh
# Network speed: download speed with a chart that scrolls
#
# Paste the whole script into Advanced › Startup Script of a Wide (2×1) button.
# Try it in Terminal first (save it as network.zsh):
#   zsh network.zsh --frame             prints the body of one live frame with a made-up chart
#   zsh network.zsh --face              prints the start state for Icon › SVG Drawing
#   zsh network.zsh --face landscape    prints the start state for its Landscape Variant
pause=2                              # seconds between samples; the chart moves one step per sample

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
zmodload zsh/datetime                # $EPOCHREALTIME: the loop measures how long it takes

# rx → "INTERFACE BYTES": bytes received so far on the interface of the default route
# (Wi-Fi or Ethernet). Ibytes is counted from the end of the line: some rows have fewer columns.
rx() {
  local iface=$(route -n get default 2>/dev/null | awk '/interface:/ { print $2 }')
  [[ -n $iface ]] && netstat -ibn -I $iface | awk -v i=$iface '$3 ~ /^<Link/ {
    print i, $(NF-4); exit }'
}

# speed BYTES-PER-SECOND → "NUMBER UNIT", 1000-based like Activity Monitor: 12.3 MB/s, 850 KB/s
speed() {
  awk -v v=$1 'BEGIN {
    if (v >= 999.5e6) printf "%.1f GB/s\n", v / 1e9
    else if (v >= 99.95e6) printf "%.0f MB/s\n", v / 1e6
    else if (v >= 999.5e3) printf "%.1f MB/s\n", v / 1e6
    else printf "%.0f KB/s\n", v / 1e3 }'
}

# scale H1 … H13 → the top of the chart: 10 K, 20 K, 50 K, 100 K … bytes/s, so it changes rarely
scale() {
  print -l $@ | awk '$1 > m { m = $1 } END {
    for (b = 10000; ; b *= 10) { if (b >= m) { print b; exit }
      if (2 * b >= m) { print 2 * b; exit }; if (5 * b >= m) { print 5 * b; exit } } }'
}

# frame LAYOUT TOP SHIFT NUMBER UNIT H1 … H13 → one SVG. 13 points, 16 apart: twelve fill the
# chart window, the newest waits just past its right edge. SHIFT 0 = rest, 1 = slid one step
# left, which brings the newest point in. The dot stays at the window's right edge.
frame() {
  local x0=212 base=164 height=120
  [[ $1 == landscape ]] && x0=12 base=364 height=170
  local -a v
  v=( "${(@f)$(awk -v x0=$x0 -v base=$base -v h=$height -v top=$2 -v shift=$3 \
      -v hist="${(j: :)@[6,-1]}" 'BEGIN {
    n = split(hist, s, " "); area = sprintf("M %.1f %.1f", x0, base)
    for (i = 1; i <= n; i++) {
      x = x0 + (i - 1) * 16; y = base - (s[i] > top ? top : s[i]) / top * h   # at most the top
      line = line sprintf("%s%.1f,%.1f", (i > 1 ? " " : ""), x, y)
      area = area sprintf(" L %.1f %.1f", x, y)
      if (i == n - 1 + shift) dot = y
    }
    printf "%s\n%s L %.1f %.1f Z\n%.1f\n%d\n", line, area, x, base, dot, -16 * shift
  }')}" )
  local chart="<g clip-path='url(#window)'><g transform='translate($v[4] 0)'>
    <path d='$v[2]' fill='currentColor' fill-opacity='0.18'/>
    <polyline points='$v[1]' fill='none' stroke='currentColor' stroke-width='5'
      stroke-linejoin='round' stroke-linecap='round'/>
  </g></g>"
  if [[ $1 == landscape ]]; then        # the turned phone: the number on top, the chart below
    print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 400'>
  <clipPath id='window'><rect x='12' y='0' width='176' height='400'/></clipPath>
  <line x1='12' y1='365' x2='188' y2='365'
    stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='2'/>
  $chart
  <circle cx='188' cy='$v[3]' r='7' fill='currentColor'/>
  <text x='100' y='100' font-size='60' font-weight='bold' text-anchor='middle'
    fill='#FFFFFF'>$4</text>
  <text x='100' y='142' font-size='28' text-anchor='middle'
    fill='#FFFFFF' fill-opacity='0.6'>↓ $5</text>
</svg>"
  else                                  # upright: the number on the left, the chart on the right
    print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200'>
  <clipPath id='window'><rect x='212' y='0' width='176' height='200'/></clipPath>
  <line x1='212' y1='165' x2='388' y2='165'
    stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='2'/>
  $chart
  <circle cx='388' cy='$v[3]' r='7' fill='currentColor'/>
  <text x='24' y='104' font-size='60' font-weight='bold' fill='#FFFFFF'>$4</text>
  <text x='24' y='146' font-size='28' fill='#FFFFFF' fill-opacity='0.6'>↓ $5</text>
</svg>"
  fi
}

# send DURATION EASING TOP SHIFT NUMBER UNIT H1 … H13 → one update with both layouts
send() {
  local up=$(json "$(frame portrait ${@[3,-1]})") turned=$(json "$(frame landscape ${@[3,-1]})")
  local glide="\"duration\":$1,\"easing\":\"$2\""
  post "{\"cellId\":\"$cell\",\"svg\":{\"source\":$up,\"landscapeSource\":$turned,$glide}}"
}

case $1 in
  --frame)
    [[ $cell == \{* ]] && cell=00000000-0000-0000-0000-000000000000   # a test ID outside Desktap
    post() { print -r -- $1 }           # print the update instead of sending it
    h=( 3 5 4 8 6 9 7 12 10 8 11 9 12.3 ); h=( ${^h}e6 )
    send 2 linear $(scale $h) 1 12.3 MB/s $h; exit ;;
  --face)
    [[ ${2:-portrait} == (portrait|landscape) ]] || { print -u2 "usage: ${0:t} --face [landscape]"
      exit 2 }
    frame ${2:-portrait} 10000 0 – KB/s 0 0 0 0 0 0 0 0 0 0 0 0 0; exit ;;
  "") ;;
  *)
    print -u2 "usage: ${0:t} [--frame | --face [landscape]]"
    exit 2 ;;
esac

typeset -a hist text
prev=$(rx) stamp=$EPOCHREALTIME period=$pause
while true; do
  started=$EPOCHREALTIME
  sleep $pause
  now=$(rx) clock=$EPOCHREALTIME
  if [[ -z $now || ${now% *} != ${prev% *} ]]; then   # no network, or a new interface: start over
    prev=$now stamp=$clock hist=(); continue
  fi
  bps=$(awk -v a=${prev#* } -v b=${now#* } -v t0=$stamp -v t1=$clock 'BEGIN {
    printf "%.0f", (b > a ? b - a : 0) / (t1 - t0) }')
  prev=$now stamp=$clock
  if (( $#hist == 0 )); then            # the first sample: a flat line at its height
    hist=( $(repeat 13 print $bps) ); top=$(scale $hist) text=( $(speed $bps) )
    send 0.6 easeInOut $top 0 $text $hist
  else
    hist=( $hist[2,-1] $bps ); new=$(scale $hist)
    # rest: the new points at the old scale and the old number; it looks exactly like the end
    # of the last slide, so it is shown at once. The new reading goes into the slide.
    send 0.01 linear $top 0 $text $hist
    text=( $(speed $bps) )
    # slide: one step left, as long as one loop took, so the chart never stops
    send $period linear $new 1 $text $hist
    top=$new
  fi
  (( dropped )) && sleep 4             # the phone is not reading: slow down
  period=$(awk -v a=$started -v b=$EPOCHREALTIME 'BEGIN {   # how long this loop took, at most 6 s
    d = b - a; printf "%.2f", (d > 6 ? 6 : d) }')
done
```

The chart scrolls as [SVG faces › Charts that scroll](?p=svg-faces#charts-that-scroll) describes. For every sample, the script sends two frames back to back:

| Frame | What it holds | `duration` | `easing` |
|---|---|---|---|
| rest | every point one slot to the left and the new sample waiting past the right edge, at the old scale and with the old number: it looks exactly like the end of the last slide | 0.01 | `linear` |
| slide | the chart one step to the left, the new number, the new scale | how long the last loop took | `linear` |

<div class="dt-mount" data-diagram="sparkline-belt" data-mode="default">This recipe's chart on the phone and in x-ray: the newest point waits past the right edge, the rest frame moves every point one slot left unseen, and the slide brings the newest one in.</div>

Four details keep it smooth:

- **The new reading goes only into the slide frame**, never into the rest frame.
- **The scale moves in steps** (10 K, 20 K, 50 K, 100 K bytes/s and so on), so it rarely changes; when it does, it changes in a slide.
- **A clip shows only the chart's window**, so the points waiting past either edge stay hidden.
- **The dot sits outside the moving chart**, at the window's right edge, and only moves up and down.

> [!SEE]
> A flat line appears, rises to the current speed after two seconds, and then the chart scrolls left without a pause. Start a large download: the line climbs and the scale grows with it. Not seeing it? → [Troubleshooting › SVG faces](?p=troubleshooting#svg-faces)

**Make it yours**

- **Upload instead of download**: print `$(NF-1)` instead of `$(NF-4)` in `rx()`, and change `↓` to `↑` in both layouts.
- **The pace**: `pause=2`. The chart always shows the last 12 samples, so `pause=5` covers about the last minute. Keep it at 1 or more.

The Gallery's **System Monitor** widget (System) shows network traffic together with CPU, memory and disk.

**If it doesn't work**: the button keeps its "–" and a flat line when the Mac has no default route. Run `route -n get default` in Terminal: its `interface:` line should name one.

## System dashboard

Fits three readings onto one Large button: CPU load as a ring, memory as a bar and a chart of CPU load over about 22 seconds.

<img src="assets/docs/img/recipes-widgets/dashboard.png" width="200" height="200" alt="The dashboard: a green ring around 42% and the word cpu at the top left, memory 63% with a purple bar at the top right, a green line chart across the bottom">

The dashboard at 42% CPU and 63% memory, drawn by Desktap.

**Where it goes**

| | This button |
|---|---|
| Size | Large (2×2) |
| Tap | **Launch App** › Activity Monitor |
| Startup Script | the script below |
| SVG Drawing | the start state, from `--face` |
| Color | any: the dashboard draws its own colors |

`sample()` reads both values in one go:

```zsh
# sample → "CPU MEMORY", both in percent. CPU from a one-second iostat reading; memory in use
# (app memory + wired + compressed), close to Activity Monitor's Memory Used.
sample() {
  iostat -c 2 -w 1 | awk '$(NF-3) ~ /^[0-9]+$/ { idle = $(NF-3); ok = 1 }
    END { v = ok ? 100 - idle : 0; printf "%d ", (v < 0 ? 0 : v > 100 ? 100 : v + 0.5) }'
  vm_stat | awk -v total=$(sysctl -n hw.memsize) '
    /page size of/ { for (i = 1; i <= NF; i++) if ($i == "of") page = $(i + 1) }
    /^(Anonymous pages|Pages wired down|Pages occupied by compressor):/ { sub(/\./, "", $NF)
      used += $NF }
    /^Pages purgeable:/ { sub(/\./, "", $NF); used -= $NF }
    END { p = used * page / total * 100; printf "%d\n", (p > 100 ? 100 : p + 0.5) }'
}
```

`iostat` needs one second to read the CPU, so one loop takes about two seconds.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (also with LC_ALL=de_DE.UTF-8), svgrender (every rest frame matches the end of the slide before it) -->
```zsh title="Startup Script"
#!/bin/zsh
# System dashboard: CPU ring, memory bar and a CPU chart
#
# Paste the whole script into Advanced › Startup Script of a Large (2×2) button.
# Try it in Terminal first (save it as dashboard.zsh):
#   zsh dashboard.zsh --frame 42 63   prints the body of one live frame: CPU 42%, memory 63%
#   zsh dashboard.zsh --face          prints the start state for Icon › SVG Drawing
pause=1                              # seconds between samples (sampling itself takes 1 s)
warn=50 alarm=80                     # CPU percent: orange from here, red from here

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
zmodload zsh/datetime                # $EPOCHREALTIME: the loop measures how long it takes

# sample → "CPU MEMORY", both in percent. CPU from a one-second iostat reading; memory in use
# (app memory + wired + compressed), close to Activity Monitor's Memory Used.
sample() {
  iostat -c 2 -w 1 | awk '$(NF-3) ~ /^[0-9]+$/ { idle = $(NF-3); ok = 1 }
    END { v = ok ? 100 - idle : 0; printf "%d ", (v < 0 ? 0 : v > 100 ? 100 : v + 0.5) }'
  vm_stat | awk -v total=$(sysctl -n hw.memsize) '
    /page size of/ { for (i = 1; i <= NF; i++) if ($i == "of") page = $(i + 1) }
    /^(Anonymous pages|Pages wired down|Pages occupied by compressor):/ { sub(/\./, "", $NF)
      used += $NF }
    /^Pages purgeable:/ { sub(/\./, "", $NF); used -= $NF }
    END { p = used * page / total * 100; printf "%d\n", (p > 100 ? 100 : p + 0.5) }'
}

# frame CPU MEMORY SHIFT H1 … H13 → one SVG. The chart: 13 points, 15 apart; twelve fill its
# window, the newest waits just past the right edge. SHIFT 0 = rest, 1 = slid one step left.
# CPU - is the start state: an empty ring and bar, a flat chart.
frame() {
  local -a v
  v=( "${(@f)$(awk -v p=$1 -v m=$2 -v shift=$3 -v hist="${(j: :)@[4,-1]}" \
      -v warn=$warn -v alarm=$alarm 'BEGIN {
    color = p == "-" ? "#8E8E93" : p < warn ? "#34C759" : p < alarm ? "#FF9F0A" : "#FF453A"
    c = 2 * 3.14159265 * 40; n = split(hist, s, " ")
    for (i = 1; i <= n; i++)
      line = line sprintf("%s%.1f,%.1f", (i > 1 ? " " : ""), 16 + (i - 1) * 15, 176 - s[i] * 0.64)
    printf "%.2f\n%.2f\n%s\n%.1f\n%d\n%s\n", c, c * (1 - p / 100), color, 62 * m / 100,
      -15 * shift, line
  }')}" )
  local cpu=$1% mem=$2%
  [[ $1 == - ]] && cpu=– mem=–
  print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <clipPath id='window'><rect x='16' y='100' width='165' height='90'/></clipPath>
  <circle cx='62' cy='62' r='40' fill='none' stroke='#FFFFFF' stroke-opacity='0.15'
    stroke-width='12'/>
  <circle cx='62' cy='62' r='40' fill='none' stroke='$v[3]' stroke-width='12'
    stroke-linecap='round' stroke-dasharray='$v[1] $v[1]' stroke-dashoffset='$v[2]'
    transform='rotate(-90 62 62)'/>
  <rect x='122' y='88' width='62' height='10' rx='5' fill='#FFFFFF' fill-opacity='0.15'/>
  <rect x='122' y='88' width='$v[4]' height='10' rx='5' fill='#BF5AF2'/>
  <line x1='16' y1='177' x2='181' y2='177' stroke='#FFFFFF' stroke-opacity='0.15'
    stroke-width='2'/>
  <g clip-path='url(#window)'><g transform='translate($v[5] 0)'>
    <polyline points='$v[6]' fill='none' stroke='$v[3]' stroke-width='4'
      stroke-linejoin='round' stroke-linecap='round'/>
  </g></g>
  <text x='62' y='69' font-size='22' font-weight='bold' text-anchor='middle'
    fill='#FFFFFF'>$cpu</text>
  <text x='62' y='88' font-size='16' text-anchor='middle'
    fill='#FFFFFF' fill-opacity='0.6'>cpu</text>
  <text x='122' y='42' font-size='16' fill='#FFFFFF' fill-opacity='0.6'>memory</text>
  <text x='122' y='76' font-size='28' font-weight='bold' fill='#FFFFFF'>$mem</text>
</svg>"
}

# send DURATION CPU MEMORY SHIFT H1 … H13 → one update. linear: the chart moves at a steady pace.
send() {
  local svg=$(json "$(frame ${@[2,-1]})")
  post "{\"cellId\":\"$cell\",\"svg\":{\"source\":$svg,\"duration\":$1,\"easing\":\"linear\"}}"
}

case $1 in
  --frame)
    [[ ${2:-42} == <-> && ${3:-63} == <-> ]] || { print -u2 "usage: ${0:t} --frame [cpu mem]"
      exit 2 }
    [[ $cell == \{* ]] && cell=00000000-0000-0000-0000-000000000000   # a test ID outside Desktap
    post() { print -r -- $1 }           # print the update instead of sending it
    send 2 ${2:-42} ${3:-63} 1 12 18 15 30 26 44 38 31 52 47 36 40 ${2:-42}; exit ;;
  --face)
    frame - 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0; exit ;;
  "") ;;
  *)
    print -u2 "usage: ${0:t} [--frame [cpu mem] | --face]"
    exit 2 ;;
esac

typeset -a hist now shown
period=2
while true; do
  started=$EPOCHREALTIME
  now=( $(sample) )
  if (( $#hist == 0 )); then            # the first sample: a flat chart at its height
    hist=( $(repeat 13 print $now[1]) )
    send 0.6 $now 0 $hist
  else
    hist=( $hist[2,-1] $now[1] )
    # rest: the new points, but the ring, the bar and the texts as they were. It looks exactly
    # like the end of the last slide, so it is shown at once.
    send 0.01 $shown 0 $hist
    # slide: the chart one step left, the ring and the bar to the new values, over one loop
    send $period $now 1 $hist
  fi
  shown=( $now )
  (( dropped )) && sleep 4             # the phone is not reading: slow down
  sleep $pause
  period=$(awk -v a=$started -v b=$EPOCHREALTIME 'BEGIN {   # how long this loop took, at most 6 s
    d = b - a; printf "%.2f", (d > 6 ? 6 : d) }')
done
```

The chart scrolls with a rest frame and a slide frame, as in [Network speed](#network-speed). The ring and the bar ride along: they take their new values in the slide frame, so they glide together with the chart. The rest frame changes only the chart's points, and on screen nothing moves.

Three details of the drawing:

- **The ring is a dashed circle** whose offset hides the empty part ([SVG faces › Rings and gauges](?p=svg-faces#rings-and-gauges)).
- **The colors follow the CPU load**: green, orange from 50%, red from 80%. The chart takes the ring's color.
- **The text sizes** keep to a Large face's minimums: 16 for the labels, 22 or more for the values.

> [!SEE]
> The empty ring and bar fill within two seconds of **Add**, then the chart starts to scroll. Open a heavy app: the ring swings toward orange and the line climbs with it. Not seeing it? → [Troubleshooting › SVG faces](?p=troubleshooting#svg-faces)

**Make it yours**

- **Thresholds**: `warn=50 alarm=80` at the top.
- **The bar's color**: `#BF5AF2` in `frame()`.
- **A longer chart**: `pause=4` makes each loop about 5 s, so the chart covers about the last minute.

The Gallery's **System Monitor** widget (System) is the full-strength version, with disk and network too: add it and read its startup script in **Advanced**.

**If it doesn't work**: the ring reads 0% all the time. Run `iostat -c 2 -w 1` in Terminal: the ring shows 100 minus the `id` column of its last line.

## Analog clock

Draws a clock with hour and minute hands, a second hand that sweeps without stopping, and the date below.

<img src="assets/docs/img/recipes-widgets/clock.png" width="200" height="200" alt="The clock at 10:10:30: white hour and minute hands, an orange second hand pointing down, twelve marks around a dark dial, and Thu, Oct 1 below">

The clock at 10:10:30, drawn by Desktap in Orange.

**Where it goes**

| | This button |
|---|---|
| Size | Large (2×2) |
| Tap | **Launch App** › Clock, or **No Action** |
| Startup Script | the script below |
| SVG Drawing | the start state, from `--face`: the clock at 10:10 |
| Color | **Orange**, or any: the second hand and the center dot take the button's Color |

The settings at the top say how the second hand moves (`glide`, `easing`) and how the date reads (`date`, in `strftime` notation).

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (frames 1.00 s apart, past 12 without a skip; also with LC_ALL=de_DE.UTF-8 and LANG=ru_RU.UTF-8), svgrender -->
```zsh title="Startup Script"
#!/bin/zsh
# Analog clock: hours, minutes and a sweeping second hand
#
# Paste the whole script into Advanced › Startup Script of a Large (2×2) button.
# Try it in Terminal first (save it as clock.zsh):
#   zsh clock.zsh --frame 10:10:30   prints the body of one live frame at that time
#   zsh clock.zsh --face             prints the start state for Icon › SVG Drawing
glide=1.25 easing=linear             # a sweep: each glide lasts 1.25 × the 1 s between frames
date='%a, %b %-d'                    # the line under the dial: Thu, Oct 1

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
zmodload zsh/datetime                # strftime, $EPOCHSECONDS and $EPOCHREALTIME

# The twelve marks around the dial never change, so awk draws them once.
marks=$(awk 'BEGIN {
  for (a = 0; a < 360; a += 30) {
    big = a % 90 == 0; r = big ? 62 : 66; t = a * 3.14159265 / 180
    printf "  <line x1=\"%.1f\" y1=\"%.1f\" x2=\"%.1f\" y2=\"%.1f\" stroke=\"#FFFFFF\"",
      100 + 72 * sin(t), 88 - 72 * cos(t), 100 + r * sin(t), 88 - r * cos(t)
    printf " stroke-opacity=\"%s\" stroke-width=\"%d\" stroke-linecap=\"round\"/>\n",
      (big ? "0.9" : "0.35"), (big ? 4 : 2)
  } }')

# frame HOUR MINUTE SECOND DAY → one SVG. Each hand is a line turned around the dial's center:
# the angle is the only number that changes, so the hands glide and never bend.
frame() {
  local -a a
  a=( $(awk -v h=$1 -v m=$2 -v s=$3 'BEGIN {
    printf "%.1f %.1f %d", (h % 12) * 30 + m * 0.5, m * 6 + s * 0.1, s * 6 }') )
  print -r -- "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\">
  <circle cx=\"100\" cy=\"88\" r=\"78\" fill=\"#FFFFFF\" fill-opacity=\"0.06\"/>
$marks
  <line x1=\"100\" y1=\"88\" x2=\"100\" y2=\"48\" stroke=\"#FFFFFF\" stroke-width=\"7\"
    stroke-linecap=\"round\" transform=\"rotate($a[1] 100 88)\"/>
  <line x1=\"100\" y1=\"88\" x2=\"100\" y2=\"30\" stroke=\"#FFFFFF\" stroke-width=\"5\"
    stroke-linecap=\"round\" transform=\"rotate($a[2] 100 88)\"/>
  <line x1=\"100\" y1=\"100\" x2=\"100\" y2=\"24\" stroke=\"currentColor\" stroke-width=\"2.5\"
    stroke-linecap=\"round\" transform=\"rotate($a[3] 100 88)\"/>
  <circle cx=\"100\" cy=\"88\" r=\"5\" fill=\"currentColor\"/>
  <text x=\"100\" y=\"188\" font-size=\"18\" text-anchor=\"middle\"
    fill=\"#FFFFFF\" fill-opacity=\"0.7\">$4</text>
</svg>"
}

# send HOUR MINUTE SECOND DAY → one update
send() {
  local svg=$(json "$(frame $@)")
  post "{\"cellId\":\"$cell\",\"svg\":{\"source\":$svg,\"duration\":$glide,\"easing\":\"$easing\"}}"
}

case $1 in
  --frame)
    [[ ${2:-10:10:30} == <->:<->:<-> ]] || { print -u2 "usage: ${0:t} --frame [HH:MM:SS]"; exit 2 }
    [[ $cell == \{* ]] && cell=00000000-0000-0000-0000-000000000000   # a test ID outside Desktap
    post() { print -r -- $1 }           # print the update instead of sending it
    strftime -s day $date $EPOCHSECONDS
    send ${(s.:.)${2:-10:10:30}} $day; exit ;;
  --face)
    frame 10 10 30 –; exit ;;
  "") ;;
  *)
    print -u2 "usage: ${0:t} [--frame [HH:MM:SS] | --face]"
    exit 2 ;;
esac

while true; do
  t=$EPOCHSECONDS
  strftime -s now '%H %M %S' $t; strftime -s day $date $t
  send ${=now} $day
  (( dropped )) && sleep 4             # the phone is not reading: slow down
  sleep $(( 1 - EPOCHREALTIME % 1 ))   # wake on the next whole second
done
```

Four rules make the hands move like a clock's:

- **Turn each hand with `rotate(angle 100 88)`**, around the dial's center, and change only the angle. The hands glide and never bend.
- **Send angles from 0 to 359.** A hand always turns the short way, so at 12 the second hand goes on forward, from 354° to 0°.
- **Sweep with `linear` and a `duration` of 1.25 s**, a quarter longer than the second between frames. The hand never waits for the next frame, even when one comes a little late.
- **Wake on each whole second.** The loop sleeps until the next whole second, read from `$EPOCHREALTIME`, so it never skips one. A plain `sleep 1` drifts, and now and then the hand jumps two seconds at once.

<div class="dt-mount" data-diagram="clock-hand" data-mode="default">A second hand passing 12: it goes on forward the short way; with linear 1.25 s glides it sweeps, with short easeInOut glides it ticks.</div>

> [!SEE]
> The hands swing from 10:10 to the current time, then the second hand sweeps around without stopping. Change the button's **Color**: the second hand and the dot follow. Not seeing it? → [Troubleshooting › SVG faces](?p=troubleshooting#svg-faces)

**Make it yours**

- **A ticking second hand**: `glide=0.3 easing=easeInOut`. The hand jumps each second and rests in between, which also costs the phone less than a sweep. One or two sweeping clocks on a page are fine ([SVG faces › Cost on the phone](?p=svg-faces#cost-on-the-phone)).
- **The date in your language**: in the loop, put the language in front of the command that reads the date, as in `LC_ALL=de_DE.UTF-8 strftime -s day $date $t`, and set `date='%a, %-d. %b'` for "Do., 1. Okt.". Everything else keeps `LC_ALL=C`, so numbers keep their dots.
- **Another color for the second hand while the clock runs**: any script can post `{"cellId": "…", "color": "#FF453A"}` with this button's ID ([Live widgets › The live look](?p=live-widgets#the-live-look)). The color must be six-digit hex.

For the time in another city, the Gallery has **World Clock** (Time & Calendar).

**If it doesn't work**: the hands stand still at 10:10, or the icon stays. Then the script is not running: open **Advanced › Status**, or tap the ⚠ count next to the Mac's name to read why.

## Next

- [Recipes: timers, alerts and triggers](?p=recipes-alerts): a Pomodoro on two buttons, a long job that reports, a button a Claude Code hook turns red.
- [SVG faces › Drawing techniques](?p=svg-faces#drawing-techniques): rings, bars, hands, colors and scrolling charts, one at a time.
- [Troubleshooting](?p=troubleshooting): every error message, with its fix.
