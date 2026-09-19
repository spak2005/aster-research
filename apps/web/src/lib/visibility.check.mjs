/**
 * No-leak check for sequence gating.
 *
 * The product claim is that replaying a run shows only what was known at the
 * point being replayed. This walks every sequence of a recording and asserts
 * that: an experiment is invisible before it was requested, its result is
 * invisible before its completion event, a hypothesis carries no resolved
 * status before it was resolved, and the conclusion does not exist before the
 * run ended. It also checks that selecting any node lands on a sequence where
 * that node actually exists.
 *
 * Usage:
 *   node apps/web/src/lib/visibility.check.mjs [recording.json ...]
 *
 * With no arguments it checks the development fixture. Point it at a real
 * recording (or a run fetched from the local API) before publishing one.
 */
import { readFileSync } from 'node:fs';
import { argv, cwd, exit } from 'node:process';
import { getChapters, getVisibleState, revealSequence, sequenceBounds } from './visibility.ts';

const RESULT_EVENTS = ['experiment.completed', 'experiment.failed', 'verification.completed'];
const END_EVENTS = ['run.completed', 'run.failed', 'run.canceled'];

const paths = argv.slice(2);
if (paths.length === 0) paths.push(new URL('../../../../contracts/examples/development.json', import.meta.url).pathname);

let failures = 0;
function fail(message) {
  failures += 1;
  console.error(`  FAIL ${message}`);
}

for (const path of paths) {
  const recording = JSON.parse(readFileSync(path, 'utf8'));
  const relative = path.replace(`${cwd()}/`, '');
  const bounds = sequenceBounds(recording);
  console.log(
    `\n${relative}\n  ${recording.events.length} events · ${recording.experiments.length} experiments · ` +
      `status ${recording.status} · sequences ${bounds.min}–${bounds.max} · ${getChapters(recording).length} chapters`,
  );

  const endEvent =
    recording.events.find((event) => event.type === 'conclusion.recorded') ??
    recording.events.find((event) => END_EVENTS.includes(event.type));

  for (let sequence = bounds.min; sequence <= bounds.max; sequence += 1) {
    const state = getVisibleState(recording, sequence);

    for (const experiment of state.experiments) {
      const requested = recording.events.find(
        (event) => event.type === 'experiment.requested' && event.experiment_id === experiment.id,
      );
      if (requested && requested.sequence > sequence) {
        fail(`sequence ${sequence}: experiment ${experiment.id} visible before it was requested`);
      }
      if (experiment.result) {
        const completion = recording.events.find(
          (event) => RESULT_EVENTS.includes(event.type) && event.experiment_id === experiment.id,
        );
        if (!completion) fail(`sequence ${sequence}: result for ${experiment.id} with no completion event`);
        else if (completion.sequence > sequence) {
          fail(`sequence ${sequence}: result for ${experiment.id} leaked from sequence ${completion.sequence}`);
        }
      }
    }

    for (const hypothesis of state.hypotheses) {
      const source = recording.hypotheses.find((item) => item.id === hypothesis.id);
      if (!source) continue;
      if (source.created_sequence > sequence) {
        fail(`sequence ${sequence}: hypothesis ${hypothesis.id} visible before it was proposed`);
      }
      const unresolvedHere =
        source.resolved_sequence != null && source.resolved_sequence > sequence;
      if (unresolvedHere && !['proposed', 'running'].includes(hypothesis.status)) {
        fail(
          `sequence ${sequence}: hypothesis ${hypothesis.id} shows "${hypothesis.status}" before sequence ${source.resolved_sequence}`,
        );
      }
    }

    if (state.conclusion && (!endEvent || endEvent.sequence > sequence)) {
      fail(`sequence ${sequence}: conclusion revealed early`);
    }
    if (endEvent && endEvent.sequence <= sequence && !state.conclusion) {
      fail(`sequence ${sequence}: conclusion missing after the run ended`);
    }
  }

  for (const experiment of recording.experiments) {
    const reveal = revealSequence(recording, experiment.id);
    if (reveal === null) fail(`no reveal sequence for experiment ${experiment.id}`);
    else if (!getVisibleState(recording, reveal).experimentById.has(experiment.id)) {
      fail(`experiment ${experiment.id} is not visible at its own reveal sequence ${reveal}`);
    }
  }

  for (const hypothesis of recording.hypotheses) {
    const reveal = revealSequence(recording, hypothesis.id);
    if (reveal === null) fail(`no reveal sequence for hypothesis ${hypothesis.id}`);
    else if (!getVisibleState(recording, reveal).hypotheses.some((item) => item.id === hypothesis.id)) {
      fail(`hypothesis ${hypothesis.id} is not visible at its own reveal sequence ${reveal}`);
    }
  }

  const final = getVisibleState(recording, bounds.max);
  console.log(
    `  at the end: ${final.hypotheses.length} hypotheses · ${final.experiments.length} experiments · ` +
      `conclusion ${final.conclusion ? final.conclusion.status : 'none recorded'}`,
  );
}

console.log(failures === 0 ? '\nno leaks found' : `\n${failures} failing assertions`);
exit(failures === 0 ? 0 : 1);
