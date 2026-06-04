# Ivan and Leon's website

A personal site for two people, styled as a 1984 Macintosh. Each domain shows its
owner's desktop. The home page shows a 3D Macintosh with the live site running on
its screen; you can orbit it, then zoom in to actually use it.

## Project structure

```
.
├── index.html          # page shell: 3D scene + the Mac OS markup it renders
├── mac-scene.js        # the 3D Macintosh (Three.js)
├── front-logo.png      # badge texture used in the 3D scene
├── mac.js              # the OS engine: boot, login, windows, menus, control panel
├── mac.css             # all styles (chassis, CRT, windows, icons, dither)
├── profile-ivan.js     # Ivan's content -> window.PROFILES.ivan
├── profile-leon.js     # Leon's content -> window.PROFILES.leon
└── assets/
    ├── fonts/          # self-hosted Chicago and Monaco
    ├── projects/       # project screenshots
    ├── rocket/         # UBC Rocket screenshots
    ├── sidehustle/     # misc photos
    ├── resume/         # Ivan_Luo_Resume.pdf
    └── apple.png       # Leon's desktop wallpaper
```

It is plain HTML, CSS, and JavaScript with no build step. Open `index.html`, or put
the folder on any static host.

(`macintosh (1).glb` is an older 3D model that the current scene does not use.)

## Engine and content

`mac.js` is the engine. It does not know anything about Ivan or Leon; it just renders
whichever profile is active. Each `profile-*.js` is data plus a few small functions:
identity (`name`, `domain`, `email`), a `projects` list, document builders
(`about`, `experience`, `contact`, and so on), and an `icons` array that lays out the
desktop.

To add a window, add an icon entry (`doc:` for a document, or `kind: "folder" |
"harddrive" | "trash"`) and, for documents, a matching builder function. Filling out
a person's side means editing their profile file. `mac.js` and `mac.css` stay the same.

## The 3D front end

`index.html` renders the live site onto a 3D Macintosh built in `mac-scene.js`
(Three.js, loaded from a CDN). `html-to-image` copies the on-screen DOM to a texture
on the curved glass, and clicks are mapped back onto it. Drag to orbit, scroll in to
enter (the screen scales up so you can use it directly), and press Esc to exit.

To run the plain 2D version instead, point a page at the Mac OS markup and the three
scripts (`profile-ivan.js`, `profile-leon.js`, `mac.js`) without the scene.

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
