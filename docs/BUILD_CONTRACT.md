# Parallel implementation contract

Read CANONICAL_PLAN.md. Shared types are contracts/recording.ts. Never silently change them.

## Frontend

V (scene) owns apps/web/src/scene/** and apps/web/src/replay/**.
Export default `PlasmaScene` from scene/PlasmaScene.tsx, props PlasmaSceneProps from contracts.
Export replay utilities from replay/index.ts: `getVisibleState(recording, sequence)` and `getExperimentAtSequence(recording, sequence)`; exact return types document in your source. UI can implement selection itself if necessary.

U (UI) owns all other apps/web/src/** including main.tsx, App.tsx, CSS. Import scene lazily using React.lazy(() => import('./scene/PlasmaScene')). A missing scene during your typecheck is an expected integration dependency; don't create a conflicting stub. Parent integrates.

UI fetches `/recordings/index.json` -> array `{id,title,description,path,mode,created_at}`. `path` is same-origin JSON file matching Recording. Empty index must show honest no-recording state. Developer fixture is `contracts/examples/development.json`, not a public investigation. No hardcoded success metrics or synthetic default as real recording.

Hash routes recommended for static hosting: #/, #/research/<id>, #/start. Research page accepts a Recording prop internally so local API runs can share display. Local API at same-origin `/api` proxied to 127.0.0.1:8765 in dev; public site may have no API.

## Backend

H owns services/**, experiments/**, tests/research/**, docs/science/**, and genuine public/recordings exports.
Research interpreter absolute path (already installed): /Users/israelogbonna/.openclaw/workspace/projects/science-harness/.venv/bin/python.
Dependency snapshot requirements.lock.txt is coordinator-owned. Do not install a second heavy environment. In worktree use above interpreter, with PYTHONPATH set to your worktree root.

API: GET /api/health => {status:'ok',simulator:'TORAX',ready:boolean}; GET /api/runs => summaries; POST /api/runs body {question,preset:'fixed-energy',max_experiments:number,seed:number} => {id,status}; GET /api/runs/{id} => Recording; GET /api/runs/{id}/events?after=0 => ResearchEvent[]; POST /api/runs/{id}/cancel. max_experiments 3..12 enforced server side. One worker. Bind localhost. Startup command `.venv/bin/python -m uvicorn services.research.api:app --host 127.0.0.1 --port 8765`.

Authenticated Cursor CLI can be research proposer: call `agent --print --mode ask --model cursor-grok-4.6-high-fast --output-format json` with bounded scientific context only. It must output a JSON decision; capture envelope safely and parse structured response. No action tools for the research proposer, no evaluator edits. Prefer subprocess in empty project runtime directory, controlled prompt, timeout. DO NOT use your coding CLI session as the scientific evidence; run actual separate proposals against actual measured experiments.

## Commits and boundaries

Small meaningful commits after each assigned task. Explicit file staging only. Don't squash. No pushes/deployments by child agents; parent handles. Never alter sibling worktrees, private workspace files, credentials, global config, or unrelated processes. Keep runtime/log files untracked. Commit your `docs/<track>-handoff.md` at end listing checks and limitations. Development fixtures must remain labeled. Stop if scientific metric unavailable; don't fabricate.
