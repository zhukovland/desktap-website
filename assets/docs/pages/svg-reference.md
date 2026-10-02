<!-- updated: 2026-10-02 -->
# SVG reference

This page is for looking things up; to learn the craft step by step, start with [SVG faces](?p=svg-faces). Every rule here applies to both kinds of drawing: a **frame**, the `<svg>` document a script sends in `svg.source`, and a **saved drawing**, the one kept in **Icon › SVG Drawing**.

| To find out | Look in |
|---|---|
| whether Desktap draws an element or attribute | [Supported SVG](#supported-svg), [What is not drawn](#what-is-not-drawn) |
| why a face cross-fades instead of gliding | [What keeps a glide](#what-keeps-a-glide) |
| what a message from the agent means | [Errors and warnings](#errors-and-warnings) |
| which viewBox and text size to use | [Sizes and scale](#sizes-and-scale), [Text details](#text-details) |
| where a button lands when the phone turns | [Landscape placement](#landscape-placement) |
| how often to send frames, and how many faces may move | [Frame rate and cost](#frame-rate-and-cost) |

## Supported SVG

Desktap on your iPhone or iPad draws a subset of SVG 1.1. Whatever falls outside it is refused with a 400, left out with a warning or, for a few attributes, ignored without a word ([What is not drawn](#what-is-not-drawn)).

| Feature | What you can write | Good to know |
|---|---|---|
| Root | `<svg viewBox="0 0 200 200">`, or `width` and `height` as plain numbers | `xmlns` is optional. A viewBox needs exactly four numbers; a size in `%` is refused. |
| Shapes | `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text` | Shapes inside `<defs>` are templates and are not drawn. |
| Path data | `M L H V C S Q T A Z`, absolute and relative; packed numbers such as `10-5.5.5` | An arc's angle may change, even past 90°, and the face still glides. Anything in `d` that is not path data is an error. |
| Rectangles | `x`, `y`, `width`, `height`, `rx`, `ry` | A missing `rx` takes `ry`, and the other way round. A radius stops at half the side; `rx="0"` stays square. |
| Paint | `fill` and `stroke`: a color, `none`, `currentColor`, `inherit`, `url(#id)` with an optional fallback color | `currentColor`, in any letter case, is the button's Color. The default fill is black; the default stroke is none. |
| Colors | `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` with commas or spaces and `/ alpha`, `hsl()` and `hsla()`, the 148 CSS names, `transparent` | The hue may carry `deg`; channels may be numbers or `%`; names work in any letter case. Values out of range are clamped. |
| Numbers | plain decimals: `12`, `12.5`, `-3`, `1e2` | `nan` and `inf` are not numbers: in `d` or `points` the frame is refused, in an attribute the value is ignored with a warning. |
| Units | `px` and `pt`; `%` only for opacity, stop offsets and gradient coordinates; `em` only for `dx` and `dy` | A `px` or `pt` suffix is dropped, not converted: `12pt` counts as 12. |
| Opacity | `opacity`, `fill-opacity`, `stroke-opacity`: 0 to 1, or a percentage | `opacity` multiplies down through groups; the other two are inherited. |
| Stroke | `stroke-width`, `stroke-linecap` (`butt`, `round`, `square`), `stroke-linejoin` (`miter`, `round`, `bevel`), `stroke-dasharray` (`none` or numbers of 0 and more), `stroke-dashoffset` | Dash lengths are in viewBox units. A width of 0 or less draws no stroke. |
| Transforms | `matrix(a b c d e f)`, `translate(x [y])`, `scale(x [y])`, `rotate(angle [cx cy])`, `skewX(a)`, `skewY(a)`, separated by spaces or commas, on any element | Names are case-sensitive: `Rotate(45)` is not read. Plain numbers only, no `deg` or `px`. One unreadable part drops the whole list, with a warning. |
| Text | one line of one style per `<text>`, with `x`, `y`, `dx`, `dy`, `font-size`, `font-weight`, `text-anchor`, `dominant-baseline`, paint and opacity | See [Text details](#text-details). |
| Style | attributes such as `fill="…"`, or the same properties in `style="fill:…; stroke:…"` | `style` wins over an attribute. Children inherit from their group. |
| Gradients | `<linearGradient>` and `<radialGradient>` with `<stop offset stop-color stop-opacity>`, used as `fill="url(#id)"` or `stroke="url(#id)"` | `stop-color` may be `currentColor`. `gradientUnits`: `objectBoundingBox` (default) or `userSpaceOnUse`. `gradientTransform` and `href` to another gradient work. A gradient may come after the shapes that use it. |
| Clips | `clip-path="url(#id)"` with a `<clipPath>` of shapes, in viewBox units | Nested clips intersect. A clip rectangle that covers the whole viewBox from 0,0, like a design tool's artboard clip, is dropped. |
| Masks | `mask="url(#id)"` | Drawn as a clip to the outline of the mask's shapes, with a warning. |
| The document | an `<?xml ?>` line, a DOCTYPE, comments, UTF-8 text, numeric references such as `&#160;` | Nothing outside the viewBox is drawn, so a chart can park its next point there, out of sight. |

<!-- Anchor used by the iOS app (EditorHelpLinks: the Learn More… link under the check line of Icon › SVG Drawing). Keep this heading text. -->
## What is not drawn

Most of what Desktap leaves out is named in the answer's `warnings`, and under the document in **Icon › SVG Drawing**. A few attributes are ignored without a word ([Ignored without a warning](#ignored-without-a-warning)), so check those by eye.

<!-- SCREENSHOT svg-reference-check-warnings: iPhone 17 Pro, iOS 26, English, dark. Icon › SVG Drawing with the frame from Errors and warnings › Warnings pasted as the document: the preview, then under the document the line "Some parts of this SVG are not supported and will not be drawn:" with its four warnings. Turn off Settings › Security › Hide Code While Recording or Mirroring first. -->

| In the frame | What you get | Write instead |
|---|---|---|
| `filter`: a drop shadow, blur or glow | the shape without the effect | a second, darker shape behind it |
| `<pattern>` as a fill | the shape unpainted, or in the fallback color after `url()` | a gradient, or draw it with shapes |
| `<image>` | not drawn | draw it with shapes |
| `<style>`, `class="…"` | no CSS: shapes without their own `fill` turn black | attributes or `style="…"` on each element |
| `<title>`, `<desc>`, `<metadata>` | skipped, with a harmless warning | nothing; delete them to clear the warning |
| `<script>`, `<symbol>`, `<marker>` | skipped with everything inside | draw the shapes directly |
| `<use>` | not drawn | copy the shape in place |
| `<animate>` and other SVG animation | ignored | send frames: the phone glides between them |
| `<a>`, `<switch>` and other unknown wrappers | the wrapper is ignored; the shapes inside are drawn | nothing |
| `<tspan>` | its characters join the text; its own position, size and color are lost | one `<text>` per line or style |
| `display="none"`, `visibility="hidden"` | the element is drawn anyway | `opacity="0"` |
| `transform-origin` | ignored | `rotate(angle cx cy)` |
| `pathLength` | ignored | dash lengths in viewBox units: a ring of radius r is 2πr long |
| `letter-spacing`, `textLength` | ignored | separate `<text>` elements, or another `font-size` |
| an unknown keyword, such as `text-anchor="center"` | the inherited value | one of the values the warning lists |
| `rotate(45deg)`, `translate(10px 0)`, `Rotate(45)` | the whole `transform` is dropped | plain numbers and lowercase names |
| `width="50%"`, `height="1em"` | the attribute is ignored | plain numbers |
| a mask with a soft edge, a gradient or transparency | a hard clip to the mask's outline | a solid mask, or a clip |
| a radial gradient's `fx` and `fy` | the gradient is centered on `cx`, `cy` | move `cx`, `cy` |
| `spreadMethod="reflect"` or `"repeat"` | the end colors fill the rest of the shape | more stops |
| a gradient on `<text>` | its first stop color | a flat `fill` |
| `clipPathUnits="objectBoundingBox"` | the clip is ignored | clip coordinates in viewBox units |

### Ignored without a warning

These leave no line in `warnings` and none under the document.

| In the frame | What you get | Write instead |
|---|---|---|
| `preserveAspectRatio` | ignored | `fit`, or **Scaling** in **SVG Drawing** ([Sizes and scale](#sizes-and-scale)) |
| `font-family`, `font-style`, `text-decoration` | the system font, upright, not underlined | in an icon, text converted to paths |
| `stroke` on `<text>` | text is filled only | a shape behind the text |
| `stroke-miterlimit` | the limit is always 10 | `stroke-linejoin="round"` or `"bevel"` for very sharp corners |
| `mix-blend-mode` and other unknown style properties | ignored | plain colors and opacity |
| attributes Desktap does not know, such as `vector-effect` | ignored | nothing |
| a nested `<svg>` | drawn as a plain group: its `x`, `y`, `width`, `height` and `viewBox` are ignored | `<g transform="translate(x y) scale(s)">` |
| a viewBox with a width or height of 0 | accepted; nothing is drawn | a real size |

### Drawn differently from a browser

Desktap draws these, but not the way a browser does. The picture shows the first three as Desktap draws them.

<img src="assets/docs/img/svg-reference/drawn-differently.png" width="326" height="115" alt="Three buttons drawn by Desktap: the number 88 stays on top of a red bar written after it; a circle and a word without fill are black and hard to see; two overlapping blue circles in a half-transparent group look more solid where they overlap">

| In the frame | On the phone | What to do |
|---|---|---|
| a shape written after a text | every `<text>` is drawn above every shape | when a shape should cover a label, set the label's `opacity` to 0 |
| a shape or text without `fill` | painted black, nearly invisible on the dark button | `fill="white"` or `fill="currentColor"` on the `<svg>` element |
| overlapping shapes in a half-transparent `<g>` | each shape fades on its own, so overlaps look more solid, and so does a stroke over its own fill | fade one shape, or keep shapes from overlapping |
| a sharp corner on a thick stroke | the miter reaches further than in a browser | `stroke-linejoin="round"` or `"bevel"` |

## What keeps a glide

Two frames glide when they have the same **structure**: the same elements in the same order, each with the same kind of shape and paint. When the structure changes, the face **cross-fades**: the new frame fades in over `duration` while the old one stays visible underneath.

A cross-fade is not an error, but on a widget that updates every few seconds it looks like flicker. The agent's answer names the first difference ([The `crossFade` note](#the-crossfade-note)).

### A frame built to glide

This is one frame of the CPU ring from [SVG faces](?p=svg-faces#your-first-live-svg-widget-the-cpu-ring), at 72%. Every frame the script sends is this same text with another value, color and dash offset.

<!-- verified 2026-10-02, agent 1.2.3 (build 8), harness, svgrender (the CPU ring script's own --frame 72 output, byte for byte; its start state, 72% and 88% glide into each other; no warnings; 652 bytes) -->
```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <circle id='track' cx='100' cy='100' r='78' fill='none'
    stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='16'/>
  <circle id='ring' cx='100' cy='100' r='78' fill='none'
    stroke='#FF9F0A' stroke-width='16' stroke-linecap='round'
    stroke-dasharray='490.09 490.09' stroke-dashoffset='137.22'
    transform='rotate(-90 100 100)'/>
  <text id='value' x='100' y='116' font-size='56' font-weight='bold'
    text-anchor='middle' fill='#FFFFFF'>72</text>
  <text id='label' x='100' y='146' font-size='28'
    text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>cpu %</text>
</svg>
```

| | Start state | 72% | 88% |
|---|---|---|---|
| `stroke` of `#ring` | `#8E8E93` | `#FF9F0A` | `#FF453A` |
| `stroke-dashoffset` of `#ring` | `490.09` | `137.22` | `58.81` |
| the words of `#value` | `–` | `72` | `88` |

Nothing else changes: the same four elements, ids, paint kinds, linecap and dash count in every frame.

### Free to change

Change any of these from one frame to the next, and the face glides.

| What | Example |
|---|---|
| positions, sizes and path points | `x`, `cx`, `r`, `width` down to 0, the numbers in `d` and `points` |
| colors | `#34C759` → `#FF3B30`: on its way to red, green passes through olive |
| opacity | `opacity`, `fill-opacity`, `stroke-opacity`: this is how you hide and show |
| strokes | `stroke-width`, the dash lengths, `stroke-dashoffset` |
| transforms | `translate`, the angle of `rotate`, `scale`; a rotation takes the short way, so 350° → 10° turns 20° forward |
| text | the words, which change at once; `x`, `y`, `font-size`, color and opacity glide. A label may be empty. |
| the viewBox position | its first two numbers: the view pans |
| gradients | coordinates, `gradientTransform`, and each stop's offset, color and opacity |
| clips | the numbers of the shapes in the `<clipPath>` |
| the way a shape is written | `<circle>` ↔ `<ellipse>`; `H` and `V` ↔ `L`; `Q`, `T` and `S` ↔ `C`; an arc at any angle |

### Keep the same in every frame

Each change in the middle column makes the face cross-fade. When a face flickers, go down this list.

| Keep | Cross-fades when | Write instead |
|---|---|---|
| the viewBox width and height | `0 0 200 200` becomes `0 0 400 200` | pan with its x and y; zoom with a `transform` on a group |
| the elements and their order | an element is added, removed or moved to another place | keep every element in every frame; hide one with `opacity="0"` |
| each element's `id` | an `id` is renamed, added or dropped | the same `id` in the same place in every frame |
| shape or text | a text stands where a shape was | keep both; hide one with `opacity="0"` |
| the path commands | `L` becomes `C`, or a path or polyline gets another number of points | the same letters and as many points; pad a short series with its last value |
| square or rounded corners | `rx` is 0 in one frame and 4 in the next | `rx` above 0 in every frame, or in none; its value may change |
| the kind of each fill and stroke | a color ↔ `none`, a color ↔ `currentColor`, a gradient ↔ a flat color | keep the kind; fade with `fill-opacity` or `stroke-opacity` 0 (a text: `opacity` 0) |
| `stroke-linecap`, `stroke-linejoin` | the value changes, such as `round` in one frame and left out in the next, even on an element without a stroke | the same value in every frame |
| the number of dash lengths | `4 2` becomes `4 2 1 2`, or the dashes become `none` | the same count; for a solid look, one dash as long as the line |
| `fill-rule` | `evenodd` in one frame only | the same in every frame |
| a text's `font-weight`, `text-anchor`, `dominant-baseline` | `regular` becomes `bold` | the same in every frame |
| a gradient's kind, units, stop count, `currentColor` stops | 2 stops become 3 | the same; change offsets and colors instead |
| the clips | a clip is added or dropped, a clip rectangle becomes a circle, or grows to cover the whole viewBox from 0,0 | the same clip shapes in every frame; stop a growing clip a little short of full size, such as 199.9 |
| the landscape variant | a frame of a Wide or Tall face comes without `landscapeSource` after one with it | send `landscapeSource` with every frame |

The same rules hold between a saved drawing and the first live frame: a start state needs the same structure as the frames that follow it ([SVG faces › Give it a start state](?p=svg-faces#give-it-a-start-state)).

### Motion that works

Both columns glide; only the first one looks the way you mean.

| To | Do this | Not this |
|---|---|---|
| turn a needle or a hand | `transform="rotate(angle cx cy)"`, and change only the angle | moving the end of a line: it bends on the way |
| fill a ring | a full circle with `stroke-dasharray="C C"`, changing `stroke-dashoffset` ([SVG faces › Rings and gauges](?p=svg-faces#rings-and-gauges)) | an arc path: on a big jump it leaves the circle halfway |
| turn several things together | put them in one `<g transform="translate(100 100) rotate(42 0 0)">` and draw them around 0,0 | — |
| circle around something that moves | one `rotate` per element: a group's `rotate` carries planet and moon around the center; inside it, move the moon by its own `cx` and `cy` | two `rotate`s on one element: they glide as a straight shift, so a moon cuts across its planet |
| turn further than half a turn | split the turn over two frames | one frame: it turns the short way, backwards |
| loop forever | let the value keep growing: a dash offset, an `x` that keeps falling | wrapping it back to the start: it glides backwards across the face |
| jump something back to its start | three frames: hide it where it is with `opacity="0"`; move it on a later frame; show it on a later frame | moving it in the frame that hides it: a faint copy slides across |
| fade out something that keeps moving | after the frame that sets `opacity="0"`, keep its numbers still for two frames | moving it at once: the fade is cut short |
| scroll a chart | move the whole chart with `translate` in a rest frame and a slide frame ([SVG faces › Charts that scroll](?p=svg-faces#charts-that-scroll)) | shifting the values by one point: the line wobbles |

## Errors and warnings

Before sending a frame to the phone, the agent checks it with the phone's own parser: a broken frame is refused with a 400, and the button keeps what it shows. A frame with parts the phone does not draw is sent anyway, and the answer lists those parts.

| Order | The agent checks | Answer |
|---|---|---|
| 1 | that there is a body, and that every key of it is known | 400 `Missing request body` or `Unknown field(s): …` |
| 2 | that the body is JSON with the right types and values | 400 `Invalid JSON` |
| 3 | `color`, then the size and the `<svg` of each document, then `duration` | 400 with the field's name |
| 4 | that `source`, then `landscapeSource`, can be drawn | 400 `svg.source rejected: …` |
| 5 | that a phone is connected | 503 `No device connected`, or 500 `Frame not sent: …` |
| 6 | nothing more: all of the above passed | 200, perhaps with `warnings`, `crossFade`, `"visible": false` or `"dropped": true` |

So a broken frame is refused even when no phone is connected, while `warnings` and `crossFade` come back only with a phone connected. The helpers block of every recipe prints each 400 to stderr. With a phone connected, **Errors** on the phone also lists a refused frame as **Drawing rejected**, with the reason, until the agent accepts a frame for the button ([Live widgets › When a widget doesn't work](?p=live-widgets#when-a-widget-doesnt-work)).

> [!TIP]
> To read warnings, `crossFade` notes and errors while you work, post a frame from Terminal ([Working from your Mac › Send one update by hand](?p=from-your-mac#send-one-update-by-hand)) and pipe the answer through `jq -r '.message // empty, .warnings[]?, .crossFade // empty'`: one line per message.

### Refused frames

Every message below comes back as `{"status":"error","message":"…"}`. The agent writes `/` as `\/` in its answers, so `width/height` arrives as `width\/height`.

| Message | Why | What to do |
|---|---|---|
| `Unknown field(s): svg.foo. Valid fields: cellId, title, icon, emoji, color, reset, svg; inside svg: source, landscapeSource, duration, fit, easing, remove.` | a key the agent does not know, such as `catchUp` | remove it; the message lists every valid key |
| `Missing request body` | the update has no body, such as `-d "$body"` with an empty variable | check the variable that holds the body |
| `Invalid JSON` | the body is not JSON, or `cellId` is missing or not a Button ID | build the body with `jq` or `json()` |
| `Invalid JSON` | a value has the wrong type, such as `"duration":"1"`, or `fit` or `easing` has an unknown value, such as `"fill"` or `"ease"` | the right type; `fit` is `contain`, `cover` or `stretch`, `easing` is `easeInOut` or `linear` |
| `Invalid color format. Expected #RRGGBB.` | comes only from the update's `color` field | write `#RRGGBB`; inside the SVG any color form works |
| `svg.source must be an <svg> document.` | the text holds no `<svg`, or is empty | send the whole document |
| `svg.source is too large (max 64 KB).` | more than 65,536 bytes | fewer points, shorter numbers |
| `svg.duration must be within 0...10 seconds.` | `duration` below 0 or above 10 | a value from 0 to 10 |
| `svg.landscapeSource must be an <svg> document.`, `svg.landscapeSource is too large (max 64 KB).` | the same checks for the landscape variant | the same fixes |

When the document itself cannot be drawn, the message starts with `svg.source rejected: `, or with `svg.source rejected: landscapeSource: ` when the landscape variant is the problem. Either way, the button keeps what it shows.

| After `svg.source rejected:` | Why | What to do |
|---|---|---|
| `XML error at line 3, column 36: premature end of document: a tag is not closed, the SVG was cut short, or an unescaped '&' / '<' appears in text (write &amp; and &lt;)` | the XML is broken: an `&` or `<` in text, `&nbsp;`, an unquoted value, an unclosed tag, a document cut short | look at that line and the lines before it; write `&amp;`, `&lt;` and `&#160;` |
| `svg needs a viewBox (or width/height)` | no viewBox, a viewBox without four numbers, or a size in `%` | `viewBox="0 0 200 200"` |
| `Missing <svg> root or viewBox/width/height` | no element is named exactly `svg`, such as `<SVG>` in capitals or a prefixed `<svg:svg>` | a plain lowercase `<svg>` |
| `The document draws nothing (no supported elements inside <svg>)` | nothing drawable inside; a single empty `<text>` counts as nothing | at least one shape, or text with words |
| `path: Unknown command n` | a letter where a number belongs, often `nan` from a script | check the numbers your script prints |
| `path: Unexpected '#' at offset 12 of the path data` | a character that cannot be path data, such as a color pasted into `d` | keep only path letters and numbers in `d` |
| `path: M without coordinates`, `path: C needs 3 points`, `path: S needs 2 points`, `path: Q needs 2 points`, `path: A needs 7 values`, `path: Missing y coordinate` | a command with too few numbers | the full set of numbers |
| `polyline: points must be pairs of plain numbers (got "1 2 3")` | an odd count, or something that is not a number; a `<polygon>` gets the same message, starting `polygon:` | x and y for every point |
| `SVG is too complex: it expands to 60420 path commands after clip-path expansion (limit 50000). A clip-path, a gradient's stops and a dash pattern count once for every element they apply to — a clip-path or gradient set on a group is copied into each shape inside it. Apply it to fewer shapes or simplify it.` | a detailed clip, gradient or dash pattern on a group of many shapes | put it on fewer shapes, or simplify it |
| `Element 1 (#r) computes a number that is infinite, not a number or beyond ±8.988465674311579e+307 — huge arc radii, stacked scale() or coordinates near 1e308 do this. Keep coordinates, sizes and transforms in an ordinary range.` | a number grew out of range; it may also start with `The viewBox origin` | ordinary sizes and scales |

Two numbers in these messages point you to the problem:

- **Line numbers.** An XML error names the line where reading stopped. The problem is on that line or shortly before it, and a tag that is never closed shows at the end of the document. Put each element of your template on its own line, so the line number leads you to the element.
- **Element numbers.** Elements are counted from 1 in the order they are written, text included; groups and the shapes inside `<defs>` or a `<clipPath>` do not count. The [`crossFade` note](#the-crossfade-note) counts the same way.

### Warnings

A frame with warnings is drawn without the parts they name. Each warning says what was ignored and, where there is one, what to write instead. This frame gets four:

<!-- verified 2026-10-01, agent 1.2.3 (build 8), harness, svgrender (the four warnings below) -->
```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <defs><filter id='glow'/></defs>
  <rect width='50%' height='40' fill='#34C759' filter='url(#glow)'/>
  <text x='100' y='120' font-size='28' text-anchor='center' fill='#FFFFFF'>CPU</text>
</svg>
```

The agent sends its answer on one line, with the keys in any order; here it is spread over several lines. `"visible": false` is there because the frame went to a made-up Button ID:

```json
{
  "visible": false,
  "warnings": [
    "Ignored unsupported elements and their children: filter. Filters (shadows, blurs), patterns, CSS and animation are not rendered; drive motion by sending frames.",
    "<rect filter>: filters are not supported.",
    "<rect width=\"50%\">: not a plain finite number and was ignored (units other than px\/pt and percentages are not supported).",
    "<text text-anchor=\"center\">: not supported, the inherited value is kept. Supported: start, middle, end."
  ],
  "status": "ok"
}
```

- The lines about elements come first, when there are any: one for unsupported elements, one for unknown ones. Then come up to 12 attribute lines, one per element name and attribute: fifteen `<rect width="50%">` make one line.
- Past 12, the list ends with `…and N more attribute warning(s) not listed; fix the ones above and send the frame again.`
- Warnings about the landscape variant start with `landscapeSource: `.
- A frame with nothing to report has no `warnings` key. Fix the drawing until the key is gone.
- **Icon › SVG Drawing** shows the same lines under "Some parts of this SVG are not supported and will not be drawn:", and "The SVG is fully supported." when there are none.

Every warning, as the agent words it. The element and attribute at the start come from your frame:

| Warning | What to do |
|---|---|
| `Ignored unsupported elements and their children: filter. Filters (shadows, blurs), patterns, CSS and animation are not rendered; drive motion by sending frames.` | see [What is not drawn](#what-is-not-drawn); the names can be `desc`, `filter`, `marker`, `metadata`, `pattern`, `script`, `style`, `symbol`, `title` |
| `Ignored unknown elements: use. Supported: svg, g, path, rect, circle, ellipse, line, polyline, polygon, text. <text> is a single run (no tspan); images and <use> are not supported.` | draw with the supported elements; shapes inside an unknown wrapper are still drawn |
| `<rect class>: CSS classes are not supported; use presentation attributes or style="…".` | `fill="…"` on the element |
| `<rect filter>: filters are not supported.` | a darker shape behind it |
| `<text letter-spacing>: letter-spacing is not supported.`, `<text textLength>: textLength is not supported.` | remove it |
| `<circle pathLength>: pathLength is not supported; dash lengths are in user units (a ring of radius r is 2πr long).` | dash lengths in viewBox units |
| `<circle transform-origin>: transform-origin is not supported; write rotate(angle cx cy).` | `rotate(angle cx cy)` |
| `<rect>: display/visibility are not supported, the element is drawn. Hide it with opacity="0" — that also keeps the frame structure stable for interpolation.` | `opacity="0"` |
| `<text text-anchor="center">: not supported, the inherited value is kept. Supported: start, middle, end.` | a listed value; the same form comes for linecap, linejoin, `fill-rule`, `clip-rule`, `font-weight` and the baseline |
| `<rect width="50%">: not a plain finite number and was ignored (units other than px/pt and percentages are not supported).` | a plain number |
| `<rect fill="blurple">: unrecognised colour, the inherited colour is used. Use #rgb, #rrggbb, #rrggbbaa, rgb(), hsl(), a CSS colour name or currentColor.` | a color from [Supported SVG](#supported-svg) |
| `<circle fill="url(paint)">: not a readable reference (write url(#id)); nothing, or the fallback colour after it, is painted.` | `url(#id)` |
| `<circle stroke-dasharray="4 -2">: not a list of plain non-negative numbers and was ignored.` | numbers of 0 and more |
| `<g transform="rotate(45deg)">: could not be read and was ignored. Supported: matrix(a b c d e f), translate(x [y]), scale(x [y]), rotate(angle [cx cy]), skewX(angle), skewY(angle) — plain numbers, no units.` | plain numbers, lowercase names, two or no center values in `rotate` |
| `<tspan> inside <text>: its characters are appended to the single run; its own position, size and colour are ignored. Use one <text> element per line or style.` | one `<text>` per line |
| `<path> without a d attribute draws nothing and was dropped.` | give it `d`; to hide it, `opacity="0"` |
| `<polyline> with fewer than 2 points draws nothing and was dropped; keep the point count constant (pad with the last value) so the frame structure does not change.` | at least two points, the same count in every frame |
| `<clipPath clipPathUnits="objectBoundingBox">: only userSpaceOnUse is supported, the clip is ignored.` | clip coordinates in viewBox units (a `<mask>` gets the same with `maskContentUnits`) |
| `<clipPath transform="rotate(5deg)">: could not be read and was ignored (plain numbers, no units).` | plain numbers |
| `clip-path inside a <clipPath> or <mask> is not supported and was ignored.` | clip the element itself |
| `<rect clip-path="inset(1px)">: only url(#id) is supported; it is ignored.` | a `<clipPath>` and `url(#id)` |
| `<text> inside a <clipPath> is not supported and was ignored.` | shapes only in a clip |
| `<clipPath> without an id cannot be referenced and was ignored.` | give it an `id` |
| `url(#nope): no <clipPath> or <mask> has this id; the element is not clipped.` | check the `id` |
| `Masks are approximated: the content is clipped to the outline of the mask's shapes. A soft edge, a gradient or a partly transparent mask is not reproduced.` | fine for a solid mask |
| `<linearGradient> without an id cannot be referenced and was ignored.` | give it an `id` |
| `Gradient "e" has no <stop>; nothing is painted with it.` | add stops; a fallback color after `url()` is still painted |
| `<stop offset="x">: not a number or a percentage, 0 is used.` | `0.5` or `50%` |
| `<stop stop-color="blurple">: unrecognised colour, black is used.` | a supported color |
| `fill="url(#none)": no <linearGradient> or <radialGradient> has this id (patterns and images are not supported); the fallback colour after url(), or nothing, is painted.` | check the `id`; an image fill cannot be drawn |
| `A gradient on <text> is not supported; its first stop colour is used.` | a flat `fill` |
| `stroke="url(#r)" on a shape whose box has no height (a straight line, a flat series): an objectBoundingBox gradient has nothing to map onto, its last stop colour is painted. Give the gradient gradientUnits="userSpaceOnUse".` | `gradientUnits="userSpaceOnUse"` on every stroke that can become straight |
| `gradientUnits="user": unknown, objectBoundingBox is used.` | `objectBoundingBox` or `userSpaceOnUse` |
| `spreadMethod="reflect" is not supported; the gradient is padded with its end colours.` | more stops |
| `gradientTransform="rotate(5deg)": could not be read and was ignored.` | plain numbers |
| `Gradient x1="a": not a number or a percentage, the default is used.` | a number or a percentage |
| `A radial gradient's focal point (fx, fy) is not supported; the gradient is centred on (cx, cy).` | move `cx`, `cy` |

### The `crossFade` note

When a frame would cross-fade into the one before it on the same button, the answer, still a 200, carries a `crossFade` line: the first difference and how to fix it. Post the 72% frame from [A frame built to glide](#a-frame-built-to-glide), then the same frame without `stroke-linecap='round'`, to the same Button ID. The second answer reads:

```json
{
  "visible": false,
  "status": "ok",
  "crossFade": "This frame's structure differs from this button's previous frame, so the phone cross-fades instead of gliding. First difference: element 2 (#ring, a circle): stroke-linecap round → butt. Keep stroke-linecap the same in every frame; it counts even on an element without a stroke."
}
```

- `First difference:` names the element by its number, its `id` and its shape, then what changed. Fix that, post the two frames again, and look for the next one.
- The number counts elements as [error messages](#refused-frames) do: from 1 in the order they are written, text included, without groups and without the shapes inside `<defs>` or a `<clipPath>`.
- The shape is `a rect`, `a rounded rect` (a rect with `rx`), `a circle`, `an ellipse`, `a text`, or `a path`, which also stands for a `<line>`, `<polyline>` or `<polygon>`.
- When only the landscape variant differs, the note is its own sentence, starting `landscapeSource: its structure differs from the previous frame's landscapeSource, so a turned button cross-fades instead of gliding.`
- A frame without `landscapeSource` after one with it gets `landscapeSource: this frame has none, so the phone drops the previous frame's landscape variant and a turned button cross-fades to source. Send landscapeSource with every frame that sends source.`
- When `source` differs too, the note describes `source` and ends with `landscapeSource cross-fades too.` instead of either landscape sentence. Fix `source` first; the next answer names the landscape difference.
- A long note ends with `…`.
- There is no note for the first frame on a button since the agent started, the first after `remove` or `reset`, or the first after the script was stopped.
- The note compares live frames only. To check a start state, post the saved drawing as a frame, then a live frame, to the same made-up Button ID.

## Sizes and scale

Match the viewBox to the button's size, and the face fills the button. The text sizes in the table keep your text at least as large as a plain button's own label: 11 points, 13 on a Large button.

<div class="dt-mount" data-diagram="sizes" data-mode="default">The four button sizes with their viewBoxes, the corner that clips the face, an 8% safe margin and the smallest text, on an iPhone and on two iPads.</div>

| Size | viewBox | Drawn on an iPhone at | Smallest text, in viewBox units |
|---|---|---|---|
| Normal (1×1) | `0 0 200 200` | about × 0.40 (× 0.37 on an iPhone SE) | 28 (values 56–64) |
| Wide (2×1) | `0 0 400 200` | about × 0.40 | 28 |
| Tall (1×2) | `0 0 200 400` | about × 0.40 | 28 |
| Large (2×2) | `0 0 200 200` | about × 0.88 | 16 for labels, 22 and more for values |

| Phone | Grid | One button |
|---|---|---|
| iPhone | 4 columns × 8 rows | up to 80 points; the space left over goes into the gaps |
| iPad, 10.5 to 11 inches | 6 columns × 8 rows | about 115 points |
| iPad, 13 inches | 6 columns × 8 rows | 140 points |

- Design for the iPhone: an iPad draws the same face larger.
- The button's rounded corners clip the face: keep about 8% padding, 16 units on a 200-unit side.
- The face has no background: the button's glass shows through. Draw a background only if the design needs one.

How the viewBox fills a button of another shape, set with `fit` in an update or **Scaling** in **SVG Drawing**:

| `fit` | **Scaling** | What it does |
|---|---|---|
| `contain` (default) | **Fit** | the whole viewBox, centered, with empty margins where the shapes differ |
| `cover` | **Fill** | fills the button, centered; what sticks out is cut off |
| `stretch` | **Stretch** | fills the button and distorts the drawing |

A frame without `fit` keeps the one the button has. The first live frame over a saved drawing takes the drawing's **Scaling**, unless it names its own.

## Landscape placement

When the phone turns, the grid turns with it: every button moves to a new place, and Wide and Tall swap. The new place depends only on where the button is in portrait, whichever way the phone is turned.

```text
landscape column = portrait row
landscape row    = (portrait columns − 1) − portrait column − (colSpan − 1)
```

<div class="dt-mount" data-diagram="landscape" data-mode="default">A 4×8 page turning into landscape: each button moves to its new place, and a Wide face either shows its landscape variant or shrinks, letterboxed, into its tall place.</div>

On an iPhone (4 columns), portrait row 0 becomes the left edge and column 0 the bottom row:

| Button | Portrait row, column | Landscape row, column | Size in landscape |
|---|---|---|---|
| Normal | 0, 0 | 3, 0 | Normal |
| Wide | 0, 2 | 0, 0 | Tall: rows 0 and 1 |
| Tall | 5, 1 | 2, 5 | Wide: columns 5 and 6 |

- Send `landscapeSource` with every frame of a Wide or Tall face: the same data laid out for the turned shape, `0 0 200 400` for a Wide face and `0 0 400 200` for a Tall one. A saved drawing has the same thing: **Landscape Variant** in **SVG Drawing**.
- The phone draws whichever variant is closer in shape to the button at that moment. Turning the phone cross-fades from one variant to the other; after that, each one glides from frame to frame on its own.
- Without a variant, a Wide face in its tall landscape place shrinks to fit (with **Fit**), and its text becomes smaller than a button label.
- Normal and Large faces need no variant.
- A script can read every button's place from `GET /api/view` ([Scenes and sound › Where each button is](?p=scenes-and-sound#where-each-button-is)).

## Frame rate and cost

Pick the pace to suit the motion. What costs the phone is motion on screen: a face at rest costs almost nothing, so count the faces that move at the same moment.

| Motion | `easing` | `duration` | Send a frame |
|---|---|---|---|
| a value that settles: CPU, battery, a progress ring | `easeInOut` (the default) | 0.4–0.8 s | when the value changed, at most every 2–5 s, and once every 30 s anyway |
| motion that never stops: a ticker, a spinner, a scene | `linear` | 1.25 × the interval | at a steady interval |
| clock hands and timers | `linear` | 1.25 s | once a second, on the whole second |
| a scrolling chart, the slide frame | `linear` | the loop's measured period, at most 1.1 × it | once per sample, every 1 s or more |
| a scrolling chart, the rest frame | any | 0.01 | right before each slide |
| music levels | `linear` | 1.25 × the loop's real period | up to 15 a second ([Scenes and sound › Music levels](?p=scenes-and-sound#music-levels)) |
| a jump | any | 0 | when needed |

- `duration` runs from 0 to 10 seconds and is 0.4 until you set it; 0 shows the frame at once. For a move people should see, use 0.3 s or more.
- Send `duration` and `easing` with every frame: they belong to the face and are gone after a `reset` or `remove`.
- More than 2–3 frames a second to one button is wasted, unless the motion never stops.
- If a loop posts more than once a second, send all its posts over one open connection ([Scenes and sound › One connection for fast loops](?p=scenes-and-sound#one-connection-for-fast-loops)).
- An answer with `"dropped": true` means the phone is not reading: send less until the answers come without it ([Script API › Answers](?p=api#answers)).

How much motion one page can take:

| On one page | Fine |
|---|---|
| faces that rest between frames | dozens |
| faces that never rest, with a glide as long as the interval or longer | a handful, not a wall of them; one Large widget is better than many Normal ones that all move every second |
| a music spectrum | one |
| buttons that are not on screen | any number: they cost the phone nothing until they appear |

- On a face that never rests, paint the shapes that move with flat colors, and keep gradients, clips and masks on shapes that rest. A still rectangle that frames a moving chart, like the window in [Charts that scroll](?p=svg-faces#charts-that-scroll), is fine.
- Frames are small: the [CPU ring frame](#a-frame-built-to-glide) is 652 bytes, and a document can be up to 64 KB.
- On the Mac, a zsh loop takes a few MB of memory. Sample with `iostat`, `vm_stat` and `sysctl`, not `top`, which takes about 1.3 CPU-seconds per call.

## Text details

A `<text>` is one line in the system font. All its digits have the same width, so a changing number stays in place.

| Attribute | Values | Good to know |
|---|---|---|
| `x`, `y` | numbers | `x` is where the line starts (see `text-anchor`); `y` is its baseline (see `dominant-baseline`) |
| `dx`, `dy` | numbers or `em`, such as `dy=".35em"` | shift the line |
| `font-size` | a number (`px` and `pt` are dropped) | 16 if you leave it out; 0 or less draws at 12, so hide text with `opacity` instead |
| `font-weight` | `normal`, `regular`, `lighter`, 100–400 → regular; `500`, `medium` → medium; `600`, `semibold` → semibold; `bold`, `bolder`, 700–900 → bold | any other value keeps the inherited weight, with a warning |
| `text-anchor` | `start`, `middle`, `end` | `middle` centers the line on `x` |
| `dominant-baseline`, `alignment-baseline` | `auto`, `alphabetic`, `baseline`: on `y`; `middle`, `central`: centered on `y`; `hanging`, `text-before-edge`, `text-top`: capitals hang from `y` | `text-anchor="middle"` with `dominant-baseline="middle"` centers a value in a ring |
| `fill`, `fill-opacity`, `opacity` | `fill`: any supported color; the two opacities: 0 to 1 | black if you leave `fill` out: always set it |
| the words | one line of UTF-8 | spaces at both ends are trimmed; a line break and the spaces around it become one space; write `&amp;` for `&` and `&lt;` for `<` |

- Every `<text>` is drawn above every shape ([Drawn differently from a browser](#drawn-differently-from-a-browser)).
- To hide or fade a text that may hold an emoji, use `opacity`: an emoji keeps its own colors at any `fill-opacity`.
- Not drawn: `<tspan>` positions, wrapping, `font-family`, `font-style`, `text-decoration`, `letter-spacing`, `textLength` and strokes on text.
- Between frames the words change at once, while position, size, color and opacity glide. Keep `font-weight`, `text-anchor` and the baseline the same.
- For the smallest sizes, see [Sizes and scale](#sizes-and-scale). For a symptom you cannot place, see [Troubleshooting](?p=troubleshooting).
