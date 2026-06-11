# Ivan and Leon's website

A personal site for two people, styled as a 1984 Macintosh. Each domain shows its
owner's desktop. The home page shows a 3D Macintosh with the live site running on
its screen; you can orbit it, then zoom in to actually use it.

## Project structure

The repo is split by ownership: shared engine code lives in `shared/`, and each
person's content + assets live in their own directory.

```
.
├── index.html            # page shell: 3D scene + the Mac OS markup it renders
├── api/
│   └── leetcode.js       # Vercel serverless proxy for Leon's live LeetCode stats
├── shared/               # the engine — knows nothing about Ivan or Leon
│   ├── mac-scene.js      # the 3D Macintosh, desk, room, keyboard, lamp (Three.js)
│   ├── mac.js            # the OS engine: boot, login, windows, menus, control panel
│   ├── mac.css           # all styles (chassis, CRT, windows, icons, dither)
│   └── assets/
│       ├── fonts/        # self-hosted Chicago and Monaco
│       ├── models/       # low-poly skis (GLB)
│       └── textures/     # PBR wood / concrete maps for the 3D desk
├── ivan/
│   ├── profile.js        # Ivan's content -> window.PROFILES.ivan
│   └── assets/
│       ├── projects/     # project screenshots
│       ├── rocket/       # UBC Rocket screenshots
│       ├── leanpub/      # Leanpub iOS v3 screenshots (Ruboss)
│       ├── sidehustle/   # misc photos
│       └── resume/       # Ivan_Luo_Resume.pdf
└── leon/
    ├── profile.js        # Leon's content -> window.PROFILES.leon
    └── assets/
        ├── resume/       # leon-resume.html
        └── apple.png     # Leon's desktop wallpaper
```

It is plain HTML, CSS, and JavaScript with no build step. Serve the folder and open
`index.html`, or put it on any static host.

## Engine and content

`shared/mac.js` is the engine. It does not know anything about Ivan or Leon; it just
renders whichever profile is active. Each `<person>/profile.js` is data plus a few
small functions: identity (`name`, `domain`, `email`), a `projects` list, document
builders (`about`, `experience`, `contact`, and so on), and an `icons` array that lays
out the desktop. Optional profile flags: `critters: false` / `deskNotes: false` turn
off the wandering desktop critters and the periodic note pop-ups (Leon's side does
both), and `github: "<username>"` adds a menubar tab with a live GitHub contributions
widget (Ivan's side).

To add a window, add an icon entry (`doc:` for a document, or `kind: "folder" |
"harddrive" | "trash"`) and, for documents, a matching builder function. Filling out
a person's side means editing their profile file. `shared/mac.js` and `shared/mac.css`
stay the same.

## The 3D front end

`index.html` renders the live site onto a 3D Macintosh built in `shared/mac-scene.js`
(Three.js, loaded from a CDN). `html-to-image` copies the on-screen DOM to a texture
on the curved glass, and clicks are mapped back onto it. Drag to orbit, scroll in a
little to enter — the camera swings around to face the screen head-on and glides in,
then the screen scales up so you can use it directly. Press Esc to exit.

To run the plain 2D version instead, point a page at the Mac OS markup and the three
scripts (`ivan/profile.js`, `leon/profile.js`, `shared/mac.js`) without the scene.

## Screenshots

Project screenshots appear inside that project's window as a small framed strip. They
are monochrome at rest, show color on hover, and open enlarged in their own window when
clicked (dismiss with the close box, a click outside, or Esc). Change which images
appear by editing a profile's `projects[].shots`.

## Two domains, one codebase

Both profile files load on both domains. At startup the engine picks the owner from the
hostname (`leonmeng.xyz` is Leon, anything else is Ivan) and shows only that desktop.
The login screen lists both people: the owner is "this Mac," and choosing the other
person sends you to their domain. On `localhost` it switches sides in place instead of
navigating.

## Running locally

Serve the folder and open it:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

Add `?as=leon` or `?as=ivan` to force a side without changing the hostname. This is
useful for editing one person's page while working on the other's machine.

## Deploying (Vercel)

1. Push the repo and import it to Vercel as a static project (no framework, no build).
2. Add both `leonmeng.xyz` and `ivanluo.xyz` as domains on the one project.
3. Point each registrar's DNS at Vercel. HTTPS is issued automatically.

## Controls

Apple menu, then Control Panel: black and white or green phosphor, CRT scanlines on or
off, and live or outline window dragging. Leon's desktop also has a Now Playing widget
that shows one song per visit. Settings are saved in the browser.
