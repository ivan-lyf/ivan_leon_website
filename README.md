Ivan × Leon's personal websites

A shared 1984-Macintosh personal site. Each domain renders its owner's desktop;
the other person is an external link to their domain.

## Files
```
I-L-site/
├── index.html   # the page: boot → login chooser → desktop
├── mac.css      # all styles (chassis, CRT, windows, icons, dither, image gallery)
├── mac.js       # engine (boot, login, window mgr, drag/resize, menus, control panel, content)
└── assets/
    ├── fonts/    # self-hosted Chicago + Monaco (woff2/woff)
    ├── projects/ # Rate My Dish, CS2 Tactics, GravitySandbox screenshots
    ├── rocket/   # UBC Rocket ground-control-station screenshots
    └── resume/   # Ivan_Luo_Resume.pdf
```
Pure HTML/CSS/JS — no build step. Open index.html or drop the folder on any static host.

## Images, the Macintosh way
Screenshots live inside the relevant project/experience window as a framed
"picture" filmstrip (`galleryHTML()` in mac.js, `.shots` styles in mac.css).
Thumbnails sit in a white matte with a black keyline and are monochrome at rest
to live in the 1-bit world; hovering shows full colour, and clicking enlarges the
picture in place (full width, full colour). Edit a project's `shots: [...]` array
or `ROCKET_SHOTS` to change which pictures appear.

## How the two-domain idea maps to this code
- **Login chooser** (`#login` in index.html): two cards — Ivan (THIS MAC) and Leon (→ OTHER DISK).
- Picking **Ivan** boots his desktop. Picking **Leon** calls `Mac.gotoLeon()` in mac.js,
  which currently shows a demo dialog. For production, replace that body with:
  `window.location.href = "https://leon.xyz";`
- To make this domain-aware (one codebase, both domains), branch on the hostname:
  `const owner = location.hostname.includes("leon") ? "leon" : "ivan";`
  and render the matching desktop + the opposite person's link.

## Status
Ivan's side is fully populated from his résumé and the old portfolio site:
real About / Experience (Ruboss + UBC Rocket) / Projects / Résumé / Contact,
self-hosted Chicago + Monaco fonts, and screenshot galleries. Wired:
- **Résumé download** — "Download PDF…" links `assets/resume/Ivan_Luo_Resume.pdf`.
- **Contact links** — yingfanluo@gmail.com, github.com/ivan-lyf, linkedin.com/in/ivan-yingfan-luo.

Still a stub (Leon's side — intentionally untouched):
- **Leon handoff** — `gotoLeon()` in mac.js shows a demo dialog. For production,
  replace its body with `window.location.href = "https://leon.xyz";`.

## Deploy (Vercel, single shared app)
1. Push this folder to a repo, import to Vercel (framework preset: Other / static).
2. Add both `ivan.xyz` and `leon.xyz` as custom domains on the one project.
3. Point each registrar's DNS at Vercel; HTTPS is issued automatically.
4. Note: repointing ivan.xyz takes the old site offline after DNS propagates — keep a backup.

## Auth (only if you actually need it)
- Just you two editing your own pages → log in on your own domain only, no SSO.
- Visitors logging in once across both domains → needs real cross-domain SSO (a central
  auth domain both redirect to). That's the one part that's more than an afternoon.

## Controls (in-app)
✦ menu → **Control Panel**: Black & White ↔ Green Phosphor, CRT scanlines/glow on/off,
Live vs. marching-ants window dragging. Preferences persist in localStorage.
