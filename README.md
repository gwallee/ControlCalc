# Robot Calc

Shop-floor geometry calculator for robot integrators. Installable, offline
web app (PWA) — open it on a phone, add to home screen.

## Planned calcs

- **Triangle solver** — enter any 3 values; edit any field without
  clearing. The 3 most recently entered values are the inputs, the rest
  are solved. Shows each formula with your numbers substituted. Handles
  the ambiguous SSA case (shows both solutions).
- **Circle in a V** — center-to-vertex, vertex-to-contact, center height
  from included angle and radius.
- **Stack index** — row / column / layer (and X/Y/Z offset from pitch)
  from a part count. Row- or column-first, 0/1-based, serpentine.

## Run

Open `index.html` directly, or serve the folder over HTTPS to install it
as a PWA (offline via `sw.js`).

## Test

    node test/run-tests.js

## Triangle solver

Type values straight into the boxes on the triangle: a, b, c (sides) and
A, B, C (angles, degrees; side a is opposite angle A). Amber solid =
typed, blue dashed = solved. Typing into a solved box makes it an input;
the oldest typed value drops out. A third angle is skipped as an input (it
adds nothing without a side). The drawing is a regular triangle, or a right
triangle when one angle is exactly 90°, never to scale. It only reshapes
once you're done typing. ƒx Work jumps to formula → your numbers → result
for each solved value; Area · P shows area and perimeter.
