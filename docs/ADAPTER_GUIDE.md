# Connecting an experimental setup

The supported backend today is TORAX. The recording contract and replay UI are independent of that backend; the current execution/orchestration code still contains TORAX-specific settings and verification rules. Adding a different simulator requires code, not merely pasting a URL.

## Responsibilities at the adapter boundary

| Component | Responsibility | Must not do |
|---|---|---|
| Research proposer | Read prior measurements, propose a bounded next experiment and prediction | Edit evaluator or manufacture observations |
| Validator | Enforce allowed variables, fixed controls, units and budgets | Trust model-authored constraints |
| Executor | Run the real simulator or instrument and return durable outputs | Substitute generated example data on failure |
| Extractor | Convert raw outputs into explicitly named units | Silently fill absent measurements |
| Verifier | Apply setup-specific checks and replicate/refine promising outcomes | Equate numerical consistency with physical validation |
| Recorder | Append ordered events, link artifacts and preserve provenance | Rewrite history to hide unsuccessful branches |
| Player | Display only evidence available at the selected event | Infer missing discoveries or future outcomes |

## Minimal integration work

1. Define one reproducible baseline and immutable controls. Choose a measurable objective and meaningful verification procedure before search.
2. Replace the TORAX setting validator and executor behind the same functional boundary. The current implementation is in `services/research/validation.py` and `executor.py`.
3. Implement extraction from your actual raw output, with units, finite-value checks, completion status and hashes.
4. Adapt `Investigation.context()` and the proposer prompt to expose only allowed variables and past evidence. Replace TORAX-specific execution and verification paths in the orchestrator.
5. Export a `Recording` conforming to `contracts/recording.ts` and `contracts/recording.schema.json`. Validate with `python3 scripts/validate_recording.py your-recording.json`.
6. Replace the plasma scene if your experiment is not a tokamak. The event timeline, hypotheses, evidence and verdict structure are reusable; radial plasma frames are currently domain-specific.
7. Add the completed recording and its evidence files to the public catalog only after `python3 scripts/check_public.py` passes.

## First-adapter example

For the fixed-energy TORAX preset, only `heating_location` and `heating_width` vary. `heating_power_mw` and `duration_s` stay frozen. The proposer returns a JSON decision before execution, the validator bounds it, and the evaluator reads `E_fusion` and `E_aux_total` from the generated NetCDF output. Refinement is a separate experiment, not a model's opinion about whether the first result was correct.

A laboratory adapter would additionally need device ownership, interlocks and domain-specific human review. Those capabilities are not part of this hackathon build.
