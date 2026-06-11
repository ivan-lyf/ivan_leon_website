/* ============================================================
   System 1 — Macintosh Portfolio  (vanilla JS engine)

   Domain-agnostic. Person-specific content lives in profile-*.js
   (registered on window.PROFILES). On load the engine resolves the
   "owner" from the hostname (leonmeng.xyz → leon, otherwise ivan) and
   renders that profile's desktop. The login screen is shared: the
   owner is THIS MAC, the other person is an external disk.

   Local preview: append ?as=ivan or ?as=leon to force a side.
   ============================================================ */
(function () {
  "use strict";

  const screen = document.getElementById("screen");
  const desktop = document.getElementById("desktop");
  const chassis = document.getElementById("chassis");

  const PROFILES = window.PROFILES || {};
  let ACTIVE = null;   // the owner of this domain
  let OTHER = null;    // the other person (external disk)

  let zTop = 20;
  const openWindows = new Map(); // id -> element

  // Now Playing widget state (one curated track per session + minimized disc tab)
  let npBox = null, npDisc = null, npTracks = null, npIndex = 0;
  // GitHub contributions widget state (menubar tab toggles it; fetched lazily)
  let ghBox = null, ghFetched = false;
  let liveDrag = localStorage.getItem("mac.liveDrag");
  liveDrag = liveDrag === null ? true : liveDrag === "true";

  // Finder view mode (by Icon/Name/Size/Kind) + double-click speed (Control Panel)
  let viewMode = localStorage.getItem("mac.view") || "icon";
  let dblThreshold = parseInt(localStorage.getItem("mac.dblspeed") || "380", 10);

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // In the 3D scene the desktop is rendered inside a CSS-scaled #screen-host. Drag
  // handlers read viewport-pixel deltas (clientX/Y) but write unscaled style.left/top,
  // so divide deltas by this scale to keep the cursor and the dragged element together.
  function dragScale() {
    const r = desktop.getBoundingClientRect();
    return (desktop.clientWidth && r.width) ? r.width / desktop.clientWidth : 1;
  }

  /* ============================================================
     SOUND  — System beeps synthesized with Web Audio (no asset files).
     Browsers block audio until a user gesture, so we unlock on first click.
     ============================================================ */
  const Sound = (function () {
    let ctx = null;
    let on = localStorage.getItem("mac.sound");
    on = on === null ? true : on === "true";
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
      }
      if (ctx && ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function blip(freq, start, dur, type, peak) {
      const c = ctx, t = c.currentTime + start;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak || 0.12, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    }
    function play(name) {
      if (!on) return;
      const c = ensure();
      if (!c) return;
      switch (name) {
        case "click": blip(950, 0, 0.05, "square", 0.08); break;
        case "open":  blip(620, 0, 0.06, "triangle", 0.1); blip(930, 0.05, 0.07, "triangle", 0.08); break;
        case "close": blip(760, 0, 0.06, "triangle", 0.1); blip(500, 0.05, 0.07, "triangle", 0.08); break;
        case "beep":  blip(440, 0, 0.16, "square", 0.12); blip(330, 0.07, 0.18, "square", 0.1); break; // error
        case "trash": blip(300, 0, 0.12, "sawtooth", 0.12); blip(200, 0.08, 0.16, "sawtooth", 0.1); break;
        case "chime": [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, i * 0.11, 0.42, "sine", 0.13)); break;
      }
    }
    return {
      play,
      isOn: () => on,
      set(v) { on = !!v; localStorage.setItem("mac.sound", on); },
      unlock() { ensure(); },
    };
  })();

  /* ---------- owner resolution ---------- */
  function resolveOwnerId() {
    const q = new URLSearchParams(location.search).get("as");
    if (q && PROFILES[q]) return q;
    if (/leon/i.test(location.hostname) && PROFILES.leon) return "leon";
    if (PROFILES.ivan) return "ivan";
    return Object.keys(PROFILES)[0]; // last resort: whatever loaded
  }
  function otherId(id) {
    const ids = Object.keys(PROFILES);
    return ids.find((k) => k !== id) || id;
  }

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
      case "disc":
        // Vinyl record — spins via CSS when used as the minimized Now-Playing tab
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="#000" stroke-width="2" shape-rendering="geometricPrecision" style="display:block"><circle cx="16" cy="16" r="13" fill="#fff"/><circle cx="16" cy="16" r="4.5"/><circle cx="16" cy="16" r="1.3" fill="#000" stroke="none"/><path d="M16 3 A13 13 0 0 1 29 16" stroke-width="1.5"/></svg>`;
      case "gh-grid":
        // tiny contribution heat-grid — the menubar tab for the GitHub widget
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges" style="display:block">${
          [0,1,2,3].map((r) => [0,1,2,3].map((c) =>
            `<rect x="${3 + c * 7}" y="${3 + r * 7}" width="5" height="5" fill="#000" opacity="${[0.15,0.45,0.75,1][(r + c * 3) % 4]}"/>`
          ).join("")).join("")
        }</svg>`;
      case "g-globe":
        // Low-poly wireframe globe (GARDEROBE desktop link)
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="#000" stroke-width="1.5" shape-rendering="geometricPrecision" style="display:block"><circle cx="16" cy="16" r="13" fill="#fff"/><ellipse cx="16" cy="16" rx="6.5" ry="13"/><line x1="16" y1="3" x2="16" y2="29"/><line x1="4.5" y1="10.5" x2="27.5" y2="10.5"/><line x1="3" y1="16" x2="29" y2="16"/><line x1="4.5" y1="21.5" x2="27.5" y2="21.5"/></svg>`;
      case "smiley":
        // 1-bit pixel smiley — white face, black outline + eyes + grin (Leon's user icon)
        return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges" style="display:block"><circle cx="16" cy="16" r="14.5" fill="#fff" stroke="#000" stroke-width="2"/><rect x="9.5" y="10" width="3.5" height="4.5" fill="#000"/><rect x="19" y="10" width="3.5" height="4.5" fill="#000"/><path d="M9 18 Q16 25 23 18" fill="none" stroke="#000" stroke-width="2.5"/></svg>`;
      case "apple":
        // WHOLE apple (NO bite) — rounded body + leaf, solid 1-bit fill
        return `<svg width="${size}" height="${size}" viewBox="0 0 100 112" fill="#000" style="display:block"><path d="M50 32 C47 25 42 19 34 19 C18 19 8 33 8 53 C8 78 27 105 50 105 C73 105 92 78 92 53 C92 33 82 19 66 19 C58 19 53 25 50 32 Z"/><path d="M51 28 C55 12 67 6 76 7 C74 22 62 30 52 28 Z"/></svg>`;
      default:
        return s(`<rect x="6" y="4" width="20" height="24" fill="#fff"/>`);
    }
  }
  window.__svgGlyph = svgGlyph;

  /* Framed picture carousel — one image at a time, ‹ › to step through
     (see CSS .gallery / carNav() / openLightbox()). Exposed globally so
     profile-*.js content builders can embed galleries. */
  function galleryHTML(shots, heading) {
    if (!shots || !shots.length) return "";
    const multi = shots.length > 1;
    const slides = shots
      .map(
        (s, i) =>
          `<figure class="shot${i === 0 ? " active" : ""}" data-i="${i}"><span class="shot-frame"><img loading="lazy" src="${s.src}" alt="${s.cap}"></span></figure>`
      )
      .join("");
    const prev = multi ? `<button class="car-nav prev" type="button" aria-label="Previous picture">‹</button>` : "";
    const next = multi ? `<button class="car-nav next" type="button" aria-label="Next picture">›</button>` : "";
    const count = multi ? `<span class="car-count">1 / ${shots.length}</span>` : "";
    return (
      `<div class="shots"><div class="shots-h">${heading || "Screenshots"}</div>` +
      `<div class="gallery" data-i="0">${prev}<div class="car-stage">${slides}</div>${next}</div>` +
      `<div class="car-meta"><span class="car-cap">${shots[0].cap || ""}</span>${count}</div></div>`
    );
  }
  window.galleryHTML = galleryHTML;

  // Step a carousel to the next/prev slide and refresh caption + counter.
  function carNav(gallery, dir) {
    if (!gallery) return;
    const figs = $$(".shot", gallery);
    const n = figs.length;
    if (!n) return;
    let i = (parseInt(gallery.dataset.i || "0", 10) + dir + n) % n;
    gallery.dataset.i = i;
    figs.forEach((f, k) => f.classList.toggle("active", k === i));
    const shots = gallery.closest(".shots");
    const cap = $(".car-cap", shots);
    const count = $(".car-count", shots);
    if (cap) cap.textContent = figs[i].querySelector("img").alt || "";
    if (count) count.textContent = `${i + 1} / ${n}`;
    // image height can differ → recompute the window's scroll thumb
    const content = gallery.closest(".content");
    const wbody = content && content.parentElement;
    const scroll = wbody && wbody.querySelector(".scroll-v");
    if (content && scroll) updateThumb(content, scroll);
  }

  function htmlBody(html) {
    const d = el("div");
    d.innerHTML = html;
    return d;
  }

  function trashContent() {
    return `
      <div style="text-align:center;padding:18px 4px;">
        <div style="margin:0 auto 14px;width:44px;">${svgGlyph('g-trash',44)}</div>
        <h3 style="font-family:'Chicago';">The Trash is empty.</h3>
        <p style="font-family:'Monaco',monospace;font-size:13px;">Nothing has been thrown away.<br>(Try dragging an icon onto me.)</p>
      </div>`;
  }

  /* ---------- folder/HD windows ---------- */
  function fileListWindow(items) {
    const wrap = el("div", "filelist");
    if (viewMode !== "icon") items = items.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    items.forEach((it) => {
      const row = el("div", "file");
      row.innerHTML = `<span class="mini">${svgGlyph(it.icon, 24)}</span><span class="fname">${it.name}</span>`;
      let last = 0;
      row.addEventListener("click", () => {
        $$(".file", wrap).forEach((f) => f.classList.remove("selected"));
        row.classList.add("selected");
        const now = Date.now();
        if (now - last < dblThreshold) it.open();
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
        ? `<p style="font-family:'Chicago';font-size:13px;">${p.links
            .map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label} →</a>`)
            .join(" &nbsp;·&nbsp; ")}</p>`
        : "";
    body.innerHTML = `
      <h2>${p.name}</h2>
      <p style="font-family:'Monaco',monospace;font-size:13px;margin-top:-4px;">${p.info}</p>
      <hr class="dotrule">
      <p>${p.blurb}</p>
      ${linksHTML}
      <h3>Tech</h3>
      <p>${p.stack.map((s) => `<span class="tag">${s}</span>`).join("")}</p>
      ${galleryHTML(p.shots, "Screenshots")}`;
    openWindow("proj-" + p.id, p.name, body, p.info, { w: 480, h: 440 });
  }

  // A folder either lists this profile's projects (default) or a custom `items`
  // array (e.g. the Side Hustle folder), where each item opens its own window.
  function folderBody(ic) {
    if (ic.items && ic.items.length) {
      return fileListWindow(
        ic.items.map((it) => ({ name: it.name, icon: it.icon || "g-doc", open: () => openFolderItem(it) }))
      );
    }
    return projectsFolderBody();
  }

  function openFolderItem(it) {
    const html = typeof it.build === "function" ? it.build() : (it.html || "");
    openWindow(it.id, it.title || it.name, htmlBody(html), it.info, it.size || { w: 400, h: 320 });
  }

  function projectsFolderBody() {
    const projects = ACTIVE.projects || [];
    if (!projects.length) {
      return htmlBody(`<div style="text-align:center;padding:24px 8px;">
        <div style="margin:0 auto 12px;width:42px;">${svgGlyph('g-folder',42)}</div>
        <h3 style="font-family:'Chicago';">No projects yet.</h3>
        <p style="font-family:'Monaco',monospace;font-size:13px;">This folder is empty.</p></div>`);
    }
    return fileListWindow(
      projects.map((p) => ({ name: p.name, icon: p.icon, open: () => openProject(p) }))
    );
  }

  function harddriveBody() {
    // List every document/folder icon on this profile's desktop (skip the HD itself + Trash).
    const items = ACTIVE.icons
      .filter((ic) => ic.kind !== "harddrive" && ic.kind !== "trash")
      .map((ic) => ({ name: ic.title || ic.label, icon: ic.glyph, open: () => openIcon(ic.id) }));
    return fileListWindow(items);
  }

  function iconById(id) { return ACTIVE.icons.find((i) => i.id === id); }

  /* ---------- Finder metadata (used by Get Info + View sorting) ---------- */
  function iconKind(ic) {
    if (ic.kind === "harddrive") return "disk";
    if (ic.kind === "folder") return "folder";
    if (ic.kind === "trash") return "trash";
    return "document";
  }
  function iconSizeK(ic) {
    const m = (ic.info || "").match(/(\d+)\s*K/);
    if (m) return parseInt(m[1], 10);
    if (ic.kind === "harddrive") return 512;
    if (ic.kind === "folder") return 128;
    return 16;
  }
  function sortIcons(list, mode) {
    const arr = list.slice();
    const byName = (a, b) => (a.label || "").localeCompare(b.label || "");
    if (mode === "name") arr.sort(byName);
    else if (mode === "size") arr.sort((a, b) => iconSizeK(b) - iconSizeK(a) || byName(a, b));
    else if (mode === "kind") arr.sort((a, b) => iconKind(a).localeCompare(iconKind(b)) || byName(a, b));
    return arr;
  }
  function setView(mode) {
    viewMode = mode;
    localStorage.setItem("mac.view", mode);
    placeIcons();
  }

  /* ---------- Control Panel settings (also applied on boot by restorePrefs) ---------- */
  function setMono(mode) {
    screen.classList.toggle("mono-green", mode === "green");
    screen.classList.toggle("mono-amber", mode === "amber");
    localStorage.setItem("mac.mono", mode);
  }
  function setPattern(p) {
    const bg = $(".desktop-bg", desktop);
    if (bg) bg.className = "desktop-bg" + (p && p !== "plain" ? " " + p : "");
    localStorage.setItem("mac.pattern", p);
  }
  function setDblSpeed(ms) {
    dblThreshold = ms;
    localStorage.setItem("mac.dblspeed", ms);
  }

  function placeIcons() {
    desktop.querySelectorAll(".icon").forEach((n) => n.remove());
    const W = desktop.clientWidth;
    const H = desktop.clientHeight;
    const sorted = viewMode === "icon" ? ACTIVE.icons : sortIcons(ACTIVE.icons, viewMode);
    const cols = Math.max(1, Math.floor((W - 20) / 96));
    sorted.forEach((ic, idx) => {
      const node = el("div", "icon");
      node.dataset.id = ic.id;
      node.innerHTML = `<div class="glyph">${svgGlyph(ic.glyph, 30)}</div><div class="label">${ic.label}</div>`;
      let x = ic.x, y = ic.y;
      if (viewMode === "icon") {
        if (ic.corner === "tr") { x = W - 108; y = 14; }
        if (ic.corner === "tr2") { x = W - 108; y = 120; }
        if (ic.corner === "tr3") { x = W - 108; y = 226; }
        if (ic.corner === "br") { x = W - 104; y = H - 110; }
      } else {
        // by Name/Size/Kind — snap into a tidy sorted grid
        x = 20 + (idx % cols) * 96;
        y = 14 + Math.floor(idx / cols) * 92;
      }
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
      down = { x: e.clientX, y: e.clientY, ox: parseInt(node.style.left), oy: parseInt(node.style.top), moved: false, s: dragScale() };
      $$(".icon", desktop).forEach((n) => n.classList.remove("selected"));
      node.classList.add("selected");
      const onMove = (ev) => {
        if (!down) return;
        const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
        if (down.moved) {
          node.style.left = down.ox + dx / down.s + "px";
          node.style.top = down.oy + dy / down.s + "px";
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        // Easter egg: dropping any icon onto the Trash doesn't delete it —
        // it protests and hands you a résumé instead.
        if (down && down.moved && ic.kind !== "trash") {
          const trashNode = desktop.querySelector('.icon[data-id="trash"]');
          if (trashNode && rectsOverlap(node.getBoundingClientRect(), trashNode.getBoundingClientRect())) {
            dropOnTrash(node, down, ic, trashNode);
          }
        }
        down = null;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    node.addEventListener("click", () => {
      const now = Date.now();
      if (now - last < dblThreshold) openIcon(ic.id);
      last = now;
    });
    node.addEventListener("dblclick", () => openIcon(ic.id));
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }
  function downloadResume() {
    const url = (ACTIVE && ACTIVE.resumePdf) || "";
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = url.split("/").pop(); a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }
  // Trash easter egg: the icon springs back (nothing is really deleted), the bin
  // bumps, and a playful alert offers the résumé as a parting gift.
  function dropOnTrash(node, down, ic, trashNode) {
    node.style.left = down.ox + "px";
    node.style.top = down.oy + "px";
    node.classList.remove("selected");
    Sound.play("trash");
    trashNode.style.transition = "transform .12s";
    trashNode.style.transform = "scale(1.22)";
    setTimeout(() => { trashNode.style.transform = ""; }, 180);
    const hasResume = !!(ACTIVE && ACTIVE.resumePdf);
    alertBox(
      "Really deleting me? :(",
      hasResume
        ? "Wow, straight to the Trash. Fine — take my résumé on your way out. No hard feelings. 🥲"
        : "Wow, straight to the Trash. That stings a little. 🥲",
      hasResume ? "Download résumé" : "OK",
      hasResume ? downloadResume : null
    );
  }

  /* ============================================================
     WINDOWS
     ============================================================ */
  function openIcon(id) {
    const ic = iconById(id);
    if (!ic) return;
    const node = desktop.querySelector(`.icon[data-id="${id}"]`);
    const origin = node ? node.getBoundingClientRect() : null;
    if (ic.kind === "link" && ic.href) { window.open(ic.href, "_blank", "noopener"); return; }
    let body;
    if (ic.kind === "harddrive") body = harddriveBody();
    else if (ic.kind === "folder") body = folderBody(ic);
    else if (ic.kind === "trash") body = htmlBody(trashContent());
    else if (ic.doc && typeof ACTIVE[ic.doc] === "function") body = htmlBody(ACTIVE[ic.doc](ACTIVE, OTHER));
    else body = htmlBody("");
    openWindow(id, ic.title || ic.label, body, ic.info, ic.size, origin);
  }

  function openWindow(id, title, bodyNode, info, size, originRect) {
    if (openWindows.has(id)) {
      focusWindow(openWindows.get(id));
      return;
    }
    size = size || { w: 340, h: 260 };

    const win = el("div", "win active");
    win.dataset.id = id;
    // Clamp size + position to the desktop so windows can't exceed the screen
    // (the 3D screen-host is a fixed, smaller viewport than the original site).
    const deskW = desktop.clientWidth || 640;
    const deskH = desktop.clientHeight || 447;
    const w = Math.min(size.w, deskW - 8);
    const h = Math.min(size.h, deskH - 8);
    const offset = openWindows.size * 22;
    const startX = Math.max(4, Math.min(70 + offset, deskW - w - 4));
    const startY = Math.max(4, Math.min(40 + offset, deskH - h - 4));
    win.style.left = startX + "px";
    win.style.top = startY + "px";
    win.style.width = w + "px";
    win.style.height = h + "px";
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
    Sound.play("open");

    // focus handling
    win.addEventListener("mousedown", () => focusWindow(win));
    $(".close-box", win).addEventListener("click", (e) => { e.stopPropagation(); closeWindow(id); });
    makeDraggable(win, tb);
    makeResizable(win, grow, size);
    updateThumb(content, scroll);
    content.addEventListener("scroll", () => updateThumb(content, scroll));
    // Recompute the thumb whenever the content reflows — late font swap, lazy
    // images loading, or the window being resized — so it never goes stale.
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => updateThumb(content, scroll));
      ro.observe(content);
      const inner = content.firstElementChild;
      if (inner) ro.observe(inner);
    }
    $$("img", content).forEach((img) => {
      img.addEventListener("load", () => updateThumb(content, scroll));
    });

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
    if (!(ratio < 1)) { // also covers NaN (empty content) -> hide
      thumb.style.display = "none";
      track.classList.remove("dither-50");
      track.style.background = "var(--paper)";
      return;
    }
    track.classList.add("dither-50");
    track.style.background = "";
    thumb.style.display = "block";
    // trackH is the true available height; `overflow:hidden` on .track keeps the
    // thumb's own margin from inflating it (which used to feed back and march the
    // thumb off the bottom of the window onto the desktop).
    const trackH = track.clientHeight;
    const th = Math.min(trackH - 4, Math.max(22, trackH * ratio - 4));
    const maxTop = Math.max(0, trackH - th - 4);
    const scrollable = content.scrollHeight - content.clientHeight;
    const frac = scrollable > 0 ? content.scrollTop / scrollable : 0;
    const top = Math.min(maxTop, Math.max(0, frac * maxTop));
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
    Sound.play("close");
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
      const scale = dragScale();
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
        const nx = ox + (ev.clientX - startX) / scale;
        const ny = Math.max(0, oy + (ev.clientY - startY) / scale);
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
          win.style.left = ox + (ev.clientX - startX) / scale + "px";
          win.style.top = Math.max(0, oy + (ev.clientY - startY) / scale) + "px";
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
      const scale = dragScale();
      const ow = win.offsetWidth, oh = win.offsetHeight;
      const onMove = (ev) => {
        win.style.width = Math.max(240, ow + (ev.clientX - startX) / scale) + "px";
        win.style.height = Math.max(150, oh + (ev.clientY - startY) / scale) + "px";
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

  /* ---------- picture viewer (lightbox, with ‹ › navigation) ---------- */
  function openLightbox(shots, index) {
    if (!Array.isArray(shots)) shots = [{ src: shots, cap: index || "" }], index = 0; // back-compat
    let i = index || 0;
    const multi = shots.length > 1;
    const lb = el("div", "lightbox");
    lb.innerHTML =
      `<div class="lb-backdrop dither-50"></div>` +
      `<div class="picwin">` +
        `<div class="titlebar"><div class="close-box"></div><div class="t"></div></div>` +
        `<div class="pic-body">` +
          (multi ? `<button class="lb-nav prev" type="button" aria-label="Previous picture">‹</button>` : "") +
          `<img src="" alt="">` +
          (multi ? `<button class="lb-nav next" type="button" aria-label="Next picture">›</button>` : "") +
        `</div>` +
        `<div class="lb-cap"></div>` +
      `</div>`;
    const img = $(".pic-body img", lb);
    const titleEl = $(".titlebar .t", lb);
    const capEl = $(".lb-cap", lb);
    function render() {
      const s = shots[i];
      img.src = s.src; img.alt = s.cap || "";
      titleEl.textContent = s.cap || "Picture";
      capEl.textContent = multi ? `${i + 1} / ${shots.length}` + (s.cap ? ` · ${s.cap}` : "") : (s.cap || "");
    }
    function go(d) { i = (i + d + shots.length) % shots.length; render(); }
    const close = () => { lb.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (multi && e.key === "ArrowRight") go(1);
      else if (multi && e.key === "ArrowLeft") go(-1);
    };
    lb.addEventListener("click", (e) => {
      if (e.target.closest(".lb-nav.next")) { go(1); return; }
      if (e.target.closest(".lb-nav.prev")) { go(-1); return; }
      // click the backdrop (anywhere outside the framed picture) or the close box to dismiss
      if (!e.target.closest(".picwin") || e.target.closest(".close-box")) close();
    });
    document.addEventListener("keydown", onKey);
    render();
    screen.appendChild(lb);
  }

  /* ============================================================
     MENU BAR
     ============================================================ */
  /* ---------- Finder actions (wired into the menus) ---------- */
  function selectedIconEl() { return desktop.querySelector(".icon.selected"); }
  function selectedIcon() { const n = selectedIconEl(); return n ? iconById(n.dataset.id) : null; }
  function hasSelectionText() { const s = window.getSelection && window.getSelection().toString(); return !!(s && s.trim()); }

  function openSelectedOrHD() { const ic = selectedIcon(); openIcon(ic ? ic.id : "harddrive"); }
  function selectAllIcons() { $$(".icon", desktop).forEach((n) => n.classList.add("selected")); Sound.play("click"); }
  function copySelection() {
    const s = window.getSelection().toString();
    if (s && navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {});
    Sound.play("click");
  }
  function emptyTrash() { Sound.play("trash"); alertBox("Empty Trash", "The Trash is already empty. There is nothing to throw away.", "OK"); }
  function aboutThisMac() { openWindow("about-mac", "About This Device", htmlBody(aboutMacBody()), null, { w: 400, h: 320 }); }

  function infoMeta(ic) {
    const kind = iconKind(ic);
    const kindLabel = { disk: "disk", folder: "folder", trash: "Trash", document: "document" }[kind] || "document";
    const size = ic.kind === "trash" ? "zero K" : iconSizeK(ic) + "K on disk";
    const comments = {
      about: "Everything you'd want to know, and a few things you wouldn't.",
      projects: "Things I built on purpose.",
      experience: "Where I've been getting paid to debug.",
      resume: "One page. Curly quotes. Recruiter-approved.",
      contact: "The fastest way to reach me.",
      sidehustle: "Proof I occasionally close the laptop.",
      harddrive: "512K of pure hustle.",
      trash: "Drag the System in here. I dare you.",
    };
    return {
      kind: kindLabel,
      size,
      created: "Saturday, January 24, 1984",
      modified: "Today",
      comment: ic.comment || comments[ic.id] || "No comment.",
    };
  }
  function getInfoSelected() {
    const ic = selectedIcon();
    if (!ic) { Sound.play("beep"); return; }
    openGetInfo(ic);
  }
  function openGetInfo(ic) {
    const m = infoMeta(ic);
    const body = el("div");
    body.innerHTML = `
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div style="flex:0 0 auto;">${svgGlyph(ic.glyph, 44)}</div>
        <div><h2 style="margin:0;">${ic.title || ic.label}</h2>
        <p class="meta" style="margin:2px 0 0;">${m.kind}</p></div>
      </div>
      <hr class="rule">
      <table class="ginfo">
        <tr><td>Kind:</td><td>${m.kind}</td></tr>
        <tr><td>Size:</td><td>${m.size}</td></tr>
        <tr><td>Where:</td><td>${ACTIVE.machineName}</td></tr>
        <tr><td>Created:</td><td>${m.created}</td></tr>
        <tr><td>Modified:</td><td>${m.modified}</td></tr>
      </table>
      <hr class="dotrule">
      <h3>Comments</h3>
      <p>${m.comment}</p>`;
    openWindow("info-" + ic.id, ic.label + " Info", body, null, { w: 340, h: 340 });
  }

  function printDialog() {
    const layer = el("div", "alert-layer");
    layer.innerHTML = `
      <div class="alert" style="width:360px;">
        <div class="body" style="flex:1 1 auto;">
          <p style="font-family:'Chicago';font-size:15px;margin:0 0 8px;">ImageWriter</p>
          <p class="meta" style="margin:0 0 4px;">Quality:&nbsp; Faster &nbsp;·&nbsp; Copies: 1</p>
          <p class="meta" style="margin:0 0 14px;">Pages:&nbsp; ◉ All&nbsp; ○ From ___ To ___</p>
          <div class="btns"><button class="mac-btn cancel">Cancel</button><button class="mac-btn default ok">Print</button></div>
        </div>
      </div>`;
    screen.appendChild(layer);
    $(".cancel", layer).addEventListener("click", () => { Sound.play("click"); layer.remove(); });
    $(".ok", layer).addEventListener("click", () => {
      Sound.play("click"); layer.remove();
      if (ACTIVE.resumePdf) window.open(ACTIVE.resumePdf, "_blank", "noopener");
      else alertBox("Print", "No printer is connected.", "OK");
    });
  }
  function pageSetupDialog() {
    const layer = el("div", "alert-layer");
    layer.innerHTML = `
      <div class="alert" style="width:360px;">
        <div class="body" style="flex:1 1 auto;">
          <p style="font-family:'Chicago';font-size:15px;margin:0 0 8px;">Page Setup</p>
          <p class="meta" style="margin:0 0 4px;">Paper:&nbsp; US Letter</p>
          <p class="meta" style="margin:0 0 14px;">Orientation:&nbsp;
            <button class="mac-btn ps-o default" data-o="portrait" style="padding:1px 10px;">Portrait</button>
            <button class="mac-btn ps-o" data-o="landscape" style="padding:1px 10px;">Landscape</button></p>
          <div class="btns"><button class="mac-btn cancel">Cancel</button><button class="mac-btn default ok">OK</button></div>
        </div>
      </div>`;
    screen.appendChild(layer);
    $$(".ps-o", layer).forEach((b) => b.addEventListener("click", () => {
      $$(".ps-o", layer).forEach((x) => x.classList.remove("default"));
      b.classList.add("default"); Sound.play("click");
    }));
    $(".cancel", layer).addEventListener("click", () => { Sound.play("click"); layer.remove(); });
    $(".ok", layer).addEventListener("click", () => { Sound.play("click"); layer.remove(); });
  }

  const MENUS = {
    apple: {
      glyph: true,
      items: [
        { label: "About This Device…", action: aboutThisMac },
        { divider: true },
        { label: "Control Panel", action: openControlPanel },
        { divider: true },
        { label: "Log Out…", action: logout },
      ],
    },
    File: { items: [
      { label: "Open", key: "⌘O", action: openSelectedOrHD },
      { label: "Close Window", key: "⌘W", action: closeFront, disabled: () => openWindows.size === 0 },
      { label: "Get Info", key: "⌘I", action: getInfoSelected, disabled: () => !selectedIcon() },
      { divider: true },
      { label: "Page Setup…", action: pageSetupDialog },
      { label: "Print…", key: "⌘P", action: printDialog },
    ]},
    Edit: { items: [
      { label: "Undo", key: "⌘Z", disabled: () => true }, { divider: true },
      { label: "Cut", key: "⌘X", disabled: () => true },
      { label: "Copy", key: "⌘C", action: copySelection, disabled: () => !hasSelectionText() },
      { label: "Paste", key: "⌘V", disabled: () => true },
      { label: "Clear", disabled: () => true },
      { divider: true },
      { label: "Select All", key: "⌘A", action: selectAllIcons },
    ]},
    View: { items: [
      { label: "by Icon", check: () => viewMode === "icon", action: () => setView("icon") },
      { label: "by Name", check: () => viewMode === "name", action: () => setView("name") },
      { label: "by Size", check: () => viewMode === "size", action: () => setView("size") },
      { label: "by Kind", check: () => viewMode === "kind", action: () => setView("kind") },
    ]},
    Special: { items: [
      { label: "Clean Up Desktop", action: placeIcons },
      { label: "Empty Trash", action: emptyTrash },
      { divider: true },
      { label: "Restart", action: () => { Sound.play("click"); location.reload(); } },
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
    // Right-aligned group: [ disc tab ][ clock ] — disc sits to the LEFT of the time.
    const right = el("div", "menubar-right");
    bar.appendChild(right);

    // GitHub stats tab — same idea as the Now Playing disc: tap it to open the widget
    if (ACTIVE && ACTIVE.github) {
      const ghTab = el("div", "gh-tab");
      ghTab.innerHTML = svgGlyph("gh-grid", 15);
      ghTab.title = "GitHub contributions";
      ghTab.addEventListener("mousedown", (e) => e.stopPropagation());
      ghTab.addEventListener("click", (e) => { e.stopPropagation(); toggleGitHub(); });
      right.appendChild(ghTab);
    }

    if (ACTIVE && ACTIVE.nowPlaying && ACTIVE.nowPlaying.length) {
      npDisc = el("div", "np-disc hidden");
      npDisc.innerHTML = svgGlyph("disc", 18);
      npDisc.title = "Now Playing";
      npDisc.addEventListener("mousedown", (e) => e.stopPropagation());
      npDisc.addEventListener("click", (e) => { e.stopPropagation(); openNowPlaying(); });
      right.appendChild(npDisc);
    }

    const clock = el("div", "clock");
    right.appendChild(clock);
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
      // Keep the document-level "close on mousedown" from firing when you press
      // a row — otherwise the dropdown is removed before the row's click lands,
      // and every menu action silently does nothing.
      dd.addEventListener("mousedown", (e) => e.stopPropagation());
      MENUS[key].items.forEach((it) => {
        if (it.divider) { dd.appendChild(el("div", "divider")); return; }
        const disabled = typeof it.disabled === "function" ? it.disabled() : !!it.disabled;
        const checked = typeof it.check === "function" ? it.check() : !!it.check;
        const row = el("div", "row" + (disabled ? " disabled" : " has"));
        row.innerHTML =
          (checked ? `<span class="check">✓</span>` : "") +
          `<span class="rl">${it.label}</span>` +
          (it.key ? `<span class="kbd">${it.key}</span>` : "");
        row.addEventListener("click", () => {
          close();
          if (disabled) { Sound.play("beep"); return; }   // error feedback on dimmed items
          Sound.play("click");
          it.action && it.action();
        });
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
    const used = Math.min(96, 18 + openWindows.size * 16);   // playful "memory in use" gauge
    return `
      <div style="text-align:center;">
        <div style="margin:6px auto 8px;display:flex;justify-content:center;">${svgGlyph('machead',44)}</div>
        <h2 style="font-family:'Chicago';">Device Portfolio</h2>
        <p class="meta">System Software 1.0</p>
        <hr class="dotrule">
        <div style="text-align:left;max-width:260px;margin:0 auto;">
          <p class="meta" style="margin:0 0 4px;">Total Memory&nbsp;&nbsp;128K</p>
          <div style="border:2px solid var(--ink);height:14px;padding:1px;">
            <div style="height:100%;width:${used}%;background:repeating-linear-gradient(90deg,var(--ink) 0,var(--ink) 3px,var(--paper) 3px,var(--paper) 5px);"></div>
          </div>
          <p class="meta" style="margin:4px 0 0;">${openWindows.size} window(s) open · Largest Unused Block: ${128 - Math.round(used * 1.28)}K</p>
        </div>
        <hr class="dotrule">
        <p style="font-size:14px;">Built with HTML · CSS · JavaScript<br>A retro desktop, built for ${ACTIVE.name}.</p>
        <p class="meta" style="margin-top:8px;">© 2026 ${ACTIVE.domain}</p>
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
      <div class="cp-row">
        <button class="mac-btn cp-mono" data-mode="bw">Black &amp; White</button>
        <button class="mac-btn cp-mono" data-mode="green">Green</button>
        <button class="mac-btn cp-mono" data-mode="amber">Amber</button>
      </div>
      <h3>Sound</h3>
      <div class="cp-row"><button class="mac-btn" id="cp-sound"></button></div>
      <h3>CRT Effects</h3>
      <div class="cp-row"><button class="mac-btn" id="cp-crt"></button></div>
      <h3>Desktop Pattern</h3>
      <div class="cp-row">
        <button class="mac-btn cp-pat" data-p="dither-50">50%</button>
        <button class="mac-btn cp-pat" data-p="dither-25">25%</button>
        <button class="mac-btn cp-pat" data-p="pinstripe">Pinstripe</button>
        <button class="mac-btn cp-pat" data-p="plain">Plain</button>
      </div>
      <h3>Double-Click Speed</h3>
      <div class="cp-row">
        <button class="mac-btn cp-d" data-ms="600">Slow</button>
        <button class="mac-btn cp-d" data-ms="380">Medium</button>
        <button class="mac-btn cp-d" data-ms="220">Fast</button>
      </div>
      <h3>Window Dragging</h3>
      <div class="cp-row"><button class="mac-btn" id="cp-drag"></button></div>
      <p class="meta" style="margin-top:10px;">Preferences are saved on this device.</p>`;
    openWindow("control", "Control Panel", body, "System · 4K", { w: 400, h: 560 });

    const win = openWindows.get("control");

    // Monitor (B&W / Green / Amber)
    const curMono = () => screen.classList.contains("mono-amber") ? "amber" : screen.classList.contains("mono-green") ? "green" : "bw";
    const syncMono = () => $$(".cp-mono", win).forEach((b) => b.classList.toggle("default", b.dataset.mode === curMono()));
    $$(".cp-mono", win).forEach((b) => b.addEventListener("click", () => { setMono(b.dataset.mode); syncMono(); }));
    syncMono();

    // Sound on/off
    const soundBtn = $("#cp-sound", win);
    const syncSound = () => { soundBtn.textContent = "Sound: " + (Sound.isOn() ? "ON" : "OFF"); };
    soundBtn.addEventListener("click", () => { Sound.set(!Sound.isOn()); syncSound(); Sound.play("click"); });
    syncSound();

    // CRT scanlines/glow
    const crtBtn = $("#cp-crt", win);
    const syncCrt = () => { crtBtn.textContent = "Scanlines & Glow: " + (chassis.classList.contains("crt-on") ? "ON" : "OFF"); };
    crtBtn.addEventListener("click", () => { const on = chassis.classList.toggle("crt-on"); localStorage.setItem("mac.crt", on); syncCrt(); });
    syncCrt();

    // Desktop pattern
    const curPat = () => localStorage.getItem("mac.pattern") || "dither-50";
    const syncPat = () => $$(".cp-pat", win).forEach((b) => b.classList.toggle("default", b.dataset.p === curPat()));
    $$(".cp-pat", win).forEach((b) => b.addEventListener("click", () => { setPattern(b.dataset.p); syncPat(); }));
    syncPat();

    // Double-click speed
    const syncDbl = () => $$(".cp-d", win).forEach((b) => b.classList.toggle("default", parseInt(b.dataset.ms, 10) === dblThreshold));
    $$(".cp-d", win).forEach((b) => b.addEventListener("click", () => { setDblSpeed(parseInt(b.dataset.ms, 10)); syncDbl(); }));
    syncDbl();

    // Window dragging
    const dragBtn = $("#cp-drag", win);
    const syncDrag = () => { dragBtn.textContent = liveDrag ? "Live" : "Outline (marching ants)"; };
    dragBtn.addEventListener("click", () => { liveDrag = !liveDrag; localStorage.setItem("mac.liveDrag", liveDrag); syncDrag(); });
    syncDrag();
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

  // Hand off to the other person's disk (their own domain / deployment).
  function gotoOther() {
    const layer = el("div", "alert-layer");
    layer.innerHTML = `
      <div class="alert">
        <div class="ico">?</div>
        <div class="body">
          <p><strong>Switch to ${OTHER.name}'s device?</strong><br>
          ${OTHER.name}'s profile lives on its own disk at <strong>${OTHER.domain}</strong>. You'll leave ${ACTIVE.name}'s machine to visit it.</p>
          <div class="btns">
            <button class="mac-btn cancel">Cancel</button>
            <button class="mac-btn default go">Go to ${OTHER.domain}</button>
          </div>
        </div>
      </div>`;
    screen.appendChild(layer);
    $(".cancel", layer).addEventListener("click", () => layer.remove());
    $(".go", layer).addEventListener("click", () => {
      layer.remove();
      const host = location.hostname;
      if (host === "localhost" || host === "127.0.0.1" || host === "") {
        // local preview: toggle sides in-place instead of navigating to a dead domain
        location.search = "?as=" + OTHER.id;
      } else {
        window.location.href = "https://" + OTHER.domain;
      }
    });
  }

  function shutDown() {
    const layer = el("div", "boot");
    layer.style.zIndex = 9800;
    layer.innerHTML = `<div class="welcome-txt" style="font-size:18px;text-align:center;">It is now safe to turn off<br>your device.</div>`;
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

  // Shared login chooser, built from the active + other profiles.
  function showLogin() {
    const login = $("#login");
    const body = $("#login-body");
    body.innerHTML = `
      <div class="machead" id="login-machead"></div>
      <h2>Welcome</h2>
      <p class="sub">Two people share this network. Who's signing in?</p>
      <div class="users">
        <div class="user-card" id="card-owner">
          <div class="avatar"></div>
          <div class="uname">${ACTIVE.name}</div>
          <div class="udom">${ACTIVE.domain}</div>
          <div class="ext">THIS DEVICE</div>
        </div>
        <div class="user-card" id="card-other">
          <div class="avatar"></div>
          <div class="uname">${OTHER.name}</div>
          <div class="udom">${OTHER.domain}</div>
          <div class="ext">→ OTHER DISK</div>
        </div>
      </div>
      <p class="login-note">You're on ${ACTIVE.domain} — picking ${OTHER.name} hands off to ${OTHER.domain}.</p>`;
    $("#login-machead", body).innerHTML = svgGlyph("machead", 44);
    $(".avatar", $("#card-owner", body)).innerHTML = svgGlyph(ACTIVE.avatarGlyph || "avatar", 52);
    $(".avatar", $("#card-other", body)).innerHTML = svgGlyph(OTHER.avatarGlyph || "avatar", 52);

    login.classList.remove("hidden");
    $("#card-owner", body).addEventListener("click", () => {
      Sound.unlock();          // first user gesture — unlock audio
      Sound.play("chime");     // startup chime as the desktop comes up
      login.classList.add("hidden");
      startDesktop();
    });
    $("#card-other", body).addEventListener("click", gotoOther);
  }

  function startDesktop() {
    desktop.classList.remove("hidden");
    renderWallpaper();
    placeIcons();
    setupNowPlaying();
    setupGitHub();
    setupCritters();
    setupDeskNotes();
    window.addEventListener("resize", debounce(placeIcons, 200));
    // intro: glide a fake mouse to "About Me" and double-click it open
    requestAnimationFrame(() => introOpenAbout());
  }

  /* ============================================================
     DESKTOP CRITTERS — a pixel cat, a dino, and a Claude spark wander the
     desktop floor, occasionally pausing by an icon/widget to react. Travel is
     a CSS `left` transition (mutation-free) so it doesn't thrash the 3D texture.
     ============================================================ */
  function critterSVG(type) {
    if (type === "cat") {
      return `<svg viewBox="0 0 22 18" shape-rendering="crispEdges" style="display:block;width:100%;height:100%">
        <g fill="#e8923a">
          <rect x="4" y="8" width="12" height="6"/>
          <rect x="14" y="4" width="5" height="6"/>
          <rect x="2" y="3" width="2" height="7"/><rect x="2" y="3" width="3" height="2"/>
          <rect x="14" y="2" width="2" height="2"/><rect x="17" y="2" width="2" height="2"/>
        </g>
        <g fill="#c5701f">
          <rect x="6" y="8" width="1" height="6"/><rect x="9" y="8" width="1" height="6"/><rect x="12" y="8" width="1" height="6"/>
        </g>
        <g fill="#e8923a"><rect x="4" y="14" width="2" height="3"/><rect x="8" y="14" width="2" height="3"/><rect x="11" y="14" width="2" height="3"/><rect x="14" y="14" width="2" height="3"/></g>
        <rect x="17" y="6" width="2" height="2" fill="#2a1a0d"/>
      </svg>`;
    }
    if (type === "dino") {
      return `<svg viewBox="0 0 24 18" shape-rendering="crispEdges" style="display:block;width:100%;height:100%">
        <g fill="#5aa84f">
          <rect x="3" y="7" width="11" height="6"/>
          <rect x="13" y="3" width="7" height="6"/>
          <rect x="0" y="8" width="4" height="3"/>
          <rect x="6" y="2" width="2" height="2"/><rect x="9" y="1" width="2" height="2"/>
        </g>
        <g fill="#3f8a39"><rect x="5" y="13" width="3" height="4"/><rect x="10" y="13" width="3" height="4"/></g>
        <rect x="13" y="9" width="3" height="1" fill="#3f8a39"/>
        <rect x="18" y="5" width="2" height="2" fill="#0f2e10"/>
        <rect x="20" y="7" width="1" height="1" fill="#0f2e10"/>
      </svg>`;
    }
    // Claude spark — coral body with a cream sunburst, two eyes, two legs
    return `<svg viewBox="0 0 20 20" shape-rendering="crispEdges" style="display:block;width:100%;height:100%">
      <g fill="#cc785c">
        <rect x="5" y="5" width="10" height="9"/><rect x="4" y="7" width="12" height="5"/><rect x="6" y="4" width="8" height="11"/>
      </g>
      <g fill="#f4ead8">
        <rect x="9" y="6" width="2" height="7"/><rect x="6" y="9" width="8" height="2"/>
        <rect x="7" y="7" width="1" height="1"/><rect x="12" y="7" width="1" height="1"/><rect x="7" y="11" width="1" height="1"/><rect x="12" y="11" width="1" height="1"/>
      </g>
      <rect x="7" y="8" width="1" height="2" fill="#2a1a0d"/><rect x="12" y="8" width="1" height="2" fill="#2a1a0d"/>
      <g fill="#a85c40"><rect x="7" y="14" width="2" height="3"/><rect x="11" y="14" width="2" height="3"/></g>
    </svg>`;
  }

  let critterTimers = [];
  function setupCritters() {
    critterTimers.forEach(clearTimeout); critterTimers = [];
    desktop.querySelectorAll(".critter").forEach((n) => n.remove());
    if (ACTIVE.critters === false) return;   // profile opted out (e.g. Leon)
    const specs = [
      { type: "cat",   emotes: ["meow", "♥", "~"], speed: 26 },
      { type: "dino",  emotes: ["rawr", "!", "♪"], speed: 22 },
      { type: "claude", emotes: ["hi!", "✦", "◡"], speed: 30 },
    ];
    specs.forEach((spec, i) => {
      const c = el("div", "critter");
      c.innerHTML = `<div class="body">${critterSVG(spec.type)}</div>`;
      const w = desktop.clientWidth || 600;
      c.style.left = Math.round(20 + Math.random() * (w - 80)) + "px";
      desktop.appendChild(c);
      critterTimers.push(setTimeout(() => stepCritter(c, spec), 900 + i * 1400));
    });
  }
  function stepCritter(c, spec) {
    if (!c.isConnected) return;
    const w = desktop.clientWidth || 600;
    const cur = parseInt(c.style.left) || 0;
    const target = Math.round(10 + Math.random() * (w - 50));
    const dur = Math.max(0.8, Math.abs(target - cur) / spec.speed);
    c.classList.toggle("flip", target < cur);   // face travel direction
    c.classList.remove("idle");
    c.style.transitionDuration = dur + "s";
    c.style.left = target + "px";
    // on arrival: small chance to react, then idle a beat before the next stroll
    critterTimers.push(setTimeout(() => {
      if (!c.isConnected) return;
      c.classList.add("idle");
      if (Math.random() < 0.5) critterEmote(c, spec, target);
      critterTimers.push(setTimeout(() => stepCritter(c, spec), 1200 + Math.random() * 3500));
    }, dur * 1000));
  }
  function critterEmote(c, spec, x) {
    // react to whatever desktop component the critter wandered next to
    let txt = spec.emotes[Math.floor(Math.random() * spec.emotes.length)];
    const np = desktop.querySelector(".nowplaying:not(.hidden)");
    const trash = desktop.querySelector('.icon[data-id="trash"]');
    const near = (el) => { if (!el) return false; const r = el.offsetLeft; return Math.abs((r + el.offsetWidth / 2) - x) < 60; };
    if (near(np)) txt = "♪";
    else if (near(trash)) txt = "?!";
    const b = el("div", "emote"); b.textContent = txt; c.appendChild(b);
    critterTimers.push(setTimeout(() => b.remove(), 1900));
  }

  /* ============================================================
     DESKTOP NOTES — friendly little dialogs that pop in now and then.
     ============================================================ */
  const DESK_NOTES = [
    "Welcome to my space 👋",
    "Thanks for visiting!",
    "Always looking for new opportunities — let's chat!",
    "Try dragging something to the Trash… I dare you.",
    "Double-click around — everything's clickable.",
  ];
  let deskNoteTimers = [];
  function setupDeskNotes() {
    deskNoteTimers.forEach(clearTimeout); deskNoteTimers = [];
    desktop.querySelectorAll(".desknote").forEach((n) => n.remove());
    if (ACTIVE.deskNotes === false) return;   // profile opted out (e.g. Leon)
    let order = DESK_NOTES.map((m, i) => i);
    let k = 0;
    const next = (first) => {
      if (k === 0 || k >= order.length) { order = shuffle(order.slice()); k = 0; }
      const msg = DESK_NOTES[first ? 0 : order[k++]];
      showDeskNote(msg);
      deskNoteTimers.push(setTimeout(() => next(false), 16000 + Math.random() * 12000));
    };
    deskNoteTimers.push(setTimeout(() => next(true), 5200));
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function showDeskNote(msg) {
    desktop.querySelectorAll(".desknote").forEach((n) => n.remove());
    const W = desktop.clientWidth || 600, H = desktop.clientHeight || 440;
    const note = el("div", "desknote");
    note.innerHTML =
      `<div class="dn-bar"><span class="dn-close"></span><span class="dn-title">${ACTIVE ? ACTIVE.name : "Note"}</span></div>` +
      `<div class="dn-body">${msg}</div>`;
    // upper area, biased right, away from the open About window
    note.style.left = Math.round(W * 0.42 + Math.random() * (W * 0.34)) + "px";
    note.style.top = Math.round(28 + Math.random() * (H * 0.28)) + "px";
    desktop.appendChild(note);
    const close = () => { note.classList.add("closing"); setTimeout(() => note.remove(), 250); };
    $(".dn-close", note).addEventListener("click", (e) => { e.stopPropagation(); Sound.play("click"); close(); });
    deskNoteTimers.push(setTimeout(close, 7000));
  }

  // apple.png inlined so the 3D texture (html-to-image) always renders it
  const APPLE_DATA_URI = "data:image/png;base64,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";

  // Wallpaper — centered Apple logo + serif "Think / Be Different" caption.
  // Only for profiles that opt in (ACTIVE.wallpaper); others keep their pattern ground.
  function renderWallpaper() {
    const wp = document.getElementById("wallpaper");
    if (!wp) return;
    if (!ACTIVE.wallpaper) { wp.innerHTML = ""; return; }
    if (ACTIVE.wallpaper === "hello") {
      // classic Macintosh "hello" script as the desktop ground (Ivan's side).
      // The dithered pattern stays; a paper halo lifts the script off it.
      wp.innerHTML = `<div class="wp-hello">hello</div>`;
      return;
    }
    // clean OPAQUE paper ground behind the wallpaper (no pattern). The opaque fill
    // matters for the 3D texture: a transparent ground rasterises to black, which
    // would hide the black apple/text. (Not persisted to the pattern setting.)
    const bg = document.querySelector(".desktop-bg");
    if (bg) { bg.className = "desktop-bg"; bg.style.background = "var(--paper)"; }
    wp.innerHTML = `<img class="wp-apple" src="${APPLE_DATA_URI}" alt="" draggable="false">` +
      `<div class="wp-words">` +
        `<div class="wp-stack">` +
          `<span class="wp-text">Think</span>` +
          `<span class="wp-text wp-be">Be</span>` +
        `</div>` +
        `<span class="wp-text wp-diff">Different.</span>` +
      `</div>`;
  }

  /* ---------- Now Playing widget (one track per page load; changes on refresh) ---------- */
  function setupNowPlaying() {
    const old = desktop.querySelector(".nowplaying");
    if (old) old.remove();
    npTracks = ACTIVE.nowPlaying;
    if (!npTracks || !npTracks.length) return;
    npIndex = Math.floor(Math.random() * npTracks.length);

    const box = el("div", "nowplaying");
    box.innerHTML =
      `<div class="np-bar">` +
        `<div class="np-min" title="Minimize"></div>` +
        `<span class="np-title-txt">Now Playing</span>` +
      `</div>` +
      `<div class="np-body">` +
        `<div class="np-art"><img alt=""></div>` +
        `<div class="np-meta">` +
          `<div class="np-song"></div>` +
          `<div class="np-artist"></div>` +
          `<div class="np-eq"><span></span><span></span><span></span><span></span></div>` +
        `</div>` +
      `</div>`;
    desktop.appendChild(box);
    npBox = box;

    // default position: bottom-CENTRE — clear of the left icon column (Side
    // Hustle / LeetCode sit at the bottom of it) and the corner icons.
    box.style.left = Math.max(8, Math.round((desktop.clientWidth - box.offsetWidth) / 2)) + "px";

    // clicking anywhere on the widget raises it above the window stack
    // (profile opt-in — Ivan's side only)
    if (ACTIVE.raisableWidgets) box.addEventListener("mousedown", () => { box.style.zIndex = ++zTop; });

    $(".np-min", box).addEventListener("click", (e) => { e.stopPropagation(); minimizeNowPlaying(); });
    box.addEventListener("click", (e) => {
      // title bar is the drag handle; the artwork/text opens the track
      if (e.target.closest(".np-min") || e.target.closest(".np-bar")) return;
      const t = npTracks[npIndex];
      if (t && t.url) window.open(t.url, "_blank", "noopener");
    });

    // drag the widget by its title bar
    const bar = $(".np-bar", box);
    bar.addEventListener("mousedown", (e) => {
      if (e.target.closest(".np-min")) return;
      e.preventDefault();
      const scale = dragScale();
      const startX = e.clientX, startY = e.clientY;
      const ox = box.offsetLeft, oy = box.offsetTop;   // current position in local coords
      box.style.bottom = "auto";
      box.style.left = ox + "px";
      box.style.top = oy + "px";
      const onMove = (ev) => {
        let nx = ox + (ev.clientX - startX) / scale;
        let ny = oy + (ev.clientY - startY) / scale;
        nx = Math.max(0, Math.min(nx, desktop.clientWidth - box.offsetWidth));
        ny = Math.max(0, Math.min(ny, desktop.clientHeight - box.offsetHeight));
        box.style.left = nx + "px";
        box.style.top = ny + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    renderNowPlaying();
    openNowPlaying(); // shown on entry; ensure the minimized disc tab is hidden
  }

  /* ---------- GitHub contributions widget (toggled from the menubar tab) ----------
     Live data from the public github-contributions API (no auth, CORS-friendly).
     Hidden by default; the gh-tab in the menubar shows/hides it. */
  function setupGitHub() {
    const old = desktop.querySelector(".ghstats");
    if (old) old.remove();
    ghBox = null; ghFetched = false;
    if (!ACTIVE.github) return;

    const box = el("div", "ghstats");
    box.innerHTML =
      `<div class="gh-bar">` +
        `<div class="gh-min" title="Minimize"></div>` +
        `<span class="gh-title-txt">GitHub</span>` +
      `</div>` +
      `<div class="gh-body"><p class="gh-note">Fetching contributions…</p></div>`;
    desktop.appendChild(box);
    ghBox = box;

    // shown on entry (like Now Playing): default position is bottom-centre,
    // stacked just above the Now Playing widget so neither covers any icon
    const np = desktop.querySelector(".nowplaying");
    box.style.left = Math.max(8, Math.round((desktop.clientWidth - box.offsetWidth) / 2)) + "px";
    if (np) box.style.bottom = (18 + np.offsetHeight + 8) + "px";
    fetchGitHub();

    // clicking anywhere on the widget raises it above the window stack
    box.addEventListener("mousedown", () => { box.style.zIndex = ++zTop; });

    $(".gh-min", box).addEventListener("click", (e) => { e.stopPropagation(); box.classList.add("hidden"); });
    box.addEventListener("click", (e) => {
      if (e.target.closest(".gh-bar")) return;   // title bar = drag handle
      window.open("https://github.com/" + ACTIVE.github, "_blank", "noopener");
    });

    // drag the widget by its title bar (same pattern as Now Playing)
    const bar = $(".gh-bar", box);
    bar.addEventListener("mousedown", (e) => {
      if (e.target.closest(".gh-min")) return;
      e.preventDefault();
      const scale = dragScale();
      const startX = e.clientX, startY = e.clientY;
      const ox = box.offsetLeft, oy = box.offsetTop;
      box.style.bottom = "auto";
      box.style.left = ox + "px";
      box.style.top = oy + "px";
      const onMove = (ev) => {
        let nx = ox + (ev.clientX - startX) / scale;
        let ny = oy + (ev.clientY - startY) / scale;
        nx = Math.max(0, Math.min(nx, desktop.clientWidth - box.offsetWidth));
        ny = Math.max(0, Math.min(ny, desktop.clientHeight - box.offsetHeight));
        box.style.left = nx + "px";
        box.style.top = ny + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function toggleGitHub() {
    if (!ghBox) return;
    const show = ghBox.classList.contains("hidden");
    ghBox.classList.toggle("hidden", !show);
    if (show) {
      ghBox.style.zIndex = ++zTop;          // reappear on top, like a window
      if (!ghFetched) fetchGitHub();        // retry if the first fetch failed
    }
  }

  function fetchGitHub() {
    ghFetched = true;
    fetch("https://github-contributions-api.jogruber.de/v4/" + ACTIVE.github + "?y=last")
      .then((r) => r.json())
      .then((d) => renderGitHub(d))
      .catch(() => renderGitHub(null));
  }

  function renderGitHub(d) {
    if (!ghBox) return;
    const body = $(".gh-body", ghBox);
    if (!d || !d.contributions || !d.contributions.length) {
      ghFetched = false;   // allow a retry on the next open
      body.innerHTML = `<p class="gh-note">Couldn't reach GitHub right now — try again shortly.</p>`;
      return;
    }
    const total = d.total && d.total.lastYear != null
      ? d.total.lastYear
      : d.contributions.reduce((s, c) => s + (c.count || 0), 0);
    // last ~4 months as a 1-bit heat grid: 7 day-rows × 17 week-columns
    const days = d.contributions.slice(-17 * 7);
    const cells = days.map((c) =>
      `<span class="gh-cell l${Math.min(4, c.level || 0)}" title="${c.date} · ${c.count}"></span>`).join("");
    body.innerHTML =
      `<div class="gh-total"><strong>${Number(total).toLocaleString()}</strong> contributions in the last year</div>` +
      `<div class="gh-grid">${cells}</div>` +
      `<div class="gh-link">@${ACTIVE.github} →</div>`;
  }

  function renderNowPlaying() {
    if (!npBox || !npTracks) return;
    const t = npTracks[npIndex];
    $(".np-art img", npBox).src = t.art || "";
    $(".np-song", npBox).textContent = t.title;
    $(".np-artist", npBox).textContent = t.artist;
  }

  function minimizeNowPlaying() {
    if (npBox) npBox.classList.add("hidden");
    if (npDisc) npDisc.classList.remove("hidden");
  }
  function openNowPlaying() {
    if (npBox) npBox.classList.remove("hidden");
    if (npDisc) npDisc.classList.add("hidden");
  }

  // Welcome animation: a fake Macintosh pointer slides to the About Me icon,
  // "double-clicks" it, and the window opens. Skipped (instant open) under
  // reduced-motion or if the user clicks first.
  function introOpenAbout() {
    const aboutNode = desktop.querySelector('.icon[data-id="about"]');
    if (!aboutNode) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { openIcon("about"); return; }

    const sRect = screen.getBoundingClientRect();
    const iRect = aboutNode.getBoundingClientRect();
    const tx = iRect.left - sRect.left + 22;            // aim at the glyph
    const ty = iRect.top - sRect.top + 16;
    const startX = sRect.width * 0.6;
    const startY = sRect.height * 0.86;

    const fc = el("div", "fake-cursor");
    fc.innerHTML =
      "<svg width='20' height='24' viewBox='0 0 20 24' shape-rendering='crispEdges'>" +
      "<path d='M2 1 L2 18 L6 14 L9 21 L12 20 L9 13 L15 13 Z' fill='black' stroke='white' stroke-width='1'/></svg>";
    fc.style.left = startX + "px";
    fc.style.top = startY + "px";
    screen.appendChild(fc);
    document.body.classList.add("intro-active");

    const timers = [];
    let done = false;
    function finish(openNow) {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      desktop.removeEventListener("mousedown", skip, true);
      document.body.classList.remove("intro-active");
      aboutNode.classList.remove("selected");
      fc.classList.add("fade");
      setTimeout(() => fc.remove(), 320);
      if (openNow && !openWindows.has("about")) openIcon("about");
    }
    function skip() { finish(true); }
    desktop.addEventListener("mousedown", skip, true);

    // glide to the icon
    requestAnimationFrame(() => {
      fc.style.transition = "left 1s ease-in-out, top 1s ease-in-out";
      fc.style.left = tx + "px";
      fc.style.top = ty + "px";
    });
    // arrive → select → double-click pulse → open → clean up
    timers.push(setTimeout(() => aboutNode.classList.add("selected"), 1050));
    timers.push(setTimeout(() => fc.classList.add("click"), 1150));
    timers.push(setTimeout(() => { if (!openWindows.has("about")) openIcon("about"); }, 1480));
    timers.push(setTimeout(() => finish(false), 1750));
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function logout() {
    openWindows.forEach((w) => w.remove());
    openWindows.clear();
    desktop.classList.add("hidden");
    showLogin();
  }

  /* ============================================================
     INIT
     ============================================================ */
  function restorePrefs() {
    const mono = localStorage.getItem("mac.mono");
    if (mono === "green" || mono === "amber") setMono(mono);
    const crt = localStorage.getItem("mac.crt");
    if (crt === null || crt === "true") chassis.classList.add("crt-on");
    const pat = localStorage.getItem("mac.pattern");
    if (pat) setPattern(pat);
  }

  // Finder keyboard shortcuts (⌘/Ctrl). Stay out of the way of text fields.
  function wireShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "w") { e.preventDefault(); closeFront(); }
      else if (k === "o") { e.preventDefault(); openSelectedOrHD(); }
      else if (k === "i") { if (selectedIcon()) { e.preventDefault(); getInfoSelected(); } }
      else if (k === "p") { e.preventDefault(); printDialog(); }
      else if (k === "a") { if (!e.target.closest(".content")) { e.preventDefault(); selectAllIcons(); } }
    });
  }

  function init() {
    const ownerId = resolveOwnerId();
    ACTIVE = PROFILES[ownerId];
    OTHER = PROFILES[otherId(ownerId)] || ACTIVE;
    if (!ACTIVE) { console.error("No profile loaded — include profile-*.js before mac.js"); return; }
    document.title = `${ACTIVE.fullName || ACTIVE.name}'s Device — ${ACTIVE.domain}`;

    restorePrefs();
    wireShortcuts();
    // populate static glyphs
    const hm = document.getElementById("happy-mac");
    if (hm) hm.innerHTML = svgGlyph("happymac", 80);
    buildMenuBar();

    // click feedback for any Mac button (dialogs, control panel) + audio unlock
    screen.addEventListener("mousedown", (e) => {
      Sound.unlock();
      if (e.target.closest(".mac-btn")) Sound.play("click");
    });

    // Gallery interactions (event-delegated):
    //  • ‹ › buttons step the carousel
    //  • clicking the picture opens it enlarged, with its own ‹ › navigation
    desktop.addEventListener("click", (e) => {
      const nav = e.target.closest(".car-nav");
      if (nav && desktop.contains(nav)) {
        e.stopPropagation();
        carNav(nav.closest(".gallery"), nav.classList.contains("next") ? 1 : -1);
        return;
      }
      const fig = e.target.closest(".shot");
      if (!fig || !desktop.contains(fig)) return;
      const gallery = fig.closest(".gallery");
      const shots = $$(".shot img", gallery).map((im) => ({ src: im.getAttribute("src"), cap: im.alt }));
      openLightbox(shots, parseInt(fig.dataset.i || "0", 10));
    });

    runBoot(showLogin);
  }

  // public API
  window.Mac = {
    alert: alertBox,
    gotoOther,
    gotoLeon: gotoOther, // backward-compat alias
    openControlPanel,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
