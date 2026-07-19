/* ============================================================
   Profile — Leon (leonmeng.xyz)
   Starter content. Leon: fill in `projects`, the document builders,
   and the icon list — same shape as ivan/profile.js.
   Document builders receive (P, O): P = this profile, O = the other person.
   ============================================================ */
(function () {
  "use strict";

  /* Peter the Anteater — a 46x51 1-bit bitmap (solid outline, 25% dithered fill)
     flattened to one path. `fill: currentColor` so he follows --ink across themes. */
  const PETER = `<svg viewBox="0 0 46 51" width="46" height="51" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M19 2h3v1h-3zM28 2h3v1h-3zM19 3h1v1h-1zM21 3h1v1h-1zM28 3h1v1h-1zM30 3h1v1h-1zM19 4h3v1h-3zM28 4h1v1h-1zM30 4h1v1h-1zM19 5h1v1h-1zM21 5h1v1h-1zM24 5h1v1h-1zM28 5h1v1h-1zM30 5h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM30 6h1v1h-1zM18 7h1v1h-1zM29 7h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM30 8h1v1h-1zM18 9h1v1h-1zM30 9h1v1h-1zM17 10h2v1h-2zM20 10h2v1h-2zM24 10h1v1h-1zM27 10h2v1h-2zM30 10h2v1h-2zM16 11h1v1h-1zM20 11h2v1h-2zM27 11h2v1h-2zM31 11h1v1h-1zM15 12h2v1h-2zM18 12h1v1h-1zM20 12h2v1h-2zM24 12h1v1h-1zM27 12h2v1h-2zM30 12h2v1h-2zM13 13h2v1h-2zM31 13h1v1h-1zM12 14h1v1h-1zM14 14h1v1h-1zM16 14h1v1h-1zM18 14h1v1h-1zM20 14h1v1h-1zM22 14h1v1h-1zM24 14h1v1h-1zM26 14h1v1h-1zM28 14h1v1h-1zM30 14h2v1h-2zM11 15h1v1h-1zM30 15h1v1h-1zM10 16h1v1h-1zM12 16h1v1h-1zM14 16h1v1h-1zM16 16h1v1h-1zM18 16h1v1h-1zM20 16h1v1h-1zM22 16h1v1h-1zM24 16h1v1h-1zM26 16h1v1h-1zM28 16h1v1h-1zM30 16h1v1h-1zM9 17h1v1h-1zM19 17h2v1h-2zM28 17h2v1h-2zM8 18h1v1h-1zM10 18h1v1h-1zM12 18h1v1h-1zM14 18h1v1h-1zM16 18h3v1h-3zM21 18h2v1h-2zM24 18h1v1h-1zM26 18h2v1h-2zM7 19h1v1h-1zM16 19h1v1h-1zM22 19h1v1h-1zM26 19h1v1h-1zM5 20h2v1h-2zM8 20h1v1h-1zM10 20h1v1h-1zM12 20h1v1h-1zM14 20h2v1h-2zM22 20h1v1h-1zM24 20h1v1h-1zM26 20h1v1h-1zM4 21h1v1h-1zM13 21h1v1h-1zM22 21h1v1h-1zM26 21h1v1h-1zM3 22h2v1h-2zM6 22h7v1h-7zM22 22h1v1h-1zM24 22h1v1h-1zM26 22h1v1h-1zM2 23h1v1h-1zM9 23h2v1h-2zM22 23h1v1h-1zM27 23h2v1h-2zM3 24h2v1h-2zM6 24h1v1h-1zM8 24h1v1h-1zM20 24h3v1h-3zM24 24h1v1h-1zM26 24h1v1h-1zM28 24h3v1h-3zM4 25h4v1h-4zM19 25h1v1h-1zM31 25h1v1h-1zM18 26h15v1h-15zM15 27h21v1h-21zM15 28h2v1h-2zM18 28h15v1h-15zM34 28h1v1h-1zM36 28h1v1h-1zM14 29h1v1h-1zM19 29h13v1h-13zM37 29h1v1h-1zM13 30h2v1h-2zM16 30h1v1h-1zM18 30h1v1h-1zM20 30h1v1h-1zM30 30h1v1h-1zM32 30h1v1h-1zM34 30h1v1h-1zM36 30h1v1h-1zM38 30h1v1h-1zM13 31h1v1h-1zM15 31h1v1h-1zM17 31h1v1h-1zM21 31h1v1h-1zM29 31h1v1h-1zM39 31h1v1h-1zM12 32h1v1h-1zM14 32h3v1h-3zM18 32h1v1h-1zM20 32h1v1h-1zM22 32h2v1h-2zM27 32h2v1h-2zM30 32h1v1h-1zM32 32h1v1h-1zM34 32h1v1h-1zM36 32h1v1h-1zM38 32h2v1h-2zM12 33h1v1h-1zM14 33h1v1h-1zM17 33h1v1h-1zM23 33h5v1h-5zM34 33h2v1h-2zM40 33h1v1h-1zM11 34h2v1h-2zM14 34h1v1h-1zM17 34h2v1h-2zM20 34h1v1h-1zM22 34h1v1h-1zM24 34h3v1h-3zM28 34h1v1h-1zM30 34h1v1h-1zM32 34h2v1h-2zM36 34h1v1h-1zM38 34h1v1h-1zM40 34h2v1h-2zM10 35h1v1h-1zM13 35h1v1h-1zM17 35h1v1h-1zM33 35h1v1h-1zM37 35h1v1h-1zM40 35h1v1h-1zM10 36h1v1h-1zM12 36h1v1h-1zM17 36h2v1h-2zM20 36h1v1h-1zM22 36h1v1h-1zM24 36h1v1h-1zM26 36h1v1h-1zM28 36h1v1h-1zM30 36h1v1h-1zM32 36h2v1h-2zM37 36h2v1h-2zM40 36h1v1h-1zM10 37h3v1h-3zM18 37h1v1h-1zM32 37h1v1h-1zM37 37h1v1h-1zM40 37h1v1h-1zM18 38h1v1h-1zM20 38h1v1h-1zM22 38h1v1h-1zM24 38h1v1h-1zM26 38h1v1h-1zM28 38h1v1h-1zM30 38h1v1h-1zM32 38h1v1h-1zM37 38h2v1h-2zM40 38h1v1h-1zM19 39h1v1h-1zM31 39h1v1h-1zM36 39h1v1h-1zM39 39h1v1h-1zM20 40h1v1h-1zM22 40h1v1h-1zM24 40h1v1h-1zM26 40h1v1h-1zM28 40h1v1h-1zM30 40h1v1h-1zM36 40h1v1h-1zM38 40h2v1h-2zM20 41h1v1h-1zM23 41h2v1h-2zM26 41h2v1h-2zM30 41h1v1h-1zM36 41h1v1h-1zM39 41h1v1h-1zM20 42h1v1h-1zM22 42h1v1h-1zM25 42h1v1h-1zM28 42h1v1h-1zM30 42h1v1h-1zM36 42h1v1h-1zM38 42h2v1h-2zM20 43h1v1h-1zM22 43h1v1h-1zM28 43h1v1h-1zM30 43h1v1h-1zM35 43h1v1h-1zM39 43h1v1h-1zM20 44h1v1h-1zM22 44h1v1h-1zM28 44h1v1h-1zM30 44h1v1h-1zM36 44h1v1h-1zM38 44h1v1h-1zM20 45h1v1h-1zM22 45h1v1h-1zM28 45h1v1h-1zM30 45h1v1h-1zM37 45h1v1h-1zM16 46h5v1h-5zM22 46h1v1h-1zM28 46h1v1h-1zM30 46h5v1h-5zM15 47h1v1h-1zM23 47h1v1h-1zM27 47h1v1h-1zM35 47h1v1h-1zM14 48h1v1h-1zM16 48h1v1h-1zM18 48h1v1h-1zM20 48h1v1h-1zM22 48h1v1h-1zM24 48h1v1h-1zM26 48h1v1h-1zM28 48h1v1h-1zM30 48h1v1h-1zM32 48h1v1h-1zM34 48h1v1h-1zM36 48h1v1h-1zM15 49h1v1h-1zM23 49h1v1h-1zM27 49h1v1h-1zM35 49h1v1h-1zM16 50h7v1h-7zM28 50h7v1h-7z"/></svg>`;

  // Ordered: active work first, then projects that are no longer being maintained
  // (those carry "inactive" in their `info` line so it shows in the window header).
  const projects = [
    {
      id: "cs2-quant", name: "CS2 Quant", icon: "g-doc",
      blurb: "Two trading agents on the CS2 skin market sharing one data layer and signal bus: one trades the repricings that follow game updates, the other accumulates undervalued items on structural factors. Behind them sits a walk-forward backtester that models BUFF's T+7 settlement, provenance logging on every decision, and a Streamlit research dashboard.",
      stack: ["Python", "Pandas", "NumPy", "scikit-learn", "SQLite", "Streamlit"],
      info: "Quant · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/cs666" }],
      shots: [
        { src: "leon/assets/shots/cs2-quant/01.jpg", cap: "Overview: per-strategy viability and capital deployed" },
        { src: "leon/assets/shots/cs2-quant/06.jpg", cap: "Spreads, and trading cost against liquidity" },
        { src: "leon/assets/shots/cs2-quant/07.jpg", cap: "Out-of-sample scorecard for each trading rule" },
        { src: "leon/assets/shots/cs2-quant/05.jpg", cap: "Event timeline: net return per trade" },
        { src: "leon/assets/shots/cs2-quant/04.jpg", cap: "Decision log, with the raw JSON behind each signal" },
        { src: "leon/assets/shots/cs2-quant/08.jpg", cap: "Live market: bid, ask and spread per item" },
        { src: "leon/assets/shots/cs2-quant/09.jpg", cap: "Data health: poller status and gaps in the series" },
        { src: "leon/assets/shots/cs2-quant/03.jpg", cap: "Trade-up class returns against the broad market" },
        { src: "leon/assets/shots/cs2-quant/02.jpg", cap: "Monopoly watch: concentration per item" },
      ],
    },
    {
      id: "ui-library", name: "UI Library", icon: "g-doc",
      blurb: "A local-first visual page builder for React: point it at a project folder and every component becomes a live, draggable block, rendered with its real CSS and dependencies, so what you preview is what you export. Visual edits are written back into the component's actual source by an AST engine that never touches your logic. Ships with 240+ working components across 11 design kits.",
      stack: ["TypeScript", "React", "Vite", "Tailwind v4", "AST tooling"],
      info: "Tooling · live",
      links: [
        { label: "Live demo", href: "https://ui-library-iota-neon.vercel.app" },
        { label: "GitHub", href: "https://github.com/ggttlplp201/UI-Library" },
      ],
      shots: [
        { src: "leon/assets/shots/ui-library/01.jpg", cap: "Launcher: open a React project or a bundled sample" },
        { src: "leon/assets/shots/ui-library/02.jpg", cap: "Editing a live component on the canvas" },
        { src: "leon/assets/shots/ui-library/03.jpg", cap: "Pages wired together in the node graph" },
        { src: "leon/assets/shots/ui-library/04.jpg", cap: "Component library, with a button selected on the canvas" },
      ],
    },
    {
      id: "garderobe", name: "GARDEROBE", icon: "g-doc",
      blurb: "A wardrobe manager and living archive for your clothes: catalog what you own, log wears and spend, build outfits on a visual mannequin, and track wishlist prices scraped from Grailed and SSENSE. Upload a photo and Claude auto-tags the item while an in-browser model cuts the background. Running in production.",
      stack: ["React", "Supabase", "FastAPI", "Claude API"],
      info: "Web · live",
      links: [
        { label: "Live site", href: "https://the-garderobe.com/" },
        { label: "GitHub", href: "https://github.com/ggttlplp201/GARDER0BE" },
      ],
      shots: [
        { src: "leon/assets/shots/garderobe/01.jpg", cap: "Outfit builder, with the closet alongside" },
        { src: "leon/assets/shots/garderobe/02.jpg", cap: "The look book, walkable in 3D" },
        { src: "leon/assets/shots/garderobe/03.jpg", cap: "Explore feed of fashion and culture articles" },
        { src: "leon/assets/shots/garderobe/04.jpg", cap: "An outfit published, with comments" },
        { src: "leon/assets/shots/garderobe/05.jpg", cap: "People directory" },
      ],
    },
    {
      id: "domusmat", name: "DoMusMat", icon: "g-doc",
      blurb: "A B2B product library for a Portuguese building-materials manufacturer, turning a physical catalog into 47 filterable products with side-by-side comparison, materials lists, quote carts, and 239 downloadable BIM/CAD files. Includes a 3D showroom configurator and a virtual tour.",
      stack: ["Next.js", "TypeScript", "React Three Fiber", "Supabase", "GSAP"],
      info: "Web · live",
      links: [
        { label: "Live site", href: "https://do-mus-mat-v2.vercel.app" },
        { label: "GitHub", href: "https://github.com/ggttlplp201/DoMusMatV2" },
      ],
      shots: [
        { src: "leon/assets/shots/domusmat/01.jpg", cap: "Configurator: an empty room with placement hotspots" },
        { src: "leon/assets/shots/domusmat/02.jpg", cap: "Choosing a door to drop into the room" },
        { src: "leon/assets/shots/domusmat/03.jpg", cap: "Windows placed, materials palette on the left" },
        { src: "leon/assets/shots/domusmat/04.jpg", cap: "A furnished room, ready to share or render" },
        { src: "leon/assets/shots/domusmat/05.jpg", cap: "Photoreal walkthrough by day" },
        { src: "leon/assets/shots/domusmat/08.jpg", cap: "The same room at night" },
        { src: "leon/assets/shots/domusmat/06.jpg", cap: "Virtual tour, stepping between rooms" },
      ],
    },
    {
      id: "pdf-translator", name: "pdfTranslator", icon: "g-doc",
      blurb: "A format-preserving PDF translator for Chinese, Portuguese, and English: translated copy is rewritten back into the original layout with real fonts embedded, so the document still looks like the document. Scanned pages fall back to OCR, and it ships as both a CLI and a FastAPI web app.",
      stack: ["Python", "PyMuPDF", "FastAPI", "Tesseract OCR", "Docker"],
      info: "Tooling · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/pdfTranslator" }],
      shots: [
        { src: "leon/assets/shots/pdf-translator/01.jpg", cap: "Upload a PDF, then pick languages and engine" },
        { src: "leon/assets/shots/pdf-translator/02.jpg", cap: "Original and translation, side by side" },
        { src: "leon/assets/shots/pdf-translator/03.jpg", cap: "Figures and diagrams keep their place" },
        { src: "leon/assets/shots/pdf-translator/04.jpg", cap: "Tables survive the translation intact" },
        { src: "leon/assets/shots/pdf-translator/05.jpg", cap: "A circuit diagram with its caption translated" },
      ],
    },
    {
      id: "drop-tracker", name: "Drop Tracker", icon: "g-doc",
      blurb: "An automated drop monitor built around Chrome Hearts and Anti Promo, extended to storefronts like Luke's NYC and 2nd Street. It polls Shopify and fires a Discord message with title, price, and image the moment something drops. In progress: automated purchasing, gated behind a model that scores an item's expected resale against market history so only real margin gets bought.",
      stack: ["Python", "BeautifulSoup", "Discord", "Railway"],
      info: "Automation · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/Drop-Tracker" }],
      shots: [
        { src: "leon/assets/shots/drop-tracker/01.jpg", cap: "Chrome Hearts drop alerts landing in Discord" },
        { src: "leon/assets/shots/drop-tracker/02.jpg", cap: "An Anti Promo drop, with price and image" },
      ],
    },
    {
      id: "buglens", name: "BugLens", icon: "g-doc",
      blurb: "A VS Code extension that explains the logic behind a highlighted bug: what the code does, what you probably intended, and the concept underneath, without handing back a rewritten fix. Streams from either OpenAI or Anthropic into a WebView side panel.",
      stack: ["TypeScript", "VS Code API", "OpenAI", "Anthropic"],
      info: "Extension · 2026",
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/BugLens" }],
      shots: [],
    },

    /* ---- no longer maintained ---- */
    {
      id: "drafted", name: "Drafted", icon: "g-doc",
      blurb: "A champion-select overlay for League of Legends that reads picks, bans, and your role straight from the local client the moment draft starts, then surfaces counters, synergies, builds, and win rates scraped from Lolalytics in a floating window that stays on top.",
      stack: ["Python", "Flask", "Electron", "SSE"],
      info: "Desktop · inactive",
      inactive: true,
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/Drafted" }],
      shots: [],
    },
    {
      id: "lineups-cs2", name: "CS2 Lineup Overlay", icon: "g-doc",
      blurb: "A transparent, always-on-top lineup overlay for Counter-Strike 2 that surfaces the right smoke, flash, or molly for wherever you're standing. VAC-safe by design: it reads only Valve's official Game State Integration feed, with no memory reading and no injection.",
      stack: ["JavaScript", "Electron", "Game State Integration"],
      info: "Desktop · inactive",
      inactive: true,
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/lineups_cs2" }],
      shots: [],
    },
    {
      id: "better-cli", name: "Better CLI", icon: "g-doc",
      blurb: "A native macOS app that wraps the Claude Code CLI in a real GUI: a chat tab that renders streamed JSON as proper Markdown, and a terminal tab running inside a real PTY so login and permission prompts still work. Multiple named sessions, each with its own working directory.",
      stack: ["Electron", "React", "TypeScript", "node-pty", "xterm.js"],
      info: "Desktop · inactive",
      inactive: true,
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/Better-CLI" }],
      shots: [],
    },
    {
      id: "mylisp", name: "mylisp", icon: "g-doc",
      blurb: "A tree-walking interpreter for a Scheme-flavored Lisp in dependency-free Python: special forms, arbitrary-precision integers, a Lisp-defined prelude, and a REPL with persistent history. Built as an experiment in agent harness engineering, written end to end by AI coding agents with no human edits.",
      stack: ["Python", "Scheme", "Interpreter"],
      info: "Languages · inactive",
      inactive: true,
      links: [{ label: "GitHub", href: "https://github.com/ggttlplp201/mylisp" }],
      shots: [],
    },
  ];

  function about(P, O) {
    return `
      <div class="peter-row">
        <div class="peter-wrap">
          ${PETER}
          <span class="peter-zot">zot zot zot!</span>
        </div>
        <div class="peter-bio">
          <h2>${P.fullName}</h2>
          <p class="meta">Sophomore CSE student at UCI</p>
          <p>Part-time ski instructor, also building stuff...</p>
          <p class="meta">Irvine | Lisbon | Beijing</p>
        </div>
      </div>
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
      <p class="meta" style="text-align:center;">leonm6@uci.edu · 949-738-8015 · leonmeng.xyz<br>github.com/ggttlplp201 · linkedin.com/in/leonylmeng</p>
      <p style="text-align:center;"><a href="leon/assets/resume/Leon_Resume.pdf" target="_blank" rel="noopener">Open full résumé →</a></p>
      <hr class="rule">

      <h3>Education</h3>
      <p><strong>University of California, Irvine</strong></p>
      <p class="meta">Bachelor of Computer Science and Engineering · 2025–2029 · Irvine, CA</p>
      <hr class="dotrule">

      <h3>Technical Skills</h3>
      <p><strong>Programming Languages</strong><br>Python, Java, JavaScript, TypeScript, HTML, CSS, SQL</p>
      <p><strong>Web &amp; Backend</strong><br>React, Vite, Tailwind, FastAPI, Supabase, PostgreSQL, Vercel serverless functions, REST APIs</p>
      <p><strong>AI &amp; Automation</strong><br>Anthropic Claude &amp; OpenAI APIs, image processing pipelines, LLM tooling, workflow automation</p>
      <p><strong>Data &amp; Quantitative</strong><br>pandas, NumPy, scikit-learn, SciPy, SQLite, Streamlit, backtesting &amp; walk-forward validation</p>
      <p><strong>Robotics &amp; Vision</strong><br>Odometry &amp; localization, path planning (Roadrunner), finite state machines, OpenCV, Limelight 3A vision, CAD (Fusion 360), photogrammetry (RealityScan), 3D printing</p>
      <p><strong>Developer Tools</strong><br>Git, GitHub, Docker, Linux, CI/CD pipelines, pytest, vitest</p>
      <hr class="dotrule">

      <h3>Experience</h3>
      <p><strong>SomaFuture</strong> — Software Engineer</p>
      <p class="meta">Jun 2026 – Aug 2026 · Oeiras, Portugal</p>
      <p>• Designed and built a completely new company website (<a href="https://do-mus-mat-v2.vercel.app" target="_blank" rel="noopener">live demo</a>) that redefined SomaFuture's strategic direction toward standardizing and digitalizing its product line, translating a physical catalog into a structured digital experience<br>
         • Built internal mini-apps and automation programs — including file translators that preserve the original document formatting — eliminating manual reformatting and accelerating office workflows<br>
         • Prototyped a mock-up 3D room configurator and evaluated competing methods for reconstructing product geometry, comparing photogrammetry (RealityScan) against CAD-authored models to determine a viable digitalization pipeline<br>
         • Defined the company's roadmap for incorporating AI into its products and initiated outreach to potential collaborators, including AiHouse, on tooling for floor-plan-to-3D generation and custom home configuration in 3D space</p>
      <p><strong>First Tech Challenge</strong> — Teams 16031 &amp; 16205, Autonomous &amp; Mechanical Engineer</p>
      <p class="meta">Oct 2021 – Jun 2025 · Vancouver, BC</p>
      <p>• Implemented an odometry system using encoders; computed horizontal/vertical displacement per time step, corrected for rotational drift, and converted to field coordinates via trigonometric transforms for sub-centimeter localization accuracy<br>
         • Built a vision-guided object detection system using Limelight 3A and OpenCV: designed a color-isolation pipeline (contour detection, color filtering) to detect and localize game elements in real time, then computed target contour angle and position to autonomously align the robot for pickup<br>
         • Implemented a finite state machine coordinating all robot mechanisms via event triggers, and integrated Roadrunner for trajectory planning and tuning to produce repeatable multi-step autonomous routines<br>
         • Designed and fabricated custom 3D-printed mechanical components (chassis, drivetrain, arm pivot, scoring mechanism) and co-authored the team's Engineering Portfolio; earned multiple top-scoring awards at the British Columbia and Alberta championships</p>
      <hr class="dotrule">

      <h3>Projects</h3>
      <p><strong>GARDEROBE</strong> — <a href="https://the-garderobe.com/" target="_blank" rel="noopener">the-garderobe.com</a></p>
      <p class="meta">Full-Stack Wardrobe Manager — React, Supabase, FastAPI, Claude API</p>
      <p>• Built and shipped to production a full-stack wardrobe management app with AI auto-tagging that extracts item name, brand, color, and type from an uploaded photo via the Anthropic Claude API<br>
         • Implemented in-browser ML background removal, a drag-and-drop outfit builder, and a live price-tracking wishlist backed by scheduled FastAPI scraping jobs (Grailed, SSENSE) refreshed every 6 hours<br>
         • Built a full social layer on Supabase realtime — profiles, publishing, an Explore page, a people directory, friends, and likes — plus a feed aggregating fashion and culture articles from multiple third-party news APIs</p>
      <p><strong>Component Style Studio</strong> — <a href="https://github.com/ggttlplp201/UI-Library" target="_blank" rel="noopener">github.com/ggttlplp201/UI-Library</a></p>
      <p class="meta">Visual Page Builder for React Codebases — TypeScript, React, Vite, Tailwind, AST tooling</p>
      <p>• Built a local-first visual page builder in which every block is a live React component: scans any React project folder in place, extracts props via react-docgen-typescript, and renders each component in a per-project child dev server so previews use its real CSS, Tailwind config, and dependencies<br>
         • Wrote an AST edit engine that writes visual changes (style, text, animation) back into the component's actual source without touching program logic, and exports either a self-contained single-file HTML site or a diffable zip of the edited source<br>
         • Designed a multi-page authoring model with a node-graph root connecting pages, per-page loading screens and cursor effects, and a live preview mode; ships a bundled library of 130+ components across three design themes</p>
      <p><strong>CS2 Quant — Skin Trading Agents</strong> — <a href="https://github.com/ggttlplp201/cs666" target="_blank" rel="noopener">github.com/ggttlplp201/cs666</a></p>
      <p class="meta">Quantitative Research System — Python, pandas, scikit-learn, SQLite, Streamlit</p>
      <p>• Built two independent paper-trading agents on the CS2 skin market — one event-driven (trading update-induced repricings), one positional value/trend — over a shared data layer, indicator library, signal bus, and provenance-logged ledger<br>
         • Implemented a T+7-aware settlement model, market regime classifier, risk gate, and honest walk-forward backtester that quarantines in-sample results from out-of-sample scoring; covered by a 186-test suite<br>
         • Shipped a read-only Streamlit research dashboard surfacing poller data-health gaps, spread-vs-liquidity trading costs, per-rule out-of-sample scorecards, and a browsable decision log tracing why each signal fired</p>
      <hr class="dotrule">

      <h3>Awards &amp; Achievements</h3>
      <p>• USACO Gold Division (2023)</p>`;
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
      title: "About Me", info: "About · 2K", size: { w: 460, h: 280 } },
    { id: "projects", kind: "folder", label: "Projects", glyph: "g-folder", x: 24, y: 120,
      title: "Projects", info: "11 items · 264K in folder", size: { w: 380, h: 340 } },
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
