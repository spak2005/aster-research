import { useMemo } from 'react';
import type { VisibleExperiment, VisibleHypothesis, VisibleState } from '../../lib/visibility';
import { EXPERIMENT_STATUS_META, ROLE_LABEL, VERDICT_META } from '../../lib/status';
import { formatNumber } from '../../lib/format';
import '../../styles/tree.css';

interface TreeRow {
  kind: 'hypothesis' | 'experiment';
  id: string;
  depth: number;
  hypothesis?: VisibleHypothesis;
  experiment?: VisibleExperiment;
  isLast: boolean;
}

/**
 * Flattens the hypothesis graph into indented rows, with each hypothesis
 * followed by the experiments run under it. Only nodes visible at the current
 * sequence are included; the tree grows as playback advances.
 */
function buildRows(state: VisibleState): TreeRow[] {
  const byParent = new Map<string | null, VisibleHypothesis[]>();
  for (const hypothesis of state.hypotheses) {
    const key = hypothesis.parentId;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(hypothesis);
    else byParent.set(key, [hypothesis]);
  }

  const rows: TreeRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    children.sort((a, b) => a.createdSequence - b.createdSequence);
    children.forEach((hypothesis, index) => {
      rows.push({
        kind: 'hypothesis',
        id: hypothesis.id,
        depth,
        hypothesis,
        isLast: index === children.length - 1,
      });
      const experiments = state.experiments
        .filter((experiment) => experiment.hypothesisId === hypothesis.id)
        .sort((a, b) => a.introSequence - b.introSequence);
      experiments.forEach((experiment, position) => {
        rows.push({
          kind: 'experiment',
          id: experiment.id,
          depth: depth + 1,
          experiment,
          isLast: position === experiments.length - 1,
        });
      });
      walk(hypothesis.id, depth + 1);
    });
  };
  walk(null, 0);
  return rows;
}

function experimentDetail(experiment: VisibleExperiment): string {
  const { heating_location: location, heating_width: width } = experiment.config;
  const placement = `ρ ${formatNumber(location, 2)} · w ${formatNumber(width, 2)}`;
  if (!experiment.result) return `${ROLE_LABEL[experiment.role]} · ${placement} · running`;
  if (experiment.result.status === 'failed') {
    return `${ROLE_LABEL[experiment.role]} · ${placement} · no result`;
  }
  const energy = experiment.result.metrics.fusion_energy_mj;
  return `${ROLE_LABEL[experiment.role]} · ${placement} · ${formatNumber(energy, 2)} MJ`;
}

interface ResearchTreeProps {
  state: VisibleState;
  selectedHypothesisId: string | null;
  selectedExperimentId: string | null;
  onSelect: (nodeId: string) => void;
}

export default function ResearchTree({
  state,
  selectedHypothesisId,
  selectedExperimentId,
  onSelect,
}: ResearchTreeProps) {
  const rows = useMemo(() => buildRows(state), [state]);

  if (rows.length === 0) {
    return (
      <p className="tree__empty">
        No hypothesis had been proposed at this point in the run. Move the transport forward to
        watch the tree grow.
      </p>
    );
  }

  return (
    <ul className="tree">
      {rows.map((row) => {
        const selected =
          row.kind === 'hypothesis'
            ? row.id === selectedHypothesisId
            : row.id === selectedExperimentId;
        const meta =
          row.kind === 'hypothesis'
            ? VERDICT_META[row.hypothesis!.status]
            : EXPERIMENT_STATUS_META[row.experiment!.status];
        const provisional =
          row.kind === 'hypothesis' ? !row.hypothesis!.statusResolved : !row.experiment!.result;

        return (
          <li
            key={row.id}
            className={`tree__row tree__row--${row.kind}${row.depth > 0 ? ' tree__row--nested' : ''}`}
            style={{ '--depth': row.depth } as React.CSSProperties}
          >
            <button
              className={`tree__node tone-${meta.tone}${selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(row.id)}
              aria-current={selected ? 'true' : undefined}
              title={meta.description}
            >
              <span
                className={`tree__glyph tree__glyph--${row.kind}${
                  provisional ? ' tree__glyph--provisional' : ''
                }`}
                aria-hidden
              />
              <span className="tree__body">
                <span className="tree__title">
                  {row.kind === 'hypothesis' ? row.hypothesis!.title : row.experiment!.label}
                </span>
                <span className="tree__meta">
                  <span className="tree__status">{meta.label}</span>
                  {row.kind === 'experiment' ? (
                    <span className="tree__detail numeric">{experimentDetail(row.experiment!)}</span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
