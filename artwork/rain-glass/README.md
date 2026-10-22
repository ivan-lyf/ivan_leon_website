# Wet-glass rain integration

Integrated locally on 2026-10-22 from the user-supplied `rain.zip`.

- Runtime: `shared/penthouse-weather.js`.
- Original package notes: [HANDOFF.md](HANDOFF.md), preserved as supplied.
- SHA-256 of the supplied weather source: `decafa3efb08fc83b7fdbbfb8eb0419097f29281e6396795f595773c7b99390d`.

The effect adds downward arrivals, pendant-shaped droplets, meandering runners, wet trails that thin and dry, and residual beads. Larger resolved drops have inverted refraction, a dark meniscus, restrained chromatic fringing, a caustic crescent and small highlights. Existing exterior rainfall, lightning, capture scheduling, distance fade and secondary-camera suppression are retained.

## Integration adjustments

Reversed GLSL `smoothstep` edges were rewritten with ordered edges and an inverted result. Gaussian terms now square signed distances directly instead of passing a negative base to `pow`. The drop-center angle is guarded against `atan(0, 0)`. These preserve the intended formulas while avoiding undefined values that can contaminate HDR bloom.

Two conservative shortcuts skip zero-contribution work: small droplets whose detailed optical blend is zero return after the simple refraction sample, and fragments outside a runner's complete influence skip its trail/head calculations. The latter uses the bounded path displacement (0.0095m) plus the widest influence (the head's 3-radius clearing field), with a small numerical margin. Film drying does not truncate the longer-lived clearing or residual beads. Pane resolution, density, capture quality and scene appearance settings are unchanged.

`quality.runRate` defaults to 1 and accepts 0. `setGlassTest({runRate})` updates all three panes independently of arrival frequency. It is a developer inspection hook, not an additional UI control.

## Verification

Run `node tests/weather-capture.cjs` for quality defaults, shared live uniforms, capture scheduling, renderer-state restoration and camera/aspect coverage.

Run `node tests/shader-finiteness.cjs --suite rain-glass --rea /path/to/rea --browser /path/to/chrome` for actual wet-glass HDR rendering. It covers close front, oblique, left and right views; multiple times and runner speeds; raw/composited output; frozen animation; capture-camera matching; and distance/grazing fades. The optional `--source-root` supports comparison against a saved source snapshot.
