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
        { src: "assets/projects/rate-my-dish-ubc-01.png", cap: "Home screen" },
        { src: "assets/projects/rate-my-dish-ubc-02.png", cap: "Menu list" },
        { src: "assets/projects/rate-my-dish-ubc-03.png", cap: "Dish detail" },
        { src: "assets/projects/rate-my-dish-ubc-04.png", cap: "Chatbot" },
      ],
    },
    {
      id: "cs2-tactics", name: "CS2 Tactics", icon: "g-doc",
      blurb: "Collaborative mobile app that helps Counter-Strike 2 teams plan, visualize, and share strategies in real time — design tactical lineups, coordinate roles, and iterate together during prep sessions on a real-time backend.",
      stack: ["React Native", "Real-time backend", "Canvas"],
      info: "Mobile · in development",
      links: [{ label: "GitHub", href: "https://github.com/thomasc-0316/CS2" }],
      shots: [
        { src: "assets/projects/cs2-tactics-01.png", cap: "Lobby" },
        { src: "assets/projects/cs2-tactics-02.png", cap: "Map tactics" },
        { src: "assets/projects/cs2-tactics-03.png", cap: "Lineup grid" },
        { src: "assets/projects/cs2-tactics-04.png", cap: "Explore" },
      ],
    },
    {
      id: "gravity-sandbox", name: "GravitySandbox", icon: "g-doc",
      blurb: "Qt Quick prototype for experimenting with 2D gravitational simulations. Bodies are integrated with a symplectic Euler solver for stable motion, trails visualize recent paths, and interactive canvas tools let you set up orbits quickly.",
      stack: ["Qt Quick", "C++", "QML"],
      info: "Simulation · 2024",
      links: [{ label: "GitHub", href: "https://github.com/ivan-lyf/gravity_simulation" }],
      shots: [
        { src: "assets/projects/gravity-sandbox-01.png", cap: "Simulation view" },
      ],
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
    { src: "assets/rocket/gcs-flight.png", cap: "Flight view — 3D attitude" },
    { src: "assets/rocket/gcs-tuning.png", cap: "PID tuning presets" },
    { src: "assets/rocket/gcs-map.png", cap: "UWB satellite map" },
  ];

  /* ---------- document windows ----------
     One typeface throughout: Chicago for headings, Geneva (the .content
     default) for everything else. `.meta` is the one info-line style. */
  function about(P, O) {
    return `
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div class="photo-dither"><div class="cap">[ ivan ]</div></div>
        <div style="flex:1 1 180px;min-width:170px;">
          <h2>Yingfan (Ivan) Luo</h2>
          <p class="meta">3rd-year Computer Engineering (CPEN) @ UBC</p>
          <p>I build software across the stack — from embedded firmware where code meets hardware, to modern web and mobile apps.</p>
        </div>
      </div>
      <hr class="dotrule">
      <h3>What I do</h3>
      <p>
        → Real-time &amp; embedded systems (STM32)<br>
        → Flight-control &amp; sensor pipelines<br>
        → Full-stack web &amp; mobile applications<br>
        → Retro computing enthusiast
      </p>
      <hr class="dotrule">
      <p>Open to internship opportunities — reach out at <a href="mailto:${P.email}">${P.email}</a>.</p>`;
  }

  function experience(P, O) {
    return `
      <h2>Experience</h2>
      <hr class="rule">
      <h3>Ruboss — Full-Stack Software Engineer</h3>
      <p class="meta">Summer 2026 · Vancouver, BC</p>
      <p>Building Leanpub's iOS v3 in SwiftUI against a GraphQL API on a Ruby on Rails backend — a better tool for readers and authors to write and publish books.</p>
      <hr class="dotrule">
      <h3>UBC Rocket — Embedded Software Engineer</h3>
      <p class="meta">TVR Team · 2025–present · Vancouver, BC</p>
      <p>Building the ground control station in C++/Qt, plus the firmware and drivers (STM32, IMU, UWB ranging) for the self-landing thrust-vectoring rocket.</p>
      <p><a href="https://github.com/UBC-Rocket/thrust_vectoring_consolidated" target="_blank" rel="noopener">GitHub →</a></p>
      ${galleryHTML(P.rocketShots, "Ground Control Station")}
      <hr class="dotrule">
      <h3>Education</h3>
      <p class="meta">B.A.Sc. Computer Engineering — University of British Columbia · GPA 86% · Class of 2028</p>`;
  }

  function resume(P, O) {
    return `
      <h2 style="text-align:center;">RÉSUMÉ</h2>
      <hr class="rule">
      <h3>Yingfan (Ivan) Luo — Computer Engineering @ UBC</h3>
      <p class="meta">Vancouver, BC · ${P.domain}<br>${P.email} · 778-228-6477</p>
      <hr class="dotrule">
      <h3>Experience</h3>
      <p>• Ruboss Technology — Full-Stack Software Engineer (2026)<br>• UBC Rocket — Embedded Software Engineer (2025–present)</p>
      <h3>Projects</h3>
      <p>• Rate My Dish UBC · CS2 Tactics · GravitySandbox<br>• Unix Shell (C) · Virtual Memory System (C)</p>
      <h3>Skills</h3>
      <p>
        <span class="tag">C</span><span class="tag">C++</span><span class="tag">Python</span>
        <span class="tag">Java</span><span class="tag">TypeScript</span><span class="tag">Swift</span>
        <span class="tag">Ruby</span><span class="tag">SystemVerilog</span><span class="tag">ARM Asm</span>
        <span class="tag">React</span><span class="tag">Next.js</span><span class="tag">SwiftUI</span>
        <span class="tag">Rails</span><span class="tag">GraphQL</span><span class="tag">Qt</span>
        <span class="tag">STM32</span><span class="tag">Protobuf</span><span class="tag">Git</span>
      </p>
      <div style="text-align:center;margin-top:16px;">
        <a class="mac-btn default" href="assets/resume/Ivan_Luo_Resume.pdf" download="Ivan_Luo_Resume.pdf" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;">Download PDF…</a>
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

  /* ---------- Side Hustle folder — life outside the terminal (placeholders) ---------- */
  function hobby(title, blurb) {
    const slug = title.toLowerCase();
    return `
      <h2>${title}</h2>
      <hr class="dotrule">
      <p>${blurb}</p>
      <div class="photo-dither" style="width:100%;height:170px;"><div class="cap">[ ${slug} — photos coming soon ]</div></div>
      <p class="meta" style="margin-top:10px;">Placeholder — I'll fill this in soon.</p>`;
  }

  const sideHustle = [
    { id: "sh-gaming",     name: "Gaming",       icon: "g-doc", title: "Gaming",       info: "Side Hustle · placeholder", size: { w: 420, h: 360 }, html: hobby("Gaming", "CS2, strategy games, and the occasional ranked grind with friends.") },
    { id: "sh-cat",        name: "Cat",          icon: "g-doc", title: "Cat",          info: "Side Hustle · placeholder", size: { w: 420, h: 360 }, html: hobby("Cat", "My cat runs QA on everything I build (mostly by sitting on the keyboard).") },
    { id: "sh-gym",        name: "Gym",          icon: "g-doc", title: "Gym",          info: "Side Hustle · placeholder", size: { w: 420, h: 360 }, html: hobby("Gym", "Lifting — chasing PRs away from the terminal.") },
    { id: "sh-photo",      name: "Photography",  icon: "g-doc", title: "Photography",  info: "Side Hustle · placeholder", size: { w: 420, h: 360 }, html: hobby("Photography", "Shooting the city, the coast, and the mountains around Vancouver.") },
    { id: "sh-snowboard",  name: "Snowboarding", icon: "g-doc", title: "Snowboarding", info: "Side Hustle · placeholder", size: { w: 420, h: 360 }, html: hobby("Snowboarding", "Winters on the local hills whenever the snow is good.") },
  ];

  /* ---------- desktop layout ----------
     kind: "harddrive" | "folder" | "trash" | undefined (document via `doc`) */
  const icons = [
    { id: "harddrive", kind: "harddrive", label: "Ivan's Mac", glyph: "g-hd", corner: "tr",
      title: "Ivan's Mac", info: "5 items · 512K in disk · 256K available", size: { w: 360, h: 270 } },
    { id: "about", doc: "about", label: "About Me", glyph: "g-doc", x: 24, y: 14,
      title: "About Me", info: "About · 24K", size: { w: 460, h: 380 } },
    { id: "projects", kind: "folder", label: "Projects", glyph: "g-folder", x: 24, y: 120,
      title: "Projects", info: "5 items · 128K in folder", size: { w: 380, h: 300 } },
    { id: "experience", doc: "experience", label: "Experience", glyph: "g-doc", x: 24, y: 226,
      title: "Experience", info: "Experience · 18K", size: { w: 460, h: 380 } },
    { id: "sidehustle", kind: "folder", items: sideHustle, label: "Side Hustle", glyph: "g-folder", x: 24, y: 332,
      title: "Side Hustle", info: "5 items · 64K in folder", size: { w: 420, h: 300 } },
    { id: "resume", doc: "resume", label: "Résumé", glyph: "g-resume", corner: "tr2",
      title: "Résumé", info: "Résumé · 32K", size: { w: 420, h: 400 } },
    { id: "contact", doc: "contact", label: "Contact", glyph: "g-mail", corner: "tr3",
      title: "Contact", info: "Contact · 8K", size: { w: 360, h: 340 } },
    { id: "trash", kind: "trash", label: "Trash", glyph: "g-trash", corner: "br",
      title: "Trash", info: "Empty", size: { w: 320, h: 260 } },
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
    projects,
    rocketShots,
    about,
    experience,
    resume,
    contact,
    icons,
  };
})();
