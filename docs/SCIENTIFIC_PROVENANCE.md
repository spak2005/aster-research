# What the demonstration establishes

Aster Research is a research orchestration harness. Its first adapter runs real TORAX numerical experiments, preserves evidence, and records model-proposed next steps for deterministic playback. The harness is the submission. The tokamak is its first supported experimental setup.

## Scientific question

Within one frozen TORAX scenario, can changing the radial location and width of auxiliary heating improve integrated simulated fusion energy while holding auxiliary power and duration fixed?

The independent variables are dimensionless heating location and width on normalized radius. The response is TORAX `E_fusion` in joules, converted to MJ. Candidate comparisons hold auxiliary input at 51 MW for 1 simulated second, or 51 MJ. Baseline, candidate and refinement results must be visibly distinguished.

## Model assumptions

The ancestor is TORAX's ITER-hybrid predictor-corrector example. This demonstration uses constant transport, fixed current and density, no pedestal model, a short one-second horizon and a modest radial grid. It does not use QLKNN turbulent transport or evolve full three-dimensional plasma dynamics. See [measured feasibility](science/FEASIBILITY.md) for the exact deviations and measured numerical sensitivity.

Important interpretation:

- Fusion energy is a simulation output, not a measured reactor yield.
- A hot initial plasma already contains thermal energy. Fusion energy divided by auxiliary input over this short transient is not a demonstrated reactor power balance or wall-plug gain.
- A higher objective does not establish stable operation, engineering feasibility, lower cost, or a new physical discovery.
- Grid/time-step refinement measures sensitivity to discretization. It does not validate the model against experiments.
- Constant transport and frozen profiles restrict where findings can be generalized. Any supported conclusion applies only within this scenario and tested bounds.
- The baseline's measured coarse/refined discrepancy is about 1.2%. Smaller candidate differences require especially cautious interpretation; a predeclared 5% screening threshold alone is not sufficient verification.
- Model explanations are hypotheses and evidence summaries, not independent measurements or proof.

## Visual encoding

The 3D torus is an axisymmetric schematic of recorded radial temperature profiles. Camera movement, field-guide lines, lighting and interpolation aid explanation. They are not simulated turbulence, diagnostic imagery, magnetic stability results, or measurements of a real reactor. Heating overlays depict the input parameterization, not a measured heating field. Use a fixed temperature scale for comparisons.

## Research integrity

Preserve proposed hypotheses before their experiments. Preserve failures and inconclusive outcomes. Record model identity, solver/software versions, settings, seeds, numerical checks and artifact hashes. Do not reveal later evidence while replaying an earlier event. Never label a hand-authored fixture as a recorded investigation. Exported artifacts must be sufficient to inspect the reported metric independently.

## Upstream attribution

- [TORAX repository](https://github.com/google-deepmind/torax), Google DeepMind and contributors, Apache 2.0.
- [TORAX documentation](https://torax.readthedocs.io/en/latest/), including installation, example configurations and simulation output definitions.
- [TORAX paper](https://arxiv.org/abs/2406.06718), the scientific description of the differentiable tokamak transport simulator.
- Three.js, React Three Fiber, Drei, React and Vite power the presentation, not the physics evaluator.

Actual research outcomes and artifact locations will be recorded in the completed investigation bundle and release report. Feasibility numbers are not an adaptive-search result.
