import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  EventType,
  ProfileFrame,
  Recording,
  ResearchEvent,
} from '../../contracts/recording';
import {
  getExperimentAtSequence,
  getSceneSelection,
  getVisibleState,
} from '../../apps/web/src/replay/index';
import { loadProfileFrame } from '../../apps/web/src/scene/profileFrames';

const frames: ProfileFrame[] = [
  {
    time_s: 0,
    rho: [0, 0.5, 1],
    electron_temperature_kev: [8, 5, 1],
    ion_temperature_kev: [7, 4, 1],
    fusion_power_mw: 0,
    cumulative_fusion_energy_mj: 0,
    cumulative_heating_energy_mj: 0,
  },
  {
    time_s: 1,
    rho: [0, 0.5, 1],
    electron_temperature_kev: [12, 7, 1.2],
    ion_temperature_kev: [11, 6, 1.1],
    fusion_power_mw: 14,
    cumulative_fusion_energy_mj: 7,
    cumulative_heating_energy_mj: 10,
  },
];

function event(
  sequence: number,
  type: EventType,
  overrides: Partial<ResearchEvent> = {},
): ResearchEvent {
  return {
    schema_version: '1.0',
    event_id: `event-${sequence}`,
    run_id: 'run-1',
    sequence,
    timestamp: new Date(sequence * 1_000).toISOString(),
    type,
    title: type,
    summary: `${type} summary`,
    evidence_ids: [],
    payload: {},
    ...overrides,
  };
}

function makeRecording(): Recording {
  const events = [
    event(8, 'run.completed'),
    event(3, 'experiment.requested', {
      hypothesis_id: 'hypothesis-1',
      experiment_id: 'candidate-1',
    }),
    event(1, 'run.started'),
    event(7, 'conclusion.recorded', {
      title: 'Supported result',
      summary: 'The candidate passed the declared checks.',
      evidence_ids: ['result-evidence'],
      payload: { status: 'supported' },
    }),
    event(5, 'experiment.completed', {
      hypothesis_id: 'hypothesis-1',
      experiment_id: 'candidate-1',
      evidence_ids: ['result-evidence'],
    }),
    event(2, 'hypothesis.proposed', {
      hypothesis_id: 'hypothesis-1',
      title: 'Move heating inward',
      summary: 'Predict higher integrated output.',
      payload: { prediction: 'Fusion energy will increase.' },
    }),
    event(6, 'assessment.recorded', {
      hypothesis_id: 'hypothesis-1',
      experiment_id: 'candidate-1',
      summary: 'Recorded output exceeded the baseline.',
      evidence_ids: ['result-evidence'],
    }),
    event(4, 'experiment.started', {
      hypothesis_id: 'hypothesis-1',
      experiment_id: 'candidate-1',
    }),
  ];

  return {
    schema_version: '1.0',
    id: 'run-1',
    title: 'Replay test',
    question: 'Does the candidate improve output?',
    created_at: '1970-01-01T00:00:00.000Z',
    mode: 'development-fixture',
    status: 'completed',
    simulator: 'TORAX',
    model: 'test',
    description: 'Test fixture',
    limitations: ['Not a public result.'],
    provenance: {
      software_versions: { torax: 'test' },
      seed: 1,
      objective: 'fusion energy',
      objective_units: 'MJ',
      config_hash: 'test',
    },
    budget: {
      max_experiments: 4,
      completed_experiments: 1,
      wall_time_s: 12,
    },
    baseline_id: 'baseline-1',
    best_experiment_id: 'candidate-1',
    temperature_scale_kev: [0, 16],
    geometry: {
      major_radius_m: 6.2,
      minor_radius_m: 2,
      elongation: 1.7,
    },
    hypotheses: [
      {
        id: 'hypothesis-1',
        parent_id: null,
        title: 'Move heating inward',
        prediction: 'Fusion energy will increase.',
        status: 'supported',
        assessment: 'Recorded output exceeded the baseline.',
        experiment_ids: ['candidate-1'],
        evidence_ids: ['result-evidence'],
        created_sequence: 2,
        resolved_sequence: 6,
      },
    ],
    experiments: [
      {
        id: 'candidate-1',
        hypothesis_id: 'hypothesis-1',
        label: 'Candidate 1',
        role: 'candidate',
        status: 'completed',
        config: {
          heating_location: 0.35,
          heating_width: 0.12,
          heating_power_mw: 10,
          duration_s: 1,
        },
        metrics: {
          fusion_energy_mj: 7,
          heating_energy_mj: 10,
          peak_ion_temperature_kev: 11,
          improvement_pct: 8,
        },
        frames,
        artifacts: [{ label: 'profiles', path: 'profiles.json' }],
        checks: [
          { name: 'finite outputs', status: 'passed', detail: 'All finite.' },
        ],
        wall_time_s: 12,
      },
    ],
    events,
    conclusion: {
      status: 'supported',
      title: 'Supported result',
      summary: 'The candidate passed the declared checks.',
      evidence_ids: ['result-evidence'],
    },
  };
}

test('hides future results, evidence, assessments, and conclusions', () => {
  const recording = makeRecording();
  const running = getVisibleState(recording, 4);

  assert.deepEqual(
    running.events.map((item) => item.sequence),
    [1, 2, 3, 4],
  );
  assert.equal(running.runStatus, 'running');
  assert.equal(running.experiments.length, 1);
  assert.equal(running.experiments[0]?.status, 'running');
  assert.equal(running.experiments[0]?.metrics, null);
  assert.deepEqual(running.experiments[0]?.frames, []);
  assert.deepEqual(running.experiments[0]?.artifacts, []);
  assert.deepEqual(running.experiments[0]?.checks, []);
  assert.equal(running.hypotheses[0]?.assessment, '');
  assert.deepEqual(running.hypotheses[0]?.evidenceIds, []);
  assert.equal(running.conclusion, null);
  assert.equal(running.budget.completedExperiments, 0);
  assert.equal(running.budget.wallTimeS, 0);

  const active = getExperimentAtSequence(recording, 4);
  assert.equal(active?.resultVisible, false);
  assert.equal(active?.metrics, null);
});

test('reveals recorded data only at its completion boundary', () => {
  const recording = makeRecording();
  const before = getVisibleState(recording, 4);
  const completed = getVisibleState(recording, 5);
  const terminal = getVisibleState(recording, 8);

  assert.equal(before.experiments[0]?.frames.length, 0);
  assert.equal(completed.experiments[0]?.frames.length, 2);
  assert.equal(completed.experiments[0]?.metrics?.fusion_energy_mj, 7);
  assert.deepEqual(completed.experiments[0]?.checks, []);
  assert.equal(completed.conclusion, null);
  assert.equal(terminal.experiments[0]?.checks.length, 1);
  assert.equal(terminal.conclusion?.status, 'supported');
  assert.equal(terminal.runStatus, 'completed');
});

test('clamps stored frame selection without interpolating values', () => {
  const experiment = makeRecording().experiments[0] ?? null;
  const first = loadProfileFrame(experiment, -100);
  const rounded = loadProfileFrame(experiment, 0.6);
  const last = loadProfileFrame(experiment, 100);
  const invalid = loadProfileFrame(experiment, Number.NaN);

  assert.equal(first.status, 'ready');
  assert.equal(first.status === 'ready' ? first.value.index : -1, 0);
  assert.equal(rounded.status === 'ready' ? rounded.value.index : -1, 1);
  assert.equal(last.status === 'ready' ? last.value.index : -1, 1);
  assert.equal(invalid.status === 'ready' ? invalid.value.index : -1, 0);
  assert.equal(
    rounded.status === 'ready'
      ? rounded.value.frame.electron_temperature_kev[0]
      : -1,
    12,
  );
});

test('keeps scene selection pending until result frames are visible', () => {
  const recording = makeRecording();
  const pending = getSceneSelection(recording, 4, {
    selectedExperimentId: 'candidate-1',
    frameIndex: 99,
    compare: true,
  });
  const ready = getSceneSelection(recording, 5, {
    selectedExperimentId: 'candidate-1',
    frameIndex: 99,
    compare: true,
  });

  assert.equal(pending.status, 'pending');
  assert.equal(pending.experiment, null);
  assert.equal(pending.compare, false);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.frameIndex, 1);
  assert.equal(ready.experiment?.frames.length, 2);
  assert.equal(ready.compare, false);
});

test('empty and incomplete runs reconstruct safely', () => {
  const recording = makeRecording();
  recording.events = [];
  recording.experiments = [];
  recording.hypotheses = [];
  recording.status = 'running';

  const state = getVisibleState(recording, Number.NaN);
  assert.equal(state.sequence, 0);
  assert.equal(state.runStatus, 'pending');
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.experiments, []);
  assert.deepEqual(state.hypotheses, []);
  assert.equal(state.activeExperiment, null);
  assert.equal(getExperimentAtSequence(recording, 50), null);
});
