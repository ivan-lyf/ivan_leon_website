/* ============================================================
   Profile — Leon (leon.xyz)
   Starter content. Leon: fill in `projects`, the document builders,
   and the icon list — same shape as profile-ivan.js.
   Document builders receive (P, O): P = this profile, O = the other person.
   ============================================================ */
(function () {
  "use strict";

  // Leon's projects go here — same shape as Ivan's. Empty for now.
  const projects = [
    // {
    //   id: "example", name: "Example Project", icon: "g-doc",
    //   blurb: "What it is and what you built.",
    //   stack: ["Tech", "Stack"], info: "Web · 2026",
    //   links: [{ label: "GitHub", href: "https://github.com/..." }],
    //   shots: [{ src: "assets/leon/example-01.png", cap: "Screen" }],
    // },
  ];

  function about(P, O) {
    return `
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div class="photo-dither"><div class="cap">[ leon ]</div></div>
        <div style="flex:1 1 180px;min-width:170px;">
          <h2>${P.fullName}</h2>
          <p style="font-family:'Monaco',monospace;font-size:13px;margin-top:-4px;">${P.tagline}</p>
          <p>Welcome to my corner of the network. This desktop is still booting up — more soon.</p>
        </div>
      </div>
      <hr class="dotrule">
      <h3>About this disk</h3>
      <p>This is ${P.name}'s side of a shared 1984-Macintosh site. The other person lives on a separate disk — open Contact to jump over.</p>
      <hr class="dotrule">
      <p style="font-family:'Monaco',monospace;font-size:13px;">
        Reach me at <a href="mailto:${P.email}">${P.email}</a>.
      </p>`;
  }

  function contact(P, O) {
    return `
      <h2 style="text-align:center;">Get in Touch</h2>
      <hr class="rule">
      <p><strong>Email</strong><br><a href="mailto:${P.email}">${P.email}</a></p>
      <p><strong>GitHub</strong><br><a href="https://github.com/ggttlplp201" target="_blank" rel="noopener">github.com/ggttlplp201</a></p>
      <hr class="dotrule">
      <p style="font-family:'Monaco',monospace;font-size:13px;text-align:center;">
        Looking for ${O.name}?<br>
        <a href="#" onclick="Mac.gotoOther();return false;">→ ${O.domain}</a>
      </p>`;
  }

  const icons = [
    { id: "harddrive", kind: "harddrive", label: "Leon's Mac", glyph: "g-hd", corner: "tr",
      title: "Leon's Mac", info: "3 items · 512K in disk · 480K available", size: { w: 360, h: 270 } },
    { id: "about", doc: "about", label: "About Me", glyph: "g-doc", x: 24, y: 14,
      title: "About Me", info: "About · 8K", size: { w: 440, h: 340 } },
    { id: "projects", kind: "folder", label: "Projects", glyph: "g-folder", x: 24, y: 120,
      title: "Projects", info: "0 items · 0K in folder", size: { w: 360, h: 240 } },
    { id: "contact", doc: "contact", label: "Contact", glyph: "g-mail", corner: "tr3",
      title: "Contact", info: "Contact · 8K", size: { w: 360, h: 320 } },
    { id: "trash", kind: "trash", label: "Trash", glyph: "g-trash", corner: "br",
      title: "Trash", info: "Empty", size: { w: 320, h: 260 } },
  ];

  window.PROFILES = window.PROFILES || {};
  window.PROFILES.leon = {
    id: "leon",
    name: "Leon",
    fullName: "Leon Meng",
    tagline: "Building things",
    domain: "leon.xyz",
    email: "hello@leon.xyz",
    machineName: "Leon's Mac",
    avatarGlyph: "avatar",
    projects,
    about,
    contact,
    icons,
  };
})();
