# Aster Research — release report

September 19, 2026 · Austin hackathon build

- **Public observatory:** https://spak2005.github.io/aster-research/
- **Featured investigation:** https://spak2005.github.io/aster-research/#/research/torax-iterhybrid-fixed-energy-v2
- **Source:** https://github.com/spak2005/aster-research
- **Release implementation:** `48151a7` (subsequent release notes do not alter implementation).

## Delivered

A bounded scientific-research loop with an actual Cursor proposer, validated TORAX experiments, deterministic verification gates, append-only evidence, a recorded 3D observatory, and a working local-run API/onboarding path. Three parallel Cursor builders used Grok, Claude and GPT Sol; their granular commits are preserved on main and their build branches. Astra was unavailable in the authenticated Cursor model catalog.

Four genuine recordings are published. The first adaptive study, reserved-verification follow-up, deterministic fixed-grid reference, and baseline snapshot are distinguishable; no synthetic data is published as research. Runtime model logs and credentials are excluded.

## Scientific outcome

The featured follow-up used eight simulator experiments within a nine-experiment allowance, reserving refinement and perturbation checks. Its best coarse fusion-energy gain was **2.3155%**. Comparing the refined candidate against the refined baseline gives approximately **2.37%**. This did not meet the predeclared **5%** acceptance threshold; the verdict is **inconclusive**. The fixed-grid reference is a limited control, not evidence of general model superiority.

The scenario uses a one-second horizon, constant transport, frozen current/density and 51 MJ auxiliary heating. Numerical verification is not experimental validation. The 3D torus is a labeled axisymmetric schematic of actual radial profiles, not a 3D turbulence simulation or a reactor power-balance claim.

## Checks completed

- Nine contract validation tests; 59 research/backend tests; five scene/replay tests.
- Actual production-prefix catalog loader test with all four recordings.
- 125 event snapshots checked for deterministic reconstruction and future-evidence leakage.
- All 213 exported profile frames checked independently against raw NetCDF output.
- Public artifact paths and recorded SHA-256 hashes checked.
- TypeScript check and production build; GitHub Pages CI verifies static checks before deploying.
- Real localhost HTTP smoke: a TORAX baseline, single-worker conflict response, and cooperative cancellation. Test-generated runs are isolated from actual runtime results.
- Public desktop browser: actual WebGL canvas, comparison mode, refined matched-baseline metric, playback, pause stability, rewind to event zero without results/conclusion, and no page errors.
- Public mobile emulation at 390 px: pane tabs work, no document horizontal overflow; scene and header visually inspected. Small-screen labeling was subsequently tightened.
- Public setup: no false live compute; real configuration download inspected with the nine-experiment request body. Source/install instructions point to the published repository.

## Operation

Public replay requires no model or simulator. Local execution requires Node 22.12+, Python 3.12, uv, the pinned environment, and Cursor CLI login. Follow the website's **Run locally** flow and run `npm run dev:all` from the checkout.

The only shipped scientific adapter is TORAX. Other laboratories/simulators must implement and validate their own adapter; arbitrary-backend plug-and-play is not claimed. The public site intentionally exposes no compute service. Fresh investigations depend on local Cursor access and may produce different decisions.
