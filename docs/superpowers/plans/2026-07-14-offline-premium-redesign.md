# Offline Premium Portfolio Redesign Implementation Plan

**Goal:** Rebuild Ted Svärd’s portfolio as a premium static site with a fully offline simulated console, no Nexus runtime, no external endpoints, and no exposed personal addresses.

**Architecture:** Keep the project dependency-free and GitHub Pages compatible. A shared `style.css` defines the editorial visual system; `app.js` provides only local navigation, theme, reveal effects, and deterministic simulated console data; each HTML page owns its content.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, local SVG/CSS visuals.

## Global Constraints

- No `fetch`, XHR, WebSocket, external API, IP address, endpoint URL, mailto link, or secret in shipped site files.
- Nexus is removed from navigation, content, scripts, and runtime behavior.
- AI Chat must be a clearly simulated local interface and must not claim live server access.
- No build step or third-party runtime dependency.
- Responsive, keyboard-focusable, reduced-motion aware.

### Task 1: Shared visual system and shell

**Files:** Modify `style.css`; create `app.js`.

- Replace the existing visual system with the graphite/ivory/cobalt editorial palette, responsive grid, typography, cards, status pills, and motion rules.
- Add local theme persistence, mobile navigation, reveal observer, and no-network console helpers.
- Verify with `rg` that `app.js` contains no network primitives.

### Task 2: Portfolio pages

**Files:** Rewrite `index.html`, `projekt.html`, `forskning.html`, `podcasts.html`, `om-mig.html`, `wiki.html`.

- Use one consistent header without Nexus, Server, personal email, or internal URLs.
- Replace outdated claims with concise project, research, and capability content.
- Use local visual panels and project metadata rather than external assets.

### Task 3: Offline console

**Files:** Rewrite `chat.html`; replace `server.html` with a local status explainer.

- Present a premium simulated IDE/operations console with deterministic local log playback, project tree, code stream, and static health indicators.
- Explicitly label data as “simulerad lokal vy”; form submission appends a local response only.
- Do not include Nexus or server address details.

### Task 4: Verification and delivery

- Run static scans for network calls, URLs, addresses, secrets, and Nexus references.
- Validate every local `href` target and HTML presence.
- Run the repository CI command locally, inspect the diff, commit the redesign, merge/push to `main`.
