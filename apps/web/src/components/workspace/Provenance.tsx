import type { Recording } from '../../types';
import type { VisibleState } from '../../lib/visibility';
import { formatDateTime, formatDuration } from '../../lib/format';

interface ProvenanceProps {
  recording: Recording;
  state: VisibleState;
}

/**
 * What produced this recording, and what it does not establish.
 *
 * Budget figures follow playback — the number of experiments completed *so
 * far* — while software versions, seed and hashes describe the run as a whole
 * and are fixed metadata.
 */
export default function Provenance({ recording, state }: ProvenanceProps) {
  const facts: { label: string; value: string }[] = [
    { label: 'Run date', value: formatDateTime(recording.created_at) },
    { label: 'Simulator', value: recording.simulator },
    { label: 'Research model', value: recording.model },
    { label: 'Objective', value: `${recording.provenance.objective} (${recording.provenance.objective_units})` },
    { label: 'Seed', value: String(recording.provenance.seed) },
    { label: 'Config hash', value: recording.provenance.config_hash },
    {
      label: 'Experiments completed',
      value: `${state.completedExperiments} of ${recording.budget.max_experiments} authorised`,
    },
    { label: 'Total research time', value: formatDuration(recording.budget.wall_time_s) },
    { label: 'Recorded status', value: recording.status },
  ];

  const versions = Object.entries(recording.provenance.software_versions);

  return (
    <section className="provenance">
      <div className="provenance__col">
        <p className="label">Provenance</p>
        <dl className="provenance__facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="label">{fact.label}</dt>
              <dd className="numeric">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {versions.length > 0 ? (
          <ul className="provenance__versions">
            {versions.map(([name, version]) => (
              <li key={name} className="numeric">
                {name} {version}
              </li>
            ))}
          </ul>
        ) : null}
        {recording.provenance.raw_artifact_path ? (
          <p className="provenance__raw numeric">
            Raw output preserved at {recording.provenance.raw_artifact_path}
          </p>
        ) : null}
      </div>

      <div className="provenance__col">
        <p className="label">What this does not establish</p>
        {recording.limitations.length === 0 ? (
          <p className="provenance__empty">No limitations were recorded with this run.</p>
        ) : (
          <ul className="provenance__limitations">
            {recording.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
