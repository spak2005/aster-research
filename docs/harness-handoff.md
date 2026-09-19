# Harness handoff (H)

Owner: H / Cursor Grok. Branch: `build/harness`. No push, no deploy, no parent/sibling edits.

## What landed

H02–H16 on this worktree. Interpreter: `/Users/israelogbonna/.openclaw/workspace/projects/science-harness/.venv/bin/python` (torax 1.4.3). PYTHONPATH = this worktree. No second venv.

| ID | Hash | Commit subject |
| --- | --- | --- |
| H02 | 6f27d60 | feat(harness): save TORAX baseline/warm/refined measurements |
| H03 | 6019684 | feat(harness): validate heating bounds and frozen energy |
| H04 | ab20df3 | feat(harness): run TORAX sequentially with timeouts |
| H05 | 407018c | feat(harness): extract fusion energy in MJ from E_fusion |
| H06 | f323f66 | feat(harness): export real TORAX profile frames |
| H07 | 3722c9c | feat(harness): record append-only research events |
| H08 | 85fb20e | feat(harness): add deterministic grid/random heating controls |
| H09 | 31b0bca | feat(harness): add Cursor ask-mode research proposer |
| H10 | 64e6889 | feat(harness): run hypothesis-prediction-experiment loop |
| H11 | 6c48e9a | feat(harness): record revise, branch, and stop decisions |
| H12 | 79f0b95 | feat(harness): enforce experiment budget, failures, and cancel |
| H13 | 139e49a | feat(harness): expose local run creation and events API |
| H14 | 856c66a | feat(harness): add refined-grid and frozen perturbation checks |
| H15 | 4f8d97c | feat(harness): add deterministic conclusion gate |
| H16 | (this commit) | genuine closed-loop recording + handoff |

## Parent-facing artifacts

- `docs/science/FEASIBILITY.md` — Gate A, measured.
- `public/recordings/index.json`
- `public/recordings/torax-iterhybrid-baseline-1s.json` — baseline-only snapshot, labeled incomplete.
- `public/recordings/torax-iterhybrid-fixed-energy-v1.json` — genuine 6-experiment investigation, replayable without TORAX.
- Local API: `PYTHONPATH=. science-harness/.venv/bin/python -m uvicorn services.research.api:app --host 127.0.0.1 --port 8765`

## Scientific result (honest)

Question: fixed 51 MW × 1.0 s heating, can location/width raise integrated `E_fusion`?

Objective field: TORAX `PostProcessedOutputs.E_fusion` [J] → MJ; power is `P_fusion` [W] = `5 * P_alpha_total`.

Closed loop (Cursor `cursor-grok-4.6-high-fast`, `--mode ask`, `--trust`, empty `runtime/proposer`):

1. Baseline ρ=0.127, w=0.073 → **110.361 MJ**
2. Agent: broader w=0.20 at same ρ → 101.735 MJ (−7.8%)
3. Agent: on-axis ρ=0.08 → 111.573 MJ (+1.10%)
4. Agent: ρ=0.05 → 112.143 MJ (+1.62%)
5. Agent: ρ=0.05, w=0.05 → 112.916 MJ (+2.32%)
6. End-of-loop refined baseline n_rho=40 → 109.035 MJ (−1.20% vs search-grid baseline)

Each candidate has a recorded hypothesis and prediction that cites the previous measured number. Next configs were not a hidden sweep.

**Gate: `inconclusive`.** Best apparent gain 2.32% is below the frozen 5% threshold (set from Gate A 1.20% grid scatter). Not labeled supported. Remaining verification cases (refined candidate, location perturbation) did not run because the 6-experiment budget was spent.

## Horizon

Documented ITER-hybrid example is 5 s. All candidates used **1.0 s** at 51 MW, so injected energy is 51 MJ for every run. Documented in FEASIBILITY.md and recording limitations.

Demo assumptions: constant transport (not QLKNN), heat-only evolution, no pedestal, CHEASE ITER-hybrid geometry.

## Checks

```
PYTHONPATH=. .venv-from-parent/bin/python -m unittest discover -s tests/research
```

46 tests, OK. Covers: malformed config / frozen energy, sequential timeout, missing `E_fusion` refusal, event monotonicity, grid-random controls labeled as controls, ask-mode JSON parse, hypothesis-before-experiment, stop/branch, 3–12 budget and cancel, API health/create/events/cancel, verification case freeze, gate refuses failed/unverified/small gains.

API tests call FastAPI handlers directly (`httpx` is not in the lockfile).

## Limitations

- Mid-step JAX cancel is cooperative; cancel is honored between experiments.
- Proposer needs `agent --trust` on the empty proposer cwd.
- Warm TORAX ~40 ms; cold import was 66 s in the first process of this session.
- Peak RSS during Gate A ~1.0–1.2 GiB.
- NetCDF originals live under gitignored `runtime/`; replay JSON carries frames.
- Elongation in the recording is a schematic 1.7, not a fitted CHEASE moment.
- Do not treat +2.32% as a physics result. Constant-χ, 1 s, resistivity/current frozen.

## Integration notes

Shared `contracts/recording.ts` was not modified. Recording JSON matches that shape. Scene/UI can load `/recordings/index.json` now. Developer fixtures stay labeled; these two files are `mode: recorded`.
