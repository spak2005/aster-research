import type { Recording } from '../../types';
import type { WorkspaceController } from './useWorkspace';
import MetricCards from './MetricCards';
import ProfileChart from '../charts/ProfileChart';
import EnergyChart from '../charts/EnergyChart';
import ObjectiveComparison from '../charts/ObjectiveComparison';
import Conclusion from './Conclusion';
import Provenance from './Provenance';
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
  const baselineFrame =
    workspace.compare && baselineFrames.length > 0
      ? baselineFrames[Math.min(frameIndex, baselineFrames.length - 1)]
      : null;
  const showBaselineSeries =
    workspace.compare && selectedExperiment?.id !== recording.baseline_id;

  return (
    <section className="dossier shell section" aria-label="Investigation detail">
      <MetricCards recording={recording} experiment={selectedExperiment} />

      <div className="dossier__charts">
        <ProfileChart
          frame={frame}
          baselineFrame={showBaselineSeries ? baselineFrame : null}
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
      />

      <Conclusion state={visible} onSelectEvidence={workspace.select} />

      <Provenance recording={recording} state={visible} />
    </section>
  );
}
