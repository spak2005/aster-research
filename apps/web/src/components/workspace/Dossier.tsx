import type { Recording } from '../../types';
import type { WorkspaceController } from './useWorkspace';
import MetricCards from './MetricCards';
import ProfileChart from '../charts/ProfileChart';
import EnergyChart from '../charts/EnergyChart';
import ObjectiveComparison from '../charts/ObjectiveComparison';
import Conclusion from './Conclusion';
import Provenance from './Provenance';
import { frameAtTime } from '../../lib/frames';
import '../../styles/dossier.css';

interface DossierProps {
  recording: Recording;
  workspace: WorkspaceController;
}

/**
 * Long-form detail below the console: headline metrics, the two profile charts
 * and the per-experiment objective comparison. Everything reflects the current
 * playback position rather than the finished run.
 */
export default function Dossier({ recording, workspace }: DossierProps) {
  const { visible, selectedExperiment } = workspace;
  const frames = selectedExperiment?.result?.frames ?? [];
  const baselineFrames = workspace.baseline?.frames ?? [];
  const frameIndex = Math.min(workspace.frameIndex, Math.max(0, frames.length - 1));
  const frame = frames[frameIndex] ?? null;
  // Experiments in one run may store different numbers of frames, so the
  // baseline is matched on simulation time rather than on position in the array.
  const alignedBaseline =
    workspace.compare && frame ? frameAtTime(baselineFrames, frame.time_s) : null;

  const showBaselineSeries =
    workspace.compare && selectedExperiment?.id !== workspace.baseline?.id;

  return (
    <section className="dossier shell section" aria-label="Investigation detail">
      <MetricCards recording={recording} experiment={selectedExperiment} baseline={workspace.baseline} />

      <div className="dossier__charts">
        <ProfileChart
          frame={frame}
          baselineFrame={showBaselineSeries ? alignedBaseline?.frame ?? null : null}
          baselineOffsetS={alignedBaseline?.offsetS ?? 0}
          temperatureScaleKev={recording.temperature_scale_kev}
          config={selectedExperiment?.config ?? null}
          label={selectedExperiment?.label ?? 'no selection'}
          baselineLabel={workspace.baseline?.label}
        />
        <EnergyChart
          frames={frames}
          baselineFrames={showBaselineSeries ? baselineFrames : []}
          frameIndex={frameIndex}
          label={selectedExperiment?.label ?? 'no selection'}
          baselineLabel={workspace.baseline?.label}
          units={recording.provenance.objective_units}
        />
      </div>

      <ObjectiveComparison
        experiments={visible.experiments}
        baselineId={recording.baseline_id}
        objective={recording.provenance.objective}
        units={recording.provenance.objective_units}
        selectedId={workspace.selectedExperimentId}
        onSelect={workspace.select}
        leadingId={visible.bestExperimentId}
        verdict={visible.conclusion?.status ?? null}
      />

      <Conclusion state={visible} onSelectEvidence={workspace.select} />

      <Provenance recording={recording} state={visible} />
    </section>
  );
}
