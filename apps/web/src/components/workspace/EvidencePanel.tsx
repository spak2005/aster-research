import { matchedBaseline, matchedGain } from '../../lib/comparison';
import { publicAssetUrl } from '../../../../../contracts/public-url';
import type { Experiment, Recording } from '../../types';
import type { VisibleExperiment, VisibleHypothesis, VisibleState } from '../../lib/visibility';
import { CHECK_META, EXPERIMENT_STATUS_META, ROLE_LABEL, VERDICT_META } from '../../lib/status';
import { formatNumber, formatPercent, formatDuration } from '../../lib/format';
import '../../styles/evidence.css';

function Quantity({ value, unit }: { value: string; unit?: string }) {
  return (
    <>
      <span className="numeric">{value}</span>
      {unit ? <span className="unit">{unit}</span> : null}
    </>
  );
}

function ConfigList({ experiment }: { experiment: VisibleExperiment }) {
  const config = experiment.config;
  const extras = Object.entries(config).filter(
    ([key]) =>
      !['heating_location', 'heating_width', 'heating_power_mw', 'duration_s', 'config_hash'].includes(key) && typeof config[key] !== 'object',
  );

  return (
    <dl className="evidence__grid">
      <div>
        <dt className="label">Deposition radius</dt>
        <dd>
          <Quantity value={formatNumber(config.heating_location, 2)} unit="ρ" />
        </dd>
      </div>
      <div>
        <dt className="label">Deposition width</dt>
        <dd>
          <Quantity value={formatNumber(config.heating_width, 2)} unit="ρ" />
        </dd>
      </div>
      <div>
        <dt className="label">Heating power</dt>
        <dd>
          <Quantity value={formatNumber(config.heating_power_mw, 1)} unit="MW" />
        </dd>
      </div>
      <div>
        <dt className="label">Pulse duration</dt>
        <dd>
          <Quantity value={formatNumber(config.duration_s, 2)} unit="s" />
        </dd>
      </div>
      {extras.map(([key, value]) => (
        <div key={key}>
          <dt className="label">{key.replace(/_/g, ' ')}</dt>
          <dd>
            <span className="numeric">{String(value)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MetricsList({
  experiment,
  recording,
  baseline,
}: {
  experiment: VisibleExperiment;
  recording: Recording;
  baseline: Experiment | null;
}) {
  const result = experiment.result;
  const improvement = matchedGain(result, baseline);
  if (!result) {
    return (
      <p className="evidence__pending">
        This experiment had not reported at this point in the run, so it has no metrics yet.
      </p>
    );
  }
  if (result.status === 'failed') {
    return (
      <p className="evidence__pending evidence__pending--adverse">
        {result.error ?? 'The run failed, so no objective value exists for this configuration.'}
      </p>
    );
  }

  return (
    <dl className="evidence__grid">
      <div>
        <dt className="label">{recording.provenance.objective}</dt>
        <dd>
          <Quantity
            value={formatNumber(result.metrics.fusion_energy_mj, 2)}
            unit={recording.provenance.objective_units}
          />
        </dd>
      </div>
      <div>
        <dt className="label">Heating energy</dt>
        <dd>
          <Quantity value={formatNumber(result.metrics.heating_energy_mj, 1)} unit="MJ" />
        </dd>
      </div>
      <div>
        <dt className="label">Peak ion temperature</dt>
        <dd>
          <Quantity value={formatNumber(result.metrics.peak_ion_temperature_kev, 2)} unit="keV" />
        </dd>
      </div>
      <div>
        <dt className="label">Against matched baseline</dt>
        <dd
          className={
            improvement === null
              ? ''
              : improvement > 0
                ? 'tone-signal evidence__delta'
                : 'tone-adverse evidence__delta'
          }
        >
          <span className="numeric">{formatPercent(improvement)}</span>
        </dd>
      </div>
      <div>
        <dt className="label">Wall time</dt>
        <dd>
          <span className="numeric">{formatDuration(result.wall_time_s)}</span>
        </dd>
      </div>
    </dl>
  );
}

interface EvidencePanelProps {
  recording: Recording;
  state: VisibleState;
  hypothesis: VisibleHypothesis | null;
  experiment: VisibleExperiment | null;
}

export default function EvidencePanel({
  recording,
  state,
  hypothesis,
  experiment,
}: EvidencePanelProps) {
  if (!hypothesis && !experiment) {
    return (
      <p className="evidence__empty">
        Nothing has been proposed yet at event {state.sequence}. Select a node in the tree, or move
        the transport forward.
      </p>
    );
  }

  return (
    <div className="evidence">
      {hypothesis ? (
        <section className={`evidence__block tone-${VERDICT_META[hypothesis.status].tone}`}>
          <header className="evidence__head">
            <span className="label">Hypothesis</span>
            <span className="evidence__status">{VERDICT_META[hypothesis.status].label}</span>
          </header>
          <h3 className="evidence__title">{hypothesis.title}</h3>

          <p className="label evidence__field-label">Predicted before running</p>
          <p className="evidence__text">{hypothesis.prediction}</p>

          <p className="label evidence__field-label">Assessment</p>
          {hypothesis.statusResolved ? (
            <p className="evidence__text">{hypothesis.assessment}</p>
          ) : (
            <p className="evidence__pending">
              Not assessed at this point in the run. The verdict recorded later is deliberately
              withheld here.
            </p>
          )}
        </section>
      ) : null}

      {experiment ? (
        <section className={`evidence__block tone-${EXPERIMENT_STATUS_META[experiment.status].tone}`}>
          <header className="evidence__head">
            <span className="label">
              {ROLE_LABEL[experiment.role]} experiment
            </span>
            <span className="evidence__status">
              {EXPERIMENT_STATUS_META[experiment.status].label}
            </span>
          </header>
          <h3 className="evidence__title">{experiment.label}</h3>

          <p className="label evidence__field-label">Configuration</p>
          <ConfigList experiment={experiment} />

          <p className="label evidence__field-label">Result</p>
          <MetricsList experiment={experiment} recording={recording} baseline={matchedBaseline(experiment.result, state.experiments.flatMap(e => e.result ? [e.result] : []), recording.baseline_id)} />

          <p className="label evidence__field-label">Checks</p>
          {experiment.checks.length === 0 ? (
            <p className="evidence__pending">
              No check had been recorded for this experiment yet.
            </p>
          ) : (
            <ul className="evidence__checks">
              {experiment.checks.map((item) => (
                <li className={`evidence__check tone-${CHECK_META[item.status].tone}`} key={item.name}>
                  <span className="evidence__check-dot" aria-hidden />
                  <span className="evidence__check-body">
                    <span className="evidence__check-name">{item.name}</span>
                    <span className="evidence__check-detail">{item.detail}</span>
                  </span>
                  <span className="evidence__check-status">{CHECK_META[item.status].label}</span>
                </li>
              ))}
            </ul>
          )}

          {experiment.result && experiment.result.artifacts.length > 0 ? (
            <>
              <p className="label evidence__field-label">Artifacts</p>
              <ul className="evidence__artifacts">
                {experiment.result.artifacts.map((artifact) => (
                  <li key={artifact.path}>
                    {artifact.path.startsWith('/recordings/') ? (
                      <a className="evidence__artifact-label" href={publicAssetUrl(artifact.path, import.meta.env.BASE_URL)} download>
                        Download {artifact.label} ↗
                      </a>
                    ) : <span className="evidence__artifact-label">{artifact.label} (local file)</span>}
                    <span className="evidence__artifact-path numeric">{artifact.path}</span>
                    {artifact.sha256 ? (
                      <span className="evidence__artifact-hash numeric">
                        sha256 {artifact.sha256}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
