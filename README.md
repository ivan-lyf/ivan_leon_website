Ivan and Leon's personal websites

A shared 1984-Macintosh personal site. Each domain renders its owner's desktop;
the other person is an external link to their domain.

## Files
```
I-L-site/
├── index.html        # the shell: boot → shared login chooser → desktop
├── mac.css           # all styles (chassis, CRT, windows, icons, dither, gallery, lightbox)
├── mac.js            # ENGINE only — domain-agnostic (boot, login, window mgr,
│                     #   drag/resize, menus, control panel, gallery, lightbox)
├── profile-ivan.js   # Ivan's CONTENT — registers window.PROFILES.ivan
├── profile-leon.js   # Leon's CONTENT — registers window.PROFILES.leon (starter)
└── assets/
    ├── fonts/    # self-hosted Chicago + Monaco (woff2/woff)
    ├── projects/ # Rate My Dish, CS2 Tactics, GravitySandbox screenshots
    ├── rocket/   # UBC Rocket ground-control-station screenshots
    └── resume/   # Ivan_Luo_Resume.pdf
```
Pure HTML/CSS/JS — no build step. Open index.html or drop the folder on any static host.

**Engine vs. content.** `mac.js` knows nothing about Ivan or Leon — it renders
whatever profile is active. Each `profile-*.js` is pure data + document builders:
identity (`name`, `domain`, `email`), `projects`, document builders
(`about(P,O)`, `experience`, `resume`, `contact` — `P` is this profile, `O` is the
other person), and an `icons` array describing the desktop layout. To add a window,
add an icon entry (`doc:` for a document, `kind:"folder"|"harddrive"|"trash"`) and,
for documents, a matching builder function. Building Leon's side = filling in
`profile-leon.js`; `mac.js` and `mac.css` stay untouched.

## Images, the Macintosh way
Screenshots live inside the relevant project/experience window as a framed
"picture" filmstrip (`galleryHTML()` in mac.js, `.shots` styles in mac.css).
Thumbnails sit in a white matte with a black keyline and are monochrome at rest
to live in the 1-bit world; hovering shows full colour, and clicking opens the
picture enlarged in its own framed window (`openLightbox()` in mac.js, `.lightbox`
/ `.picwin` styles in mac.css) — full colour, dimmed desktop behind, dismissed by
the close box, a click outside, or Esc. Edit a profile's `projects[].shots` array or
its `rocketShots` to change which pictures appear.

## How the two-domain idea maps to this code
One codebase serves both domains. Both `profile-*.js` files load on both domains;
the engine picks the **owner** at startup and renders only their desktop:
- **Owner resolution** (`resolveOwnerId()` in mac.js):
  `location.hostname.includes("leon") ? "leon" : "ivan"`. The owner is `ACTIVE`,
  the other person is `OTHER`.
- **Shared login** (`showLogin()`): the engine builds the two cards from `ACTIVE`
  and `OTHER` — the owner is **THIS MAC** (boots their desktop), the other is
  **→ OTHER DISK** (hands off via `Mac.gotoOther()`).
- **Handoff** (`gotoOther()`): on a real domain it navigates to
  `https://<other>.domain`; on `localhost` it toggles sides in place with `?as=`.
- **Local preview:** `?as=ivan` or `?as=leon` forces a side without changing host —
  handy for editing Leon's page while developing on Ivan's machine.

## Status
Ivan's side is fully populated (`profile-ivan.js`): real About / Experience
(Ruboss + UBC Rocket) / Projects / Résumé / Contact, self-hosted Chicago + Monaco
fonts, and screenshot galleries. Wired:
- **Résumé download** — "Download PDF…" links `assets/resume/Ivan_Luo_Resume.pdf`.
- **Contact links** — yingfanluo@gmail.com, github.com/ivan-lyf, linkedin.com/in/ivan-yingfan-luo.

Leon's side (`profile-leon.js`) is a working starter — its own desktop (About,
Projects, Contact), title, and login card. Leon fills in `projects` and the
document builders; the engine already renders leonmeng.xyz from his hostname.

## Deploy (Vercel, single shared app)
1. Push this folder to a repo, import to Vercel (framework preset: Other / static).
2. Add both `ivanluo.xyz` and `leonmeng.xyz` as custom domains on the one project.
3. Point each registrar's DNS at Vercel; HTTPS is issued automatically.
4. Note: repointing ivan.xyz takes the old site offline after DNS propagates — keep a backup.

## Auth (only if you actually need it)
- Just you two editing your own pages → log in on your own domain only, no SSO.
- Visitors logging in once across both domains → needs real cross-domain SSO (a central
  auth domain both redirect to). That's the one part that's more than an afternoon.

## Controls (in-app)
✦ menu → **Control Panel**: Black & White ↔ Green Phosphor, CRT scanlines/glow on/off,
Live vs. marching-ants window dragging. Preferences persist in localStorage.
