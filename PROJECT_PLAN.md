# Project Plan — Interactive 3D Creative Developer Portfolio

Status (24 Nov 2026): Phases 1–3, 5 and 6 are implemented and tested. Phase 4 (the final character) is blocked on the rigged GLB. Measured results are in `README.md`; open items are in §10.

---

## 0. Inputs and what was actually inspected

| Input | Status |
|---|---|
| Character reference (full-body render, grey hoodie, black trousers, white sneakers) | Received. Saved as `assets-src/character-reference.png`. |
| Screenshot of the reference website | **Not received.** Only the character render was attached. The analysis below is from the live site instead. |
| Live reference site `codeofsagar.in` | Inspected on 24 Nov 2026 with Playwright (headless Chromium, SwiftShader WebGL) at 1440 × 900, scrolling with real wheel events so Lenis and ScrollTrigger respond. 50 frames captured, plus the menu and a fine-grained pass over the hero → "Creative Developer" handoff. |

The live site has been re-positioned since the brief was written: its copy is now business-oriented ("Websites That Sell"), and some compositions named in the brief (an oversized `SELECTED` / `WORK` split, an "Off the Screen" section, a full-screen `HELLO`) don't exist there in that form. Where the brief and the live site differ, **the brief wins** (it describes the screenshot that was meant to be attached). Where the brief is silent, the live site's visual language was used. Anything not observable is marked *assumption*.

---

## 1. Visual analysis (observed)

### 1.1 Global language
- **Canvas.** One shared full-viewport `<canvas>` (1440 × 900 at DPR 1) sits behind and in front of DOM content. One WebGL context for the entire page.
- **Assets loaded by the reference.** A rigged character GLB, separate animation clips (`typing`, `jumping`, `armStretch`, plus JSON-baked clips `standSit`, `jumpingDown`, `tripping`, `casting`), and props (`chair.glb`, `desk2.glb`, a laptop GLB). This confirms the architecture: one character model, clips loaded separately, props as separate GLBs.
- **Type.** A geometric grotesk for everything (medium weight, tight tracking, sentence case ending with a period: "Creative Developer.", "Selected Work."), with a monospace for micro metadata (uppercase, tracked: `INDEPENDENT`, `BASED IN …`, `CLIENTS WORLDWIDE`).
- **Scale.** Section titles are about 5.2 vw (75 px at 1440). The hero headline is about 3.2 vw, centred, on two lines. Body copy is 12–13 px, semi-bold, set in narrow blocks (about 32 ch). Mono micro labels are 10 px.
- **Grid.** Faint vertical column rules across white sections (about 6 lines at 1440, very low contrast), a 56 px header with a small mark on the left, a centred wordmark, and `SOUND` + `MENU` on the right.
- **Colour.** White background, near-black ink, one pale lime-beige accent on the only button ("See all work ↗", with a black square arrow chip). The hero sky is the only large area of colour.
- **Annotations.** Hand-drawn arrow plus a two-line handwritten-feel caption pointing at the character ("That's me, on my third coffee.").
- **Menu.** Not full-screen. A small white panel drops from top-right with uppercase links separated by hairlines; the current page is struck through. Email and social links sit at the bottom, and a round `CLOSE` chip replaces `MENU`.

### 1.2 Sequence (top → bottom, 1440 × 900, total scroll height ≈ 17 965 px)
| # | Scroll px | Composition | Character |
|---|---|---|---|
| 1 | 0–3 300 (pinned, about 3.7 vh) | Sky with volumetric clouds, two sculptural hands (Creation-of-Adam pose) from bottom-left and top-right. Headline top-centre, annotation mid-right, intro paragraph bottom-right, scroll cue bottom-centre. | Seated on the lower hand's fingers, laptop on lap, typing loop. |
| 1→2 | ≈ 2 250–2 700 | Headline swaps to a second line ("Let's Make It Simple."), then a **page-curl** peels the sky away to white. | Hidden during the curl. |
| 2 | ≈ 3 150 | Desk scene: gaming chair, desk, monitor, PC. Headline top-left, testimonial carousel on the right. | Seated, typing. Then stands, stretches and **jumps off the desk** (camera follows). |
| 3 | ≈ 4 000–5 000 | "Creative Developer." at about 5.2 vw across the middle, paragraph top-left, right-aligned list of four services, mono row at the bottom. | Lands and stands **in front of** the title (occludes 2–3 letters). Blob shadow on the floor. Idle gestures, then jumps again. |
| 4 | ≈ 5 400–7 600 | "Selected Work." The camera dives in close on the falling character while project screenshots orbit him in 3D (cards at different depths). | Falls into the title, then a close-up pass. |
| 5 | ≈ 8 000–10 000 | Laptop on a patch of grass. The lid opens and the camera pushes into the screen. | Not present. |
| 6 | ≈ 10 300–12 600 | Aurora night scene with a client logo wall, "From Rome to Toronto", "Oops!". | Trips, then sits on a bean bag with a laptop. |
| 7 | ≈ 13 000 | "Things I Do For You" service grid. | Seated on a bean bag. |
| 8 | ≈ 13 500–15 700 | Full-bleed video of a sketching desk ("Where Code / Meets Art."). | Live action, not the 3D character. |
| 9 | ≈ 16 200 | "How We Work Together" process list with a video. | — |
| 10 | ≈ 16 600–17 965 | Black footer card: "Got A Project In Mind?", email, page links, local time, status, ghosted "Hello" letters behind. | — |

### 1.3 Motion observations
- Scroll is smooth (Lenis on `<html>`). Section pins are long (the hero holds for about 3.7 viewports), and other sections scroll normally between pins.
- The character never teleports on screen. Large position changes happen while he is airborne (jumps) or while the camera is moving.
- Text reveals are short, masked, upward slides. Nothing bounces.
- *Assumption (not observable headless):* `SOUND` toggles ambient audio. Not implemented, per the brief ("no sound by default").

---

## 2. Design decisions for this build

- **Original identity.** No reference branding, mark, wordmark, copy, hand sculptures, character model or textures are reused. The wordmark and all copy are placeholders from `src/data`.
- **Type.** *Instrument Sans* (variable, `wght` 400–700, `wdth` 75–100) for display and text, *IBM Plex Mono* for metadata. Both are OFL and self-hosted at build time by `next/font`. Similar editorial behaviour to the reference, different faces.
- **Palette.** `--bg #FBFBF9`, `--ink #0C0C0D`, hairlines at 7 % ink, accent `--lime #E4EDB4`. The only saturated colour is the hero sky.
- **Hands.** Procedural plaster/stone sculptures, generated at runtime from about 40 primitives merged into one geometry per hand (1 draw call each). No third-party scan is needed, and the result is clearly original.
- **Hero exit.** A **cloud dissolve** (noise-thresholded sky that breaks apart into the white page) instead of the reference's page-curl, so the transition is our own.

---

## 3. Scene-by-scene architecture (homepage, desktop)

Layering contract, used everywhere:

```
z 0   fixed column rules (DOM)
z 1   "back" typography (DOM): name, WORK, HELLO, titles the character stands in front of
z 2   shared WebGL canvas (fixed, pointer-events: none)
z 3   "front" DOM: small copy, links, annotations, buttons
z 50+ header, menu, page-transition curtain, preloader
```

Sections never create stacking contexts (no transform/opacity/filter on section wrappers), so back and front layers interleave with the canvas. Pinned compositions use **two sibling `position: sticky` layers** (back + front) inside a tall section rather than a ScrollTrigger pin. A pin is one stacking context and would put both layers on the same side of the canvas.

| Scene | DOM (server-rendered) | 3D | Character station / state |
|---|---|---|---|
| 01 Preloader | Wordmark, giant counter tied to real progress (fonts + scene chunk + GLTF/texture loading manager). Capped at 4.5 s. Never blocks content. | Starts the asset loads. | — |
| 02 Hero | Headline, role label, intro paragraph, annotation arrow, scroll cue. A CSS sky + static character image act as the no-WebGL fallback. | Sky shader (gradient + 2-layer FBM clouds + dissolve), 2 procedural hands, procedural laptop, key/hemi/env lights, mouse parallax on the camera. | `hero` (world space): seated on the lower hand, laptop open, `typing`. |
| 03 Transition | Headline masks out, intro name masks in, all scrubbed. | Laptop lid closes → stand up → hands drift out → sky dissolves → camera eases to the page camera → character leaps onto the intro station. | `closeLaptop` → `standUp` → `jump` → `land` (scrubbed, fully reversible). |
| 04 Intro | Oversized name (back layer), short bio, About link, mono meta row. | — | `intro`: standing in front of the name, idle with cursor look-at. |
| 05 Expertise | "Creative / Developer." split over two lines, numbered capabilities with one-line descriptions, short paragraph. | — | `expertise`: walks in, stands left of centre, `point` toward the list. |
| 06 Selected work | `SELECTED` + oversized `WORK`, then an asymmetric project grid (varying spans and offsets), masked image reveals, inner parallax, hover states. | — | `work`: sits on top of the WORK letters (`sitIdle`) and looks toward the project in view. |
| 07 Workspace | Title + tools/experiments list, sticky composition. | Procedural desk, chair, monitor (code-shader screen), keyboard, blob shadows. Visible only while the section is on screen. | `desk`: walks in from the left, `sitDown` → `typing`. |
| 08 Off the screen | Asymmetric photo placeholders + short notes. | Nothing rendered (canvas idles). | Hidden. |
| 09 Contact | Full-width `HELLO`, email + copy button, socials, availability, back to top. | — | `hello`: walks in from the right, `wave` once, then `idle`. |

Other routes share the canvas and the station system:
- `/about`: one station beside the bio (`think`).
- `/contact`: the HELLO composition.
- `/work`, `/work/[slug]`, `/playground`: no character, so the canvas renders nothing.

### Station system
`<CharacterStation>` renders an invisible box whose **bottom-centre is the feet** and whose **height is the character's apparent height**, so CSS layout decides where the character goes and how big it is at every viewport.

Per frame the director:
1. Reads the rects of at most two stations.
2. Interpolates between them with the scroll-derived `travel` value (ScrollTrigger, smoothed). Because both rects move with the page, a linear blend produces steady on-screen motion with no drift.
3. Converts screen position + apparent height into a **world position at a constant world scale** (1.75 m tall), using the canonical camera. Bigger apparent size means closer to the camera, never a rescale.

Stations can also enter from off-screen (`enter="left" | "right"`). If no JavaScript or WebGL is available, each station shows the static cut-out instead.

---

## 4. Technology

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack, Cache Components), React 19.3, TypeScript 5 | Routes are statically prerendered. Activity-preserved routes are handled (effects re-run on show). |
| 3D | three 0.187, @react-three/fiber 9.8, drei 10.7 (`useGLTF`, `useTexture` only) | `frameloop="never"`: R3F renders from the single GSAP ticker. |
| Motion | GSAP 3.15 (ScrollTrigger, SplitText — both included in the free `gsap` package), Lenis 1.3 | One loop: `gsap.ticker → lenis.raf → ScrollTrigger.update → R3F advance`. |
| Styling | CSS Modules + global tokens | No UI or CSS framework. |
| Assets | GLB with Meshopt (+ optional KTX2), WebP/AVIF via `next/image` | Decoders are local. No CDN fetches at runtime. The GLB pipeline is its own lazy chunk, fetched only once a model is configured. |
| Tests | Playwright | Desktop / mobile / reduced-motion / no-WebGL projects. |

Desktop-only code (GSAP, Lenis, three, R3F) is behind `import()` gates that run only after a capability check, so phones never download it. This is verified by a test that records network requests.

---

## 5. Character asset pipeline (no Blender)

> **Superseded for the current phase by `ZERO_BUDGET_PLAN.md`.** Paid image-to-3D exports are off the table, so the character is now a hybrid 2.5D image character. The GLB path below still works if a free rigged model ever becomes available.

1. **Model.** Image-to-3D in **Tripo** or **Meshy** from `assets-src/character-reference.png`. Generate an A-pose variant first: front view, arms 30–45° from the body, feet shoulder-width. Target 25–40 k triangles and one 2048² PBR texture set (base colour + normal + ORM). Check the face, curly hair silhouette, hoodie drawstrings and sneakers against the reference before rigging.
2. **Rig.** Use the generator's built-in humanoid auto-rig, or upload to **Mixamo** (FBX/OBJ). Keep the Mixamo bone names (`mixamorig:Hips` … `mixamorig:Head`) so every clip shares one skeleton.
3. **Facial.** If the generator outputs blendshapes, keep `eyeBlinkLeft` / `eyeBlinkRight` (ARKit names) or a single `blink`. Otherwise blinking is disabled; no fake eyelids are drawn.
4. **Clips.** Mixamo → FBX "Without Skin", **In Place** where offered, 30 fps. Convert with [`FBX2glTF`](https://github.com/facebookincubator/FBX2glTF) (CLI, no Blender). The full list is in §9.
5. **Optimise.**
   ```bash
   npx @gltf-transform/cli optimize character.glb public/models/character/character.glb \
     --compress meshopt --texture-compress webp --texture-size 2048
   npx @gltf-transform/cli optimize clips.glb public/animations/character-clips.glb --compress meshopt
   ```
   (`--texture-compress ktx2` once the KTX2 transcoder in `public/basis/` is enabled in `character.config.ts`.)
6. **Wire up.** In `src/config/character.config.ts`, set `model.url`, add any external clip files to `animations`, and run the site with `?debug`. The HUD lists every state and which clip it resolved to, or which fallback it is using.

No website code changes when the GLB arrives.

---

## 6. Animation timeline map

### Hero → Intro (sticky section, 360 vh tall, so 260 vh of scroll). `p` = section progress, scrubbed (0.8 s smoothing).

| p | DOM | 3D | Character |
|---|---|---|---|
| 0.00–0.06 | hold | clouds drift, mouse parallax | `typing` (looping, time-based) |
| 0.04–0.20 | headline lines mask out, labels fade | laptop lid 105° → 0° | `closeLaptop` scrub |
| 0.18–0.34 | — | — | `standUp` scrub |
| 0.22–0.62 | — | sky dissolves to page white | — |
| 0.25–0.65 | — | hands drift outward/down, out of frame | — |
| 0.30–0.62 | — | camera: hero pose → canonical page camera | — |
| 0.34–0.66 | — | — | leap from hand to intro station (parabolic arc), `jump` → `land` scrub |
| 0.50–0.80 | name characters mask in (staggered) | — | — |
| 0.70–0.92 | bio, link, meta fade/slide in | — | `idle` + cursor look-at |

Every value is a pure function of `p`, so reverse scrolling replays the sequence backwards with no resets.

### Station travel (all other scenes)
`travel` 0 → 1 runs from "next section top hits viewport bottom" to "next section top hits viewport top". This is overridable per station with `data-travel-start` / `data-travel-end`.

| From → To | Motion | States |
|---|---|---|
| intro → expertise | walk left, ≈ 0.2 vw | `walk` (timeScale from on-screen speed), face travel direction, then `point` |
| expertise → work | step up onto the WORK letters | `walk` → `sitIdle` (`sitDown` one-shot on arrival when the clip exists) |
| work → desk | enters from the left edge | `walk` → `sitDown` → `typing` |
| desk → hello | enters from the right edge | `walk` → `wave` (one-shot) → `idle` |

---

## 7. Performance strategy

- **Bundles.** Mobile ships the Next runtime + page HTML/CSS + tiny client islands (menu, copy email, transitions). Desktop adds a motion chunk (GSAP/Lenis) after hydration and the 3D chunk (three/R3F) on idle, while the preloader runs.
- **One WebGL context, one loop.** Render only when something is visible: hero on screen, character on screen, or desk on screen. Otherwise the canvas is cleared once and the loop does no GPU work. The ticker stops in hidden tabs (rAF).
- **Draw calls.** Each hand is one merged geometry, and the laptop/desk/chair share a handful of materials. The sky is one full-screen triangle that is not rendered after the dissolve.
- **Adaptive DPR.** Starts at min(devicePixelRatio, 1.75). A rolling frame-time average steps it down to 1.0 (and back up) in 0.25 steps.
- **One shadow map, hero only.** The key light shadows the sculptures, and its map re-renders only while the hero is on screen. Every other contact shadow is a blob texture. No environment map: a PMREM bake costs several start-up shader compiles for little visible gain.
- **Staged start-up.** Scene parts mount one per idle callback, materials compile with `compileAsync`, and reveal setup is time-sliced into ≤ 8 ms batches, so no single main-thread task blocks for long.
- **Memory.** No allocation in frame loops (scratch vectors are hoisted). R3F disposes objects on unmount, and the loaders' caches prevent re-downloads between scenes and routes.
- **Images.** `next/image` with AVIF/WebP, explicit sizes and `sizes` attributes. Only the hero fallback/LCP image is `priority`.
- **Fonts.** Two families, self-hosted, `display: swap`, with metric-matched fallbacks.

Targets (desktop): 60 fps on capable hardware, LCP < 2.5 s, CLS < 0.1, INP < 200 ms, Lighthouse ≥ 90. The measured numbers are in `README.md` → *Performance results*.

---

## 8. Implementation order

1. **Foundation.** Next app, tokens, fonts, data layer, desktop/mobile gate, header + menu, routes, SEO files. ✅
2. **Desktop UI.** All home compositions, work index + detail, about, playground, contact, mobile home. ✅
3. **Three.js architecture.** Shared canvas, scene bus, director, camera rig, lights, sky, hands, laptop, workspace props, asset loading + fallbacks. ✅
4. **Character integration.** Animation controller + clip map + procedural look-at/blink are built. **Blocked on the GLB.** The 2D placeholder is in use.
5. **Motion.** Lenis/ScrollTrigger loop, hero scrub, station travel, reveals, page transitions, scroll restoration. ✅
6. **Optimisation + tests.** Production build, bundle isolation test, Playwright suite (90 passing across Chromium/Firefox/WebKit and emulated phone/tablet), Lighthouse. ✅ (results in README)

---

## 9. Required asset checklist

### Character model — `public/models/character/character.glb`
- [ ] Single skinned mesh (or ≤ 3 meshes: body, hair, eyes), 25–40 k tris, ≤ 4 materials
- [ ] Humanoid skeleton, Mixamo naming, ≤ 65 bones, 4 influences per vertex
- [ ] Rest pose A- or T-pose, **feet at y = 0, facing +Z, 1 unit = 1 m**, height ≈ 1.75
- [ ] 2048² textures max (base colour sRGB, normal, ORM), Meshopt-compressed, WebP or KTX2
- [ ] Optional morph targets: `eyeBlinkLeft`, `eyeBlinkRight` (or `blink`), `jawOpen`
- [ ] Identity check against the reference: curly black hair, moustache + light beard, grey hoodie with drawstrings and kangaroo pocket, black tapered trousers, white low-top sneakers, realistic proportions (no oversized head)

### Clips — `public/animations/*.glb` (same skeleton, in place, 30 fps)

| State | Suggested Mixamo clip | Loop | Status |
|---|---|---|---|
| idle / standing | "Idle" or "Breathing Idle" | ✔ | missing (no model yet) |
| lookAround | "Looking Around" | ✔ | missing |
| walk | "Walking" (in place) | ✔ | missing |
| run | "Running" (in place) | ✔ | missing |
| jump | "Jumping" (in place) | one-shot / scrub | missing |
| land | "Falling To Landing" / "Hard Landing" | one-shot / scrub | missing |
| sitDown | "Stand To Sit" | one-shot | missing |
| sitIdle | "Sitting Idle" | ✔ | missing |
| standUp | "Sit To Stand" | one-shot / scrub | missing |
| typing / laptopWork | "Typing" / "Sitting And Typing" | ✔ | missing |
| closeLaptop | *no stock clip:* record or keyframe (seated, both hands close a lid) | scrub | missing, falls back to `sitIdle` |
| wave | "Waving" | one-shot | missing |
| turn | "Left Turn" / "Right Turn" | one-shot | missing, procedural yaw is used |
| think | "Thinking" | ✔ | missing |
| point | "Pointing" | one-shot / hold | missing |
| breathing, blinking, cursor look-at | procedural (spine scale, morph targets, neck/head bones) | — | built, active once a model exists |

### Props (optional upgrades — procedural versions ship now)
- [ ] `props/laptop.glb` (≤ 3 k tris, lid as a separate node with its pivot on the hinge)
- [ ] `props/desk.glb`, `props/chair.glb` (≤ 5 k tris each)
- [ ] `environments/hands.glb` (2 sculpted hands, ≤ 30 k tris total, one 2k texture)

### Content
- [ ] Name, title, bio, location, availability, email, socials (`src/data/site.ts`)
- [ ] Projects, covers (≥ 2000 px wide), gallery images (`src/data/projects.ts`, `public/images/projects/`)
- [ ] Playground experiments, "Off the screen" photos
- [ ] Real OG image, favicon/mark, canonical domain (`SITE_URL`)

---

## 10. Known limitations (current phase)

1. **There is no 3D character model.** The character is a hybrid 2.5D image character: your render on a 2D skeletal mesh. It sits, stands, crouches, hops and breathes, but it can't turn or show its back. See `ZERO_BUDGET_PLAN.md` §8.
2. The reference **screenshot** was not attached. The layout follows the brief + the live site, so compositions the brief describes but the live site lacks (SELECTED/WORK split, Off the Screen, HELLO) are original interpretations.
3. Hands, MacBook (Air-like, with logo/notch/keyboard/trackpad/hinge), desk and chair are procedural models, sculptural rather than photoreal.
4. Placeholder imagery (projects, photos, experiments) is generated abstract artwork, clearly labelled as mock.
5. Cross-browser results are limited to what was actually run (see README). Safari/Firefox on real hardware, Windows, and real mobile devices still need a pass.
6. Mobile home LCP measures 2.6–2.7 s under Lighthouse's simulated slow 4G, just above the 2.5 s target (desktop and the other mobile routes meet it).
7. The home HTML contains both the desktop and the mobile tree. CSS shows the right one from the first paint, and the inactive tree is removed after hydration. Crawlers that don't run JavaScript therefore see two `h1`s on `/`. If that matters, switch to user-agent routing in `proxy.ts` (which makes `/` dynamic).
8. The Workspace entrance is a profile walk cycle from the walking render (cut-out layers, one key stride); the hero seated render and the desk render are dedicated images with subtle in-plane motion. Two hand-overs are visible cuts (seated render → standing on the rise; walker → seated render as he sits). The intermediate poses that would remove them are specified in `ZERO_BUDGET_PLAN.md` §4b. Pushing the desk, arms crossed and pencil writing still need pose images.
9. The sunset → northern-lights sky transition is not implemented yet.
