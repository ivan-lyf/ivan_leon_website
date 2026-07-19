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
