import type { Recording } from '../../types';
import type { VisibleExperiment } from '../../lib/visibility';
import { formatNumber, formatPercent } from '../../lib/format';

interface MetricCardsProps {
  recording: Recording;
  experiment: VisibleExperiment | null;
}

interface Card {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone?: 'signal' | 'adverse';
}

/**
 * Headline readouts for the selected experiment. Values come straight from the
 * recorded metrics; where a metric does not exist yet the card says so instead
 * of showing a zero.
 */
export default function MetricCards({ recording, experiment }: MetricCardsProps) {
  const result = experiment?.result?.status === 'completed' ? experiment.result : null;
  const metrics = result?.metrics ?? null;
  const improvement = metrics?.improvement_pct ?? null;

  const cards: Card[] = [
    {
      label: recording.provenance.objective === 'integrated_P_fusion' ? 'Fusion energy produced' : recording.provenance.objective,
      value: metrics ? formatNumber(metrics.fusion_energy_mj, 2) : '—',
      unit: metrics ? recording.provenance.objective_units : undefined,
      note: metrics ? 'frozen objective definition' : 'no value recorded yet',
    },
    {
      label: 'Against its reference',
      value: improvement === null ? '—' : formatPercent(improvement),
      note: improvement === null ? 'no comparison recorded' : 'as recorded by the harness',
      tone: improvement === null ? undefined : improvement > 0 ? 'signal' : 'adverse',
    },
    {
      label: 'Peak ion temperature',
      value: metrics ? formatNumber(metrics.peak_ion_temperature_kev, 2) : '—',
      unit: metrics ? 'keV' : undefined,
      note: 'maximum over time and radius',
    },
    {
      label: 'Heating energy delivered',
      value: metrics ? formatNumber(metrics.heating_energy_mj, 1) : '—',
      unit: metrics ? 'MJ' : undefined,
      note: 'held fixed across the investigation',
    },
  ];

  return (
    <dl className="cards">
      {cards.map((card) => (
        <div className={`cards__card${card.tone ? ` tone-${card.tone}` : ''}`} key={card.label}>
          <dt className="label">{card.label}</dt>
          <dd className={`cards__value${card.tone ? ' cards__value--tone' : ''}`}>
            <span className="numeric">{card.value}</span>
            {card.unit ? <span className="unit">{card.unit}</span> : null}
          </dd>
          <p className="cards__note">{card.note}</p>
        </div>
      ))}
    </dl>
  );
}
