# Gate A feasibility — TORAX 1.4.3

Measured 2026-09-19 on Israel's M3 Pro (18 GB) using the canonical interpreter
`science-harness/.venv` (`torax==1.4.3`). Single worker. No second environment
was installed. Raw numbers: `docs/science/benchmark-measurements.json`.

## Decision

**Gate A passes.** The chosen metric exists on the real TORAX post-processed
outputs, heating location/width change it at fixed injected energy, profiles are
finite and usable, and a 4–6 experiment sequential loop fits the laptop budget
at a 1.0 s horizon.

This is a feasibility result, not a heating-profile improvement claim.

## Horizon change from the plan

The documented ITER-hybrid example uses `t_final = 5` s. All Gate A and
subsequent candidate comparisons use **`t_final = 1.0` s**. Injected heating
power stays frozen at 51 MW, so heating energy is 51 MJ for every candidate.
The shorter horizon is a compute bound, not a silent metric substitution.

## Objective (verified against TORAX 1.4.3 source)

| Recording field | TORAX field | Units in TORAX | Conversion |
| --- | --- | --- | --- |
| `metrics.fusion_energy_mj` | `PostProcessedOutputs.E_fusion` | J | `/ 1e6` → MJ |
| `frames[].fusion_power_mw` | `PostProcessedOutputs.P_fusion` | W | `/ 1e6` → MW |
| `metrics.heating_energy_mj` | `PostProcessedOutputs.E_aux_total` | J | `/ 1e6` → MJ |

`P_fusion` is documented in TORAX as generated fusion power
`(5 * P_alpha_total)` in watts. `E_fusion` is the time integral of that power
in joules. The harness objective is **integrated `P_fusion` reported in MJ**,
i.e. `E_fusion / 1e6`. These fields were present on the output DataTree
(`has_E_fusion`, `has_P_fusion`, `has_E_aux_total` all true).

## Configuration (demo assumptions, not hidden)

Ancestor: `torax.examples.iterhybrid_predictor_corrector`.

Kept from that example: CHEASE ITER-hybrid geometry (`R=6.2 m`, `a=2.0 m`,
`B_0=5.3 T`), D-T 50/50, Ne impurity, `Z_eff=1.6`, generic_heat
`P_total=51 MW`, `electron_heat_fraction=0.68`, fusion source, linear solver.

Changed for CPU budget and recorded here:

- Transport: **constant**, not QLKNN.
- Evolve ion and electron heat only; current and density frozen.
- No pedestal model.
- Radial grid `n_rho=25` (refinement `n_rho=40`, `chi_timestep_prefactor=25`).
- Horizon 1.0 s as above.

`resistivity_multiplier=200` from the example is unused while current is not
evolved.

## Measurements

First process in this session: `import torax` took **66.2 s**. Later processes
in the same session imported in ~1.2 s (filesystem/JAX cache). Peak RSS during
the three-case benchmark: **0.94–1.17 GiB**.

| Case | location | width | n_rho | wall s | E_fusion MJ | E_aux MJ | T_i peak keV |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline (compile+solve) | 0.127 | 0.073 | 25 | 3.62 (first-ever compile+solve in session was 13.0) | 110.361 | 51.000 | 16.66 |
| changed heating (warm) | 0.400 | 0.150 | 25 | 0.040 | 92.302 | 51.000 | 14.70 |
| refined baseline | 0.127 | 0.073 | 40 | 3.15 | 109.035 | 51.000 | 16.77 |

- Solver status `completed`, `SimError.NO_ERROR`, finite profiles in all three.
- Fixed energy holds: `E_aux_total` = 51.0 MJ on every completed case.
- Heating shape changes the objective: Δ(changed − baseline) = **−18.06 MJ**
  (−16.4%). Off-axis wider heating was worse, not better.
- Refinement vs baseline relative difference: **1.20%**. Any later “supported”
  improvement must exceed this numerical scatter. Provisional threshold:
  **≥ 5% vs baseline** and surviving the refined grid.

Warm 1 s solves are ~40 ms after compile. A 6-experiment loop plus one
refinement is on the order of tens of seconds after the first compile, plus
~1 minute if TORAX has to be imported cold.

## What this does not show

- No agent loop has run yet.
- Constant-χ transport is not QLKNN and is not a claim about turbulent
  transport. Location still matters because fusion reactivity is local and
  nonlinear in temperature.
- 110 MJ of fusion energy in 1 s at 15 keV D-T is a simulated, enhanced-demo
  plasma, not a reactor prediction.
- Do not treat the off-axis decrease as an optimized result; it is a
  one-point sensitivity check.

## Next

Proceed to typed validation, sequential execution, profile-frame export, and a
baseline-only recording so the parent site can load real radial data before the
closed loop finishes.
