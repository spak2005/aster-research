# Harness handoff (H)

Owner: H / Cursor Grok. Branch: `build/harness`. No push, no deploy, no parent/sibling edits.

## What landed

H02–H16 on this worktree, then post-review fixes on the same branch. Interpreter: `/Users/israelogbonna/.openclaw/workspace/projects/science-harness/.venv/bin/python` (torax 1.4.3). PYTHONPATH = this worktree. No second venv.

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
| H16 | b4a7e49 | genuine closed-loop recording + handoff |
| H17 | d5d2b16 | bind verification checks to heating+grid |
| H18 | 93facf2 | solver grid metadata and SHA-256 hashes |
| H19 | 6160024 | proposal bounds, baseline fail, worker reserve |
| H20 | a496fc2 | v2 investigation + equal-budget control recording |

Post-review H17–H20 are listed above. v1 scientific result below is unchanged history.

## Parent-facing artifacts

- `docs/science/FEASIBILITY.md` — Gate A, measured.
- `public/recordings/index.json`
- `public/recordings/torax-iterhybrid-baseline-1s.json` — baseline-only snapshot, labeled incomplete.
- `public/recordings/torax-iterhybrid-fixed-energy-v1.json` — genuine 6-experiment investigation, **preserved unchanged** (incomplete verification). SHA-256 `aa19d4eca2ead4586e19c73a9cd6038d89c9b465fa7f121cbdcd1ab65c8eb2b8`.
- `public/recordings/torax-iterhybrid-fixed-energy-v2.json` — genuine 8-experiment investigation with reserved verification. SHA-256 `a619e258f8c55c19755d7836efea392607eb03da253620d6d4f6dc06a25cb944`.
- `public/recordings/torax-iterhybrid-fixed-energy-control-9.json` — deterministic 9-call control, **NO MODEL**. SHA-256 `1be26813bc962f89e68d0bdfe4271b1f729c7b20c4f45278921f29c6230098b6`.
- Local API: `PYTHONPATH=. science-harness/.venv/bin/python -m uvicorn services.research.api:app --host 127.0.0.1 --port 8765`

## Scientific result (honest) — v1, preserved

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

**Gate: `inconclusive`.** Best apparent gain 2.32% is below the frozen 5% threshold (set from Gate A 1.20% grid scatter). Not labeled supported. Remaining verification cases (refined candidate, location perturbation) did not run because the 6-experiment budget was spent. This incomplete verification is kept as history.

## Scientific result (honest) — v2

New unique ID `torax-iterhybrid-fixed-energy-v2`. Total budget 9 = **6 SEARCH** (baseline + candidates) + **3 reserved verification**. Thresholds unchanged (5%, `REFINEMENT_REL_TOL=0.03`, `PERTURBATION_DRHO=0.03`). Finalist frozen before checks. Model `cursor-grok-4.6-high-fast` (no `RESEARCH_MODEL` override). Provenance config SHA-256 `55591163f18b6184e62ceecf00130765616b54c0a930c71b89b67b9baae65c04`.

Search (n_rho=25, χ-prefactor=50, 51 MW × 1.0 s):

1. Baseline ρ=0.127, w=0.073 → **110.361 MJ**
2. Agent: ρ=0.05, w=0.073 → 112.143 MJ (+1.62%)
3. Agent: ρ=0.05, w=0.05 → **112.916 MJ (+2.32%)** — frozen finalist
4. Agent: ρ=0.09, w=0.05 → 112.204 MJ (+1.67%)
5. Agent: ρ=0.07, w=0.05 → 112.595 MJ (+2.02%)

Proposer stopped with 1 SEARCH slot unused. Then reserved checks of the **frozen** finalist (ρ=0.05, w=0.05), not the latest candidate:

6. baseline_refined n_rho=40, χ=25, baseline heating → 109.035 MJ
7. candidate_refined n_rho=40, χ=25, finalist heating → 111.617 MJ
8. location perturbation ρ=0.08, w=0.05, search grid → 112.409 MJ

Each proposal artifact stores the pre-experiment context (including explicit SEARCH remaining) and parsed decision. Raw CLI logs stay under gitignored `runtime/runs/.../logs/`.

**Gate: `inconclusive`.** Best matched-grid gain 2.32% is still below 5%. An inconclusive result is valid. All three predeclared checks ran and matched heating+grid; they do not promote a sub-threshold gain to supported.

## Deterministic control (NO MODEL)

ID `torax-iterhybrid-fixed-energy-control-9`. **Not adaptive research.** `model` = `none (deterministic control)`. Same preset, 51 MW × 1.0 s, seed 11. Allocation **matches v2**: 6 SEARCH solver calls (baseline + 5 grid/random points) + 3 verification of the frozen best search-grid control point. 9 recorded solver calls.

Best control search point was ρ=0.15, w=0.08 → 109.285 MJ (**−0.97%** vs baseline 110.361 MJ). Other grid points were worse. Verification of that control finalist: refined baseline 109.035 MJ, refined control 107.906 MJ, perturbation ρ=0.18 → 108.157 MJ.

**Gate: `inconclusive`.** Do not claim the model beat this control. Both recordings are inconclusive versus the frozen 5% threshold. The agent searched closer to the axis than the control grid (control locations start at 0.15); that is an allocation/search-space difference, not a verified improvement.

## Horizon

Documented ITER-hybrid example is 5 s. All candidates used **1.0 s** at 51 MW, so injected energy is 51 MJ for every run. Documented in FEASIBILITY.md and recording limitations.

Demo assumptions: constant transport (not QLKNN), heat-only evolution, no pedestal, CHEASE ITER-hybrid geometry.

## Checks

```
PYTHONPATH=. parent-.venv/bin/python -m unittest discover -s tests/research
```

56 tests, OK. Added: unrelated refinement and absent perturbation cannot yield supported; `REFINEMENT_REL_TOL` is applied directly; invalid proposals do not consume experiment slots; baseline failure is not a zero reference; 409 create without orphan runs; invalid run IDs rejected before disk lookup.

Parent `scripts/validate_recording.py`: v1, v2, and control JSON all **Valid recording**.

Parent `scripts/check_public.py` reads **parent** `public/`, not this worktree. v2 and control artifact paths are portable under this worktree `public/recordings/<id>/...` with matching SHA-256. v1 JSON still points at `runtime/experiments/...` (unchanged). Copies for parent packaging: `public/recordings/_handoff/MANIFEST.json`.

## v1 raw-file handoff (JSON unchanged)

Parent can rewrite v1 artifact paths after this. Hashes below match the v1 recording.

| original path | handoff copy |
| --- | --- |
| `runtime/experiments/exp-d1c0113135/output.nc` | `public/recordings/_handoff/v1/exp-d1c0113135/output.nc` |
| `runtime/experiments/exp-707c1ced1a/output.nc` | `public/recordings/_handoff/v1/exp-707c1ced1a/output.nc` |
| `runtime/experiments/exp-c807064004/output.nc` | `public/recordings/_handoff/v1/exp-c807064004/output.nc` |
| `runtime/experiments/exp-59e8be0416/output.nc` | `public/recordings/_handoff/v1/exp-59e8be0416/output.nc` |
| `runtime/experiments/exp-c6f1be95ba/output.nc` | `public/recordings/_handoff/v1/exp-c6f1be95ba/output.nc` |
| `runtime/experiments/exp-dd8111db93/output.nc` | `public/recordings/_handoff/v1/exp-dd8111db93/output.nc` |
| `runtime/experiments/baseline-h06/output.nc` | `public/recordings/_handoff/baseline-1s/exp-baseline/output.nc` |

## Limitations

- Mid-step JAX cancel is cooperative; cancel is honored between experiments. Documented on the API (`cancel: cooperative`) and in recordings.
- API binds localhost `127.0.0.1:8765`, one worker. Existing authorization does not permit unlimited compute.
- Proposer needs `agent --trust` on the empty proposer cwd.
- Warm TORAX ~tens of ms after compile; cold import was ~66 s in the first process of the H16 session.
- Peak RSS during Gate A ~1.0–1.2 GiB.
- v1 NetCDF originals also still exist under gitignored `runtime/`; v2/control evidence is packaged under `public/recordings/`.
- Elongation in the recording is a schematic 1.7, not a fitted CHEASE moment.
- Do not treat +2.32% as a physics result. Constant-χ, 1 s, resistivity/current frozen.
- v2 left one SEARCH slot unused because the proposer stopped; verification still consumed the three reserved slots.
- Single-worker create is reserved atomically; GET uses atomic JSON replace so a concurrent read cannot parse a partial snapshot.

## Integration notes

Shared `contracts/recording.ts` was not modified. Recording JSON matches that shape. Scene/UI can load `/recordings/index.json` now. Developer fixtures stay labeled; public files listed above are `mode: recorded`.


## Coordinator packaging update

Original raw-file handoff moved from `_handoff` to `public/recordings/archive`. v1 and baseline artifact URLs now point at those portable copies. All raw hashes remain unchanged. Display titles/descriptions were edited for readability; scientific values and recorded events were not changed. Recording JSON hashes listed above describe the pre-publication metadata version. The current public catalog passes full path/hash validation.
