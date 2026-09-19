# Scene and replay handoff

## Integration

`apps/web/src/scene/PlasmaScene.tsx` is the default-exported scene component. It
accepts the shared `PlasmaSceneProps` from `contracts/recording.ts`; no parallel
scene contract was introduced.

```tsx
import { useMemo, useState } from 'react';
import PlasmaScene from './scene/PlasmaScene';
import {
  getSceneSelection,
  getVisibleState,
  useReplayPlayback,
} from './replay';

function ResearchScene({ recording }: { recording: Recording }) {
  const playback = useReplayPlayback(recording);
  const [frameIndex, setFrameIndex] = useState(0);
  const visible = useMemo(
    () => getVisibleState(recording, playback.sequence),
    [playback.sequence, recording],
  );
  const scene = useMemo(
    () =>
      getSceneSelection(recording, playback.sequence, {
        frameIndex,
        compare: true,
      }),
    [frameIndex, playback.sequence, recording],
  );

  return (
    <PlasmaScene
      experiment={scene.experiment}
      baseline={scene.baseline}
      frameIndex={scene.frameIndex}
      temperatureScale={recording.temperature_scale_kev}
      geometry={recording.geometry}
      compare={scene.compare}
      reducedMotion={window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches}
    />
  );
}
```

The UI should own playback controls, selected tree/hypothesis IDs, and frame
selection. `useReplayPlayback` exposes play, pause, speed, normalized scrubbing,
and chapter navigation. Frame selection remains independent by design.

For public assets, call `useRecording(path)` or `loadRecording(path)`. Loading
is same-origin by default, validates the playback-critical v1 shape, and returns
an explicit idle/loading/ready/error state. It does not substitute the
development fixture when a genuine recording fails.

## Replay return types and leakage boundary

- `getVisibleState(recording, sequence): VisibleReplayState`
- `getExperimentAtSequence(recording, sequence): VisibleExperiment | null`
- `getVisibleStateAtProgress(recording, progress): VisibleReplayState`
- `getSceneSelection(recording, sequence, options): SceneReplaySelection`

`VisibleReplayState` deliberately omits the source `Recording`. Experiment
metrics, frames, artifacts, wall time, assessments, evidence, checks, and
conclusions are unavailable until the corresponding recorded event boundary.
Empty and incomplete recordings return safe empty state. `getSceneSelection`
converts only completed, visible experiment data back into leak-safe
`Experiment` objects for `PlasmaScene`.

Recorded timestamps control playback timing. Scrubbing selects recorded event
boundaries and reconstructs state; it does not simulate events. Profile frame
selection clamps to a stored frame and never interpolates scientific values.
Baseline comparison selects the stored baseline frame nearest the candidate's
physical simulation time.

## Scientific encoding

- The torus is explicitly labeled as a schematic axisymmetric reconstruction
  of recorded radial profiles, not a 3D TORAX field.
- Supplied major radius, minor radius, and elongation determine the geometry.
- Plasma color is the mean of recorded electron and ion temperature at each
  normalized radius. The scale is the caller-supplied recording-wide fixed
  scale, shared by baseline and candidate, with units in keV.
- The amber heating band uses only recorded `heating_location` and
  `heating_width`, normalized to rho. It is labeled configured, not measured.
- Static helical guides are labeled schematic and are not represented as
  solver field output. There are no particles, turbulence, instability, or
  random dynamics.
- Desktop comparison uses one synchronized canvas with baseline and candidate.
  Compact view renders one at a time to reduce GPU cost.

The scene includes constrained orbit controls, reset, deliberate cyan/amber
lighting, a cutaway profile face, fixed legend, adaptive geometry/DPR, and
restrained selection-driven camera transitions. Reduced-motion mode makes
camera changes immediate and disables damping. If WebGL is unavailable or its
context is lost, an accessible SVG/text profile summary replaces the canvas.

## Checks performed

TypeScript scene/replay check:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Replay leakage and frame-boundary tests:

```sh
node_modules/.bin/esbuild tests/scene/replay.test.ts \
  --bundle --platform=node --format=esm \
  --outfile=dist/scene-replay-tests.mjs --log-level=warning
node --test dist/scene-replay-tests.mjs
```

Result: 5 tests passed. `git diff --check` also passed after implementation.

## Known limitations

- No genuine public recording is owned by this branch. The loader is ready for
  the coordinator/backend recording path; no fixture is silently presented as
  a real investigation.
- The shared contract has no partial-frame event. Frames therefore remain
  hidden until experiment or verification completion instead of appearing
  incrementally during a running experiment.
- Checks are held back until verification completion or a terminal run event
  because aggregate check objects may contain later verification outcomes.
- Recorded wall-clock gaps are preserved by playback speed. A long real
  experiment gap can therefore remain long at 1x.
- Full Vite build and browser screenshot checks require the UI-owned entry
  files, which were intentionally absent during this branch's isolated work.
