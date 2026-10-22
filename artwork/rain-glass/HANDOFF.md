# Rain on glass: gravity pass

This replaces `shared/penthouse-weather.js`. Only the wet-glass shader changed; the falling rain, curtains, capture pass and API are unchanged.

## What changed
- **Arrivals come from above.** The old impact was a radial crown, which reads as rain hitting the window head-on. Now each drop lands with a short downward smear, settles into a bead that grows as it merges, and then slides off down the pane with its own short trail.
- **Runners.** Heavy drops break away and run down the glass with stick-slip motion, following a meandering path. Each leaves a long wet trail (0.5–2 m) that thins, breaks into a dotted line, drops residual beads and dries over about 4–16 s. The head is a bottom-heavy, elongated drop that gathers briefly before it moves. Runners clear the settled beads along their track.
- **Settled beads** sag slightly (taller than wide, heavier at the bottom) and have a darker meniscus at the bottom edge.
- **Wet trails as lenses.** Each trail strip shows a compressed, inverted image of the city, dark edges and a specular line, so it reads against the dark backdrop.
- **Distance.** Every feature still fades once narrower than a pixel, so the existing 2–4.1 m fade and the anti-aliasing guarantees are kept.

## Drop optics (revision 2)
Large drops are now modelled as plano-convex lenses on vertical glass:
- **Shape**: pendant, with a flatter crown, heavier rounded belly and an irregular contact line (a low-order wobble, seeded per drop).
- **Optics**: the centre shows a small inverted, wide-angle image of the city, with faint chromatic fringing. The steep margin goes dark from total internal reflection, thickest at the belly. A bright caustic crescent forms inside the bottom edge, and a thin rim catches light at the contact line. There's a sharp specular point high on the dome plus a faint secondary one low on the opposite side.
- **Size blend**: drops blend from a simple refracting dot (a few pixels) to the full lens model (about 14 px radius and up), so small and distant drops stay clean.

## API
- New: `quality.runRate` (default 1) and `setGlassTest({runRate})` multiply runner speed.
- `impactRate` now controls how often drops arrive. The default rhythm is slower than before because beads now live longer and slide.

## Cost
Runners are evaluated at two column scales, two slots each. Per fragment that's about 4 runner evaluations plus up to 4 trail beads, on top of the existing bead and arrival loops. It only runs on glass within 4.1 m of the camera.
