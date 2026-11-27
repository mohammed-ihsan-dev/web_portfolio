# Zero-Budget Cinematic Character Plan

Status (25 Nov 2026): the **proof of concept is built and tested**: sky → seated with laptop → close lid → set it aside → stand → leap → land in front of "Creative Developer." → reverse. It uses only the supplied render, open-source libraries and browser APIs. No paid tool, asset, API or subscription is involved, and nothing here needs one.

---

## 1. Hardware compatibility (measured on this machine)

| | |
|---|---|
| OS / arch | macOS 26.6.2, arm64 |
| CPU | Apple M4, 10 cores |
| GPU | Apple M4, 10-core, Metal 4 (unified memory; no CUDA) |
| Memory | 16 GB unified |
| Free disk | 135 GB |
| Python | 3.9.6 (Xcode system Python). Pillow present; **no** PyTorch, NumPy, OpenCV, rembg or onnxruntime |
| Other | Homebrew, ffmpeg, Node 22.18, npm 10.9 |

---

## 2. Open-source image-to-3D: feasibility

### TripoSR (VAST-AI-Research)

**Can it run here?** Yes. PyTorch supports Apple Silicon through MPS, and TripoSR has a CPU path too.

**Not attempted yet.** Before downloading anything this large, you asked for the requirements and an approval request, so here they are:

| Item | Size / cost |
|---|---|
| Python 3.11 (Homebrew; recommended over the 3.9 system Python) | ~100 MB |
| PyTorch + torchvision (arm64 wheels) | ~400–700 MB installed |
| TripoSR deps: transformers, einops, omegaconf, trimesh, xatlas, moderngl, imageio, rembg + onnxruntime; `torchmcubes` compiles from source (CMake, Xcode toolchain) | ~300–500 MB |
| Weights `stabilityai/TripoSR/model.ckpt` | **~1.7 GB** |
| rembg `u2net.onnx` (background removal) | ~176 MB |
| **Total** | **~3–3.5 GB disk**, ~6–10 GB RAM peak at marching-cubes resolution 256 |
| Run time per image (estimate, not measured) | tens of seconds on MPS, a few minutes on CPU |

**Expected result for this character** (an assessment from how TripoSR works, not a measured run):

| Criterion | Expectation |
|---|---|
| Facial resemblance | ❌ Soft and generic. Colour comes from a low-resolution triplane, so the face will not hold identity. |
| Curly hair | ❌ Merges into a smooth blob. |
| Clothing | ◐ Overall colours right; drawstrings, pocket and cuffs largely lost. |
| Side / back | ❌ Hallucinated from one front view. |
| Topology | ❌ Marching-cubes triangle soup (100–300 k tris), no UVs unless baked. |
| Rigging / deformation | ❌ No rig. Mixamo's auto-rigger is free, but arms fused to the torso deform badly. |
| GLB export / size | ✔ Exports GLB; ~5–20 MB before decimation. |
| Web performance | ◐ Fine after decimation, but there's no point if identity is lost. |

**Verdict:** TripoSR doesn't meet your top priority, an exact face. At best it could provide a hidden occlusion or shadow proxy. The free public Hugging Face demo you linked runs the same model if you want to see this for yourself. I didn't upload your image there, because that would send your likeness to a third-party service.

### Other open-source options

| Model | Why not here |
|---|---|
| TRELLIS, Hunyuan3D-2, InstantMesh, CharacterGen | CUDA-oriented and/or need 16–24 GB of dedicated VRAM; not practical on an M4 without renting a GPU (paid) |
| SF3D / SPAR3D | Gated weights under a community licence; quality on full-body humans is similar to TripoSR |

**Decision:** go straight to the hybrid 2.5D pipeline (§3), as the brief instructs. The TripoSR experiment remains available on your approval and wouldn't change any website code: a GLB plugs into `Rigged3DCharacter`.

---

## 3. Recommended method: hybrid 2.5D character

**Your actual image, deformed — never replaced.**

1. **Asset prep** (`npm run assets:character`, sharp only, no models). This step:
   - removes the background with an edge-aware flood fill. The white sneakers survive because a gradient barrier stops the fill at their outline; it's not a "make white transparent" pass.
   - mattes the edges (no halo around the curls), removes enclosed backdrop pockets (hair gaps, sleeve gaps, with the face protected), and strips the floor shadow so a dynamic one can move with jumps.
   - crops and scales every pose to the same world size via head height, and writes WebP.
2. **Segmentation.** Each arm is flood-filled from the wrist and elbow across opaque pixels, inside a measured outline. The result is a per-cell part map in the manifest (body / left arm / right arm / empty).
3. **Background extension.** The torso hidden behind each sleeve is synthesised from the torso's own edge pixels into a small underlay texture, so a swinging arm uncovers fabric, not a hole.
4. **2D skeletal mesh** (`Layered2DCharacter`). One subdivided plane (36 × 104 cells) is skinned to 16 in-plane bones. Arms have their own vertices, while body and legs form one continuous sheet. The **head is weighted 100 % to its bone and every inherited scale is compensated**, so the face is only ever moved or rotated, never stretched.
5. **Motion from one image.** Breathing, weight shift, head drift and cursor look, typing micro-motion, a seated pose from frontal foreshortening (hidden behind the real 3D laptop), stand-up, crouch, launch, tuck, landing squash. All of it is a deterministic function of scroll.
6. **MultiPose.** When dedicated pose images exist, the director swaps to them. Like-anchored poses crossfade (220 ms). Others cut on the motion with a short directional smear in the shader, never a slow crossfade between different bodies.
7. **FrameSequence.** Optional scroll-scrubbed sequences (from a folder or a video via ffmpeg), cropped with a stable union box and optionally packed into an atlas.
8. **Rigged3D.** The existing GLB path still works unchanged if a real model ever exists.

Everything around the character is real three.js: sky shader, sculptural hands, laptop with hinge, desk, chair, monitor, contact shadows.

---

## 4. Required pose images

Generate them with your existing image workflow, using the **preamble + pose prompt** from `assets-src/character/poses.json` (copied below), with your reference image attached. Save each as a PNG at the path shown. Then:

```bash
npm run assets:character -- --grid 02-laptop-working   # writes assets-src/character/debug/02-laptop-working-grid.png
# open the grid, note crown/chin (and feet or hips) pixel coordinates, add them to the pose in poses.json
npm run assets:character                               # cut-out, scale, WebP, manifest → the site picks it up
```

Only `crown`/`chin` and the anchor are required. Joints and arm outlines are optional and enable the 2D rig on that pose.

**Preamble (prepend to every prompt):**

> Use the attached image as the exact identity and outfit reference. Keep the same young man: natural curly black hair, the same face, eyebrows, eyes and nose, the same moustache and light beard, the same natural skin tone and friendly expression. Same outfit: light grey pullover hoodie with drawstrings and a kangaroo pocket, dark black tapered trousers, clean white low-top sneakers. Same semi-realistic 3D CGI character render style, realistic human proportions (do not enlarge the head), natural hands with five fingers, the same soft studio lighting from the front-left and the same colour grading. Full body visible from hair to shoes, nothing cropped, generous empty margin around the figure. Plain flat pure white background (#FFFFFF), no floor, no horizon, no cast shadow on the background, no text, no watermark. Portrait 2:3, at least 1536 px tall, PNG.

| # | File | Camera | Posture / hands / legs | Anchor | 3D props (NOT drawn) | Role in the timeline | Priority |
|---|---|---|---|---|---|---|---|
| 01 | `assets-src/character-reference.png` | Front, eye level | Standing, relaxed | feet | — | Base pose, fully rigged | ✅ have |
| 02 | `assets-src/character/poses/02-laptop-working.png` | ¾ front from his left, seated chest height | Seated on a ledge, thighs toward camera, forearms forward typing | hips | laptop on lap, hand seat | Hero idle; lid closes in 3D | ★★★ |
| 03 | `…/03-preparing-to-stand.png` | Same as 02 | Seated, leaning forward, palms on knees | hips | hand seat | 02 → stand (soft blend) | ★★★ |
| 04 | `…/04-jumping.png` | ¾ front, slightly low | Mid-air, knees tucked, arms out | hips | — | Leap (smear cut in/out) | ★★★ |
| 07 | `…/07-landing.png` | Front, eye level | Deep crouch landing, fingertips on the ground | feet | — | Touch-down before "Creative Developer." | ★★ |
| 08 | `…/08-confident-standing.png` | Front, eye level | Hands in hoodie pocket | feet | — | Idle in front of the title | ★★ |
| 09 | `…/09-superhero-jump.png` | Low ¾ front | Fist up, launching diagonally | hips | — | Exit to Selected Work | ★★ |
| 10 | `…/10-presenting-work.png` | ¾ front from his right | Arm extended, palm up | feet | floating project panels | Selected Work | ★★ |
| 05 | `…/05-pushing-computer.png` | Side-¾ from his right | Leaning into a push, arms extended | feet | floating desk + PC | Storyboard 5 | ★ |
| 06 | `…/06-desktop-working.png` | ¾ rear from his left, slightly high | Seated, hands on keyboard/mouse | hips | gaming chair, desk, monitor, tower | Storyboard 7–8 | ★ |
| 11 | `…/11-writing.png` | ¾ rear from his left, slightly high | Leaning over a desk, pencil in right hand | hips | wooden desk, chair, paper | Storyboard 18–19 | ★ |
| 12 | Superhero flight | Flying render, mirrored for right-to-left; curved path, acceleration, banking along the climb/dive, depth change, cape flutter (chain bones) | ✅ |

The per-pose prompts are in `assets-src/character/poses.json` → `poses[].prompt`. Each one tells the generator **not** to draw props the scene renders in 3D (laptop, desk, chair). That's what lets the real 3D laptop close on his lap.

**Consistency rules for every pose:** same outfit and lighting, pure white flat background, full figure with margin, no floor shadow on the backdrop, no props unless the prompt says so. If a generator adds a busy or gradient background, the local cut-out can't separate it. That case would need a matting model such as rembg (~176 MB, free, local), which I'd install only with your OK.

---

### 4b. Intermediate poses that would make the two remaining hand-overs invisible

Same identity, outfit, lighting and render style as the supplied images; transparent or flat background; full figure; at least 1536 px on the long side.

*Update 26 Nov 2026:* 1 and 2 were supplied and are integrated (`hero-closing`, `hero-rising` puppets). 3 and 4 are not planned.

1. **`hero-closing-laptop`** — same camera as `hero-macbook.png`, same seat on the edge, same leg position. Both hands on the lid edge closing the MacBook (lid at ~45°), eyes lifting from the screen to mid-distance, shoulders starting to rise. Bridges typing → the base pose.
2. **`hero-rising`** — same camera; weight forward, feet planted, hips just off the seat, closed MacBook held in his left hand at his side, looking ahead. Bridges the seated render → standing.
3. **`desk-sitting-down`** — same camera and set as `desk-working.png` (mirrored: he faces right), hips halfway down to the chair, torso turning from profile to three-quarter toward the monitor, right hand reaching for the keyboard. Bridges the profile walk → seated typing.
4. *(optional)* **`walking-right-passing`** — same camera as `walking-right.png`, the passing position (legs together under the hips, the swinging knee bent, arms near the sides). Gives the walk real cloth variation between strides.

## 5. Asset-generation pipeline (implemented)

| Tool | Status |
|---|---|
| `scripts/prepare-character.mjs` | Poses: cut-out, matting, pocket and shadow cleanup, consistent scale, WebP, normalised anchors and rig, part map, torso underlay. `--grid` measurement overlays. `--parts` segmentation previews. `--frames <dir|video> --name … [--atlas]` frame sequences (ffmpeg extraction, stable union crop, atlas packing). |
| `scripts/lib/cutout.mjs` | Shared edge-aware background removal (any flat backdrop colour). |
| `scripts/cutout-character.mjs` | Static mobile / no-WebGL image (keeps a soft baked shadow). |
| Sources | Preserved untouched in `assets-src/`. Outputs in `public/images/character/`. |

Current output: `01-standing.webp` 544×1516, 64 KB; underlay 11 KB; manifest 13 KB.

### 5b. Dedicated pose renders → layered puppets (`npm run assets:puppets`)

Four renders supplied on 26 Nov 2026 are preserved untouched in `assets-src/character/poses/` (`hero-macbook.png`, `flying.png`, `walking-right.png`, `desk-working.png`). `scripts/prepare-puppets.mjs` reads `assets-src/character/puppets.json` (all coordinates in source pixels) and, per render:

1. mirrors when asked (the desk set faces right, so the walk into the chair keeps one direction; the Apple logo patch is flipped back so it reads correctly);
2. gently corrects colour toward the reference render with a white-preserving per-channel map fitted on hoodie, skin and trouser medians (white sneakers and highlights never tint);
3. removes what must not ship: the beige seat under the hero render (colour rule inside a polygon, stricter near the sneakers), the desk render's dark backdrop (outside the kept objects, plus a colour-grown region between the curls), the edge-cut notebook and plant (desk wood continued row by row; the monitor behind the leaves refilled from the monitor);
4. mattes every cut edge against the local removed colour (`C = a·F + (1−a)·B`, F = the nearest solid pixel, pixels off the F–B line are left alone), so there are no halos or white/dark rims;
5. splits it into layers (back → front) and paints what each layer hides behind the ones in front (torso under the near arm, the far leg behind the near leg, the empty chair and keyboard under him) so limbs can move without opening holes;
6. bleeds edge colours into transparent texels (no fringes under GPU filtering), crops each layer, writes WebP, a coverage grid and the manifest.

Output (`public/images/character/puppets/`): hero 436×890 (52 KB), flying 1074×539 (71 KB), walking 5 layers (55 KB total), desk set 4 layers (≈190 KB). Each scene loads only its own layers, ahead of time (the hero's blocks the preloader; the others load while the previous scene plays). The runtime (`src/three/puppet/`) builds one skinned mesh per layer on a shared in-plane skeleton with soft weights; clips are pure functions of time or scroll phase.

---

## 6. Scene plan: the 19-step storyboard

The 19 reference screenshots weren't attached to this conversation. The storyboard below follows your numbered list, matched against my Playwright captures of the live reference site (same sequence).

| # | Step | Method | Status |
|---|---|---|---|
| 1 | Sitting on the sculptural hand, working on a laptop | Dedicated render (seated with its own MacBook) on the index finger; puppet: breathing, typing hand, small head/shoulder motion, eyes stay on the screen | ✅ |
| 2 | Stops work, closes the MacBook, rises | Seated render: typing stops, hands lift → **closing render** (hands on the shut lid, head lifting) → **rising render** (off the finger, MacBook in one hand) → base pose finishes standing while the 3D MacBook takes over in his hand and is set on the palm. Each hand-over is a short scroll-driven dissolve: the incoming render fades in *under* the outgoing one, then the outgoing one fades out, while both slide so their faces meet | ✅ (a brief soft dissolve at each hand-over is visible if you stop mid-way) |
| 3 | Jumps away from the hand | Crouch → launch → tuck → land, ballistic arc, dynamic shadow → pose 04 | ✅ PoC |
| 4 | Approaches the computer setup | Walk cycle from the profile render (cut-out layers: legs swap over half a cycle, knee flex, counter-swinging arms, ground contact via forward kinematics; phase from distance so feet don't slide) | ✅ (one key pose: cloth doesn't change between strides) |
| 5 | Pushes the computer desk | Pose 05 + 3D desk translation synced to scroll | ◻ not done: needs pose 05 (the front-facing photo can't lean into a push) |
| 6 | Daylight → sunset → northern lights | Sky shader gains sunset palette + aurora layer (ribbon FBM) | ◻ not done yet |
| 7 | Working at a workstation | The desk render is the set (chair, desk, monitor, mug); seated layer types (both hands), breathes, head nods toward the monitor; procedural desk front so it stands on the floor; slow push-in | ✅ |
| 8 | Walks to the chair and sits | Faster entrance (48 vh of scroll instead of 80 vh, starting just off the left edge); he slows into the stop, his hips drop behind the desk while his head travels to the seated head; the seated render fades in on top, then the walker fades out underneath (legs hidden by the desk). Seated and typing before the section is fully in view | ◐ profile → three-quarter head turn is a short dissolve (no sitting-down render, by choice) |
| 9 | Jumps into the white editorial environment | Sky dissolve + hop (same as step 3) | ✅ PoC |
| 10 | Lands in front of "Creative Developer." | Station landing, title masked in behind him, occlusion via DOM layering | ✅ PoC |
| 11 | Confident gestures | Rig gestures (small); pose 08 / 10 for big ones; arms crossed needs pose 07 | ◐ rig only |
| 12 | Superhero jump | Leap onto WORK with a ballistic arc; pose 09 for the classic superhero silhouette | ◐ leap yes, superhero silhouette needs pose 09 |
| 13 | Enters Selected Work | Leap onto WORK, panels; then crouch → launch → straight up out of frame (base pose) | ✅ |
| 14 | Flies through the projects | One pass per project row, alternating L→R / R→L (any number of rows); direction changes happen off-screen; each project image opens behind him (same path function drives both); last pass dives out toward the Workspace | ✅ |
| 15 | Closed silver laptop | Procedural MacBook-Air-like model: Apple-logo lid, notch, bezel, keyboard, trackpad, hinge (`src/three/props/MacBook.tsx`), shared by hero and finale | ✅ |
| 16 | Opens the lid | Hinge rotation synced to scroll; camera orbits from the top view to the front | ✅ |
| 17 | Into the screen → footer | The real HTML footer ("Open to work.", email, Copy Email, Let's Talk, socials, Back to Top) is mapped onto the display with a CSS homography; the camera flies in and the transform eases to identity — no cut, no fade | ✅ |
| 18 | Sits at a wooden desk, writing | Pose 11 + wooden desk/chair/pencil/paper (3D) | ◻ not done: needs pose 11 (pencil grip can't come from the photo) |
| 19 | Overhead camera, desk + wireframe | Camera rise; wireframe material pass on the same props | ◻ not done (depends on 18) |

All steps share the deterministic scroll timeline (forward and reverse), one canvas and one character instance.

---

## 7. Performance (measured, production build, this machine)

- **Whole page with the new renders (26 Nov 2026), Chromium on Metal GPU, DPR 2, 1440×900, steady 26 s scroll top → footer:** 60.0 fps over 1,604 frames; median 16.7 ms, p95 16.7 ms, p99 16.8 ms, none over 20 ms; JS heap 21 MB. Per section: hero 60.1, Selected Work + flight 60.0, Workspace 60.0, rest 60.0.

- **Hero sequence, Chromium on Metal GPU, devicePixelRatio 2:** 60.0 fps over 417 frames, median 16.7 ms, p95 16.8 ms, none over 20 ms; JS heap ~15 MB.
- **Character cost:** 1 skinned mesh (4,560 triangles after empty cells are culled) + 1 underlay mesh (446), 2 textures (75 KB total), 16 bones. Pose textures load only when the choreography asks for them, at most 3 mounted at once.
- **Mobile:** unchanged. No three.js, GSAP, Lenis or character assets are downloaded (enforced by the Playwright suite).
- Adaptive DPR, render-on-demand, hero-only shadow map, staged scene start-up: as before (see README).

---

## 8. Technical limitations (honest list)

1. **One photo, one viewpoint.** The base pose can't turn around, show its back, raise arms high or bend far. Limb angles are capped around 0.3 rad on purpose. Those moments need the dedicated pose images above.
2. **The seated pose is an illusion:** frontal foreshortening plus a real laptop hiding the lap. It works from the hero's camera angle, not from the side.
3. **Synthesised hoodie under the arms.** Fine for the swings used here. At the jump's widest arm spread, faint marks can appear at the inner cuffs for a fraction of a second.
4. **No facial animation or blinking** on an image. Head motion is rigid (by design, to protect identity).
5. **Pose swaps are cuts with motion smear, not true in-betweens.** They're timed to fast motion so they read as motion.
6. **Procedural props** (hands, laptop, desk) are stylised stand-ins. Free CC0 models can replace them later (log them in `ASSETS_ATTRIBUTION.md`).
7. **Not possible with the current single photo (need pose images or a real skeleton):** pushing the desk, turning to/from the chair, arms crossed, pencil writing, finger-level typing, a side-view walk, a true side-view seat. These are *not* implemented and are not faked; they are listed in the storyboard as ◻.
8. **The 3D camera stays canonical (z 10, fov 30) wherever the character stands on DOM text**, so DOM ↔ WebGL alignment holds; three-quarter camera angles are only used in self-contained scenes (hero, finale).
9. **Dedicated renders are single key poses.** The puppets move limbs, cape and head in-plane; cloth folds, lighting and facial expression stay as rendered. The walk is a cut-out cycle from one stride (convincing in motion, not a captured walk).
10. **Hand-overs between renders are short dissolves, not cuts:** seated → closing → rising → base pose in the hero, walker → seated render at the desk. The incoming render fades in under the outgoing one and both slide so their faces meet, so there is no see-through moment and no face in two places; stopped exactly mid-way, a soft blend of the two images is visible for a few percent of scroll.
11. The 19 storyboard screenshots weren't received. Storyboard matching relies on your list plus my live-site captures.
