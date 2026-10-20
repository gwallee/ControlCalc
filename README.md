# Robot Calc

Shop-floor geometry calculator for robot integrators. Installable, offline
web app (PWA) — open it on a phone, add to home screen.

## Planned calcs

- **Triangle solver** — enter any 3 values; edit any field without
  clearing. The 3 most recently entered values are the inputs, the rest
  are solved. Shows each formula with your numbers substituted. Handles
  the ambiguous SSA case (shows both solutions).
- **Circle in V** — round part in a V nest: enter any 2 of included angle,
  radius/diameter, and the distances from the vertex; the rest are solved.
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

## Circle in V

For picking a round part out of a V nest. Enter any 2 values; all distances
are from the V's vertex:

| | |
|---|---|
| θ | included angle of the V |
| D | part diameter (r = D / 2 is solved, no box) |
| d | vertex → part center, along the center line: `r / sin(θ/2)` |
| t | vertex → contact point, along a face: `r / tan(θ/2)` |
| g | vertex → part bottom: `d − r` |
| h | vertex → part top: `d + r` |
| w | contact span, under More: `2·t·sin(θ/2)` |
| e | contact height above the vertex, under More: `t·cos(θ/2)` |

w and e are letters on the drawing only; their values are under More.
