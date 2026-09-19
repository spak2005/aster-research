import { Dices, Lock } from 'lucide-react';
import { MAX_EXPERIMENTS, MIN_EXPERIMENTS } from '../../lib/api';
import { SEED_MAX, type RunConfig, clampConfig, randomSeed } from '../../lib/runConfig';

/** What the preset freezes. Stated qualitatively: exact values belong to the harness. */
const FROZEN = [
  'Total heating energy and pulse duration',
  'Plasma geometry and the documented baseline configuration',
  'The objective, its units, and the minimum improvement that counts',
  'Parameter bounds for deposition radius and width',
];

interface SetupFormProps {
  config: RunConfig;
  onChange: (config: RunConfig) => void;
  disabled?: boolean;
}

export default function SetupForm({ config, onChange, disabled }: SetupFormProps) {
  const update = (patch: Partial<RunConfig>) => onChange(clampConfig({ ...config, ...patch }));

  return (
    <div className="setup">
      <div className="setup__field">
        <p className="label">Research question</p>
        <p className="setup__locked">
          <Lock size={13} aria-hidden />
          <span>{config.question}</span>
        </p>
        <p className="setup__hint">
          One question is supported. It is fixed so the objective, the bounds and the standard of
          evidence can all be declared before anything runs.
        </p>
      </div>

      <div className="setup__field">
        <p className="label">Preset</p>
        <p className="setup__preset">
          <span className="setup__preset-name numeric">{config.preset}</span>
          <span className="setup__preset-state">supported</span>
        </p>
        <ul className="setup__frozen">
          {FROZEN.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="setup__field">
        <label className="label" htmlFor="max-experiments">
          Experiment budget
        </label>
        <div className="setup__range">
          <input
            id="max-experiments"
            type="range"
            className="transport__scrub"
            min={MIN_EXPERIMENTS}
            max={MAX_EXPERIMENTS}
            step={1}
            value={config.max_experiments}
            disabled={disabled}
            onChange={(input) => update({ max_experiments: Number(input.target.value) })}
            aria-describedby="budget-hint"
          />
          <output className="setup__range-value numeric" htmlFor="max-experiments">
            {config.max_experiments}
          </output>
        </div>
        <p className="setup__hint" id="budget-hint">
          Between {MIN_EXPERIMENTS} and {MAX_EXPERIMENTS} simulator runs, including the baseline and
          verification. The default allocation reserves three checks. Choose at least five runs
          for one candidate plus all three checks; smaller budgets can leave verification incomplete.
        </p>
      </div>

      <div className="setup__field">
        <label className="label" htmlFor="seed">
          Seed
        </label>
        <div className="setup__seed">
          <input
            id="seed"
            type="number"
            className="setup__input numeric"
            min={0}
            max={SEED_MAX}
            step={1}
            value={config.seed}
            disabled={disabled}
            onChange={(input) => update({ seed: Number(input.target.value) })}
          />
          <button
            className="btn btn--sm"
            type="button"
            onClick={() => update({ seed: randomSeed() })}
            disabled={disabled}
          >
            <Dices size={14} aria-hidden />
            New seed
          </button>
        </div>
        <p className="setup__hint">
          Recorded for reproducibility bookkeeping and seeded controls. Model decisions can still
          vary between runs.
        </p>
      </div>
    </div>
  );
}
