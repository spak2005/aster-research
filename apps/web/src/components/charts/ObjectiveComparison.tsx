import type { Verdict } from '../../types';
import type { VisibleExperiment } from '../../lib/visibility';
import { ROLE_LABEL, VERDICT_META } from '../../lib/status';
import { formatNumber, formatPercent } from '../../lib/format';
import '../../styles/charts.css';

interface ObjectiveComparisonProps {
  experiments: VisibleExperiment[];
  baselineId: string;
  objective: string;
  units: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The run's own designation, withheld until its conclusion is visible. */
  leadingId: string | null;
  verdict: Verdict | null;
}

/**
 * Objective value per experiment, in the order they were run.
 *
 * Deliberately not sorted by value. Ranking is a claim, so the only experiment
 * marked out is the one the recording itself designated, and it is marked in
 * the recording's own terms: a leading value is not an improvement unless the
 * run's conclusion says it cleared the declared threshold. Failed runs keep a
 * row and say plainly that no value exists for them.
 */
export default function ObjectiveComparison({
  experiments,
  baselineId,
  objective,
  units,
  selectedId,
  onSelect,
  leadingId,
  verdict,
}: ObjectiveComparisonProps) {
  const values = experiments
    .map((experiment) => experiment.result?.metrics.fusion_energy_mj)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart__caption">
          <span className="label">{objective}</span>
        </figcaption>
        <p className="chart__empty">No experiment had reported a value at this point in the run.</p>
      </figure>
    );
  }

  const max = Math.max(...values) * 1.06;
  const baselineValue = experiments.find((experiment) => experiment.id === baselineId)?.result
    ?.metrics.fusion_energy_mj;

  return (
    <figure className="chart chart--bars">
      <figcaption className="chart__caption">
        <span className="label">{objective}</span>
        <span className="chart__note">raw outputs · in run order · {units}</span>
      </figcaption>

      <ul className="bars">
        {experiments.map((experiment) => {
          const value = experiment.result?.metrics.fusion_energy_mj ?? null;
          const failed = experiment.result?.status === 'failed';
          const selected = experiment.id === selectedId;
          const isBaseline = experiment.id === baselineId;
          const leading = experiment.id === leadingId;
          return (
            <li className={`bars__row${selected ? ' is-selected' : ''}`} key={experiment.id}>
              <button className="bars__label" onClick={() => onSelect(experiment.id)}>
                <span className="bars__name">{experiment.label}</span>
                <span className="bars__role">
                  {ROLE_LABEL[experiment.role]}
                  {leading ? <span className="bars__leading">leading value</span> : null}
                </span>
              </button>

              <span className="bars__track">
                {value !== null && !failed ? (
                  <span
                    className={`bars__fill${isBaseline ? ' bars__fill--baseline' : ''}`}
                    style={{ width: `${Math.max(1, (value / max) * 100)}%` }}
                  />
                ) : (
                  <span className="bars__absent">
                    {experiment.result ? 'no value recorded' : 'not reported yet'}
                  </span>
                )}
                {baselineValue !== undefined ? (
                  <span
                    className="bars__reference"
                    style={{ left: `${(baselineValue / max) * 100}%` }}
                    aria-hidden
                  />
                ) : null}
              </span>

              <span className="bars__value">
                {value !== null && !failed ? (
                  <>
                    <span className="numeric">{formatNumber(value, 2)}</span>
                    <span className="unit">{units}</span>
                  </>
                ) : (
                  <span className="bars__dash">—</span>
                )}
                {experiment.result?.metrics.improvement_pct !== null &&
                experiment.result?.metrics.improvement_pct !== undefined ? (
                  <span
                    className={`bars__delta ${
                      experiment.result.metrics.improvement_pct > 0 ? 'tone-signal' : 'tone-adverse'
                    }`}
                  >
                    {formatPercent(experiment.result.metrics.improvement_pct)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="chart__note">Percentages here use the original baseline. Refined experiments require the matched-grid comparison in the selected evidence.</p>
      <ul className="chart__legend">
        {baselineValue !== undefined ? (
          <li className="chart__key chart__key--reference">
            Dashed line: baseline at {formatNumber(baselineValue, 2)} {units}
          </li>
        ) : null}
        {leadingId && verdict ? (
          <li className="chart__key">
            {verdict === 'supported'
              ? 'Leading value: the run recorded this as its best result.'
              : `Leading value only. The run's verdict was ${VERDICT_META[
                  verdict
                ].label.toLowerCase()}, so no improvement is claimed for it.`}
          </li>
        ) : null}
      </ul>
    </figure>
  );
}
