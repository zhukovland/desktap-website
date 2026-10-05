<!-- updated: 2026-10-02 -->
# SVG faces

<!-- Anchor used by the iOS app: Icon › SVG Drawing › Learn More… opens docs?p=svg-faces (the old docs#svg-faces-vector-widgets maps here). Keep this page's slug. -->

An SVG face replaces the whole button with a drawing: a ring, a gauge, bars, a chart, a clock hand. Whenever the data changes, your script sends a new drawing, a **frame**, and on your iPhone or iPad (the phone, on these pages) the face glides from the old frame to the new one. You never animate anything yourself.

<img src="assets/docs/img/svg-faces/faces.png" width="448" height="96" alt="Five SVG faces as Desktap draws them: a CPU ring at 65%, a battery ring at 82%, a gauge with a needle at 64°, four bars and an imported icon">

SVG's own animation (`<animate>`, CSS) is ignored: all motion comes from your frames. Nothing on this page needs an AI app.

## Plain or drawn?

Choose the face by what a glance should tell you.

| A plain face (name, icon, color) for | An SVG face for |
|---|---|
| an action: Open Mail, Mute | a level: CPU load, battery, time left |
| a name or a state: On, Off, Dark | a trend: the last minute of network traffic |
| a number read as a number: "412 GB free" | several values together |
| | a shape that carries meaning: clock hands, a needle |

One disk can need either face. "How much is left?" is a number, so a plain face says "412 GB free". "How full is it?" is a level, so a ring shows it. When you are not sure, start plain ([Live widgets](?p=live-widgets)).

## A first face that moves

This tap script draws a ring at a random value. Every tap sends a new frame, and the ring glides to it.

1. In edit mode, tap a free spot, then **Shell Command** under **Scripts**.
2. In **Appearance**, pick a **Color**, such as Green. The ring takes the button's Color, and a new button starts out Gray.
3. Type a **Name**. The face hides it, but VoiceOver reads it.
4. Tap **Command**, paste the script, tap **Done**, then **Add**. Leave edit mode and tap the button.

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender -->
```zsh title="Shell Command"
#!/bin/zsh
# Ring on tap: every tap glides the ring to a new value
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
pct=$(( RANDOM % 101 ))                           # a new value, 0…100, on every tap
offset=$(awk -v p=$pct 'BEGIN { printf "%.2f", 490.09 * (1 - p / 100) }')
svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <circle id='track' cx='100' cy='100' r='78' fill='none'
    stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='16'/>
  <circle id='ring' cx='100' cy='100' r='78' fill='none'
    stroke='currentColor' stroke-width='16' stroke-linecap='round'
    stroke-dasharray='490.09 490.09' stroke-dashoffset='$offset'
    transform='rotate(-90 100 100)'/>
  <text id='value' x='100' y='100' dominant-baseline='middle' text-anchor='middle'
    font-size='60' font-weight='bold' fill='#FFFFFF'>$pct</text>
</svg>"
glide='"duration":0.6,"easing":"easeInOut"'      # a 0.6 s glide to the new value
post "{\"cellId\":\"$cell\",\"svg\":{\"source\":$(json "$svg"),$glide}}"
```

The folded part is the helpers block, the same in every script on these pages ([Live widgets › The helpers](?p=live-widgets#the-helpers)). Your part follows it: a random value, the ring's dash offset worked out in awk, the drawing, and one update with a 0.6 s glide. `stroke='currentColor'` paints the ring in the button's Color.

> [!SEE]
> The icon and the name disappear and the ring appears. Each tap glides the ring to its new value in 0.6 s; the number changes at once.
>
> <img src="assets/docs/img/svg-faces/ring-on-tap.png" width="448" height="96" alt="Five moments of one glide drawn by Desktap: the ring at 18, then the number reads 74 while the green ring grows in three steps to 74">
>
> Not seeing it? → [Troubleshooting › SVG faces](?p=troubleshooting#svg-faces)

To remove the face, send `"svg":{"remove":true}` for the button, and it shows its saved look again. `"reset":true` removes the face as well, together with any title, icon or color a script set.

## Frames that glide

<div class="dt-mount" data-diagram="glide-vs-crossfade" data-mode="default">Two CPU-ring scripts send the same values: one keeps its red dot in every frame and glides, the other adds the dot at 80% and cross-fades.</div>

A face glides when the new frame has the same elements as the one on the button and only numbers, colors or text changed. Otherwise the new frame fades in over the old one: a **cross-fade**. A cross-fade is not an error, but on a widget that updates every few seconds it looks like flicker. So build every frame from one template:

- **Keep the elements.** The same ones, in the same order, with the same `id`s. Hide one with `opacity="0"`; never add, remove or reorder.
- **Change only numbers, colors and text.** Positions, sizes, dash offsets, opacity, stroke widths, font sizes, angles and colors glide. A bar may shrink to 0.

As the frames arrive:

- **New text appears at once**, while the shapes around it glide.
- **A rotation takes the short way**: from 350° to 10°, a hand turns forward by 20°.
- **A frame that arrives mid-glide** carries on from where the drawing is, so nothing jumps.
- **A button that comes back on screen** shows its newest frame at once, and the frames after it glide again.

### What makes a face cross-fade

Each change in this table, from one frame to the next, makes the new frame cross-fade. [SVG reference › What keeps a glide](?p=svg-reference#what-keeps-a-glide) has the full list.

| This change | Write instead |
|---|---|
| an element added, removed or moved to another place | keep it in every frame; hide it with `opacity="0"` |
| an `id` changed | keep every `id` |
| a `fill` or `stroke` that switches between a color, `none`, `currentColor` and a gradient | keep the kind; fade it with `fill-opacity` or `stroke-opacity` |
| `stroke-linecap` or `stroke-linejoin` in one frame only, even on an element without a stroke | write them in every frame, or in none |
| another number of values in `stroke-dasharray` | keep the count |
| `rx` above 0 in some frames and 0 in others | keep `rx` above 0 in every frame, or 0 in every frame |
| a path with other commands, a polyline with another number of points | the same commands and the same number of points (repeat the last point) |
| another viewBox width or height | keep its size; move the view with its x and y |
| a text's `font-weight`, `text-anchor` or `dominant-baseline` | keep them |
| `fill-rule="evenodd"` in one frame only | keep it |
| a gradient's kind, units or number of stops | keep them; change its offsets and colors |
| a clip added or dropped, or a clip that grows to cover the whole viewBox | keep the clip, a little smaller than the viewBox |
| a Wide or Tall frame without `landscapeSource` after one with it (on a turned phone) | send `landscapeSource` with every frame |

When a frame has one of these changes, the agent's answer names the first one it finds: see [Check a face before it goes live](#check-a-face-before-it-goes-live).

## Your first live SVG widget: the CPU ring

A live widget is drawn by a startup script on the Mac. This one samples the CPU and sends a frame when the value changes. It uses only what every Mac has: zsh, awk, iostat and curl.

1. In edit mode, tap a free spot, then **No Action** at the bottom of **New Button**: this button only shows information. A new button is Normal (1×1), the size this face is drawn for.
2. Open **Advanced › Startup Script › Write Script**, paste the script and tap **Done**.
3. Optional: paste the empty ring from [Give it a start state](#give-it-a-start-state) into **Appearance › Icon › SVG Drawing** and tap **Done**, so the ring is there before the first frame.
4. Tap **Add** (**Save** for an existing button).

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender, render_preview -->
```zsh title="Startup Script"
#!/bin/zsh
# CPU ring: a ring that fills with the CPU load
#
# Paste the whole script into Advanced › Startup Script of a Normal (1×1) button.
# To make your own widget, change three things and keep the rest:
#   pause     how often to sample
#   sample()  where the number comes from
#   frame()   the drawing
# Try it in Terminal first (save it as ring.zsh):
#   zsh ring.zsh --frame 42   prints the body of one live frame at 42%
#   zsh ring.zsh --face       prints the start state to save in Icon › SVG Drawing
pause=2                              # seconds between samples (sampling itself takes 1 s)

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

# The value to show, 0…100. iostat costs almost nothing, top more than it measures.
sample() {
  iostat -c 2 -w 1 | awk '$(NF-3) ~ /^[0-9]+$/ { idle = $(NF-3); ok = 1 }
    END { v = ok ? 100 - idle : 0; print int(v < 0 ? 0 : v > 100 ? 100 : v + 0.5) }'
}

# ONE template: between frames only the numbers, the color and the value text change,
# never the elements, so the phone glides from frame to frame. frame PCT rest = the start
# state: the same elements with nothing filled, so the first live frame grows out of it.
frame() {
  local -a v
  # Numbers come from awk: zsh's own arithmetic would print 0.17999999999999999.
  # C = 2 × π × r is the ring's length. Dash pattern "C C"; the offset hides the unfilled part.
  v=( $(awk -v p=$1 -v rest=${2:-} 'BEGIN {
    c = 2 * 3.14159265 * 78
    color = p < 50 ? "#34C759" : p < 80 ? "#FF9F0A" : "#FF453A"
    if (rest == "rest") color = "#8E8E93"
    printf "%.2f %.2f %s %.0f", c, c * (1 - p / 100), color, p
  }') )
  local text=$v[4]
  [[ $2 == rest ]] && text="–"
  print -r -- "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <circle id='track' cx='100' cy='100' r='78' fill='none'
    stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='16'/>
  <circle id='ring' cx='100' cy='100' r='78' fill='none'
    stroke='$v[3]' stroke-width='16' stroke-linecap='round'
    stroke-dasharray='$v[1] $v[1]' stroke-dashoffset='$v[2]'
    transform='rotate(-90 100 100)'/>
  <text id='value' x='100' y='116' font-size='56' font-weight='bold'
    text-anchor='middle' fill='#FFFFFF'>$text</text>
  <text id='label' x='100' y='146' font-size='28'
    text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>cpu %</text>
</svg>"
}

# body PCT → the update for one frame. duration and easing go with every frame: they
# belong to the face and are lost with it. A 0.6 s glide settles before the next sample.
body() {
  local svg=$(json "$(frame $1)") glide='"duration":0.6,"easing":"easeInOut"'
  print -rn -- "{\"cellId\":\"$cell\",\"svg\":{\"source\":$svg,$glide}}"
}

case $1 in
  --frame)
    [[ ${2:-42} == (<->|<->.<->) ]] || { print -u2 "usage: ${0:t} --frame [pct]"; exit 2 }
    # Outside Desktap nothing replaces the placeholder; the API needs an ID: a dummy one.
    [[ $cell == \{* ]] && cell=00000000-0000-0000-0000-000000000000
    body ${2:-42}; print; exit ;;
  --face)
    frame 0 rest; exit ;;
  "") ;;
  *)                                   # a typo must not start the endless loop
    print -u2 "usage: ${0:t} [--frame [pct] | --face]"
    exit 2 ;;
esac

last="" sent_at=-100
while true; do
  pct=$(sample)
  # Send when the value changed, plus a keyframe every 30 s: the face may have been
  # cleared meanwhile (another script's reset, the button saved in the editor).
  if [[ $pct != $last ]] || (( SECONDS - sent_at > 30 )); then
    post "$(body $pct)" && last=$pct sent_at=$SECONDS   # only a 200 counts as sent
  fi
  # Keep drawing while the button is off screen: the agent holds the newest frame and
  # shows it the moment the button appears. Slow down while the phone is not reading.
  (( dropped )) && sleep 4
  sleep $pause
done
```

To make your own widget, change three things and keep the rest:

- `pause`: the seconds between samples.
- `sample()`: print one number from 0 to 100.
- `frame()`: print the drawing. Between frames, change only its numbers, color and text.

The rest is the loop from [Live widgets › Send only what changed](?p=live-widgets#send-only-what-changed): a frame on every change and every 30 s, counted as sent only after a 200. It keeps drawing while the button is off screen and slows down on `"dropped": true`.

Keep the whole widget in this one script. Your buttons travel with the phone to every Mac it connects to, and a file kept on one Mac is missing on the others.

> [!SEE]
> The ring appears within a second or two of **Add**, and **Advanced › Status** reads Running. As the load changes, the ring glides, turning orange from 50% and red from 80%.
>
> Not seeing it? → [Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work)

### Give it a start state

Until the first frame arrives, the button shows its icon and name. Instead, save the empty ring as the button's **SVG Drawing**. Then the ring is there from the moment the app opens, and the first frame fills it with a glide. The script prints this start state with `--face`; on the phone, copy it from here:

<!-- verified 2026-10-01, svgrender (glides into every --frame output) -->
```svg title="SVG Drawing"
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <circle id='track' cx='100' cy='100' r='78' fill='none'
    stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='16'/>
  <circle id='ring' cx='100' cy='100' r='78' fill='none'
    stroke='#8E8E93' stroke-width='16' stroke-linecap='round'
    stroke-dasharray='490.09 490.09' stroke-dashoffset='490.09'
    transform='rotate(-90 100 100)'/>
  <text id='value' x='100' y='116' font-size='56' font-weight='bold'
    text-anchor='middle' fill='#FFFFFF'>–</text>
  <text id='label' x='100' y='146' font-size='28'
    text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>cpu %</text>
</svg>
```

1. In edit mode, tap the button, then **Appearance › Icon › SVG Drawing**.
2. Tap **SVG Document**, then **Paste**. The line under the document should read "The SVG is fully supported."
3. Tap **Done**, then **Save**.

After you change `frame()`, print your own start state on the Mac and paste it on the phone through Universal Clipboard:

<!-- verified 2026-10-01, zsh -f (the --face output), svgrender -->
```zsh title="Terminal"
zsh ring.zsh --face | pbcopy
```

> [!SEE]
> The empty ring fills with the first frame. Stop the script, and the ring glides back to empty, or switches at once if you left the page meanwhile.
>
> <img src="assets/docs/img/svg-faces/start-state.png" width="448" height="96" alt="The start state, an empty gray ring with a dash, then four moments of the glide in which an orange ring grows to 65%">

The start state must use the same template as the live frames, down to how each shape is painted. This ring has a fixed color in both, gray at rest. A ring drawn in `currentColor` needs `currentColor` in its start state too, or the first frame cross-fades.

- The first frame takes the saved drawing's **Scaling** when the update names no `fit`.
- Whenever the live face is cleared, the saved drawing shows again ([How scripts run › What brings back the saved look](?p=scripts#what-brings-back-the-saved-look)). It is a still picture: never try to keep it up to date.
- **Remove SVG Drawing** deletes it and its landscape variant. After **Save**, the icon and name are back.

### Make it yours

Five edits turn the CPU ring into a battery ring for a MacBook. First, replace `pause` and `sample()`:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (pmset stubbed with a MacBook's output), svgrender -->
```zsh title="Startup Script"
pause=60                             # the battery changes slowly

# The charge, 0…100, from pmset; 0 on a Mac without a battery.
sample() {
  pmset -g batt | awk 'match($0, /[0-9]+%/) && !n { n = substr($0, RSTART, RLENGTH - 1) }
    END { print n + 0 }'
}
```

Then turn the colors around in `frame()`, since a low battery is the bad case. Replace its `color = p < 50 …` line with:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (pmset stubbed), svgrender: a whole battery ring with these edits -->
```zsh title="Startup Script"
    color = p < 20 ? "#FF453A" : p < 50 ? "#FF9F0A" : "#34C759"
```

Last, change the label `cpu %` to `battery`, and line 2 to `# Battery ring: how full the battery is`. Line 2 is the script's name under **Scripts** in the agent window.

<img src="assets/docs/img/svg-faces/battery-ring.png" width="272" height="96" alt="The battery ring at 82% in green, 41% in orange and 15% in red">

The Gallery's **CPU Load** and **Battery** widgets are fuller versions of both rings: add one and read its startup script in **Advanced**.

## Drawing techniques

### Rings and gauges

Draw progress as a dashed full circle, never as an arc path. The dash slides exactly along the circle, while an arc crumples into a loop halfway through a big jump.

<div class="dt-mount" data-diagram="rings" data-mode="default">A dashed ring and an arc path both jump from 10% to 90%: the dash slides along the circle, the arc crumples; below, green glides into red through olive.</div>

```text
C                 = 2 × π × r              r = 78  →  C = 490.09
stroke-dasharray  = "C C"
stroke-dashoffset = C × (1 − fraction)     72%  →  137.22
transform         = "rotate(-90 cx cy)"    the ring starts at 12 o'clock
```

Compute the numbers in awk with `printf "%.2f"`, as `frame()` does: zsh's own arithmetic prints `0.17999999999999999`.

For an open gauge, such as a ¾ ring, dash only the visible length L: `stroke-dasharray="L C"` and `stroke-dashoffset` = L × (1 − fraction). Then rotate the circle to where the gauge starts.

### Bars

Grow a bar to the right with `width`. For a bar that grows upward, change `y` and `height` together, with `y` = bottom − `height`. A width or height of 0 is fine. Keep `rx` above 0 in every frame, or 0 in every frame.

### Needles and hands

Turn a needle with `transform="rotate(angle cx cy)"` and change only the angle. Give each element one `rotate`: two stacked rotations glide as a straight shift. Draw a group that turns together around 0,0 and place it with `transform="translate(100 100) rotate(42 0 0)"`. The [Analog clock](?p=recipes-widgets#analog-clock) recipe turns its hands this way.

### Colors

Between two colors, a glide passes through their mix: green turns olive on its way to red. For a traffic-light look, pick each frame's color from the level, as the CPU ring does. Never switch a paint between a fixed color and `currentColor`: that frame cross-fades. A `color` update recolors `currentColor` at once, without a glide; to fade between colors, write them into the drawing.

### Showing and hiding

Fade an element with `opacity` instead of adding or removing it. `display` and `visibility` are not supported: the element is drawn anyway, with a warning. Hide a `<text>` with `opacity`, not `fill-opacity`: an emoji stays visible at `fill-opacity="0"`. To fade a label out, keep its text and set `opacity="0"`; an emptied label vanishes at once.

To move something unseen, hide it in one frame and move it in a later one. If one frame both hides and moves it, it slides across faintly ([Scenes and sound › Motion that never stops](?p=scenes-and-sound#motion-that-never-stops)).

### Text

- One line per `<text>`: no `<tspan>`, no wrapping.
- Always set `fill`: the default is black, nearly invisible on the dark button.
- Text is always drawn above shapes, whatever the order in the document.
- Center a value with `text-anchor="middle"` and `dominant-baseline="middle"`.
- The font is the system font with fixed-width digits, so a changing number stays in place. `font-family` is ignored without a warning.
- Weights: `normal`, `500`, `600` and `bold`.
- Write `&` as `&amp;` and `<` as `&lt;`, also in text your script did not write.
- Smallest sizes: [Sizes and the turned phone](#sizes-and-the-turned-phone).

### Charts that scroll

Shift a chart's values by one slot and the line wobbles: every point moves up or down to its new value. Scroll the whole chart sideways instead.

<div class="dt-mount" data-diagram="sparkline-belt" data-mode="default">A sparkline seen on the phone and in x-ray: the newest point waits past the right edge, the rest frame resets the chart unseen, the slide moves it one step.</div>

Keep one point more than the window shows. The newest point waits just past the right edge, inside a group with `transform="translate(0 0)"`, and a clip shows only the window. For each new sample, send two frames back to back:

| Frame | What it holds | Settings |
|---|---|---|
| rest | each point moved one slot to the left and the new sample in the slot past the edge, all at the previous scale: it looks exactly like the end of the last slide | `translate(0 0)`, `duration` 0.01 |
| slide | the same points; a new scale, the new value text and anything else that changes | `translate(-step 0)`, `linear`, `duration` = the measured period, at most 1.1 × it |

Measure the period: the time one pass really takes, with sampling, drawing and sleep (2.12 s, say, not 2). Keep it at 1 s or more. A slide shorter than the period pauses at every step; one longer than 1.1 × the period jumps at every step.

Keep a moving dot at a fixed x, outside the scrolling group. The [Network speed](?p=recipes-widgets#network-speed) recipe puts it all together.

### Gradients and clips

A gradient glides when every frame keeps its kind (linear or radial), its `gradientUnits` and its number of stops, and a `currentColor` stop stays `currentColor`. Then its positions, its rotation and each stop's color, offset and opacity glide. This tile warms as its stop colors change:

<!-- verified 2026-10-01, svgrender (glides from the same tile with #0A84FF and #5E5CE6 stops; a third stop cross-fades) -->
```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <defs>
    <linearGradient id='heat' x1='0' y1='180' x2='0' y2='20'
      gradientUnits='userSpaceOnUse'>
      <stop offset='0' stop-color='#FF9F0A'/>
      <stop offset='1' stop-color='#FF375F'/>
    </linearGradient>
  </defs>
  <rect id='tile' x='16' y='16' width='168' height='168' rx='28' fill='url(#heat)'/>
  <text id='value' x='100' y='100' text-anchor='middle' dominant-baseline='middle'
    font-size='60' font-weight='bold' fill='#FFFFFF'>34°</text>
</svg>
```

<img src="assets/docs/img/svg-faces/gradient-glide.png" width="448" height="96" alt="A gradient tile glides from blue at 21° to orange and red at 34°, drawn by Desktap in five steps">

- On a stroke that can become straight, such as a flat sparkline, use `gradientUnits="userSpaceOnUse"`; otherwise Desktap paints the last stop's color, with a warning.
- A clip glides too: widen its rectangle and it reveals a bar. Keep the clip a little smaller than the viewBox, or away from 0,0: a clip that covers the whole viewBox from 0,0 is dropped, and that frame cross-fades.
- Paint shapes that move all the time with flat colors, and keep gradients, masks and other clips on shapes that rest. A still upright rectangle that frames a moving chart, like the window in [Charts that scroll](#charts-that-scroll), is fine. Under a scrolling chart, a flat fill with `fill-opacity="0.2"` looks nearly the same as a gradient and costs the phone much less.

## Sizes and the turned phone

<div class="dt-mount" data-diagram="sizes" data-mode="default">The four button sizes with their viewBoxes, the corner that clips the face, an 8% safe margin and the smallest text, on an iPhone and on two iPads.</div>

| Size | viewBox | Smallest text | Room for |
|---|---|---|---|
| Normal (1×1) | `0 0 200 200` | 28 (values 56–64) | one value with a ring or a gauge and a short label |
| Wide (2×1) | `0 0 400 200` | 28 | a value on the left, a chart on the right |
| Tall (1×2) | `0 0 200 400` | 28 | a vertical gauge or bar with the value below |
| Large (2×2) | `0 0 200 200` | 16 for labels, 22 for values | a ring, a value, a bar and a chart together; a clock |

The smallest text sizes keep your text at least as large as the button's own label. Any square viewBox fits a Normal or Large face, and these sizes scale with it: 28 of 200 is 18 of 128. A Normal face is about 80 points wide on an iPhone and larger on an iPad, so design for the iPhone. Keep about 8% padding (16 units of 200): the button's rounded corners clip the face.

Set the size in **Appearance › Size**. A bigger size grows right and down from the button's spot, so the spots it covers must be free; tap a dimmed size and the editor says why it does not fit. Match the viewBox to the size, or the face is letterboxed. **Scaling** (`fit` in an update) chooses Fit (`contain`, the default), Fill (`cover`) or Stretch (`stretch`).

When the phone turns, the grid turns with it: a Wide button becomes tall, a Tall one wide.

<div class="dt-mount" data-diagram="landscape" data-mode="default">A 4×8 page turning into landscape: each button moves to its new place, and a Wide face either shows its landscape variant or shrinks, letterboxed, to fit the tall shape.</div>

For a Wide or Tall face, send `landscapeSource` with every frame: the same data laid out for the turned shape, 200×400 for a Wide face. The [Memory gauge](?p=recipes-widgets#memory-gauge) recipe sends both layouts in every update. In a saved drawing, the turned layout is the **Landscape Variant**: "Used in landscape, where a wide button turns tall and a tall one turns wide."

The phone draws whichever of the two layouts fits the turned button better, and each one glides from frame to frame on its own. Without a landscape variant, a Wide face shrinks to fit the tall shape, and its text becomes smaller than a button label. On an iPad kept in landscape, the landscape variant is the face you see most.

> [!SEE]
> Turn the phone: a Wide face cross-fades into its landscape variant, and the next frames glide again.

A picture spread over several buttons must also know where each button lands:

```text
landscape column = portrait row
landscape row    = (portrait columns − 1) − portrait column − (colSpan − 1)
```

Portrait row 0 becomes the leftmost column, and portrait column 0 the bottom row. A script can also read each button's place from `GET /api/view` ([Scenes and sound › Where each button is](?p=scenes-and-sound#where-each-button-is)).

## Check a face before it goes live

Without an AI app, nothing shows you the glide itself before the phone does. These checks still catch nearly every problem first:

| Check | What it tells you | Needs |
|---|---|---|
| On the phone | how one frame looks at rest, and which parts are not drawn | the phone in your hand |
| From Terminal | why a frame is rejected, and which parts are not drawn | the phone connected, except for a rejection |
| Frames in a row | whether the start state and each next frame glide, and if not, why | the phone connected |
| While you build | the running script's first warning or cross-fade, in the phone's list of errors | the phone connected |
| While the script runs | every rejected frame; with the phone connected, also as **Drawing rejected** in the phone's list of errors | — |
| With an AI app | a storyboard of the glide | an AI app |

**On the phone.** Copy a frame on the Mac with `zsh ring.zsh --frame 42 | jq -r .svg.source | pbcopy`, then paste it into **Icon › SVG Drawing › SVG Document**. The phone draws it, and the line under the document reads "The SVG is fully supported." or "Some parts of this SVG are not supported and will not be drawn:", followed by a line for each part. On a Wide or Tall button, ⟲ (**Show Landscape**) shows it turned; **Cancel** discards everything.

<img src="assets/docs/img/svg-faces/drawing-check.png" width="280" height="608" alt="Icon › SVG Drawing with the CPU ring’s start state pasted: the preview of an empty gray ring with a dash and “cpu %”, the SVG Document row, Paste and Import from File…, the green check “The SVG is fully supported.” with Learn More…, Scaling “Fit” and Remove SVG Drawing.">

**From Terminal.** With the phone connected, pipe a frame to the agent through its socket ([Working from your Mac › Send one update by hand](?p=from-your-mac#send-one-update-by-hand)). `--frame` uses a made-up Button ID, so the phone shows nothing, but the agent checks the frame as it checks a live one:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal (the socket form, phone connected), harness (the same frames over 127.0.0.1:9848) -->
```zsh title="Terminal"
sock="$HOME/Library/Application Support/Desktap/LocalAPI/agent.sock"
zsh ring.zsh --frame 42 |
  curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
    -d @- http://localhost/api/update-button
```

Run `--frame` on `ring.zsh` itself. A `try.zsh` copy from [Working from your Mac › Try a script in Terminal first](?p=from-your-mac#try-a-script-in-terminal-first) carries the real Button ID, so its frame lands on the button.

Check an exported icon or a saved drawing the same way, from its file:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness (the same jq body over 127.0.0.1:9848, phone connected: 200 with the three warnings below for the Illustrator export), terminal (the socket form) -->
```zsh title="Terminal"
sock="$HOME/Library/Application Support/Desktap/LocalAPI/agent.sock"
jq -n --arg id "$(uuidgen)" --rawfile s icon.svg '{cellId: $id, svg: {source: $s}}' |
  curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
    -d @- http://localhost/api/update-button
```

An answer without a `warnings` key means the phone draws everything. `"visible":false` only says that no button with this ID is on screen, and the order of the keys varies:

```json
{"status":"ok","visible":false}
```

Otherwise the answer names each part that will not be drawn, here for an Illustrator export with CSS classes (one line in Terminal):

```json
{
  "status": "ok",
  "visible": false,
  "warnings": [
    "Ignored unsupported elements and their children: style. Filters (shadows, blurs), patterns, CSS and animation are not rendered; drive motion by sending frames.",
    "<rect class>: CSS classes are not supported; use presentation attributes or style=\"…\".",
    "<path class>: CSS classes are not supported; use presentation attributes or style=\"…\"."
  ]
}
```

A broken frame gets a 400 with the reason, such as `svg.source rejected: svg needs a viewBox (or width/height)`, even with no phone connected. Without the phone, any other frame gets 503 "No device connected". A few details, such as `font-family`, are ignored without a warning ([SVG reference › What is not drawn](?p=svg-reference#what-is-not-drawn)).

**Frames in a row.** The agent compares each frame with the one before it on the same Button ID. These lines post the start state and two live frames to the made-up ID of `--frame`, and print only what the agent says is wrong:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), terminal (the socket form, phone connected: no output for the CPU ring; the crossFade line below for an 80 frame without stroke-linecap; a currentColor start state and a skipped reset each give a crossFade line), svgdiff, render_preview -->
```zsh title="Terminal"
sock="$HOME/Library/Application Support/Desktap/LocalAPI/agent.sock"
# send: post the body from stdin; print only what the agent says is wrong
send() {
  local a=$(curl -q -s -m 5 --unix-socket "$sock" -H 'Content-Type: application/json' \
    -d @- http://localhost/api/update-button)
  [[ -n $a ]] || { print "no answer: is the agent running?"; return 1 }
  print -r -- "$a" | jq -r '.message // empty, .warnings[]?, .crossFade // empty'
}
id=00000000-0000-0000-0000-000000000000                  # the made-up ID of --frame
jq -nc --arg id $id '{cellId: $id, reset: true}' | send  # forget earlier checks
zsh ring.zsh --face > face.svg                           # the start state, as a frame
jq -nc --arg id $id --rawfile s face.svg '{cellId: $id, svg: {source: $s}}' | send
zsh ring.zsh --frame 42 | send                           # a live frame after it
zsh ring.zsh --frame 80 | send                           # and the next one
```

> [!SEE]
> No output: the start state glides into the first frame, and each frame into the next. Each line that does appear names something to fix; `No device connected` means the phone is not connected.

Here the 80 frame lost `stroke-linecap='round'`, which leaves the default, `butt`. The line, wrapped here, reads:

```text
This frame's structure differs from this button's previous frame, so the phone
cross-fades instead of gliding. First difference: element 2 (#ring, a circle):
stroke-linecap round → butt. Keep stroke-linecap the same in every frame; it counts
even on an element without a stroke.
```

**While you build.** A face that sends two frames per sample, such as a scrolling chart's rest and slide, is best checked as it runs. Put the three lines from [Script API › Answers](?p=api#answers) in place of its `post`: the script stops at the first warning or `crossFade`. ⚠ 1 then appears next to your Mac's name at the top of the deck: tap it to read that text. Take the lines out when the face is done.

**While the script runs.** The helpers print every 400 to stderr, and nothing about warnings or `crossFade`. In the list the ⚠ count opens, a rejected frame shows as **Drawing rejected**, with the agent's reason, until the agent accepts a frame for the button. A startup script that fails shows there with its error text ([Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work)).

**With an AI app.** The assistant can draw two frames as a storyboard of the glide before it delivers a face ([Use with an AI app › Asking for widgets](?p=ai#asking-for-widgets)).

<!-- Slot for a future preview in the agent (report P1): add it here as the first check. -->

## Icons from design tools

An icon exported from Figma usually works as it is, gradients and even-odd holes included. Keep its own square viewBox, such as 64 or 128: the text sizes scale with it ([Sizes and the turned phone](#sizes-and-the-turned-phone)). To bring one to the phone, open **Icon › SVG Drawing**: **Import from File…** picks an `.svg` from Files, or copy the file's text on the Mac and tap **Paste**. The button keeps a copy of the content, up to 64 KB.

<!-- verified 2026-10-01, svgrender (no warnings; the artboard clip is dropped) -->
```svg title="SVG Drawing"
<svg width="64" height="64" viewBox="0 0 64 64" fill="none"
  xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1_2)">
<rect x="6" y="6" width="52" height="52" rx="14" fill="url(#paint0_linear_1_2)"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M32 15C22.6112 15 15 22.6112 15 32
  C15 41.3888 22.6112 49 32 49C41.3888 49 49 41.3888 49 32C49 22.6112 41.3888 15 32 15Z
  M32 21C25.9249 21 21 25.9249 21 32C21 38.0751 25.9249 43 32 43C38.0751 43 43 38.0751
  43 32C43 25.9249 38.0751 21 32 21Z" fill="white" fill-opacity="0.92"/>
<path d="M29 26.5L38 32L29 37.5V26.5Z" fill="white"/>
</g>
<defs>
<linearGradient id="paint0_linear_1_2" x1="6" y1="6" x2="58" y2="58"
  gradientUnits="userSpaceOnUse">
<stop stop-color="#FF9F0A"/>
<stop offset="1" stop-color="#FF375F"/>
</linearGradient>
<clipPath id="clip0_1_2">
<rect width="64" height="64" fill="white"/>
</clipPath>
</defs>
</svg>
```

<img src="assets/docs/img/svg-faces/icon-exports.png" width="272" height="96" alt="Three icons drawn by Desktap: an Illustrator export with CSS classes is all black; the same icon with presentation attributes is orange with a white play triangle; the Figma export above is an orange-to-red tile with a white ring">

Left to right: an Illustrator export with CSS classes, drawn all black; the same icon exported with presentation attributes; the Figma export above.

| In the file | What Desktap does | What to do |
|---|---|---|
| a Figma export | draws it; drops the clip around the artboard | nothing |
| CSS from Illustrator (`<style>`, `class="…"`) | ignores it, so the shapes turn black; warns | export with **Styling: Presentation Attributes** |
| shapes without a `fill` | draws them black | `fill="white"` or `fill="currentColor"` on the `<svg>` element |
| `<title>`, `<desc>`, `<metadata>` | skips them, with a harmless warning | nothing, or delete them |
| a drop shadow, a blur, a glow (`filter`) | leaves the effect out; warns | draw a darker shape behind instead |
| an image fill (`<pattern>`, `<image>`) | leaves the shape unpainted; warns | redraw it as shapes |
| a mask | clips to the mask's outline; soft edges are lost; warns | a solid mask looks right, but the warning stays: draw the same shapes as a `<clipPath>` to clear it |
| text that is not outlined | draws it in the system font; drops `letter-spacing`, with a warning; a Figma `<tspan>` loses its position, so the text lands at 0,0 and is clipped | convert the text to outlines before export |
| `<use>`, for repeated symbols | leaves it out; warns | expand the instances on export |
| `mix-blend-mode` | ignores it **without a warning** | flatten the look into plain colors |
| more than 64 KB | refuses it: "The file is too large. An SVG drawing can be up to 64 KB." Pasted text gets "The SVG is too large. A drawing can be up to 64 KB." | export the icon frame alone, without hidden layers |

To see what your own file loses, paste it into **SVG Document** and read the line under it, or check the file from Terminal ([Check a face before it goes live](#check-a-face-before-it-goes-live)).

## Cost on the phone

What costs the phone is motion, not the frames you send: a face at rest costs almost nothing, however much it holds. So count the faces that glide at the same moment.

<div class="dt-mount" data-diagram="pacing" data-mode="default">How fast three faces move: a value that settles glides and rests; with glides as long as the interval the dot stops when a frame is late, at 1.25 × the interval it never stops.</div>

| | Values that settle | Motion that never stops |
|---|---|---|
| For | system metrics, a battery, a progress ring | a ticker, a spinner, a sweeping second hand |
| `easing` | `easeInOut` | `linear` |
| `duration` | 0.4–0.8 s | 1.25 × the frame interval: 1.25 s for a frame a second |
| Frames | every 2–5 s, and only when the value changed | steady: a frame a second for clocks, timers and tickers |
| On one page | dozens are fine | a handful, not a wall: prefer one Large face to many Normal ones that all move every second |

For motion that never stops, a glide that lasts exactly one interval stops each time a frame comes a little late. A scrolling chart is the exception: its slide lasts the measured period, at most 1.1 × it ([Charts that scroll](#charts-that-scroll)).

For anything from the web, wait 60 s or more between frames. A music spectrum may take up to 15 frames a second, but only one per page ([Scenes and sound](?p=scenes-and-sound)). More than 2–3 frames a second to one button is wasted unless the motion never stops.

- **Gradients, clips and masks** belong on shapes that rest; a still rectangle that frames a moving chart is fine ([Gradients and clips](#gradients-and-clips)).
- **`"dropped": true`** means the phone is not reading right now. Slow down to about a frame every few seconds until the answers come without it; the CPU ring waits 4 s longer. If it happens while Desktap is open in the foreground, the page costs more than the phone can draw: make it lighter.

## Next

- [Button logic](?p=button-logic): taps change something, the startup script draws it.
- [Recipes: live widgets](?p=recipes-widgets): a memory gauge, network speed, a dashboard and a clock, all drawn this way.
- [SVG reference](?p=svg-reference): every element and attribute Desktap draws, and every message it gives.

<div class="recipe-cards" data-set="widgets"></div>
