/* ============================================================
   Profile — Leon (leonmeng.xyz)
   Starter content. Leon: fill in `projects`, the document builders,
   and the icon list — same shape as ivan/profile.js.
   Document builders receive (P, O): P = this profile, O = the other person.
   ============================================================ */
(function () {
  "use strict";

  const projects = [
    {
      id: "garderobe", name: "GARDEROBE", icon: "g-doc",
      blurb: "A personal wardrobe manager and living archive for your clothes — catalog what you own, log wears and spend, build outfits on a visual mannequin, and keep a wishlist with live price tracking scraped from Grailed, SSENSE, and more. Upload a photo and Claude auto-tags the item while an in-browser ML model removes the background; an interactive 3D globe lets you explore other users' collections. Fully functional and running in production.",
      stack: ["React", "Supabase", "FastAPI", "Claude API"],
      info: "Web · live",
      links: [
        { label: "Live site", href: "https://the-garderobe.com/" },
        { label: "GitHub", href: "https://github.com/ggttlplp201/GARDER0BE" },
      ],
      shots: [],
    },
    {
      id: "drafted", name: "Drafted", icon: "g-doc",
      blurb: "A real-time champion-select overlay for League of Legends. It hooks into the local League client (LCU API) to auto-read picks, bans, and your role the moment draft starts, then surfaces data-driven recommendations — meta strength, counters, synergies, builds, runes, and win-rate-by-game-length — scraped live from Lolalytics, all in a floating Electron window that stays on top during champion select.",
      stack: ["Python", "Flask", "Electron", "SSE"],
      info: "Desktop · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/Drafted" }],
      shots: [],
    },
    {
      id: "drop-tracker", name: "Drop Tracker", icon: "g-doc",
      blurb: "An automated drop monitor for streetwear and resale shops. It polls Shopify storefronts (Anti Promo, Luke's, 2nd Street USA, and others) for newly listed products and fires a Discord notification — with title, price, and image — the moment something new drops. Runs as a scheduled worker on Railway.",
      stack: ["Python", "BeautifulSoup", "Discord", "Railway"],
      info: "Automation · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/Drop-Tracker" }],
      shots: [],
    },
    {
      id: "mylisp", name: "mylisp", icon: "g-doc",
      blurb: "A tree-walking interpreter for a Scheme-flavored Lisp, written in Python with no runtime dependencies — special forms, arbitrary-precision integers, a Lisp-defined prelude (map/filter/fold), file loading, and a REPL with persistent history. Built as an experiment in autonomous-agent harness engineering: the source was written end-to-end by AI coding agents with no human edits.",
      stack: ["Python", "Scheme", "Interpreter"],
      info: "Languages · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/mylisp" }],
      shots: [],
    },
  ];

  function about(P, O) {
    return `
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div class="photo-dither"><div class="cap">[ leon ]</div></div>
        <div style="flex:1 1 180px;min-width:170px;">
          <h2>${P.fullName}</h2>
          <p class="meta">${P.tagline}</p>
          <p>I'm a first-year Computer Engineering student at UC Irvine. I've been building robots for the past four years, and I'm genuinely passionate about it.</p>
        </div>
      </div>
      <hr class="dotrule">
      <h3>Robotics</h3>
      <p>Four years competing in FIRST Tech Challenge (teams 16031 &amp; 16205) — chassis and mechanism design, custom 3D-printed parts, and the control code that ties it all together. These days I'm prototyping an autonomous wall-plastering robot.</p>
      <hr class="dotrule">
      <h3>Off the clock</h3>
      <p>Outside the classroom I'm a ski instructor, and I spend most of my weekends in the mountains.</p>
      <hr class="dotrule">
      <p>Reach me at <a href="mailto:${P.email}">${P.email}</a>.</p>`;
  }

  function contact(P, O) {
    return `
      <h2 style="text-align:center;">Get in Touch</h2>
      <hr class="rule">
      <p><strong>Email</strong><br><a href="mailto:${P.email}">${P.email}</a></p>
      <p><strong>GitHub</strong><br><a href="https://github.com/ggttlplp201" target="_blank" rel="noopener">github.com/ggttlplp201</a></p>
      <p><strong>LinkedIn</strong><br><a href="https://www.linkedin.com/in/leonylmeng/" target="_blank" rel="noopener">linkedin.com/in/leonylmeng</a></p>
      <p><strong>LeetCode</strong><br><a href="https://leetcode.com/u/brownguest3123/" target="_blank" rel="noopener">leetcode.com/u/brownguest3123</a></p>
      <hr class="dotrule">
      <p class="meta" style="text-align:center;">
        Looking for ${O.name}?<br>
        <a href="#" onclick="Mac.gotoOther();return false;">→ ${O.domain}</a>
      </p>`;
  }

  function resume(P, O) {
    return `
      <h2 style="text-align:center;">${P.fullName}</h2>
      <p class="meta" style="text-align:center;">${P.email} · 949-738-8015</p>
      <p style="text-align:center;"><a href="leon/assets/resume/leon-resume.html" target="_blank" rel="noopener">Open full résumé →</a></p>
      <hr class="rule">

      <h3>Technical Skills</h3>
      <p><strong>Languages</strong><br>Java, Python, JavaScript, HTML, CSS, SQL</p>
      <p><strong>Tools</strong><br>Git, GitHub Actions, Docker, IntelliJ IDEA, Supabase, PostgreSQL, REST APIs, Fusion 360, 3D printing</p>
      <p><strong>Cloud &amp; DevOps</strong><br>CI/CD pipelines, containerized deploys (Docker), cloud hosting (Railway, Netlify)</p>
      <hr class="dotrule">

      <h3>Experience</h3>
      <p><strong>Mechanical Engineer &amp; Robot Operator</strong> — FTC Teams 16031 &amp; 16205</p>
      <p class="meta">Oct 2021 – Jun 2025 · Vancouver, BC</p>
      <p>• Led design &amp; fabrication of the robot chassis, drivetrain, arm pivot, and scoring mechanism<br>
         • Designed custom 3D-printed parts in Fusion 360 and integrated them onto the robot<br>
         • Contributed robot-control code and the Engineering Portfolio on GitHub<br>
         • Top-scoring team — multiple awards at BC &amp; Alberta championships</p>
      <hr class="dotrule">

      <h3>Projects</h3>
      <p><strong>Plastering Robot</strong> — Autonomous Construction Robotics</p>
      <p class="meta">Jan 2026 – ongoing · Irvine, CA</p>
      <p>• Prototyped an autonomous wall-plastering system for consistent material deposition &amp; finishing<br>
         • Modeled mechanical &amp; motion systems in CAD — linear actuation, guided multi-axis movement<br>
         • Defined system architecture &amp; constraints with a multidisciplinary team</p>
      <p><strong>GARDEROBE</strong> — Full-Stack Wardrobe Web App</p>
      <p class="meta">Jan 2026 – ongoing · Irvine, CA</p>
      <p>• React SPA + Python/FastAPI backend exposing RESTful AI-tagging &amp; background-removal endpoints<br>
         • Dockerized backend, cloud-deployed; CI/CD via GitHub Actions (ESLint, Ruff, Vite build)<br>
         • Supabase (PostgreSQL) auth, queries &amp; storage with row-level security policies</p>
      <hr class="dotrule">

      <h3>Awards</h3>
      <p>• USACO Gold Division (2023)</p>
      <hr class="dotrule">

      <h3>Education</h3>
      <p><strong>University of California, Irvine</strong></p>
      <p class="meta">B.S. Computer Engineering · 2025–2029 · Irvine, CA</p>`;
  }

  /* ---------- live LeetCode stats (via /api/leetcode serverless proxy) ---------- */
  let lcData = null, lcFetching = false;
  function lcRender(d) {
    if (!d || d.error) return `<p class="meta" style="text-align:center;">Couldn't reach LeetCode right now — try again shortly.</p>`;
    return `
      <p style="text-align:center;font-size:40px;line-height:1;margin:8px 0 0;"><strong>${d.total}</strong></p>
      <p class="meta" style="text-align:center;margin-top:2px;">problems solved</p>
      <hr class="dotrule">
      <p><strong>Easy</strong><br>${d.easy}</p>
      <p><strong>Medium</strong><br>${d.medium}</p>
      <p><strong>Hard</strong><br>${d.hard}</p>
      <hr class="dotrule">
      <p class="meta">Global ranking · #${d.ranking ? Number(d.ranking).toLocaleString() : "—"}</p>`;
  }
  function lcFetch() {
    if (lcFetching) return;
    lcFetching = true;
    fetch("/api/leetcode")
      .then((r) => r.json())
      .then((d) => { lcData = d; const e = document.getElementById("lc-stats"); if (e) e.innerHTML = lcRender(d); })
      .catch(() => { lcData = { error: true }; const e = document.getElementById("lc-stats"); if (e) e.innerHTML = lcRender(lcData); });
  }
  function leetcode(P, O) {
    if (!lcData) lcFetch();   // fetch lazily the first time the window opens
    return `
      <h2 style="text-align:center;">LeetCode</h2>
      <p class="meta" style="text-align:center;"><a href="https://leetcode.com/u/brownguest3123/" target="_blank" rel="noopener">@brownguest3123 →</a></p>
      <hr class="rule">
      <div id="lc-stats">${lcData ? lcRender(lcData) : `<p class="meta" style="text-align:center;">Fetching live stats…</p>`}</div>`;
  }

  const icons = [
    { id: "harddrive", kind: "harddrive", label: "Leon's Device", glyph: "g-hd", corner: "tr",
      title: "Leon's Device", info: "5 items · 512K in disk · 480K available", size: { w: 360, h: 270 } },
    { id: "about", doc: "about", label: "About Me", glyph: "g-doc", x: 24, y: 14,
      title: "About Me", info: "About · 8K", size: { w: 440, h: 340 } },
    { id: "projects", kind: "folder", label: "Projects", glyph: "g-folder", x: 24, y: 120,
      title: "Projects", info: "4 items · 96K in folder", size: { w: 380, h: 300 } },
    { id: "garderobe-site", kind: "link", href: "https://the-garderobe.com/", label: "GARDEROBE",
      glyph: "g-globe", x: 24, y: 226, title: "GARDEROBE" },
    { id: "leetcode", doc: "leetcode", label: "LeetCode", glyph: "g-doc", x: 24, y: 332,
      title: "LeetCode", info: "Stats · live", size: { w: 360, h: 320 } },
    { id: "resume", doc: "resume", label: "Résumé", glyph: "g-resume", corner: "tr2",
      title: "Résumé", info: "Résumé · 12K", size: { w: 480, h: 460 } },
    { id: "contact", doc: "contact", label: "Contact", glyph: "g-mail", corner: "tr3",
      title: "Contact", info: "Contact · 8K", size: { w: 360, h: 360 } },
    { id: "trash", kind: "trash", label: "Trash", glyph: "g-trash", corner: "br",
      title: "Trash", info: "Empty", size: { w: 320, h: 260 } },
  ];

  // Curated "Now Playing" list — the widget shows one random pick per page load.
  const nowPlaying = [
    { title: "Pop Pop", artist: "Sparrow & Barbossa, Von Boch, KZ", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c3b936025d936bfa83a1ab78", url: "https://open.spotify.com/track/3AUs97dQW2Q0TmwLB5J8st" },
    { title: "Sabu", artist: "Ginton, Oumou Sangaré, Palane", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02aa683de6136ad7e6af54417b", url: "https://open.spotify.com/track/4KG3SAPJbEvNOVO7VsqJBr" },
    { title: "Libertad", artist: "Alastair Lane", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02851e0733305d2467da458964", url: "https://open.spotify.com/track/3jqBsgfhzYYyl1kwj571f5" },
    { title: "You", artist: "Lane 8, Kasablanca", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0207c935007c81beea6ac0b6a6", url: "https://open.spotify.com/track/1KCMF9fdF7sNE74R2V46af" },
    { title: "Apple", artist: "Charli xcx", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02f88b43d15fd14e9525338b59", url: "https://open.spotify.com/track/19RybK6XDbAVpcdxSbZL1o" },
    { title: "can't slow down", artist: "almost monday", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02aa21e4d3d70419011eac3ccc", url: "https://open.spotify.com/track/15IF4wSCMrAo2Rq0eytARR" },
    { title: "Fantasy (feat. Franc Moody)", artist: "Cosmo's Midnight, Franc Moody", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e024fe0e5c96625af7039cda926", url: "https://open.spotify.com/track/6AVAhgUJ3nnDzO2l9oJnpQ" },
    { title: "MIA (feat. Drake)", artist: "Bad Bunny, Drake", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02519266cd05491a5b5bc22d1e", url: "https://open.spotify.com/track/116H0KvKr2Zl4RPuVBruDO" },
    { title: "Cold Heart - PNAU Remix", artist: "Elton John, Dua Lipa, PNAU", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02eb842acacb3238b2bf3b8471", url: "https://open.spotify.com/track/7rglLriMNBPAyuJOMGwi39" },
    { title: "Down Under", artist: "Men At Work", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02aa5e4c9da271951ac0b31fa2", url: "https://open.spotify.com/track/5pSvjjfsh34sLrkYSNGCl4" },
    { title: "drive ME crazy!", artist: "Lil Yachty, Diana Gordon", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026f578b21bce56056473da7e6", url: "https://open.spotify.com/track/6luBKkFUt5wTwz7hpLhp12" },
    { title: "Midsummer Madness", artist: "88rising, Joji, Rich Brian", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221456c115d2f0f44f4630a63", url: "https://open.spotify.com/track/6TodWdTSDfzwgYynTZSvJn" },
    { title: "我的未來式", artist: "Amber Kuo", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d292166835da4017eea80a5e", url: "https://open.spotify.com/track/64rcEztTi8JF9ufwlCgyPK" },
    { title: "Walking (feat. Swae Lee & Major Lazer)", artist: "88rising, Joji, Jackson Wang, Major Lazer, Swae Lee", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029dbb37516ff4b03244808e45", url: "https://open.spotify.com/track/1qbXrxctv75pm1lWCn6Zw3" },
    { title: "D.A.N.C.E.", artist: "Justice", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021c0bcf8b536295438d26c70d", url: "https://open.spotify.com/track/33yAEqzKXexYM3WlOYtTfQ" },
    { title: "If I Got It (Your Love Brought It)", artist: "Aaron Frazer", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f1111b4b0a9f611b0838053b", url: "https://open.spotify.com/track/1jSAARNT7fzLTcPc4IUQQz" },
    { title: "Better", artist: "nimino, Manta", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023a6fd09dc4dfdd42134b5046", url: "https://open.spotify.com/track/6oUgmZK0McW4706SLJlfDh" },
    { title: "Can't Help Falling in Love", artist: "Elvis Presley", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b184226408f981e3dd17c606", url: "https://open.spotify.com/track/44AyOl4qVkzS48vBsbNXaC" },
    { title: "Et si tu n'existais pas", artist: "Joe Dassin", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e029520be730c64292246fc1d78", url: "https://open.spotify.com/track/1GeszH3DWCOKwK0d8D5gEZ" },
    { title: "Selenge", artist: "Céline Dessberg", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028ee9aa7456028b2d4485c253", url: "https://open.spotify.com/track/47yngLaqEr3z1lnk7ok0OV" },
    { title: "Any Way (feat. Maggie Rogers)", artist: "L'Impératrice, Maggie Rogers", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027e3398f4a50f6e9534f2fbd6", url: "https://open.spotify.com/track/6pLpm17TjgukQbWU5F6fwo" },
    { title: "Parlami d'amore Mariù", artist: "Achille Togliani", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0205045a074718b94aec202756", url: "https://open.spotify.com/track/4DHuxeU2epE6OpXwSMWr9g" },
    { title: "Hang on Little Tomato", artist: "Pink Martini, China Forbes, Thomas M. Lauderdale, Patrick Abbey", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e020c9386d0f4e695570cd41935", url: "https://open.spotify.com/track/3Np6QCfJumv3C09gt3Iuxd" },
    { title: "Te Maldigo (From \"Queer\")", artist: "Trent Reznor, Omar Apollo, Atticus Ross", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0281f1332e0f4273b5db69d5a4", url: "https://open.spotify.com/track/2QxCXBMAeDxQ5Cehea4cEv" },
    { title: "The Look", artist: "Metronomy", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028ca7d89456553e4bbbf3c981", url: "https://open.spotify.com/track/6zfczP87XO2SxWlQtnjFNa" },
    { title: "Tu si' 'na cosa grande", artist: "Ornella Vanoni", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02316389bfa04e7a1012b5d9ea", url: "https://open.spotify.com/track/1QxDOGB1GEY62knGknRfSS" },
    { title: "Ava Maria", artist: "Maria Ferrante", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a480d3bf24be627a6ea5ba73", url: "https://open.spotify.com/track/6drMEKriM3sscgdmDqc1OW" },
    { title: "embers", artist: "Kenichiro Nishihara, Lou Mi Na", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02443ce6145b4696073d34f668", url: "https://open.spotify.com/track/3ZsDA5mkT7awi0OHVMcT7Z" },
    { title: "Something About Us", artist: "Daft Punk", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021e81bff9807a9e629fce5ade", url: "https://open.spotify.com/track/1NeLwFETswx8Fzxl2AFl91" },
    { title: "No Surprises", artist: "Radiohead", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c8b444df094279e70d0ed856", url: "https://open.spotify.com/track/10nyNJ6zNy2YVYLrcwLccB" },
    { title: "I Love You", artist: "Spacemen 3", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c3824888ed659a123db27452", url: "https://open.spotify.com/track/3KfXor1xGOBNE2wwFiP6rV" },
    { title: "Something In The Way", artist: "Nirvana", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02444f118a9126af9e1483dcc0", url: "https://open.spotify.com/track/1nFtiJxYdhtFfFtfXBv06s" },
    { title: "灰色と青 ( + 菅田将暉 )", artist: "Kenshi Yonezu, SUDA MASAKI", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025ee78302fe48134795016cbf", url: "https://open.spotify.com/track/3KnURrjsXA0TDce8N7iOwz" },
    { title: "Distant Dreamer", artist: "Duffy", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02618eb90c1c10d299e51f3822", url: "https://open.spotify.com/track/1uqXrzulcVflfeZDHbyjIs" },
  ];

  window.PROFILES = window.PROFILES || {};
  window.PROFILES.leon = {
    id: "leon",
    name: "Leon",
    fullName: "Leon Meng",
    tagline: "Building things",
    domain: "leonmeng.xyz",
    email: "leonm6@uci.edu",
    machineName: "Leon's Device",
    avatarGlyph: "smiley",
    wallpaper: true,   // show the Apple "Think / Be Different" wallpaper (Leon's page only)
    critters: false,   // no wandering desktop critters on Leon's side
    deskNotes: false,  // no periodic note pop-ups on Leon's side
    projects,
    nowPlaying,
    about,
    contact,
    resume,
    leetcode,
    icons,
  };
})();
