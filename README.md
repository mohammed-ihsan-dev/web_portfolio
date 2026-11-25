# Creative Developer Portfolio — cinematic 3D foundation

Next.js 16 · React 19 · three.js / React Three Fiber · GSAP + ScrollTrigger · Lenis · CSS Modules.

A character-led, scroll-driven portfolio. One shared WebGL canvas, one character instance, and DOM typography layered in front of and behind it.

> **Status.** The visual foundation, motion system and 3D environment are built and tested. The character is a **hybrid 2.5D character**: your render, cut out locally and deformed by a 2D skeleton inside the 3D scene. It breathes, looks around, sits, stands, crouches, jumps and lands, and the face is never stretched. It is not a 3D model: it can't turn around. Dedicated pose images (prompts in `ZERO_BUDGET_PLAN.md`) slot in without code changes, and so would a rigged GLB. Proof of concept: hero → leap → "Creative Developer.". All copy, projects and images are placeholders.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run test:e2e` | Playwright suite. Build first. It starts `next start` on :3200, or set `BASE_URL` to use a running server |
| `npm run assets:character` | Prepares the character poses (cut-out, scale, WebP, rig, part map, torso underlay) from `assets-src/character/poses.json`. Also `-- --grid <pose>`, `-- --parts`, `-- --frames <dir\|video> --name <seq> [--atlas]` |
| `npm run assets:cutout` | Regenerates the static mobile / no-WebGL character image (with soft shadow) |
| `npm run assets:placeholders` | Regenerates mock project / photo / experiment images and the OG card |
| `npm run assets:basis` | Copies the KTX2 (Basis) transcoder to `public/basis/` (only needed for KTX2 textures) |

First-time Playwright users: `npx playwright install chromium firefox webkit`.

**URL switches** (any page):
- `?debug` — HUD with fps, DPR, render gating, active station, character state, renderer, and which pose images are still needed
- `?webgl=0` — force the static desktop layout (no WebGL)
- `?motion=0` — behave as `prefers-reduced-motion`

Set the canonical domain with `NEXT_PUBLIC_SITE_URL=https://your.domain` (used by metadata, the sitemap, robots and JSON-LD).

---

## Where to change things

| You want to change… | Edit |
|---|---|
| Name, role, bio, email, socials, availability, all section copy, SEO text | `src/data/site.ts` |
| Projects, project images, playground experiments | `src/data/projects.ts` + `public/images/projects/<slug>/` |
| Breakpoint, capability thresholds, preloader timing, DPR range | `src/config/site.config.ts` |
| Character pose images, measurements, prompts | `assets-src/character/poses.json` → `npm run assets:character` |
| Character rig presets (seated, crouch, jump…) | `src/three/character2d/rigPose.ts` |
| GLB model, clip names (only if a rigged model exists) | `src/config/character.config.ts` |
| Colours, type scale, spacing, layers | `src/styles/globals.css` (`:root` tokens) |
| Where the character stands in a section | that section's `CharacterStation` + its CSS (bottom-centre = feet, height = apparent height) |
| Hero choreography timing | `src/three/scenes/hero/heroLayout.ts` (3D) · `src/motion/scenes/heroTimeline.ts` (DOM) |

Personal details are not hard-coded anywhere else.

---

## How it works

### Three experiences, chosen before first paint
A tiny inline script in `<head>` (`src/lib/pre-paint.ts`) sets `html[data-experience]`, so CSS lays out the right page from the first frame (CLS 0).

| Mode | When | What loads |
|---|---|---|
| `mobile` | `< 1024px`, or any touch-first device (tablets included) | Separate lightweight layout. **No WebGL, GSAP, Lenis or three.js are downloaded.** This is verified by a test that inspects every script response. |
| `desktop-static` | Desktop, but reduced motion, save-data, low cores/memory, no WebGL2, or a runtime WebGL failure | Editorial desktop layout with a static character cut-out |
| `desktop-3d` | Capable desktop | Motion chunk (GSAP/ScrollTrigger/Lenis, 53 KB gz), then the WebGL chunk (three/R3F, 238 KB gz), both via `import()` after a capability check |

The breakpoint lives in one place (`DESKTOP_QUERY`) and is shared by the pre-paint script, the CSS and the JS gate.

### Layering contract
```
z0 column rules · z1 "back" type (name, WORK, HELLO) · z2 shared canvas · z3 "front" copy/links · z50+ chrome
```
Sections never create stacking contexts, so DOM text can sit both behind and in front of the character. Pinned compositions use two sibling `position: sticky` layers instead of a ScrollTrigger pin, because a pin would merge both layers into one stacking context.

### One loop
`gsap.ticker → Lenis.raf → ScrollTrigger.update → director.solve → R3F advance(render)`. R3F runs with `frameloop="never"`. The frame driver renders only when something 3D is on screen, then idles with a cleared canvas.

### Stations (how the character finds its place)
`<CharacterStation>` is an invisible box. Its bottom-centre is the feet and its height is the character's apparent height. The director (`src/three/director/director.ts`) reads the active pair of station rects each frame. It blends between them using scroll-driven `travel`, and converts the result to a world position at a **constant 1.75 m scale**: a bigger apparent size means closer to the camera, never a rescale. Stations can walk in from off-screen (`enter="left|right"`). Each one declares a loop state (`idle`, `point`, `sitIdle`, `typing`…), an optional arrival one-shot (`wave`, `sitDown`…), a pose and a facing.

### Hero → "Creative Developer." (proof of concept)
One scrubbed timeline drives `bus.hero.progress`. The DOM half (headline exit, title reveal) and the 3D half are pure functions of that value, so reverse scrolling replays exactly. The 3D half covers the laptop lid on its hinge, the laptop set aside, the stand, crouch, leap and land, the sky dissolve, hands drifting out, and the camera dolly. Choreography: `src/three/director/choreography2d.ts`.

### Workspace, Selected Work, finale
- **Workspace:** the character walks in (frontal gait), sits behind a camera-facing desk and types. The seat height is a per-station anchor (`hipsLiftOf` in the director).
- **Selected Work:** he leaps onto WORK and opens both arms; four project panels (WebGL planes textured with the mock covers) fly out and land on real links (`data-panel-slot`), which stay clickable and crawlable.
- **Finale:** the MacBook (`src/three/props/MacBook.tsx`) is seen closed from above, the lid opens, and the camera flies into the display. The real `<footer>` is projected onto the display corners with a CSS `matrix3d` homography (`src/three/scenes/finale/homography.ts`) that eases to identity, so you end up inside the page footer without a cut.

### The character (hybrid 2.5D)
`CharacterController` picks a renderer: **Rigged3D** (GLB, if configured), **Layered2D / MultiPose** (image poses on a 16-bone 2D skinned mesh, with crossfade or smear-cut swaps), or **FrameSequence** (scrubbed frames). Asset prep (`scripts/prepare-character.mjs`) does edge-aware background removal that keeps the white sneakers, edge matting, arm segmentation by flood fill, and synthesises the torso hidden behind the sleeves so swinging arms uncover fabric. Full write-up: `ZERO_BUDGET_PLAN.md`.

### Page transitions
`TransitionLink` wraps `next/link` (`onNavigate`). A curtain slides over the page, the route changes client-side, and scroll is reset, or restored on back/forward. Project links also fly the clicked image into the detail page's hero (shared element). It uses the Web Animations API, so it works on mobile without GSAP.

---

## Adding pose images (free)

1. Generate the pose with the prompt from `assets-src/character/poses.json` (or `ZERO_BUDGET_PLAN.md` §4), using your reference image, on a pure white background.
2. Save it as `assets-src/character/poses/<id>.png`.
3. `npm run assets:character -- --grid <id>`, then read crown/chin and the anchor (feet or hips) off the grid into `poses.json`.
4. `npm run assets:character`. The site uses the pose wherever the choreography prefers it.

## Adding a rigged 3D character (optional)

1. Generate and rig the model following `PROJECT_PLAN.md` §5 (Tripo/Meshy → auto-rig/Mixamo → FBX2glTF → `gltf-transform optimize --compress meshopt`). No Blender is needed.
2. Put files in `public/models/character/` and `public/animations/`.
3. In `src/config/character.config.ts`:
   ```ts
   model: { url: '/models/character/character.glb', scale: 1, yaw: 0 },
   animations: ['/animations/character-clips.glb'],
   ```
4. Open `/?debug`. The HUD lists every state and the clip it resolved to, `(via fallback)`, or `MISSING`. Clip names follow Mixamo defaults; add aliases in `clipMap` if yours differ.
5. Check the seated offsets (`characterConfig.seat`), the hero seat point (`heroLayout.seatRoot`) and the lap position of the laptop (`heroLayout.laptop.lap`).

The GLB pipeline (GLTFLoader, Meshopt, KTX2, mixer) is a separate 52 KB gz chunk that is only fetched once `model.url` is set. If the model fails to load, the image character is used and the site keeps working.

The required clip list and asset specs are in `PROJECT_PLAN.md` §9.

---

## Test & performance results (measured 24–25 Nov 2026)

All numbers are from **production builds on this machine** (Apple Silicon, macOS 26), served locally by `next start`.

### Playwright — `npm run test:e2e`
**90 passed, 0 failed** (24 skipped by design: device-specific tests on the other device class). Six projects ran: desktop Chromium, Firefox and WebKit at 1440×900, plus emulated Pixel 7, iPhone 15 and iPad Pro 11 (landscape). Coverage:
- Every route: 200, one visible `h1`, no console errors, no horizontal overflow. 404 route. Metadata, canonical, JSON-LD, sitemap, robots. Server-rendered content with JavaScript disabled.
- Desktop: preloader → hero handover, exactly one canvas, a scroll-driven hero sequence that **reverses correctly**, `?webgl=0` static fallback, reduced-motion fallback, SPA navigation with transition, and **scroll restoration on back** (all three engines).
- Accessibility: skip link first in tab order, menu dialog semantics (focus in, Escape, focus returned, `aria-current`), alt text on every image.
- Mobile / tablet: `mobile` experience, no canvas, desktop tree removed after hydration, and **no three.js / ScrollTrigger / Lenis code in any downloaded script**.

Headless WebGL in Chromium uses SwiftShader (software) in the suite, so the tests check behaviour, not frame rate.

### Lighthouse 12.8 (home unless noted)

| Run | Perf | A11y | Best pr. | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Desktop preset, GPU WebGL (Metal) | **98** | 100 | 100 | 100 | 0.6 s | 0–50 ms | 0 |
| Desktop preset, `/work` · `/about` (GPU) | 100 · 100 | 100 | 100 | 100 | 0.6 · 0.5 s | 0 ms | 0 |
| Desktop preset, software WebGL (SwiftShader) | 72 | 100 | 100 | 100 | 1.0 s | 740 ms | 0 |
| Mobile preset (simulated slow 4G, 4× CPU) | **96–97** | 100 | 100 | 100 | 2.6–2.7 s | 0–10 ms | ≤ 0.006 |
| Mobile, `/work` · `/work/northbound` | 97 · 97 | 100 | 100 | 100 | 2.5 s | 0 ms | 0 |

- Desktop targets are met on GPU-accelerated runs. On software WebGL, TBT comes from shader compilation and rendering running on the CPU. Scene construction is already staged across idle callbacks and reveal setup is time-sliced.
- **Mobile home LCP is 2.6–2.7 s under Lighthouse's simulated slow-4G throttle, just over the 2.5 s target.** The LCP element is the character image (preloaded, ~25 KB AVIF at 480 w). Unthrottled, it paints with first paint (32 ms).
- Transfer on first load: mobile home ≈ 284 KB total (150 KB of scripts), desktop home ≈ 711 KB including the WebGL runtime.

### Not yet tested (be aware)
- Real Safari and Firefox apps, Windows, and real phones/tablets. Only Playwright's engines and device emulation were run.
- Frame rate and memory on real low-power laptops (the `?debug` HUD shows live fps/DPR). Adaptive DPR steps 1.75 → 1.0 if frames exceed 21 ms.

---

## Project layout

```
src/
  app/                 routes (/, /work, /work/[slug], /about, /playground, /contact), sitemap, robots, icon
  components/
    desktop/           DesktopHome (sections), DesktopRuntime (motion + canvas chunk), DebugHud
    mobile/            MobileHome (lightweight)
    sections/          HeroIntro, SelectedWork, Workspace, OffTheScreen, Finale (home), ContactScene (/contact)
    experience/        ExperienceProvider (mode gate), HomeSwitch, Preloader
    layout/ navigation/ transitions/ ui/ work/
  motion/              runtime (Lenis+GSAP loop), reveals, stations, scenes/heroIntro
  three/
    canvas/            SceneCanvas (single WebGL context), FrameDriver (render gating, adaptive DPR)
    director/          per-frame solve: stations → world, character state, camera blend
    scenes/            SceneRoot (staged mount), hero/ (sky, hands, layout), workspace/, work/ (project panels), finale/
    props/             MacBook (procedural, shared by hero + finale)
    character/         CharacterController, Rigged3DCharacter / CharacterModel (GLB, optional), rig
    character2d/       2.5D image character: rig2d, rigPose presets, poses, frame sequences
    animation/         AnimationController (crossfade + scrub on AnimationMixer)
    camera/ lighting/ assets/
  config/ data/ lib/ styles/ types/
public/images/         character cut-out, mock project/photo/experiment art
scripts/               cutout-character.mjs, generate-placeholders.mjs
tests/e2e/             Playwright specs
assets-src/            original character reference render
```

## Known limitations
See `PROJECT_PLAN.md` §10. In short:
- No 3D model or skeleton: the character is a 2.5D image rig (one photo, 16 2D bones). Pushing, chair turns, arms crossed, writing, finger typing and a side-view walk need pose images (see `ZERO_BUDGET_PLAN.md` §4/§8) and are not implemented.
- The sunset → northern-lights sky is not implemented yet.
- The sculptural hands, MacBook, desk and chair are procedural models (no third-party assets).
- All content is mock.
- The reference screenshot mentioned in the brief was never received, so the layout follows the brief and the live reference site.
- Mobile is a foundation only; its final design is a later phase.
- Nothing is deployed.
# web_portfolio
