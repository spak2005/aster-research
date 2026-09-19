import { Suspense, lazy } from 'react';
import { Columns2 } from 'lucide-react';
import type { Recording } from '../../types';
import type { WorkspaceController } from './useWorkspace';
import SceneBoundary from './SceneBoundary';
import TokamakSchematic from '../landing/TokamakSchematic';
import { formatNumber } from '../../lib/format';

/** The release requires the real scene module; WebGL failures have a runtime fallback. */
const PlasmaScene = lazy(() => import('../../scene/PlasmaScene'));

function SceneFallback({ detail }: { detail: string }) {
  return (
    <div className="scene__fallback">
      <TokamakSchematic className="scene__fallback-figure" />
      <p className="scene__fallback-text">
        <span className="label">Plasma view unavailable</span>
        {detail}
      </p>
    </div>
  );
}

interface ScenePaneProps {
  recording: Recording;
  workspace: WorkspaceController;
}

export default function ScenePane({ recording, workspace }: ScenePaneProps) {
  const experiment = workspace.selectedExperiment?.result ?? null;
  const frames = experiment?.frames ?? [];
  const frameIndex = Math.min(workspace.frameIndex, Math.max(0, frames.length - 1));
  const frame = frames[frameIndex] ?? null;
  const [scaleMin, scaleMax] = recording.temperature_scale_kev;

  // The scene contract carries a frame index, not a time. When two experiments
  // were stored on different time grids, stepping them together by index puts
  // them at different instants, so the pane says so and points at the charts,
  // which match on time.
  const baselineFrames = workspace.baseline?.frames ?? [];
  const gridsDiffer =
    workspace.compare && frames.length > 0 && baselineFrames.length > 0
      ? baselineFrames.length !== frames.length
      : false;

  return (
    <div className="scene">
      <header className="scene__head">
        <p className="label">
          Plasma view · schematic reconstruction of 1D radial profiles
        </p>
        <button
          className={`scene__toggle${workspace.compare ? ' is-active' : ''}`}
          onClick={workspace.toggleCompare}
          aria-pressed={workspace.compare}
          title="Show the baseline alongside the selection"
        >
          <Columns2 size={13} aria-hidden />
          Compare with baseline
        </button>
      </header>

      <div className="scene__stage">
        {experiment === null ? (
          <div className="scene__fallback">
            <TokamakSchematic className="scene__fallback-figure" />
            <p className="scene__fallback-text">
              <span className="label">No result at this point</span>
              {workspace.selectedExperiment
                ? 'The selected experiment had not reported when this event was recorded, so there are no profiles to render.'
                : 'No experiment had been run yet at this point in the investigation.'}
            </p>
          </div>
        ) : (
          <SceneBoundary
            fallback={() => (
              <SceneFallback detail="This device could not render the 3D view. Recorded measurements and profile charts remain available below." />
            )}
          >
            <Suspense
              fallback={
                <div className="scene__loading">
                  <span className="label">Preparing plasma view</span>
                </div>
              }
            >
              <PlasmaScene
                experiment={experiment}
                baseline={workspace.compare ? workspace.baseline : null}
                frameIndex={frameIndex}
                temperatureScale={recording.temperature_scale_kev}
                geometry={recording.geometry}
                compare={workspace.compare}
                reducedMotion={workspace.reducedMotion}
                className="scene__canvas"
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>

      {gridsDiffer ? (
        <p className="scene__caveat">
          The baseline stores {baselineFrames.length} frames against {frames.length} here. This view
          steps both by frame, so the two are not at the same instant; the profile chart below
          matches them on simulation time instead.
        </p>
      ) : null}

      <footer className="scene__foot">
        <div className="scene__scale" aria-hidden>
          <span className="scene__scale-bar" />
          <span className="scene__scale-range numeric">
            {formatNumber(scaleMin, 0)}–{formatNumber(scaleMax, 0)} keV
          </span>
        </div>

        <label className="scene__frame">
          <span className="label">Simulation time</span>
          <input
            type="range"
            className="transport__scrub scene__frame-scrub"
            min={0}
            max={Math.max(0, frames.length - 1)}
            step={1}
            value={frameIndex}
            disabled={frames.length < 2}
            onChange={(input) => workspace.setFrameIndex(Number(input.target.value))}
            aria-label="Simulation time, by stored profile frame"
            aria-valuetext={frame ? `${frame.time_s} seconds` : 'no frames'}
          />
          <span className="scene__frame-value numeric">
            {frame ? `${formatNumber(frame.time_s, 2)} s` : '—'}
          </span>
        </label>
      </footer>
    </div>
  );
}
