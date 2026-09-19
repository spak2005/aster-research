/** Integration checks against actual public recordings, not only fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const compiled = await build({
  stdin: {
    contents: "export {getVisibleState} from './apps/web/src/replay/index.ts';",
    resolveDir: root.pathname,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const {getVisibleState} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const catalog = JSON.parse(await fs.readFile(new URL('public/recordings/index.json', root)));
let snapshots = 0;
for (const entry of catalog) {
  const recording = JSON.parse(await fs.readFile(new URL(`public/${entry.path.replace(/^\//,'')}`, root)));
  for (const event of recording.events) {
    const state = getVisibleState(recording, event.sequence);
    assert.deepEqual(state, getVisibleState(recording, event.sequence), 'Replay must reconstruct deterministically');
    assert(state.events.every(e => e.sequence <= event.sequence), 'Future event exposed');
    const visibleEvents = recording.events.filter(e => e.sequence <= event.sequence);
    for (const experiment of state.experiments) {
      const completed = visibleEvents.some(e => e.experiment_id === experiment.id && ['experiment.completed','verification.completed'].includes(e.type));
      if (!completed) {
        assert.equal(experiment.metrics, null, 'Future metrics exposed');
        assert.equal(experiment.frames.length, 0, 'Future temperature frames exposed');
        assert.equal(experiment.artifacts.length, 0, 'Future artifacts exposed');
      } else {
        const original = recording.experiments.find(e => e.id === experiment.id);
        assert.deepEqual(experiment.metrics, original.metrics, 'Replay changed measured metrics');
      }
    }
    const conclusionVisible = visibleEvents.some(e => e.type === 'conclusion.recorded');
    assert.equal(state.conclusion !== null, conclusionVisible, 'Conclusion visibility does not match the evidence timeline');
    snapshots++;
  }
  console.log(`Replay verified: ${recording.id}`);
}
console.log(`${snapshots} real event snapshots checked`);
