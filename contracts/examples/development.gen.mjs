/**
 * Generates `contracts/examples/development.json`.
 *
 * THE OUTPUT IS SYNTHETIC. It exists so the interface can be built, reviewed and
 * regression-checked before a genuine investigation has been recorded. The
 * profiles come from a closed-form toy expression, not from TORAX, and none of
 * the numbers are a scientific result. The fixture is marked
 * `mode: "development-fixture"` so the UI labels it as such everywhere, and the
 * production build never loads it.
 *
 * Every percentage quoted in the narrative is derived from the generated frames
 * rather than typed in, so the fixture stays internally consistent and the
 * charts, metric cards and evidence text can be checked against each other.
 *
 * Usage: node contracts/examples/development.gen.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RUN_ID = 'development-fixture';
const RHO = Array.from({ length: 25 }, (_, i) => Number((i / 24).toFixed(4)));
const DURATION_S = 5;
const FRAME_STEP_S = 0.25;
const HEATING_POWER_MW = 20;
const HEATING_ENERGY_MJ = HEATING_POWER_MW * DURATION_S;
const T_EDGE_KEV = 0.6;
const TAU_S = 1.2;
const FUSION_COEFFICIENT = 0.055;
/** Minimum meaningful improvement, fixed before the run in this fixture's story. */
const THRESHOLD_PCT = 3;

const round = (value, digits = 3) => Number(value.toFixed(digits));

/** Toy radial profile: peaked core plus a Gaussian bump at the deposition radius. */
function ionTemperature(rho, t, { coreKev, location, width, bumpKev }) {
  const ramp = 1 - Math.exp(-t / TAU_S);
  const core = T_EDGE_KEV + (coreKev - T_EDGE_KEV) * Math.pow(Math.max(0, 1 - rho * rho), 1.6) * ramp;
  const bump = bumpKev * ramp * Math.exp(-((rho - location) ** 2) / (2 * width * width));
  return core + bump;
}

function buildFrames(shape) {
  const frames = [];
  let fusionEnergy = 0;
  let previousPower = 0;
  for (let step = 0; step * FRAME_STEP_S <= DURATION_S + 1e-9; step += 1) {
    const t = step * FRAME_STEP_S;
    const ion = RHO.map((rho) => round(ionTemperature(rho, t, shape), 3));
    // Electrons sit below the ions and flatten faster in this toy model.
    const electron = RHO.map((rho, i) => round(ion[i] * (0.78 + 0.06 * (1 - rho)), 3));
    const power = round(FUSION_COEFFICIENT * ion[0] * ion[0], 3);
    if (step > 0) fusionEnergy += ((power + previousPower) / 2) * FRAME_STEP_S;
    previousPower = power;
    frames.push({
      time_s: round(t, 2),
      rho: RHO,
      electron_temperature_kev: electron,
      ion_temperature_kev: ion,
      fusion_power_mw: power,
      cumulative_fusion_energy_mj: round(fusionEnergy, 3),
      cumulative_heating_energy_mj: round(HEATING_POWER_MW * t, 3),
    });
  }
  return frames;
}

const check = (name, status, detail) => ({ name, status, detail });

/**
 * Shape parameters were chosen so the generated objective lands near the
 * narrative the fixture tells; the narrative itself is written from the
 * generated values below, not the other way round.
 */
const SPECS = [
  {
    id: 'exp-baseline',
    hypothesisId: 'hyp-root',
    label: 'Baseline — documented configuration',
    role: 'baseline',
    comparedTo: null,
    shape: { coreKev: 14.2, bumpKev: 2.1, location: 0.35, width: 0.15 },
    solver: 'linear',
    dt: 0.05,
    wallTime: 214.8,
  },
  {
    id: 'exp-c1',
    hypothesisId: 'hyp-inward',
    label: 'Candidate A — deposition at rho 0.22',
    role: 'candidate',
    comparedTo: 'exp-baseline',
    shape: { coreKev: 13.79, bumpKev: 2.6, location: 0.22, width: 0.15 },
    solver: 'linear',
    dt: 0.05,
    wallTime: 208.4,
  },
  {
    id: 'exp-c2',
    hypothesisId: 'hyp-outward',
    label: 'Candidate B — deposition at rho 0.50',
    role: 'candidate',
    comparedTo: 'exp-baseline',
    shape: { coreKev: 13.94, bumpKev: 1.7, location: 0.5, width: 0.15 },
    solver: 'linear',
    dt: 0.05,
    wallTime: 211.2,
  },
  {
    id: 'exp-c3',
    hypothesisId: 'hyp-narrow',
    label: 'Candidate C — narrow deposition, width 0.06',
    role: 'candidate',
    comparedTo: null,
    status: 'failed',
    error: 'Solver did not converge at t = 1.85 s; step rejected 12 times at dt = 0.05 s.',
    shape: { coreKev: 13.79, bumpKev: 2.6, location: 0.22, width: 0.06 },
    solver: 'linear',
    dt: 0.05,
    wallTime: 96.3,
  },
  {
    id: 'exp-v1',
    hypothesisId: 'hyp-inward',
    label: 'Refinement — baseline at dt 0.0125 s',
    role: 'verification',
    comparedTo: null,
    shape: { coreKev: 14.14, bumpKev: 2.1, location: 0.35, width: 0.15 },
    solver: 'newton-raphson',
    dt: 0.0125,
    wallTime: 742.6,
  },
  {
    id: 'exp-v2',
    hypothesisId: 'hyp-inward',
    label: 'Refinement — candidate A at dt 0.0125 s',
    role: 'verification',
    comparedTo: 'exp-v1',
    shape: { coreKev: 13.62, bumpKev: 2.3, location: 0.22, width: 0.15 },
    solver: 'newton-raphson',
    dt: 0.0125,
    wallTime: 758.1,
  },
];

const frameSets = new Map();
const energies = new Map();
for (const spec of SPECS) {
  const frames = spec.status === 'failed' ? [] : buildFrames(spec.shape);
  frameSets.set(spec.id, frames);
  energies.set(spec.id, frames.length ? frames.at(-1).cumulative_fusion_energy_mj : null);
}

function improvementPct(id, comparedTo) {
  if (!comparedTo) return null;
  const value = energies.get(id);
  const reference = energies.get(comparedTo);
  if (value === null || reference === null) return null;
  return Number((((value - reference) / reference) * 100).toFixed(1));
}

const improvements = new Map(SPECS.map((spec) => [spec.id, improvementPct(spec.id, spec.comparedTo)]));
const gainCoarse = improvements.get('exp-c1');
const gainRefined = improvements.get('exp-v2');
const lossOutward = improvements.get('exp-c2');
const refinementShift = Number(
  ((Math.abs(energies.get('exp-v1') - energies.get('exp-baseline')) / energies.get('exp-baseline')) * 100).toFixed(1),
);

const CHECKS = {
  'exp-baseline': [
    check('inputs within declared bounds', 'passed', 'All controls inside reviewed ranges.'),
    check('fixed heating energy', 'passed', `${HEATING_ENERGY_MJ.toFixed(1)} MJ delivered, matching the frozen budget.`),
    check('solver converged', 'passed', 'No step rejected; requested horizon completed.'),
    check('finite outputs', 'passed', 'All profile values finite.'),
  ],
  'exp-c1': [
    check('inputs within declared bounds', 'passed', 'All controls inside reviewed ranges.'),
    check('fixed heating energy', 'passed', `${HEATING_ENERGY_MJ.toFixed(1)} MJ delivered, matching the baseline.`),
    check('solver converged', 'passed', 'Requested horizon completed.'),
    check('minimum meaningful improvement', 'pending', 'Awaiting refinement at reduced timestep.'),
  ],
  'exp-c2': [
    check('inputs within declared bounds', 'passed', 'All controls inside reviewed ranges.'),
    check('fixed heating energy', 'passed', `${HEATING_ENERGY_MJ.toFixed(1)} MJ delivered, matching the baseline.`),
    check('solver converged', 'passed', 'Requested horizon completed.'),
  ],
  'exp-c3': [
    check('inputs within declared bounds', 'passed', 'All controls inside reviewed ranges.'),
    check('solver converged', 'failed', 'Non-convergence before the requested horizon.'),
    check('completed requested horizon', 'failed', 'Stopped at 1.85 s of 5.00 s.'),
  ],
  'exp-v1': [
    check('numerical convergence', 'passed', `Objective shifted ${refinementShift}% against the coarse run.`),
    check('alternative solver agrees', 'passed', 'Newton–Raphson within the declared tolerance.'),
  ],
  'exp-v2': [
    check('numerical convergence', 'passed', 'Objective shift against the coarse run inside tolerance.'),
    check(
      'minimum meaningful improvement',
      'failed',
      `Refined gain ${gainRefined}% is below the ${THRESHOLD_PCT.toFixed(1)}% threshold fixed before the run.`,
    ),
    check('equal-budget grid search', 'inconclusive', 'Grid best overlaps the candidate interval.'),
  ],
};

const experiments = SPECS.map((spec) => {
  const frames = frameSets.get(spec.id);
  const last = frames.at(-1);
  const status = spec.status ?? 'completed';
  return {
    id: spec.id,
    hypothesis_id: spec.hypothesisId,
    label: spec.label,
    role: spec.role,
    status,
    config: {
      heating_location: spec.shape.location,
      heating_width: spec.shape.width,
      heating_power_mw: HEATING_POWER_MW,
      duration_s: DURATION_S,
      solver: spec.solver,
      dt_s: spec.dt,
    },
    metrics: {
      fusion_energy_mj: last ? round(last.cumulative_fusion_energy_mj, 2) : 0,
      heating_energy_mj: HEATING_ENERGY_MJ,
      peak_ion_temperature_kev: last ? round(Math.max(...last.ion_temperature_kev), 2) : 0,
      improvement_pct: improvements.get(spec.id),
    },
    frames,
    artifacts:
      status === 'failed'
        ? [{ label: 'solver log', path: `artifacts/${spec.id}/solver.log` }]
        : [
            {
              label: 'raw simulator output',
              path: `artifacts/${spec.id}/state.nc`,
              sha256: `synthetic-fixture-${spec.id}-no-real-artifact`,
            },
            { label: 'solver log', path: `artifacts/${spec.id}/solver.log` },
          ],
    checks: CHECKS[spec.id],
    wall_time_s: spec.wallTime,
    ...(spec.error ? { error: spec.error } : {}),
  };
});

const hypotheses = [
  {
    id: 'hyp-root',
    parent_id: null,
    title: 'The objective responds to deposition radius at fixed heating energy',
    prediction:
      'Repeating the documented configuration reproduces its recorded objective, and moving the deposition changes the objective by more than the noise floor.',
    status: 'supported',
    assessment:
      'Baseline reproduced. Later experiments moved the objective in both directions by more than the refinement shift, so deposition radius is worth searching.',
    experiment_ids: ['exp-baseline'],
    evidence_ids: ['exp-baseline'],
    created_sequence: 2,
    resolved_sequence: 6,
  },
  {
    id: 'hyp-inward',
    parent_id: 'hyp-root',
    title: 'Moving deposition inward increases integrated fusion output at fixed energy',
    prediction: `Deposition at rho 0.22 raises integrated fusion energy by at least ${THRESHOLD_PCT.toFixed(1)}% relative to the baseline.`,
    status: 'refuted',
    assessment: `The coarse run showed ${gainCoarse}%, but refinement at dt 0.0125 s reduced the gain to ${gainRefined}%, below the ${THRESHOLD_PCT.toFixed(1)}% threshold fixed before the run. The direction of the effect survived; the claimed size did not.`,
    experiment_ids: ['exp-c1', 'exp-v1', 'exp-v2'],
    evidence_ids: ['exp-c1', 'exp-v1', 'exp-v2'],
    created_sequence: 7,
    resolved_sequence: 25,
  },
  {
    id: 'hyp-outward',
    parent_id: 'hyp-root',
    title: 'Outward deposition is the better direction',
    prediction: 'Deposition at rho 0.50 raises integrated fusion energy above the baseline.',
    status: 'refuted',
    assessment: `Objective fell ${Math.abs(lossOutward)}% below baseline. Direction discarded after one experiment.`,
    experiment_ids: ['exp-c2'],
    evidence_ids: ['exp-c2'],
    created_sequence: 12,
    resolved_sequence: 16,
  },
  {
    id: 'hyp-narrow',
    parent_id: 'hyp-inward',
    title: 'A narrower deposition compounds the inward gain',
    prediction: 'Width 0.06 at rho 0.22 exceeds the gain measured for candidate A.',
    status: 'inconclusive',
    assessment:
      'The simulation did not reach the requested horizon, so no objective value exists for this configuration. Not retried within the remaining budget.',
    experiment_ids: ['exp-c3'],
    evidence_ids: ['exp-c3'],
    created_sequence: 17,
    resolved_sequence: 21,
  },
  {
    id: 'hyp-power',
    parent_id: 'hyp-root',
    title: 'Shortening the pulse while raising power holds total energy fixed',
    prediction: 'Doubling power over half the duration keeps 100 MJ and improves the objective.',
    status: 'abandoned',
    assessment:
      'Rejected by the harness before execution: duration is a frozen parameter for this question, so the configuration was never run.',
    experiment_ids: [],
    evidence_ids: [],
    created_sequence: 9,
    resolved_sequence: 10,
  },
];

const START = Date.parse('2026-09-18T09:12:04Z');
let sequence = 0;
const events = [];

function event(type, title, summary, extra = {}, secondsAhead = 0) {
  sequence += 1;
  events.push({
    schema_version: '1.0',
    event_id: `evt-${String(sequence).padStart(3, '0')}`,
    run_id: RUN_ID,
    sequence,
    timestamp: new Date(START + secondsAhead * 1000).toISOString(),
    type,
    ...(extra.hypothesis_id ? { hypothesis_id: extra.hypothesis_id } : {}),
    ...(extra.experiment_id ? { experiment_id: extra.experiment_id } : {}),
    ...(extra.parent_id ? { parent_id: extra.parent_id } : {}),
    title,
    summary,
    evidence_ids: extra.evidence_ids ?? [],
    payload: extra.payload ?? {},
  });
}

event(
  'run.started',
  'Run started',
  'Question, parameter bounds, objective and budget frozen. Twelve experiments authorised.',
  { payload: { max_experiments: 12, seed: 20260918, threshold_pct: THRESHOLD_PCT } },
  0,
);
event(
  'hypothesis.proposed',
  'Reproduce the baseline first',
  'Before searching, confirm the documented configuration reproduces its recorded objective.',
  { hypothesis_id: 'hyp-root' },
  38,
);
event(
  'experiment.requested',
  'Baseline requested',
  'Documented configuration: 20 MW over 5 s, deposition at rho 0.35.',
  { hypothesis_id: 'hyp-root', experiment_id: 'exp-baseline' },
  44,
);
event(
  'experiment.started',
  'Baseline running',
  'Executor accepted the configuration and began the run.',
  { hypothesis_id: 'hyp-root', experiment_id: 'exp-baseline' },
  46,
);
event(
  'experiment.completed',
  'Baseline completed',
  `Horizon reached. Integrated fusion energy ${energies.get('exp-baseline').toFixed(2)} MJ under the frozen objective definition.`,
  { hypothesis_id: 'hyp-root', experiment_id: 'exp-baseline', evidence_ids: ['exp-baseline'] },
  261,
);
event(
  'assessment.recorded',
  'Baseline accepted as the reference',
  'All four checks passed. Deposition radius is worth searching within the reviewed bounds.',
  { hypothesis_id: 'hyp-root', evidence_ids: ['exp-baseline'] },
  268,
);
event(
  'hypothesis.proposed',
  'Try moving the deposition inward',
  `Predicts at least a ${THRESHOLD_PCT.toFixed(1)}% gain in integrated fusion energy at rho 0.22.`,
  { hypothesis_id: 'hyp-inward', parent_id: 'hyp-root' },
  292,
);
event(
  'experiment.requested',
  'Candidate A requested',
  'Deposition moved to rho 0.22 with the width and total energy unchanged.',
  { hypothesis_id: 'hyp-inward', experiment_id: 'exp-c1' },
  296,
);
event(
  'hypothesis.proposed',
  'Consider shortening the pulse',
  'Proposes doubling power over half the duration at the same total energy.',
  { hypothesis_id: 'hyp-power', parent_id: 'hyp-root' },
  300,
);
event(
  'hypothesis.revised',
  'Pulse-shortening rejected before execution',
  'Duration is frozen for this question. Validation refused the configuration and it was never run.',
  { hypothesis_id: 'hyp-power', payload: { rejected_by: 'schema', field: 'duration_s' } },
  303,
);
event(
  'experiment.started',
  'Candidate A running',
  'Executor accepted the configuration and began the run.',
  { hypothesis_id: 'hyp-inward', experiment_id: 'exp-c1' },
  310,
);
event(
  'branch.created',
  'Outward direction opened as a sibling',
  'A second child hypothesis tests the opposite direction so the search is not one-sided.',
  { hypothesis_id: 'hyp-outward', parent_id: 'hyp-root' },
  318,
);
event(
  'experiment.requested',
  'Candidate B requested',
  'Deposition moved outward to rho 0.50, width and total energy unchanged.',
  { hypothesis_id: 'hyp-outward', experiment_id: 'exp-c2' },
  322,
);
event(
  'experiment.completed',
  'Candidate A completed',
  `Integrated fusion energy ${energies.get('exp-c1').toFixed(2)} MJ, ${gainCoarse}% above baseline at the coarse timestep.`,
  { hypothesis_id: 'hyp-inward', experiment_id: 'exp-c1', evidence_ids: ['exp-c1'] },
  524,
);
event(
  'experiment.started',
  'Candidate B running',
  'Executor accepted the configuration and began the run.',
  { hypothesis_id: 'hyp-outward', experiment_id: 'exp-c2' },
  530,
);
event(
  'experiment.completed',
  'Candidate B completed',
  `Integrated fusion energy ${energies.get('exp-c2').toFixed(2)} MJ, ${Math.abs(lossOutward)}% below baseline.`,
  { hypothesis_id: 'hyp-outward', experiment_id: 'exp-c2', evidence_ids: ['exp-c2'] },
  748,
);
event(
  'hypothesis.proposed',
  'Narrow the deposition',
  'Predicts that width 0.06 at rho 0.22 compounds the inward gain.',
  { hypothesis_id: 'hyp-narrow', parent_id: 'hyp-inward' },
  771,
);
event(
  'experiment.requested',
  'Candidate C requested',
  'Width reduced to 0.06 at rho 0.22, total energy unchanged.',
  { hypothesis_id: 'hyp-narrow', experiment_id: 'exp-c3' },
  775,
);
event(
  'experiment.started',
  'Candidate C running',
  'Executor accepted the configuration and began the run.',
  { hypothesis_id: 'hyp-narrow', experiment_id: 'exp-c3' },
  778,
);
event(
  'experiment.failed',
  'Candidate C failed',
  'Solver did not converge at t = 1.85 s. No objective value exists for this configuration.',
  { hypothesis_id: 'hyp-narrow', experiment_id: 'exp-c3', evidence_ids: ['exp-c3'] },
  875,
);
event(
  'assessment.recorded',
  'Narrow deposition left unresolved',
  'A failed run is not evidence against the hypothesis. Not retried within the remaining budget.',
  { hypothesis_id: 'hyp-narrow', evidence_ids: ['exp-c3'] },
  881,
);
event(
  'verification.requested',
  'Refinement requested for baseline and candidate A',
  'Both re-run at dt 0.0125 s with an alternative solver before any claim is made.',
  { hypothesis_id: 'hyp-inward', payload: { dt_s: 0.0125, solver: 'newton-raphson' } },
  902,
);
event(
  'verification.completed',
  'Refined baseline completed',
  `Objective shifted ${refinementShift}% against the coarse run, inside the declared tolerance.`,
  { hypothesis_id: 'hyp-inward', experiment_id: 'exp-v1', evidence_ids: ['exp-v1'] },
  1646,
);
event(
  'verification.completed',
  'Refined candidate A completed',
  `Gain against the refined baseline is ${gainRefined}%, below the ${THRESHOLD_PCT.toFixed(1)}% minimum fixed before the run.`,
  { hypothesis_id: 'hyp-inward', experiment_id: 'exp-v2', evidence_ids: ['exp-v1', 'exp-v2'] },
  2406,
);
event(
  'assessment.recorded',
  'Claimed improvement does not survive refinement',
  'The direction of the effect holds; its magnitude does not clear the pre-registered threshold.',
  { hypothesis_id: 'hyp-inward', evidence_ids: ['exp-c1', 'exp-v1', 'exp-v2'] },
  2418,
);
event(
  'conclusion.recorded',
  'No supported improvement within budget',
  `Inward deposition moves the objective in the predicted direction, but the best refined gain of ${gainRefined}% did not clear the ${THRESHOLD_PCT.toFixed(1)}% minimum.`,
  {
    evidence_ids: ['exp-baseline', 'exp-c1', 'exp-c2', 'exp-v1', 'exp-v2'],
    payload: { threshold_pct: THRESHOLD_PCT, best_refined_gain_pct: gainRefined },
  },
  2451,
);
event(
  'run.completed',
  'Run completed',
  'Six experiments executed, one of them failed. Budget was not exhausted.',
  { payload: { completed_experiments: 6 } },
  2460,
);

const recording = {
  schema_version: '1.0',
  id: RUN_ID,
  title: 'Development fixture — synthetic heating-profile search',
  question:
    'At fixed total heating energy, can a different heating deposition profile improve integrated fusion output, and does the improvement survive stricter numerical checks?',
  created_at: new Date(START).toISOString(),
  mode: 'development-fixture',
  status: 'completed',
  simulator: 'none — synthetic closed-form profiles',
  model: 'none — scripted decisions',
  description:
    'Synthetic data used to develop and regression-check the Aster interface. It is not a scientific result and must never be presented as one.',
  limitations: [
    'Profiles come from a closed-form toy expression, not from TORAX or any solver.',
    'Every check outcome and assessment in this file was written by hand for interface development.',
    'No model was consulted and no experiment was executed to produce these numbers.',
    'Loaded only in development builds; it is never published in the recording catalogue.',
  ],
  provenance: {
    software_versions: { aster: '0.1.0-dev', fixture: '1', torax: 'not used' },
    seed: 20260918,
    objective: 'Integrated fusion energy over a fixed 5 s horizon',
    objective_units: 'MJ',
    config_hash: 'synthetic-fixture-no-config-hash',
  },
  budget: { max_experiments: 12, completed_experiments: 6, wall_time_s: 2460 },
  baseline_id: 'exp-baseline',
  best_experiment_id: 'exp-c1',
  temperature_scale_kev: [0, 18],
  geometry: { major_radius_m: 6.2, minor_radius_m: 2.0, elongation: 1.72 },
  hypotheses,
  experiments,
  events,
  conclusion: {
    status: 'inconclusive',
    title: 'No supported improvement within budget',
    summary: `Inward deposition moved the objective in the predicted direction, but after refinement at dt 0.0125 s the best candidate gained ${gainRefined}% against a ${THRESHOLD_PCT.toFixed(1)}% minimum fixed before the run. The direction is worth further study; the improvement is not claimed.`,
    evidence_ids: ['exp-baseline', 'exp-c1', 'exp-v1', 'exp-v2'],
  },
};

const outPath = join(dirname(fileURLToPath(import.meta.url)), 'development.json');
writeFileSync(outPath, `${JSON.stringify(recording, null, 1)}\n`);
console.log(
  `wrote ${outPath} — ${events.length} events, ${experiments.length} experiments, ` +
    `coarse gain ${gainCoarse}%, refined gain ${gainRefined}%, outward ${lossOutward}%`,
);
