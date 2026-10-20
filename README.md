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

Two modes, picked at the top:

- **Right** — C is 90° (square corner, bottom right; c is the hypotenuse).
  Enter any 2 values, at least 1 side.
- **Any** — enter any 3 values, at least 1 side.

Type straight into the boxes on the triangle: angles inside the corners,
sides on the edges (side a is opposite angle A; angles in degrees). Amber
solid = typed, blue dashed = solved. Typing into a solved box makes it an
input; the oldest typed value drops out. Each mode keeps its own values.
ƒx Work jumps to formula → your numbers → result for each solved value;
Area · P shows area and perimeter.
