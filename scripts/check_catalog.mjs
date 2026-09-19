/** Exercise the actual loader with production project-path settings. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
const compiled = await build({entryPoints:['apps/web/src/lib/recordings.ts'], bundle:true, platform:'node', format:'esm', write:false, define:{'import.meta.env.BASE_URL':'"/aster-research/"','import.meta.env.DEV':'false'}});
const loader = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const paths = [];
globalThis.fetch = async url => {
  paths.push(url);
  assert(url.startsWith('/aster-research/recordings/'), `Wrong deployment path: ${url}`);
  return new Response(await fs.readFile(`public/${url.slice('/aster-research/'.length)}`), {headers:{'Content-Type':'application/json'}});
};
const catalog = await loader.fetchRecordingIndex();
assert.equal(catalog.length,4);
for (const entry of catalog) assert.equal((await loader.fetchRecording(entry.path)).id, entry.id);
console.log(`Catalog and ${catalog.length} recordings loaded through the production prefix`);
