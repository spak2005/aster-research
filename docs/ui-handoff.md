# UI handoff — track U

Scope delivered: `apps/web/src/**` except `scene/**` and `replay/**`, plus
`contracts/examples/development.*` (labelled fixture) and this document.
43 commits, `f956fb8` through `c87cc14`, tasks U01–U16.

## What exists

**Landing (`#/`)** — hero, published-investigation showcase, the five-step
research loop, and the adapter interface with the real `ScientificAdapter`
signature. No metric appears on this page; the facts listed are about the
harness, not about results.

**Investigations (`#/research`)** — the published catalogue, read from
`/recordings/index.json`. An absent catalogue is an empty shelf, not an error.

**Workspace (`#/research/<id>`)** — three panes (research tree, plasma view,
evidence) over a transport, with a longer dossier beneath: metric cards, radial
temperature profile, cumulative fusion energy, per-experiment objective
comparison, conclusion, provenance. Everything is gated by playback position.

**Start (`#/start`)** — bounded configuration (experiment budget, seed; the
question and preset are fixed), a live probe of the local research service, a
real `POST /api/runs` when it answers, and a downloadable configuration plus
`curl` equivalent when it does not.

## Interfaces other tracks depend on

- **Scene**: loaded from `src/scene/PlasmaScene.tsx` through `import.meta.glob`,
  not a direct `React.lazy(import(...))`. This was necessary because a direct
  dynamic import of a missing module fails the build; the glob resolves to an
  empty map instead, and `ScenePane` falls back to the schematic. The scene is
  now present and is code-split into its own chunk (~915 kB, 247 kB gzipped).
  Props are exactly `PlasmaSceneProps` from `contracts/recording.ts`.
- **Recordings**: `/recordings/index.json` as an array of
  `{id,title,description,path,mode,created_at}`, each `path` a same-origin JSON
  file matching `Recording`. `assertRecording` rejects anything structurally
  unfit rather than rendering a partial run.
- **Local API**: `GET /api/health`, `POST /api/runs`, `GET /api/runs`,
  `GET /api/runs/<id>`, `POST /api/runs/<id>/cancel`, proxied to
  `127.0.0.1:8765` in dev. Live runs are addressed as `live:<run-id>` and
  polled every 5 s.

## Checks performed

| Check | Result |
| --- | --- |
| `tsc --noEmit` with the real scene present | passes |
| `npm run build` | passes; scene code-split, no other chunk over 500 kB |
| `node apps/web/src/lib/visibility.check.mjs` against all four published recordings, the canceled live run, and the fixture | no leaks found |
| `assertRecording` against the same six payloads | all accepted |
| Field coverage (checks, artifacts, frames, wall time, assessments, limitations) on real recordings | every field the UI reads is present |
| Dev server routes: `/`, module graph, `/api/health` proxy, fixture | all 200 |

The gating check is the load-bearing one. It walks every sequence of a
recording and asserts that an experiment is invisible before it was requested,
a result is invisible before its completion event, a hypothesis carries no
resolved status before it was resolved, the conclusion does not exist before
the run ended, and selecting any node lands on a sequence where that node
exists. Run it against any new recording before publishing it:

```
node apps/web/src/lib/visibility.check.mjs public/recordings/<id>.json
```

## Things found while checking real data

- **Different time grids.** Refined experiments store 16 frames where coarse
  ones store 7. Index-matched comparison would place a candidate at 0.8 s beside
  a baseline at 1.0 s. The charts now match on simulation time
  (`lib/frames.ts`) and state the residual offset.
- **`PlasmaSceneProps` carries `frameIndex`, not a time.** The scene therefore
  still steps both experiments by index. `ScenePane` discloses this in the pane
  when the grids differ and points at the time-matched charts. Changing the
  contract to pass a time is a coordinator decision, not a UI one.
- **Canceled and failed runs.** These record an outcome without a
  `conclusion.recorded` event. They were showing no conclusion at all, which
  reads as unfinished rather than stopped; terminal run events now reveal the
  recorded outcome.
- **Every published run concluded `inconclusive`**, with gains below the
  declared 5% threshold. The UI reports that verdict as recorded. The
  experiment named by `best_experiment_id` is marked "leading value" only, and
  the legend states explicitly that no improvement is claimed unless the
  conclusion says the threshold was cleared.
- **Absent catalogue on static hosts.** Some hosts answer a missing file with
  their own HTML and a 200. That is now read as "nothing published yet"; a file
  that is present but malformed is still reported as a fault.

## Known limitations

- **No visual verification.** There is no browser automation in this
  environment, so layout, typography, motion and the 3D view have not been seen
  rendered. Typecheck, build, data conformance and gating are machine-verified;
  visual polish is not.
- **No recordings in this worktree.** `public/recordings/` does not exist here.
  Real recordings were fetched over HTTP from the parent checkout for
  verification. The catalogue will populate when the parent integrates them.
- **Mobile layout is unmeasured.** Below 760 px the console shows one pane at a
  time behind a tab bar; this follows from the CSS but has not been observed on
  a device.
- **`node_modules` is an untracked symlink** to `../science-harness/node_modules`.
  `.gitignore` lists `node_modules/` with a trailing slash, which does not match
  a symlink, so `git add -A` would commit the link. The scene link is already
  handled this way in `.git/info/exclude`; `node_modules` is not. Either add
  `/node_modules` there too or keep staging files explicitly.
- **`apps/web/src/scene` is a symlink** into the main checkout, excluded via
  `.git/info/exclude`. It resolves for both Vite and `tsc`, so the scene is
  fully exercised here, but nothing on this branch tracks it.
- **No test runner.** `visibility.check.mjs` is a standalone Node script relying
  on native TypeScript stripping (Node 22.6+). It is not wired into a suite.

## Accessibility and motion

Full keyboard transport (space, arrows, shift-arrows, Home/End, `[`/`]`, `s`,
`c`, `?`), a shortcut legend, a skip link that moves focus rather than
navigating, focus moved to `<main>` on route change, and `aria-live` for
copy-link feedback. Reduced motion suppresses animation and transitions
globally and stops the simulation-frame loop from advancing on its own;
playback started deliberately still plays.

## Next dependency

Parent integration of `public/recordings/`. Nothing in the UI blocks on it —
the empty state is honest and the routes work without it.
