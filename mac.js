/* ============================================================
   System 1 — Macintosh Portfolio  (vanilla JS engine)
   ============================================================ */
(function () {
  "use strict";

  const screen = document.getElementById("screen");
  const desktop = document.getElementById("desktop");
  const chassis = document.getElementById("chassis");

  let zTop = 20;
  const openWindows = new Map(); // id -> element
  let liveDrag = localStorage.getItem("mac.liveDrag");
  liveDrag = liveDrag === null ? true : liveDrag === "true";

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ============================================================
     PIXEL-SVG GLYPHS  (crisp 1-bit, render everywhere)
     ============================================================ */
  function svgGlyph(type, size) {
    const s = (paths) =>
      `<svg width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="miter" style="display:block">${paths}</svg>`;
    const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    switch (type) {
      case "g-doc":
        return s(`<path d="M7 3 H20 L26 9 V29 H7 Z" fill="#fff"/><path d="M20 3 V9 H26"/>${L(11,15,22,15)}${L(11,19,22,19)}${L(11,23,18,23)}`);
      case "g-resume":
        return s(`<path d="M6 4 H19 L25 10 V30 H6 Z" fill="#fff"/><path d="M9 2 H22 L28 8 V28" fill="#fff"/><path d="M19 4 V10 H25"/>${L(10,16,21,16)}${L(10,20,21,20)}${L(10,24,17,24)}`);
      case "g-folder":
        return s(`<path d="M4 10 H12 L15 13 H28 V26 H4 Z" fill="#fff"/>${L(4,16,28,16)}`);
      case "g-hd":
        return s(`<rect x="3" y="10" width="26" height="13" rx="2" fill="#fff"/><rect x="18" y="18" width="8" height="2.5" fill="#000" stroke="none"/><circle cx="8" cy="20" r="1.4" fill="#000" stroke="none"/>`);
      case "g-mail":
        return s(`<rect x="3" y="8" width="26" height="17" fill="#fff"/><path d="M3 9 L16 18 L29 9"/>`);
      case "g-trash":
        return s(`<rect x="12" y="3" width="8" height="3" fill="#fff"/><rect x="8" y="6" width="16" height="4" rx="1" fill="#fff"/><path d="M10 10 H22 L21 29 H11 Z" fill="#fff"/>${L(14,14,14,25)}${L(16,14,16,25)}${L(18,14,18,25)}`);
      case "machead":
        return `<svg width="${size}" height="${size*1.08}" viewBox="0 0 46 50" shape-rendering="crispEdges" fill="none" stroke="#000" stroke-width="2" style="display:block"><rect x="3" y="2" width="40" height="46" rx="5" fill="#fff"/><rect x="9" y="8" width="28" height="23" fill="#fff"/><rect x="14" y="40" width="18" height="3" fill="#000" stroke="none"/></svg>`;
      case "avatar":
        return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" shape-rendering="geometricPrecision" fill="none" stroke="#000" stroke-width="2" style="display:block"><defs><clipPath id="ac"><circle cx="24" cy="24" r="21"/></clipPath></defs><circle cx="24" cy="24" r="22" fill="#fff"/><g clip-path="url(#ac)"><circle cx="24" cy="20" r="7.5" fill="#000" stroke="none"/><path d="M9 44 a15 15 0 0 1 30 0 Z" fill="#000" stroke="none"/></g></svg>`;
      case "happymac":
        return `<svg width="${size}" height="${size*1.18}" viewBox="0 0 80 94" shape-rendering="crispEdges" fill="none" stroke="#000" stroke-width="3" style="display:block"><rect x="5" y="3" width="70" height="88" rx="8" fill="#fff"/><rect x="14" y="11" width="52" height="50" rx="2" fill="#fff" stroke-width="2"/><rect x="26" y="27" width="6" height="9" fill="#000" stroke="none"/><rect x="48" y="27" width="6" height="9" fill="#000" stroke="none"/><path d="M28 45 q12 11 24 0" stroke-width="3"/><line x1="14" y1="68" x2="66" y2="68" stroke-width="2"/><rect x="22" y="78" width="36" height="4" fill="#000" stroke="none"/></svg>`;
      default:
        return s(`<rect x="6" y="4" width="20" height="24" fill="#fff"/>`);
    }
  }
  window.__svgGlyph = svgGlyph;

  /* ============================================================
     CONTENT  — Ivan's files
     ============================================================ */
  const PROJECTS = [
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
  const ROCKET_SHOTS = [
    { src: "assets/rocket/gcs-flight.png", cap: "Flight view — 3D attitude" },
    { src: "assets/rocket/gcs-tuning.png", cap: "PID tuning presets" },
    { src: "assets/rocket/gcs-map.png", cap: "UWB satellite map" },
  ];

  /* inline framed gallery — thumbnails that enlarge in place (see CSS .shots) */
  function galleryHTML(shots, heading) {
    if (!shots || !shots.length) return "";
    const tiles = shots
      .map(
        (s) =>
          `<figure class="shot"><span class="shot-frame"><img loading="lazy" src="${s.src}" alt="${s.cap}"></span><figcaption>${s.cap}</figcaption></figure>`
      )
      .join("");
    return `<div class="shots"><div class="shots-h">${heading || "Screenshots"}</div><div class="filmstrip">${tiles}</div></div>`;
  }

  function aboutContent() {
    return `
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div class="photo-dither"><div class="cap">[ ivan ]</div></div>
        <div style="flex:1 1 180px;min-width:170px;">
          <h2>Yingfan (Ivan) Luo</h2>
          <p style="font-family:'Monaco',monospace;font-size:11px;margin-top:-4px;">Computer Engineering @ UBC</p>
          <p>I build software across the stack — from embedded firmware where code meets hardware, to modern web and mobile apps.</p>
        </div>
      </div>
      <hr class="dotrule">
      <h3>UBC Rocket — Thrust Vectoring</h3>
      <p>I'm on UBC Rocket's TVR team, working toward a self-landing thrust-vectoring rocket. I work on the IMU/ECU firmware, the flight-control algorithm, and the ground-control-station software.</p>
      <hr class="dotrule">
      <h3>What I do</h3>
      <p>
        → Real-time &amp; embedded systems (STM32)<br>
        → Flight-control &amp; sensor pipelines<br>
        → Full-stack web &amp; mobile applications<br>
        → Retro computing enthusiast
      </p>
      <hr class="dotrule">
      <p style="font-family:'Monaco',monospace;font-size:11px;">
        Open to internship opportunities — reach out at<br>
        <a href="mailto:yingfanluo@gmail.com">yingfanluo@gmail.com</a>.
      </p>`;
  }

  function experienceContent() {
    return `
      <h2>Experience</h2>
      <hr class="rule">
      <h3>Full-Stack Software Engineer — Ruboss</h3>
      <p style="font-family:'Monaco',monospace;font-size:11px;margin:0 0 4px;">Ruboss Technology Corp. · May–Aug 2026 · Vancouver, BC</p>
      <p>
        • Co-developed Leanpub's native iOS app from scratch in SwiftUI as one of two developers — secure auth, book creation, and voice-input dictation against a GraphQL backend via Apollo iOS.<br>
        • Built a dual-mode chapter editor supporting raw Markua markup and a visual editor, then shipped a formatting toolbar and keyboard shortcuts shared across the web app and iOS.<br>
        • Fixed a production GraphQL bug where a non-nullable price field returned null and nulled entire book queries; shipped a fallback resolver with a regression test in Ruby on Rails.<br>
        • Built an AI-assisted workflow with Claude Code — custom skill files and MCP integrations (Linear, Harvest) — reviewing all generated code before merge.
      </p>
      <hr class="dotrule">
      <h3>Embedded Software Engineer — UBC Rocket</h3>
      <p style="font-family:'Monaco',monospace;font-size:11px;margin:0 0 4px;">TVR Team · Sept 2025 – present · Vancouver, BC</p>
      <p>
        • Engineer a high-performance ground control station in C++ and Qt — 100+ Hz telemetry, 3D attitude visualization, and a satellite-view map for real-time position tracking.<br>
        • Built the bidirectional radio link: COBS-encoded message framing, an updated Protobuf schema, and CSV logging of received packets for post-flight analysis.<br>
        • Developed and validated PID and flight-control-loop algorithms with CTest, catching regressions across tuning cycles; added in-station PID tuning presets.<br>
        • Delivered a 1 kHz IMU data pipeline with consistent timing via non-blocking SPI firmware on STM32.<br>
        • Developed STM32 firmware for a Qorvo DW3000 ultra-wideband (UWB) ranging module over UART for precise distance/position tracking.<br>
        • Tuned ESC/motor-control firmware and built a Python data-collection pipeline measuring force/torque vs. thrust %.
      </p>
      <p style="font-family:'Chicago';font-size:11px;"><a href="https://github.com/UBC-Rocket/thrust_vectoring_consolidated" target="_blank" rel="noopener">GitHub →</a></p>
      ${galleryHTML(ROCKET_SHOTS, "Ground Control Station")}
      <hr class="dotrule">
      <h3>Education</h3>
      <p style="font-family:'Monaco',monospace;font-size:11px;">B.A.Sc. Computer Engineering — University of British Columbia<br>GPA 86% · Class of 2028</p>`;
  }

  function resumeContent() {
    return `
      <h2 style="text-align:center;">RÉSUMÉ</h2>
      <hr class="rule">
      <h3>Yingfan (Ivan) Luo — Computer Engineering @ UBC</h3>
      <p style="font-family:'Monaco',monospace;font-size:11px;">Vancouver, BC · ivanluo.xyz<br>yingfanluo@gmail.com · 778-228-6477</p>
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

  function contactContent() {
    return `
      <h2 style="text-align:center;">Get in Touch</h2>
      <hr class="rule">
      <p><strong>Email</strong><br><a href="mailto:yingfanluo@gmail.com">yingfanluo@gmail.com</a></p>
      <p><strong>GitHub</strong><br><a href="https://github.com/ivan-lyf" target="_blank" rel="noopener">github.com/ivan-lyf</a></p>
      <p><strong>LinkedIn</strong><br><a href="https://www.linkedin.com/in/ivan-yingfan-luo/" target="_blank" rel="noopener">linkedin.com/in/ivan-yingfan-luo</a></p>
      <hr class="dotrule">
      <p style="font-family:'Monaco',monospace;font-size:11px;text-align:center;">
        Looking for Leon?<br>
        <a href="#" onclick="Mac.gotoLeon();return false;">→ leon.xyz</a>
      </p>`;
  }

  function trashContent() {
    return `
      <div style="text-align:center;padding:18px 4px;">
        <div style="margin:0 auto 14px;width:44px;">${svgGlyph('g-trash',44)}</div>
        <h3 style="font-family:'Chicago';">The Trash is empty.</h3>
        <p style="font-family:'Monaco',monospace;font-size:11px;">Nothing has been thrown away.<br>(Try dragging an icon onto me.)</p>
      </div>`;
  }

  /* ---------- folder/HD windows ---------- */
  function fileListWindow(items) {
    const wrap = el("div", "filelist");
    items.forEach((it) => {
      const row = el("div", "file");
      row.innerHTML = `<span class="mini">${svgGlyph(it.icon, 24)}</span><span class="fname">${it.name}</span>`;
      let last = 0;
      row.addEventListener("click", () => {
        $$(".file", wrap).forEach((f) => f.classList.remove("selected"));
        row.classList.add("selected");
        const now = Date.now();
        if (now - last < 380) it.open();
        last = now;
      });
      row.addEventListener("dblclick", it.open);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function openProject(p) {
    const body = el("div");
    const linksHTML =
      p.links && p.links.length
        ? `<p style="font-family:'Chicago';font-size:11px;">${p.links
            .map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label} →</a>`)
            .join(" &nbsp;·&nbsp; ")}</p>`
        : "";
    body.innerHTML = `
      <h2>${p.name}</h2>
      <p style="font-family:'Monaco',monospace;font-size:11px;margin-top:-4px;">${p.info}</p>
      <hr class="dotrule">
      <p>${p.blurb}</p>
      ${linksHTML}
      <h3>Tech</h3>
      <p>${p.stack.map((s) => `<span class="tag">${s}</span>`).join("")}</p>
      ${galleryHTML(p.shots, "Screenshots")}`;
    openWindow("proj-" + p.id, p.name, body, p.info, { w: 404, h: 360 });
  }

  function projectsFolderBody() {
    return fileListWindow(
      PROJECTS.map((p) => ({ name: p.name, icon: p.icon, open: () => openProject(p) }))
    );
  }

  function harddriveBody() {
    const items = [
      { name: "About Me", icon: "g-doc", open: () => openIcon("about") },
      { name: "Projects", icon: "g-folder", open: () => openIcon("projects") },
      { name: "Experience", icon: "g-doc", open: () => openIcon("experience") },
      { name: "Résumé", icon: "g-resume", open: () => openIcon("resume") },
      { name: "Contact", icon: "g-mail", open: () => openIcon("contact") },
    ];
    return fileListWindow(items);
  }

  /* ============================================================
     DESKTOP ICONS
     ============================================================ */
  const ICONS = [
    { id: "harddrive", label: "Ivan's Mac", glyph: "g-hd", x: 0, y: 0, corner: "tr",
      title: "Ivan's Mac", info: "5 items · 512K in disk · 256K available",
      build: harddriveBody, size: { w: 300, h: 230 } },
    { id: "about", label: "About Me", glyph: "g-doc", x: 24, y: 14,
      title: "About Me", info: "About · 24K", build: () => htmlBody(aboutContent()), size: { w: 380, h: 300 } },
    { id: "projects", label: "Projects", glyph: "g-folder", x: 24, y: 120,
      title: "Projects", info: "5 items · 128K in folder", build: projectsFolderBody, size: { w: 320, h: 250 } },
    { id: "experience", label: "Experience", glyph: "g-doc", x: 24, y: 226,
      title: "Experience", info: "Experience · 18K", build: () => htmlBody(experienceContent()), size: { w: 360, h: 300 } },
    { id: "resume", label: "Résumé", glyph: "g-resume", x: 0, y: 0, corner: "tr2",
      title: "Résumé", info: "Résumé · 32K", build: () => htmlBody(resumeContent()), size: { w: 340, h: 320 } },
    { id: "contact", label: "Contact", glyph: "g-mail", x: 0, y: 0, corner: "tr3",
      title: "Contact", info: "Contact · 8K", build: () => htmlBody(contactContent()), size: { w: 300, h: 300 } },
    { id: "trash", label: "Trash", glyph: "g-trash", x: 0, y: 0, corner: "br",
      title: "Trash", info: "Empty", build: () => htmlBody(trashContent()), size: { w: 280, h: 230 } },
  ];

  function htmlBody(html) {
    const d = el("div");
    d.innerHTML = html;
    return d;
  }

  function iconById(id) { return ICONS.find((i) => i.id === id); }

  function placeIcons() {
    desktop.querySelectorAll(".icon").forEach((n) => n.remove());
    const W = desktop.clientWidth;
    const H = desktop.clientHeight;
    ICONS.forEach((ic) => {
      const node = el("div", "icon");
      node.dataset.id = ic.id;
      node.innerHTML = `<div class="glyph">${svgGlyph(ic.glyph, 44)}</div><div class="label">${ic.label}</div>`;
      let x = ic.x, y = ic.y;
      if (ic.corner === "tr") { x = W - 108; y = 14; }
      if (ic.corner === "tr2") { x = W - 108; y = 120; }
      if (ic.corner === "tr3") { x = W - 108; y = 226; }
      if (ic.corner === "br") { x = W - 104; y = H - 110; }
      node.style.left = x + "px";
      node.style.top = y + "px";
      wireIcon(node, ic);
      desktop.appendChild(node);
    });
  }

  function wireIcon(node, ic) {
    let last = 0;
    let down = null;
    node.addEventListener("mousedown", (e) => {
      down = { x: e.clientX, y: e.clientY, ox: parseInt(node.style.left), oy: parseInt(node.style.top), moved: false };
      $$(".icon", desktop).forEach((n) => n.classList.remove("selected"));
      node.classList.add("selected");
      const onMove = (ev) => {
        if (!down) return;
        const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
        if (down.moved) {
          node.style.left = down.ox + dx + "px";
          node.style.top = down.oy + dy + "px";
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        down = null;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    node.addEventListener("click", () => {
      const now = Date.now();
      if (now - last < 380) openIcon(ic.id);
      last = now;
    });
    node.addEventListener("dblclick", () => openIcon(ic.id));
  }

  /* ============================================================
     WINDOWS
     ============================================================ */
  function openIcon(id) {
    const ic = iconById(id);
    if (!ic) return;
    const node = desktop.querySelector(`.icon[data-id="${id}"]`);
    const origin = node ? node.getBoundingClientRect() : null;
    openWindow(id, ic.title, ic.build(), ic.info, ic.size, origin);
  }

  function openWindow(id, title, bodyNode, info, size, originRect) {
    if (openWindows.has(id)) {
      focusWindow(openWindows.get(id));
      return;
    }
    size = size || { w: 340, h: 260 };

    const win = el("div", "win active");
    win.dataset.id = id;
    const offset = openWindows.size * 22;
    const startX = 70 + offset;
    const startY = 40 + offset;
    win.style.left = startX + "px";
    win.style.top = startY + "px";
    win.style.width = size.w + "px";
    win.style.height = size.h + "px";
    win.style.zIndex = ++zTop;

    const tb = el("div", "titlebar");
    tb.innerHTML = `<div class="close-box"></div><div class="title">${title}</div>`;
    const info_html = info ? `<div class="infoline">${formatInfo(info)}</div>` : "";

    const bodyWrap = el("div", "win-body");
    const content = el("div", "content txt");
    content.appendChild(bodyNode);
    const scroll = el("div", "scroll-v");
    scroll.innerHTML =
      `<div class="arrow up"><span class="tri up"></span></div>` +
      `<div class="track dither-50"><div class="thumb"></div></div>` +
      `<div class="arrow down"><span class="tri down"></span></div>`;
    bodyWrap.appendChild(content);
    bodyWrap.appendChild(scroll);

    win.appendChild(tb);
    if (info) win.insertAdjacentHTML("beforeend", info_html);
    win.appendChild(bodyWrap);

    const grow = el("div", "growbox", `<div class="mark"></div>`);
    win.appendChild(grow);

    desktop.appendChild(win);
    openWindows.set(id, win);

    // focus handling
    win.addEventListener("mousedown", () => focusWindow(win));
    $(".close-box", win).addEventListener("click", (e) => { e.stopPropagation(); closeWindow(id); });
    makeDraggable(win, tb);
    makeResizable(win, grow, size);
    updateThumb(content, scroll);
    content.addEventListener("scroll", () => updateThumb(content, scroll));

    setActive(win);

    // zoom-rectangle open animation
    if (originRect) zoomOpen(originRect, win);
  }

  function formatInfo(info) {
    return info
      .split("·")
      .map((s) => `<span>${s.trim()}</span>`)
      .join('<span class="sep"></span>');
  }

  function updateThumb(content, scroll) {
    const thumb = $(".thumb", scroll);
    const track = $(".track", scroll);
    if (!thumb || !track) return;
    const ratio = content.clientHeight / content.scrollHeight;
    if (ratio >= 1) {
      thumb.style.display = "none";
      track.classList.remove("dither-50");
      track.style.background = "var(--paper)";
      return;
    }
    track.classList.add("dither-50");
    track.style.background = "";
    thumb.style.display = "block";
    const th = Math.max(22, track.clientHeight * ratio - 4);
    const maxTop = track.clientHeight - th - 4;
    const top = (content.scrollTop / (content.scrollHeight - content.clientHeight)) * maxTop;
    thumb.style.height = th + "px";
    thumb.style.marginTop = (2 + top) + "px";
  }

  function setActive(win) {
    openWindows.forEach((w) => w.classList.remove("active"));
    win.classList.add("active");
  }
  function focusWindow(win) {
    if (parseInt(win.style.zIndex) !== zTop) win.style.zIndex = ++zTop;
    setActive(win);
  }
  function closeWindow(id) {
    const win = openWindows.get(id);
    if (!win) return;
    win.remove();
    openWindows.delete(id);
    // activate top-most remaining
    let top = null, topz = -1;
    openWindows.forEach((w) => {
      const z = parseInt(w.style.zIndex);
      if (z > topz) { topz = z; top = w; }
    });
    if (top) setActive(top);
  }

  /* ---------- dragging (live or marching-ants) ---------- */
  function makeDraggable(win, handle) {
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".close-box")) return;
      e.preventDefault();
      focusWindow(win);
      const startX = e.clientX, startY = e.clientY;
      const ox = parseInt(win.style.left), oy = parseInt(win.style.top);
      let ghost = null;
      if (!liveDrag) {
        ghost = el("div", "drag-ghost");
        ghost.style.left = ox + "px";
        ghost.style.top = oy + "px";
        ghost.style.width = win.offsetWidth + "px";
        ghost.style.height = win.offsetHeight + "px";
        desktop.appendChild(ghost);
      }
      const onMove = (ev) => {
        const nx = ox + (ev.clientX - startX);
        const ny = Math.max(0, oy + (ev.clientY - startY));
        if (liveDrag) {
          win.style.left = nx + "px";
          win.style.top = ny + "px";
        } else {
          ghost.style.left = nx + "px";
          ghost.style.top = ny + "px";
        }
      };
      const onUp = (ev) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (!liveDrag) {
          win.style.left = ox + (ev.clientX - startX) + "px";
          win.style.top = Math.max(0, oy + (ev.clientY - startY)) + "px";
          ghost.remove();
        }
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  /* ---------- resizing via grow box ---------- */
  function makeResizable(win, grow, size) {
    grow.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win);
      const startX = e.clientX, startY = e.clientY;
      const ow = win.offsetWidth, oh = win.offsetHeight;
      const onMove = (ev) => {
        win.style.width = Math.max(240, ow + (ev.clientX - startX)) + "px";
        win.style.height = Math.max(150, oh + (ev.clientY - startY)) + "px";
        const content = $(".content", win);
        const scroll = $(".scroll-v", win);
        updateThumb(content, scroll);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  /* ---------- zoom rectangles ---------- */
  function zoomOpen(from, win) {
    const dRect = desktop.getBoundingClientRect();
    const to = win.getBoundingClientRect();
    const fx = from.left - dRect.left, fy = from.top - dRect.top;
    const tx = to.left - dRect.left, ty = to.top - dRect.top;
    const steps = 5;
    win.style.visibility = "hidden";
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const r = el("div", "zoom-rect");
      r.style.left = fx + (tx - fx) * t + "px";
      r.style.top = fy + (ty - fy) * t + "px";
      r.style.width = from.width + (to.width - from.width) * t + "px";
      r.style.height = from.height + (to.height - from.height) * t + "px";
      r.style.animationDelay = i * 18 + "ms";
      desktop.appendChild(r);
      setTimeout(() => r.remove(), 260 + i * 18);
    }
    setTimeout(() => { win.style.visibility = "visible"; }, 110);
  }

  /* ============================================================
     MENU BAR
     ============================================================ */
  const MENUS = {
    apple: {
      glyph: true,
      items: [
        { label: "About This Macintosh…", action: () => openWindow("about-mac", "About This Macintosh", htmlBody(aboutMacBody()), null, { w: 340, h: 230 }) },
        { divider: true },
        { label: "Control Panel", action: openControlPanel },
        { divider: true },
        { label: "Log Out…", action: logout },
      ],
    },
    File: { items: [
      { label: "Open", action: () => openIcon("harddrive") },
      { label: "Close Window", action: closeFront },
      { divider: true },
      { label: "Page Setup…", disabled: true },
      { label: "Print…", disabled: true },
    ]},
    Edit: { items: [
      { label: "Undo", disabled: true }, { divider: true },
      { label: "Cut", disabled: true }, { label: "Copy", disabled: true },
      { label: "Paste", disabled: true }, { label: "Clear", disabled: true },
    ]},
    View: { items: [
      { label: "by Icon", check: true }, { label: "by Name", disabled: true },
      { label: "by Size", disabled: true }, { label: "by Kind", disabled: true },
    ]},
    Special: { items: [
      { label: "Clean Up Desktop", action: placeIcons },
      { label: "Empty Trash", action: () => Mac.alert("Empty Trash", "The Trash is already empty. There is nothing to throw away.", "OK") },
      { divider: true },
      { label: "Restart", action: () => location.reload() },
      { label: "Shut Down", action: shutDown },
    ]},
  };

  function buildMenuBar() {
    const bar = $("#menubar");
    bar.innerHTML = "";
    Object.keys(MENUS).forEach((key) => {
      const m = MENUS[key];
      const item = el("div", "menu-item" + (m.glyph ? " apple" : ""));
      item.innerHTML = m.glyph ? `<span class="apple-glyph"></span>` : `<span class="ml">${key}</span>`;
      item.dataset.menu = key;
      bar.appendChild(item);
    });
    const clock = el("div", "clock");
    bar.appendChild(clock);
    tickClock(clock);
    setInterval(() => tickClock(clock), 10000);

    let active = null;
    function close() {
      $$(".menu-item.open", bar).forEach((n) => n.classList.remove("open"));
      $$(".dropdown", bar).forEach((n) => n.remove());
      active = null;
    }
    function open(item) {
      close();
      const key = item.dataset.menu;
      item.classList.add("open");
      const dd = el("div", "dropdown");
      MENUS[key].items.forEach((it) => {
        if (it.divider) { dd.appendChild(el("div", "divider")); return; }
        const row = el("div", "row" + (it.disabled ? " disabled" : " has"));
        row.innerHTML = (it.check ? `<span class="check">✓</span>` : "") + it.label;
        if (!it.disabled) row.addEventListener("click", () => { close(); it.action && it.action(); });
        dd.appendChild(row);
      });
      item.appendChild(dd);
      active = item;
    }
    bar.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        if (active === item) close();
        else open(item);
      });
      item.addEventListener("mouseenter", () => { if (active) open(item); });
    });
    document.addEventListener("mousedown", close);
  }

  function tickClock(node) {
    node.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  function closeFront() {
    let top = null, topz = -1;
    openWindows.forEach((w, id) => {
      const z = parseInt(w.style.zIndex);
      if (z > topz) { topz = z; top = id; }
    });
    if (top) closeWindow(top);
  }

  function aboutMacBody() {
    return `
      <div style="text-align:center;">
        <div class="login-body" style="padding:0;">
          <div style="margin:6px auto 10px;display:flex;justify-content:center;">${svgGlyph('machead',44)}</div>
        </div>
        <h2 style="font-family:'Chicago';">Macintosh Portfolio</h2>
        <p style="font-family:'Monaco',monospace;font-size:11px;">System Software 1.0</p>
        <hr class="dotrule">
        <p style="font-family:'Geneva','Monaco',sans-serif;font-size:12px;">
          Total Memory: 128K<br>
          Built with HTML · CSS · JavaScript<br>
          A faithful 1984 Macintosh, for Ivan.
        </p>
        <p style="font-family:'Monaco',monospace;font-size:10px;margin-top:10px;">© 2026 ivanluo.xyz</p>
      </div>`;
  }

  /* ============================================================
     CONTROL PANEL  (CRT + monitor toggles)
     ============================================================ */
  function openControlPanel() {
    if (openWindows.has("control")) { focusWindow(openWindows.get("control")); return; }
    const body = el("div");
    body.innerHTML = `
      <h2>Control Panel</h2>
      <hr class="rule">
      <h3>Monitor</h3>
      <div id="cp-monitor" style="display:flex;gap:8px;margin:6px 0 12px;">
        <button class="mac-btn cp-mono" data-mode="bw">Black &amp; White</button>
        <button class="mac-btn cp-mono" data-mode="green">Green Phosphor</button>
      </div>
      <h3>CRT Effects</h3>
      <div style="display:flex;gap:8px;margin:6px 0 12px;">
        <button class="mac-btn" id="cp-crt">Scanlines &amp; Glow: ON</button>
      </div>
      <h3>Window Dragging</h3>
      <div style="display:flex;gap:8px;margin:6px 0 4px;">
        <button class="mac-btn" id="cp-drag">${liveDrag ? "Live" : "Outline (marching ants)"}</button>
      </div>
      <p style="font-family:'Monaco',monospace;font-size:10px;margin-top:10px;">Tip: every section is a file — double-click to open.</p>`;
    openWindow("control", "Control Panel", body, "System · 4K", { w: 320, h: 320 });

    const win = openWindows.get("control");
    const syncMono = () => {
      const green = screen.classList.contains("mono-green");
      $$(".cp-mono", win).forEach((b) => {
        const on = (b.dataset.mode === "green") === green;
        b.classList.toggle("default", on);
      });
    };
    $$(".cp-mono", win).forEach((b) => {
      b.addEventListener("click", () => {
        screen.classList.toggle("mono-green", b.dataset.mode === "green");
        localStorage.setItem("mac.mono", b.dataset.mode);
        syncMono();
      });
    });
    syncMono();

    const crtBtn = $("#cp-crt", win);
    crtBtn.addEventListener("click", () => {
      const on = chassis.classList.toggle("crt-on");
      crtBtn.textContent = "Scanlines & Glow: " + (on ? "ON" : "OFF");
      localStorage.setItem("mac.crt", on);
    });

    const dragBtn = $("#cp-drag", win);
    dragBtn.addEventListener("click", () => {
      liveDrag = !liveDrag;
      localStorage.setItem("mac.liveDrag", liveDrag);
      dragBtn.textContent = liveDrag ? "Live" : "Outline (marching ants)";
    });
  }

  /* ============================================================
     PUBLIC ALERTS / DIALOGS
     ============================================================ */
  function alertBox(title, message, okLabel, onOk) {
    const layer = el("div", "alert-layer");
    layer.innerHTML = `
      <div class="alert">
        <div class="ico">!</div>
        <div class="body">
          <p><strong>${title}</strong><br>${message}</p>
          <div class="btns">
            <button class="mac-btn default ok">${okLabel || "OK"}</button>
          </div>
        </div>
      </div>`;
    screen.appendChild(layer);
    $(".ok", layer).addEventListener("click", () => { layer.remove(); onOk && onOk(); });
  }

  function gotoLeon() {
    const layer = el("div", "alert-layer");
    layer.innerHTML = `
      <div class="alert">
        <div class="ico">?</div>
        <div class="body">
          <p><strong>Switch to Leon's Macintosh?</strong><br>
          Leon's profile lives on its own disk at <strong>leon.xyz</strong>. You'll leave Ivan's machine to visit it.</p>
          <div class="btns">
            <button class="mac-btn cancel">Cancel</button>
            <button class="mac-btn default go">Go to leon.xyz</button>
          </div>
        </div>
      </div>`;
    screen.appendChild(layer);
    $(".cancel", layer).addEventListener("click", () => layer.remove());
    $(".go", layer).addEventListener("click", () => {
      layer.remove();
      // In production this is: window.location.href = "https://leon.xyz";
      alertBox("Demo handoff", "In production this navigates to https://leon.xyz — Leon's own deployment. Wired here as a demo.", "OK");
    });
  }

  function shutDown() {
    const layer = el("div", "boot");
    layer.style.zIndex = 9800;
    layer.innerHTML = `<div class="welcome-txt" style="font-size:18px;text-align:center;">It is now safe to turn off<br>your Macintosh.</div>`;
    screen.appendChild(layer);
  }

  /* ============================================================
     BOOT  +  LOGIN
     ============================================================ */
  function runBoot(done) {
    const boot = $("#boot");
    const happy = $("#boot-happy");
    const welcome = $("#boot-welcome");
    const bar = $("#boot-bar");
    boot.classList.remove("hidden");
    happy.classList.remove("hidden");
    welcome.classList.add("hidden");

    let skipped = false;
    const skip = () => { if (!skipped) { skipped = true; finish(); } };
    boot.addEventListener("click", skip);

    setTimeout(() => {
      if (skipped) return;
      happy.classList.add("hidden");
      welcome.classList.remove("hidden");
      requestAnimationFrame(() => { bar.style.width = "100%"; });
    }, 1300);

    const t = setTimeout(finish, 3400);
    function finish() {
      clearTimeout(t);
      boot.removeEventListener("click", skip);
      boot.classList.add("hidden");
      done();
    }
  }

  function showLogin() {
    $("#login").classList.remove("hidden");
    const ivan = $("#user-ivan");
    const leon = $("#user-leon");
    ivan.addEventListener("click", () => {
      $("#login").classList.add("hidden");
      startDesktop();
    });
    leon.addEventListener("click", gotoLeon);
  }

  function startDesktop() {
    desktop.classList.remove("hidden");
    placeIcons();
    window.addEventListener("resize", debounce(placeIcons, 200));
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function logout() {
    openWindows.forEach((w) => w.remove());
    openWindows.clear();
    desktop.classList.add("hidden");
    $("#login").classList.remove("hidden");
  }

  /* ============================================================
     INIT
     ============================================================ */
  function restorePrefs() {
    const mono = localStorage.getItem("mac.mono");
    if (mono === "green") screen.classList.add("mono-green");
    const crt = localStorage.getItem("mac.crt");
    if (crt === null || crt === "true") chassis.classList.add("crt-on");
  }

  function init() {
    restorePrefs();
    // populate static glyphs
    const hm = document.getElementById("happy-mac");
    if (hm) hm.innerHTML = svgGlyph("happymac", 80);
    const mh = document.getElementById("login-machead");
    if (mh) mh.innerHTML = svgGlyph("machead", 44);
    document.querySelectorAll('[data-glyph="avatar"]').forEach((a) => { a.innerHTML = svgGlyph("avatar", 52); });
    buildMenuBar();

    // Inline gallery: click a framed thumbnail to enlarge it in place.
    desktop.addEventListener("click", (e) => {
      const fig = e.target.closest(".shot");
      if (!fig || !desktop.contains(fig)) return;
      fig.classList.toggle("expanded");
      const content = fig.closest(".content");
      const wbody = content && content.parentElement;
      const scroll = wbody && wbody.querySelector(".scroll-v");
      if (content && scroll) updateThumb(content, scroll);
    });

    runBoot(showLogin);
  }

  // public API
  window.Mac = {
    alert: alertBox,
    gotoLeon,
    openControlPanel,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
