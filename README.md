# Control Calc

Shop-floor calculator for controls engineers and robot integrators.
Installable, offline web app (PWA) — open it on a phone, add to home
screen.

## Calcs

- **Triangle solver** — enter any 3 values; edit any field without
  clearing. The 3 most recently entered values are the inputs, the rest
  are solved. Shows each formula with your numbers substituted. Handles
  the ambiguous SSA case (shows both solutions).
- **Circle in V** — round part in a V nest, or a rod held between two V
  gripper jaws: enter any 2 of included angle, diameter, and the distances
  from the vertex (or vertex to vertex); the rest are solved.
- **Stack** — part # ↔ col / row / layer for placing parts in a grid, with
  optional layers, serpentine, and XYZ offsets from a pitch.
- **Line** — two points (line ends or rectangle corners) ↔ length / width,
  line length and angle; N evenly spaced points along the line.
- **Screw** — ball screw thrust from motor torque, gear ratio, lead and
  efficiency, or any of those from the others.
- **Scale** — linear scaling of a value from an input range to an output
  range (e.g. 4–20 mA → 0–500), and back.

## Run

Open `index.html` directly, or serve the folder over HTTPS to install it
as a PWA (offline via `sw.js`). An installed copy picks up a new build on
its own: once it has downloaded, the page reloads onto it.

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

**V gripper** — a rod held between two facing V jaws, worked straight in
D and S (S = vertex to vertex):

    D = S·sin(θ/2)    t = D / (2·tan(θ/2))    g = (S − D) / 2

Enter S and θ to get the rod diameter, or D and θ to get the S the jaws
close to; any 2 of θ, D, S, t, g work. Each mode keeps its own values.

## Stack

For placing parts in a grid with a robot while tracking only the part
count. Enter columns C and rows R, then either the part # n (col / row /
layer solve) or a position (n solves). Leave the second dimension blank
(R when filling across, C when filling down) for no layers.

n counts parts already on the stack, so the first spot is n = 0 (switch
to "1st part = 1" if you number from 1). Positions are always 1-based.
Formulas, shown in FANUC TP style (DIV / MOD), filling across:

    col   = n MOD C + 1
    row   = (n DIV C) MOD R + 1
    layer = n DIV (C·R) + 1
    n     = (layer − 1)·C·R + (row − 1)·C + col − 1

With no layers: `row = n DIV C + 1`. Filling down swaps the roles of
col / C and row / R. With 1st part = 1, n becomes (n − 1).

- **Serpentine** — every even row (col, filling down) runs back:
  `col = C − n MOD C`. Each layer starts again at 1,1.
- **XYZ** — enter pitches px / py / pz (negative for direction):
  `X = (col − 1)·px`, `Y = (row − 1)·py`, `Z = (layer − 1)·pz`.

## Line

Two points P1 (x1, y1) and P2 (x2, y2): the ends of a line, or the
diagonal corners of a rectangle. Any 4 values that fix the line solve it,
for example both points, or P1 plus a length and angle.

| | |
|---|---|
| L, W | rectangle length / width, signed: `x2 − x1`, `y2 − y1` |
| D | line length / diagonal: `√(L² + W²)` |
| θ | line angle, CCW from +X, −180°…180°: `atan2(W, L)` |
| P3, P4 | the other corners, as x, y: `(x2, y1)`, `(x1, y2)` |
| cx, cy, area | center and area, under More |

D with L (or W) has two answers, the other side pointing either way; a
toggle picks one.

**Points** spaces N points evenly from P1 to P2, both ends included, and
lists each one's x / y:

    sx = L / (N − 1),  sy = W / (N − 1)
    x_k = x1 + (k − 1)·sx,  y_k = y1 + (k − 1)·sy,  k = 1 … N

## Screw

Ball screw thrust. Enter any 4 of the 5 and the last one solves (torque →
thrust, or the torque a push force needs, or the lead, ratio or
efficiency):

    F = 2π·(η/100)·i·T / p      (p/1000 with N·m, mm, N)

| | |
|---|---|
| T | motor torque: N·m, lbf·in, lbf·ft or oz·in |
| i | gear ratio, motor turns per screw turn (2 = 2:1 reduction) |
| p | screw lead, per screw turn: mm or in |
| η | efficiency, % |
| F | thrust: N, lbf or kgf |

**Units** picks each one. Changing a unit converts the value already in
that box, so it still means the same amount; mixed units fold into a
single factor on p in the formula.

## Scale

Linear scaling, as in a PLC CPT:

    Out = (In − InMin) / (InMax − InMin) · (OutMax − OutMin) + OutMin

Enter the input and output ranges, then In (or Out, to work back to the
In that gives it). Also shows the INT a Logix MOV REAL → INT stores
(nearest, ties to even) and the line as gain / offset, `Out = m·In + b`.
Keep the result tag a REAL in the PLC and move it to an INT after.
