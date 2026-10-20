# Robot Calc

Phone-first geometry calculator PWA for FANUC/robot integrators. Built by
Brian Jalufka (DAC Robotics) with Claude. Users know the math — keep UI
text terse, big touch targets (gloves), formulas over prose.

## Hard rules

- **Zero runtime dependencies.** Plain JS, no modules, no build step —
  must work from file:// and offline. Never add npm packages.
- **Never make the user clear inputs.** Every calc tracks which fields were
  typed (inputs) vs. solved (outputs); editing a field re-solves from the
  most recent inputs. Typed and solved values look different.
- **Show the work.** Every solved value can show its formula, then the
  formula with the user's numbers substituted, then the result.
- Keep math in pure functions (no DOM) so it can be tested with
  `node test/run-tests.js`.
- **Bump the build** in `js/version.js` on every pushed change.

## Conventions

- git: commits as Brian (`-c user.email=15891477+gwallee@users.noreply.github.com
  -c user.name="Brian Jalufka"`), imperative subject + body explaining why,
  "build N" line at the end.
