/* ============================================================
   Profile — Ivan (ivanluo.xyz)
   Pure content + desktop layout. The engine (mac.js) renders it.
   Document builders receive (P, O): P = this profile, O = the other person.
   `galleryHTML` is provided globally by the engine at runtime.
   ============================================================ */
(function () {
  "use strict";

  const projects = [
    {
      id: "rate-my-dish", name: "Rate My Dish UBC", icon: "g-doc",
      blurb: "Full-stack web app for UBC students to rate and comment on dining-hall dishes. It fetches the dining-hall menu daily to stay current, surfaces a leaderboard of top dishes across halls, and ships a custom chatbot to help you find something good to eat.",
      stack: ["Next.js", "TypeScript", "Vercel", "LLM chatbot"],
      info: "Web · live",
      links: [{ label: "Live site", href: "https://rate-my-dish-ubc.vercel.app/" }],
      shots: [
        { src: "ivan/assets/projects/rate-my-dish-ubc-01.png", cap: "Home screen" },
        { src: "ivan/assets/projects/rate-my-dish-ubc-02.png", cap: "Menu list" },
        { src: "ivan/assets/projects/rate-my-dish-ubc-03.png", cap: "Dish detail" },
        { src: "ivan/assets/projects/rate-my-dish-ubc-04.png", cap: "Chatbot" },
      ],
    },
    {
      id: "cs2-tactics", name: "CS2 Tactics", icon: "g-doc",
      blurb: "Collaborative mobile app that helps Counter-Strike 2 teams plan, visualize, and share strategies in real time — design tactical lineups, coordinate roles, and iterate together during prep sessions on a real-time backend.",
      stack: ["React Native", "Real-time backend", "Canvas"],
      info: "Mobile · in development",
      links: [{ label: "GitHub", href: "https://github.com/thomasc-0316/CS2" }],
      shots: [
        { src: "ivan/assets/projects/cs2-tactics-01.png", cap: "Lobby" },
        { src: "ivan/assets/projects/cs2-tactics-02.png", cap: "Map tactics" },
        { src: "ivan/assets/projects/cs2-tactics-03.png", cap: "Lineup grid" },
        { src: "ivan/assets/projects/cs2-tactics-04.png", cap: "Explore" },
      ],
    },
    {
      id: "gravity-sandbox", name: "GravitySandbox", icon: "g-doc",
      blurb: "Qt Quick prototype for experimenting with 2D gravitational simulations. Bodies are integrated with a symplectic Euler solver for stable motion, trails visualize recent paths, and interactive canvas tools let you set up orbits quickly.",
      stack: ["Qt Quick", "C++", "QML"],
      info: "Simulation · 2024",
      links: [{ label: "GitHub", href: "https://github.com/ivan-lyf/gravity_simulation" }],
      shots: [
        { src: "ivan/assets/projects/gravity-sandbox-01.png", cap: "Simulation view" },
      ],
    },
    {
      id: "fpga-market-data", name: "Live Market Data FPGA", icon: "g-doc",
      blurb: "A real-time market-data pipeline running on a DE10-Lite FPGA. A Python WebSocket client streams live binary packets over UART into a SystemVerilog parser FSM, which decodes them on the board for low-latency processing.",
      stack: ["SystemVerilog", "Python", "UART", "DE10-Lite"],
      info: "Hardware · 2026",
      links: [],
      shots: [],
    },
    {
      id: "unix-shell", name: "Unix Shell (crash)", icon: "g-doc",
      blurb: "A Unix shell written from scratch in C with a REPL supporting foreground/background job execution via fork/execve and process groups. Implements job control (fg, bg, kill, jobs) and POSIX signal handlers (SIGINT, SIGTSTP, SIGCHLD), eliminating zombie processes.",
      stack: ["C", "Linux", "POSIX", "Signals"],
      info: "Systems · 2025",
      links: [],
      shots: [],
    },
    {
      id: "virtual-memory", name: "Virtual Memory System", icon: "g-doc",
      blurb: "Virtual-to-physical address translation in C via a 3-level page-table walk, backed by a TLB cache with a miss fallback. Handles page faults and demand paging with LRU page replacement over a limited pool of physical frames.",
      stack: ["C", "Paging", "TLB", "LRU"],
      info: "Systems · 2025",
      links: [],
      shots: [],
    },
  ];

  /* UBC Rocket ground-control-station screenshots (shown in Experience) */
  const rocketShots = [
    { src: "ivan/assets/rocket/gcs-flight.png", cap: "Flight view — 3D attitude" },
    { src: "ivan/assets/rocket/gcs-tuning.png", cap: "PID tuning presets" },
    { src: "ivan/assets/rocket/gcs-map.png", cap: "Satellite-view map" },
  ];

  /* Leanpub iOS v3 screenshots — Ruboss work (shown in Experience) */
  const leanpubShots = [
    { src: "ivan/assets/leanpub/leanpub-library.jpg", cap: "Library — always up to date" },
    { src: "ivan/assets/leanpub/leanpub-reader.jpg", cap: "Reader" },
    { src: "ivan/assets/leanpub/leanpub-highlights.jpg", cap: "Highlights & notes" },
    { src: "ivan/assets/leanpub/leanpub-explore.jpg", cap: "Explore — discover books" },
    { src: "ivan/assets/leanpub/leanpub-book-detail.jpg", cap: "Book detail" },
    { src: "ivan/assets/leanpub/leanpub-author.jpg", cap: "Author studio" },
    { src: "ivan/assets/leanpub/leanpub-account.jpg", cap: "Account" },
  ];

  /* ---------- document windows ----------
     One typeface throughout: Chicago for headings, Geneva (the .content
     default) for everything else. `.meta` is the one info-line style. */
  function about(P, O) {
    return `
      <h2>Yingfan (Ivan) Luo</h2>
      <p class="meta">3rd-year Computer Engineering (CPEN) @ UBC</p>
      <p>I build software across the stack — from embedded firmware where code meets hardware, to modern web and mobile apps.</p>
      <hr class="dotrule">
      <h3>What I do</h3>
      <p>
        → Real-time &amp; embedded systems (STM32)<br>
        → Flight-control &amp; sensor pipelines<br>
        → Full-stack web &amp; mobile applications<br>
        → Retro computing enthusiast
      </p>
      <hr class="dotrule">
      <p>Looking for Winter 2027 and Summer 2027 internships — reach out at <a href="mailto:${P.email}">${P.email}</a>.</p>`;
  }

  function experience(P, O) {
    return `
      <h2>Experience</h2>
      <hr class="rule">
      <h3>Apera AI — Software Engineer Intern</h3>
      <p class="meta">Sept 2026 – present · Vancouver, BC</p>
      <p>On the C++ team building 4D vision software for industrial robotics — helping robots see and handle parts on real factory floors. Built cell localization for shipped work cells, solving a rigid-body transform between reference and measured planes so arm-to-cell calibration survives transport to 0.01 mm / 0.1°.</p>
      <hr class="dotrule">
      <h3>Ruboss — Software Engineer Intern</h3>
      <p class="meta">Summer 2026 · Vancouver, BC</p>
      <p>Shipped Leanpub's first native iOS app to the App Store in 7 weeks as one of two engineers — 105 screens covering reading, publishing, pricing, and sales in SwiftUI over a GraphQL API, plus real-time collaborative editing with CRDTs (Yjs) synced live across web and iOS. Also built an LLM catalog assistant that answers “find me a book on X” over the live catalog, and GitHub-backed books that publish straight from a repo.</p>
      <p><a href="https://apps.apple.com/ca/app/leanpub/id913517110" target="_blank" rel="noopener">App Store →</a></p>
      ${galleryHTML(P.leanpubShots, "Leanpub iOS v3")}
      <hr class="dotrule">
      <h3>UBC Rocket — Embedded Software Engineer</h3>
      <p class="meta">Thrust Vector Control · 2025–present · Vancouver, BC</p>
      <p>Built the flight team's ground control station in C++/Qt, rendering 100+ Hz telemetry with live 3D attitude and a satellite map. On the firmware side: non-blocking STM32 drivers delivering a jitter-free 1 kHz IMU pipeline, a COBS-framed Protobuf radio link, and the controls team's PID flight-control law guarded by a 30-test CTest harness.</p>
      <p><a href="https://github.com/UBC-Rocket/thrust_vectoring_consolidated" target="_blank" rel="noopener">GitHub →</a></p>
      ${galleryHTML(P.rocketShots, "Ground Control Station")}
      <hr class="dotrule">
      <h3>Education</h3>
      <p class="meta">B.A.Sc. Computer Engineering — University of British Columbia · GPA 3.9/4.0 (87%) · Expected December 2028</p>`;
  }

  function resume(P, O) {
    return `
      <h2 style="text-align:center;">RÉSUMÉ</h2>
      <hr class="rule">
      <h3>Yingfan (Ivan) Luo — Computer Engineering @ UBC</h3>
      <p class="meta">Vancouver, BC · ${P.domain}<br>${P.email} · 778-228-6477</p>
      <hr class="dotrule">
      <h3>Experience</h3>
      <p>• Apera AI — Software Engineer Intern (2026–present)<br>• Ruboss (Leanpub) — Software Engineer Intern (Summer 2026)<br>• UBC Rocket — Embedded Software Engineer (2025–present)</p>
      <h3>Projects</h3>
      <p>• Rate My Dish UBC · CS2 Tactics · GravitySandbox<br>• Live Market Data FPGA · Unix Shell (C) · Virtual Memory System (C)</p>
      <h3>Skills</h3>
      <p>
        <span class="tag">C</span><span class="tag">C++</span><span class="tag">Python</span>
        <span class="tag">Java</span><span class="tag">JavaScript</span><span class="tag">TypeScript</span>
        <span class="tag">Swift</span><span class="tag">Ruby</span><span class="tag">SystemVerilog</span>
        <span class="tag">ARM Asm</span><span class="tag">React</span><span class="tag">Next.js</span>
        <span class="tag">Remix</span><span class="tag">Node.js</span><span class="tag">SwiftUI</span>
        <span class="tag">Rails</span><span class="tag">GraphQL</span><span class="tag">Qt</span>
        <span class="tag">STM32</span><span class="tag">Protobuf</span><span class="tag">Git</span>
      </p>
      <div style="text-align:center;margin-top:16px;">
        <a class="mac-btn default" href="ivan/assets/resume/Ivan_Luo_Resume.pdf" download="Ivan_Luo_Resume.pdf" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;">Download PDF…</a>
      </div>`;
  }

  function contact(P, O) {
    return `
      <h2 style="text-align:center;">Get in Touch</h2>
      <hr class="rule">
      <p><strong>Email</strong><br><a href="mailto:${P.email}">${P.email}</a></p>
      <p><strong>GitHub</strong><br><a href="https://github.com/ivan-lyf" target="_blank" rel="noopener">github.com/ivan-lyf</a></p>
      <p><strong>LinkedIn</strong><br><a href="https://www.linkedin.com/in/ivan-yingfan-luo/" target="_blank" rel="noopener">linkedin.com/in/ivan-yingfan-luo</a></p>
      <hr class="dotrule">
      <p class="meta" style="text-align:center;">
        Looking for ${O.name}?<br>
        <a href="#" onclick="Mac.gotoOther();return false;">→ ${O.domain}</a>
      </p>`;
  }

  /* ---------- Side Hustle folder — life outside the terminal ----------
     `build()` runs at open time so it can embed galleries via galleryHTML.
     Tone: keep it light and human. */
  const SH = "ivan/assets/sidehustle/";
  function shDoc(title, body) {
    return `<h2>${title}</h2><hr class="dotrule">${body}`;
  }

  const sideHustle = [
    {
      id: "sh-gaming", name: "Gaming", icon: "g-doc", title: "Gaming",
      info: "Side Hustle · CS2 & League", size: { w: 360, h: 250 },
      build: () => shDoc("Gaming", `
        <p>I play CS2 and League — hit me up if you want me to carry you. (Carry success rate: not legally guaranteed.)</p>
        <p><strong>Riot ID</strong> &nbsp;Floral Sea #000<br>
        <strong>Steam</strong> &nbsp;<a href="https://steamcommunity.com/profiles/76561198832913764/" target="_blank" rel="noopener">add me here</a></p>`),
    },
    {
      id: "sh-cat", name: "Cat", icon: "g-doc", title: "Cat",
      info: "Side Hustle · lead QA", size: { w: 380, h: 420 },
      build: () => shDoc("Cat", `
        <p>This is <strong>Jupiter</strong> — my cat and lead QA engineer. He tests every build by sitting on the keyboard and knocking unfinished features off the desk.</p>
        ${galleryHTML([{ src: SH + "cat-01.jpeg", cap: "Jupiter, reviewing my commits" }], "Exhibit A")}`),
    },
    {
      id: "sh-gym", name: "Gym", icon: "g-doc", title: "Gym",
      info: "Side Hustle · loading…", size: { w: 360, h: 220 },
      build: () => shDoc("Gym", `
        <p>No picture until I bench two plates. :))</p>
        <p class="meta">Check back in a few months. Maybe a few more.</p>`),
    },
    {
      id: "sh-photo", name: "Photography", icon: "g-doc", title: "Photography",
      info: "Side Hustle · digital + film", size: { w: 370, h: 270 },
      build: () => shDoc("Photography", `
        <p>Digital and film — I like chasing light on both, and occasionally a shot even comes out in focus.</p>
        <p><strong>Instagram</strong> &nbsp;<a href="https://www.instagram.com/ivan_photo_studio/" target="_blank" rel="noopener">@ivan_photo_studio</a></p>`),
    },
    {
      id: "sh-snowboard", name: "Snowboarding", icon: "g-doc", title: "Snowboarding",
      info: "Side Hustle · CASI L2", size: { w: 390, h: 430 },
      build: () => shDoc("Snowboarding", `
        <p>CASI Level 2 and Park Level 1 instructor. Catch me at Whistler all winter — come say hi, or book a lesson and let me talk your ear off about edge control.</p>
        ${galleryHTML([
          { src: SH + "snowboard-01.jpeg", cap: "Peak of Whistler" },
          { src: SH + "snowboard-02.jpeg", cap: "Found an ice cave" },
        ], "On the hill")}`),
    },
  ];

  /* ---------- Now Playing — Jay Chou (周杰倫) on heavy rotation ----------
     Same widget as Leon's: a random track per session, spinning disc + EQ bars.
     art = Spotify album thumbnail; url = the track on Spotify. */
  const nowPlaying = [
    { title: "晴天", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026850b3307853e0753ed53cc5", url: "https://open.spotify.com/track/5pIcwtJYNJx93l420oR2Vm" },
    { title: "告白氣球", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02db1172ca038c6818b6ae8bf2", url: "https://open.spotify.com/track/2tqF9MPNdYdJU70U0ULO23" },
    { title: "說好不哭 (with aMEI)", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0220eb9661dbcd873731280b48", url: "https://open.spotify.com/track/52yAKumXlqPjUsIBlmiMvo" },
    { title: "擱淺", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0200b976d1df4243e5318a7712", url: "https://open.spotify.com/track/0cOMncRq4cmDLO4tPQnkBF" },
    { title: "珊瑚海", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e022625625847482492f9e2e665", url: "https://open.spotify.com/track/3Qj9Fy8BPbWmICTiNkuqB7" },
    { title: "七里香", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0200b976d1df4243e5318a7712", url: "https://open.spotify.com/track/57w29bSwdIZ6gr6xXOqwc1" },
    { title: "等你下課 (with 楊瑞代)", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0220eb9661dbcd873731280b48", url: "https://open.spotify.com/track/0TMGJMQJWHhuNY60MEr5jR" },
    { title: "說好的幸福呢", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c2321adb9887902f0c5bd8f1", url: "https://open.spotify.com/track/4OoExItZJ0jePoCZDbHx4t" },
    { title: "安靜", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0266d1a374224122c5c5ed5cd9", url: "https://open.spotify.com/track/4oSqIlKulWts1oRUIem44V" },
    { title: "一路向北", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e022625625847482492f9e2e665", url: "https://open.spotify.com/track/7KoqEF76fGnDYdxTSHLxcm" },
    { title: "楓", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e022625625847482492f9e2e665", url: "https://open.spotify.com/track/1pALOIA4ytESmhl7Fxjdic" },
    { title: "不該 (with 張惠妹)", artist: "周杰倫 (Jay Chou)", art: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02db1172ca038c6818b6ae8bf2", url: "https://open.spotify.com/track/5miH0BWhRVTvHAwmnoeyXH" },
  ];

  /* ---------- Terminal ----------
     A small read-only shell over a virtual filesystem. The projects/ and
     side-hustle/ directories are generated from the same arrays the windows
     use, so the files can never drift from the rest of the desktop.
     Directories are plain objects; files are strings. */

  const TERM_HOME = ["home", "ivan"];

  const slug = (s) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  function underline(s) { return s + "\n" + "=".repeat(s.length); }

  function projectFile(p) {
    const lines = [underline(p.name), "", p.info, "", p.blurb, "", "Stack: " + p.stack.join(", ")];
    if (p.links && p.links.length) {
      lines.push("");
      p.links.forEach((l) => lines.push(l.label + ": " + l.href));
    }
    return lines.join("\n");
  }

  function projectsDir() {
    const d = {};
    projects.forEach((p) => { d[slug(p.name) + ".txt"] = projectFile(p); });
    return d;
  }

  /* Side Hustle windows are HTML builders; the terminal keeps its own plain
     one-liners rather than stripping tags out of markup. */
  const sideHustleText = {
    "gaming.txt": "CS2 and League. Hit me up if you want me to carry you.\nCarry success rate: not legally guaranteed.\n\nRiot ID  Floral Sea #000",
    "cat.txt": "Jupiter — my cat, and lead QA engineer.\n\nTests every build by sitting on the keyboard and knocking\nunfinished features off the desk. Has never filed a ticket.",
    "gym.txt": "No picture until I bench two plates. :))\n\nCheck back in a few months. Maybe a few more.",
    "photography.txt": "Digital and film. I like chasing light on both, and\noccasionally a shot even comes out in focus.\n\nInstagram  @ivan_photo_studio",
    "snowboarding.txt": "CASI Level 2 and Park Level 1 instructor.\n\nCatch me at Whistler all winter. Come say hi, or book a\nlesson and let me talk your ear off about edge control.",
  };

  const FS = {
    home: {
      ivan: {
        "README": [
          underline("Hello from a Macintosh that never existed"),
          "",
          "You are in a small read-only filesystem. Everything in here is",
          "also somewhere on the desktop behind this window — this is just",
          "a faster way through it if you already think in shells.",
          "",
          "Try:  ls           see what is here",
          "      cd projects   move around",
          "      cat about.txt  read something",
          "      help          the full list",
        ].join("\n"),
        "about.txt": [
          underline("Yingfan (Ivan) Luo"),
          "",
          "3rd-year Computer Engineering (CPEN) at UBC, in Vancouver.",
          "",
          "I build software across the stack — from embedded firmware where",
          "code meets hardware, to modern web and mobile apps.",
          "",
          "  - Real-time and embedded systems (STM32)",
          "  - Flight-control and sensor pipelines",
          "  - Full-stack web and mobile applications",
          "  - Retro computing enthusiast",
          "",
          "Open to internship opportunities.",
        ].join("\n"),
        "skills.txt": [
          underline("Technical skills"),
          "",
          "Languages   C, C++, Java, JavaScript, TypeScript, Python, Ruby,",
          "            Swift, SystemVerilog, ARM Assembly",
          "Frameworks  React, Next.js, Remix, Node.js, SwiftUI,",
          "            Ruby on Rails, GraphQL, Qt, Protobuf",
          "Tools       Git/GitHub, Claude Code, Xcode, Linux, CTest",
        ].join("\n"),
        "contact.txt": [
          underline("Get in touch"),
          "",
          "Email     yingfanluo@gmail.com",
          "Phone     778-228-6477",
          "GitHub    github.com/ivan-lyf",
          "LinkedIn  linkedin.com/in/ivan-yingfan-luo",
          "Site      ivanluo.xyz",
        ].join("\n"),
        experience: {
          "apera-ai.txt": [
            underline("Apera AI Inc. — Software Engineer Intern"),
            "",
            "Sept 2026 – present · Vancouver, BC",
            "",
            "On the C++ team building 4D vision software for industrial",
            "robotics — helping robots see and handle parts on real factory",
            "floors.",
            "",
            "  - Built cell localization for shipped robotic work cells:",
            "    computed a rigid-body transform between reference and",
            "    measured planes defined by three calibration boards,",
            "    restoring arm-to-cell calibration after transport to",
            "    0.01 mm / 0.1 degree accuracy.",
            "  - Fixed inaccurate calibration progress reporting in the",
            "    cell's HMI by refactoring legacy code to weight progress",
            "    by per-task step counts rather than assuming uniform",
            "    task durations.",
          ].join("\n"),
          "ruboss-leanpub.txt": [
            underline("Ruboss Technology Corporation (Leanpub)"),
            "",
            "Software Engineer Intern · May 2026 – Aug 2026 · Vancouver, BC",
            "",
            "  - Shipped Leanpub's first native iOS app to the App Store in",
            "    7 weeks as one of two engineers: 105 screens covering",
            "    reading, book publishing, pricing, and sales, built in",
            "    SwiftUI over a GraphQL API. 1,000+ downloads.",
            "  - Built real-time collaborative editing so co-authors can",
            "    write a book together with live sync across web and iOS,",
            "    using CRDTs (Yjs) over Rails ActionCable; ported Yjs's",
            "    binary sync protocol to Swift.",
            "  - Built an AI catalog assistant for leanpub.com that answers",
            "    natural-language requests like \"find me a book on X\",",
            "    powered by a tool-calling LLM pipeline over the live catalog.",
            "  - Launched GitHub-backed books: authors connect a repository",
            "    and Leanpub publishes from it, with automated repo",
            "    provisioning, ownership transfer, and hardened,",
            "    injection-safe input validation.",
          ].join("\n"),
          "ubc-rocket.txt": [
            underline("UBC Rocket — Thrust Vector Control"),
            "",
            "Embedded Software Engineer · Sept 2025 – present · Vancouver, BC",
            "",
            "  - Built the flight team's ground control station in C++ and",
            "    Qt, rendering 100+ Hz telemetry with live 3D attitude",
            "    visualization and a satellite-view map.",
            "  - Designed non-blocking STM32 firmware (SPI) delivering a",
            "    jitter-free 1 kHz IMU data pipeline, meeting the timing",
            "    budget the attitude-control loop depended on.",
            "  - Built a bidirectional radio link with COBS-encoded message",
            "    framing and an updated Protobuf schema, plus CSV packet",
            "    logging that enabled post-flight analysis of command and",
            "    telemetry data.",
            "  - Implemented the controls team's PID flight-control law from",
            "    spec and built a ground-station tuning page with saved gain",
            "    presets, guarded by a 30-test CTest regression harness.",
            "  - Developed and tuned ESC/motor-control firmware and built a",
            "    Python data-collection pipeline measuring force/torque vs.",
            "    thrust %, enabling thrust-performance validation and tuning.",
          ].join("\n"),
          "education.txt": [
            underline("Education"),
            "",
            "University of British Columbia — Vancouver, BC",
            "B.A.Sc. Computer Engineering",
            "GPA 3.9/4.0 (87%)",
            "Expected December 2028",
            "",
            "Relevant coursework: Computing Systems, Software Construction,",
            "Data Structures and Algorithms, Computer Architecture,",
            "Operating Systems.",
          ].join("\n"),
        },
        projects: projectsDir(),
        "side-hustle": sideHustleText,
        ".secret": [
          "You found it.",
          "",
          "There is no easter egg here, only the quiet satisfaction of",
          "someone who reads the man page. That is a real skill. Use it.",
          "",
          "  -- ivan",
        ].join("\n"),
      },
    },
  };

  const isDir = (n) => n !== null && typeof n === "object";

  /* Resolve a user-typed path against cwd. Returns an array of segments. */
  function resolvePath(cwd, raw) {
    let parts;
    if (!raw || raw === "~") parts = TERM_HOME.slice();
    else if (raw === "/") parts = [];
    else if (raw.charAt(0) === "/") parts = raw.split("/");
    else if (raw === "~/" || raw.slice(0, 2) === "~/") parts = TERM_HOME.concat(raw.slice(2).split("/"));
    else parts = cwd.concat(raw.split("/"));
    const out = [];
    parts.forEach((seg) => {
      if (seg === "" || seg === ".") return;
      if (seg === "..") { out.pop(); return; }
      out.push(seg);
    });
    return out;
  }

  function nodeAt(parts) {
    let node = FS;
    for (let i = 0; i < parts.length; i++) {
      if (!isDir(node)) return undefined;
      if (!Object.prototype.hasOwnProperty.call(node, parts[i])) return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function displayPath(parts) {
    const abs = "/" + parts.join("/");
    const home = "/" + TERM_HOME.join("/");
    if (abs === home) return "~";
    if (abs.indexOf(home + "/") === 0) return "~" + abs.slice(home.length);
    return abs === "/" ? "/" : abs;
  }

  const HELP = [
    "Available commands:",
    "",
    "  ls [-al] [path]   list directory contents",
    "  cd [path]         change directory",
    "  cat <file>        print a file",
    "  pwd               print the working directory",
    "  clear             clear the screen",
    "  help              this list",
    "",
    "  -a  include hidden files      -l  one entry per line",
    "",
    "Paths work as you expect: . .. ~ / and relative.",
    "Up and Down arrows walk through command history.",
    "Run `cat README` for the tour.",
  ].join("\n");

  /* Run one command line. Returns { text, cls } lines to print, and may
     mutate state.cwd. Kept free of DOM so it stays easy to reason about. */
  function runCommand(raw, state) {
    const line = raw.trim();
    if (!line) return [];
    const argv = line.split(/\s+/);
    const cmd = argv[0];
    const args = argv.slice(1);
    const err = (t) => [{ text: t, cls: "err" }];

    if (cmd === "help") return [{ text: HELP }];

    if (cmd === "pwd") return [{ text: "/" + state.cwd.join("/") || "/" }];

    if (cmd === "clear") return "CLEAR";

    if (cmd === "ls") {
      const flags = args.filter((a) => a.charAt(0) === "-");
      const rest = args.filter((a) => a.charAt(0) !== "-");
      const all = flags.some((f) => f.indexOf("a") > 0);
      const long = flags.some((f) => f.indexOf("l") > 0);
      const bad = flags.find((f) => !/^-[al]+$/.test(f));
      if (bad) return err("ls: invalid option: " + bad);
      if (rest.length > 1) return err("ls: too many arguments");
      const target = rest.length ? rest[0] : null;
      const parts = target === null ? state.cwd : resolvePath(state.cwd, target);
      const node = nodeAt(parts);
      if (node === undefined) return err("ls: " + (target || ".") + ": No such file or directory");
      if (!isDir(node)) return [{ text: target }];
      let names = Object.keys(node);
      if (!all) names = names.filter((n) => n.charAt(0) !== ".");
      if (!names.length) return [];
      names.sort((a, b) => a.localeCompare(b));
      const shown = names.map((n) => (isDir(node[n]) ? n + "/" : n));
      return [{ text: shown.join(long ? "\n" : "  ") }];
    }

    if (cmd === "cd") {
      if (args.length > 1) return err("cd: too many arguments");
      const target = args.length ? args[0] : "~";
      const parts = resolvePath(state.cwd, target);
      const node = nodeAt(parts);
      if (node === undefined) return err("cd: " + target + ": No such file or directory");
      if (!isDir(node)) return err("cd: " + target + ": Not a directory");
      state.cwd = parts;
      return [];
    }

    if (cmd === "cat") {
      if (!args.length) return err("cat: missing operand");
      const out = [];
      args.forEach((a) => {
        const node = nodeAt(resolvePath(state.cwd, a));
        if (node === undefined) out.push({ text: "cat: " + a + ": No such file or directory", cls: "err" });
        else if (isDir(node)) out.push({ text: "cat: " + a + ": Is a directory", cls: "err" });
        else out.push({ text: node });
      });
      return out;
    }

    return err("sh: command not found: " + cmd);
  }

  /* Mount the interactive terminal into a freshly opened window body. */
  function mountTerminal(root, P) {
    const doc = root.ownerDocument;
    root.className = "term";
    root.innerHTML = "";

    const out = doc.createElement("div");
    out.className = "term-out";
    const lineEl = doc.createElement("div");
    lineEl.className = "term-inputline";
    const promptEl = doc.createElement("span");
    promptEl.className = "term-prompt";
    const typedEl = doc.createElement("span");
    typedEl.className = "term-typed";
    const input = doc.createElement("input");
    input.className = "term-hidden-input";
    input.type = "text";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-label", "Terminal input");

    lineEl.appendChild(promptEl);
    lineEl.appendChild(typedEl);
    root.appendChild(out);
    root.appendChild(lineEl);
    root.appendChild(input);

    const state = { cwd: TERM_HOME.slice() };
    const history = [];
    let histPos = 0;

    const promptText = () => "ivan@" + (P.domain || "mac") + ":" + displayPath(state.cwd) + "$ ";

    function print(text, cls) {
      const d = doc.createElement("div");
      d.className = "term-line" + (cls ? " " + cls : "");
      d.textContent = text;
      out.appendChild(d);
    }

    function scrollToBottom() {
      const pane = root.closest ? root.closest(".content") : null;
      if (pane) pane.scrollTop = pane.scrollHeight;
    }

    function renderLine() {
      promptEl.textContent = promptText();
      const v = input.value;
      let i = input.selectionStart;
      if (i === null || i === undefined || i > v.length) i = v.length;
      typedEl.textContent = "";
      typedEl.appendChild(doc.createTextNode(v.slice(0, i)));
      const caret = doc.createElement("span");
      caret.className = "term-caret";
      if (i < v.length) {
        caret.classList.add("on-char");
        caret.textContent = v.charAt(i);
      }
      typedEl.appendChild(caret);
      if (i < v.length) typedEl.appendChild(doc.createTextNode(v.slice(i + 1)));
    }

    function submit() {
      const raw = input.value;
      print(promptText() + raw);
      const result = runCommand(raw, state);
      if (result === "CLEAR") out.innerHTML = "";
      else result.forEach((r) => print(r.text, r.cls));
      if (raw.trim()) {
        history.push(raw);
        if (history.length > 100) history.shift();
      }
      histPos = history.length;
      input.value = "";
      renderLine();
      scrollToBottom();
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); return; }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (histPos > 0) { histPos--; input.value = history[histPos]; }
        renderLine();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (histPos < history.length - 1) { histPos++; input.value = history[histPos]; }
        else { histPos = history.length; input.value = ""; }
        renderLine();
        return;
      }
      if (e.key === "l" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); out.innerHTML = ""; renderLine(); return; }
      if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        print(promptText() + input.value + "^C");
        input.value = "";
        renderLine();
        scrollToBottom();
        return;
      }
      // let the browser move the caret first, then redraw it
      setTimeout(renderLine, 0);
    });
    input.addEventListener("input", renderLine);
    input.addEventListener("focus", () => root.classList.remove("blurred"));
    input.addEventListener("blur", () => root.classList.add("blurred"));

    // clicking anywhere in the pane types into the shell, unless the user is
    // selecting text to copy
    root.addEventListener("mousedown", (e) => {
      if (e.target === input) return;
      const sel = doc.defaultView.getSelection && doc.defaultView.getSelection().toString();
      if (sel && sel.trim()) return;
      e.preventDefault();
      input.focus();
    });

    print("Macintosh Terminal 1.0");
    print("Type `help` for the list of commands, `cat README` for the tour.", "term-dim");
    print("");
    renderLine();
    input.focus();
    // the window animates open; grab focus again once it has settled
    setTimeout(() => input.focus(), 260);
  }

  /* ---------- desktop layout ----------
     kind: "harddrive" | "folder" | "trash" | "app" | undefined (document via `doc`) */
  const icons = [
    { id: "harddrive", kind: "harddrive", label: "Ivan's Mac", glyph: "g-hd", corner: "tr",
      title: "Ivan's Mac", info: "7 items · 512K in disk · 256K available", size: { w: 320, h: 230 } },
    { id: "about", doc: "about", label: "About Me", glyph: "g-doc", x: 24, y: 14,
      title: "About Me", info: "About · 24K", size: { w: 360, h: 300 } },
    { id: "projects", kind: "folder", label: "Projects", glyph: "g-folder", x: 24, y: 120,
      title: "Projects", info: "6 items · 144K in folder", size: { w: 330, h: 280 } },
    { id: "experience", doc: "experience", label: "Experience", glyph: "g-doc", x: 24, y: 226,
      title: "Experience", info: "Experience · 24K", size: { w: 380, h: 360 } },
    { id: "sidehustle", kind: "folder", items: sideHustle, label: "Side Hustle", glyph: "g-folder", x: 24, y: 332,
      title: "Side Hustle", info: "5 items · 64K in folder", size: { w: 340, h: 250 } },
    { id: "terminal", kind: "app", mount: mountTerminal, label: "Terminal", glyph: "g-term", x: 120, y: 14,
      title: "Terminal", info: "Application · 12K", size: { w: 520, h: 330 } },
    { id: "resume", doc: "resume", label: "Résumé", glyph: "g-resume", corner: "tr2",
      title: "Résumé", info: "Résumé · 32K", size: { w: 340, h: 360 } },
    { id: "contact", doc: "contact", label: "Contact", glyph: "g-mail", corner: "tr3",
      title: "Contact", info: "Contact · 8K", size: { w: 300, h: 270 } },
    { id: "trash", kind: "trash", label: "Trash", glyph: "g-trash", corner: "br",
      title: "Trash", info: "Empty", size: { w: 290, h: 220 } },
  ];

  window.PROFILES = window.PROFILES || {};
  window.PROFILES.ivan = {
    id: "ivan",
    name: "Ivan",
    fullName: "Yingfan (Ivan) Luo",
    domain: "ivanluo.xyz",
    email: "yingfanluo@gmail.com",
    machineName: "Ivan's Mac",
    avatarGlyph: "avatar",
    resumePdf: "ivan/assets/resume/Ivan_Luo_Resume.pdf",
    wallpaper: "hello",   // classic Macintosh "hello" script on the desktop
    github: "ivan-lyf",   // live GitHub contributions widget + menubar tap
    raisableWidgets: true, // clicking a widget raises it above windows
    projects,
    rocketShots,
    leanpubShots,
    nowPlaying,
    about,
    experience,
    resume,
    contact,
    icons,
  };
})();
