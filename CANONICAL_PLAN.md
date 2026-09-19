# AI Science Research Harness: Canonical Build Plan

Version: 1.0 · September 19, 2026
Status: **DRAFT FOR ISRAEL'S REVIEW. Implementation has not started.**
Working descriptor: AI Science Research Harness. Product name and domain are not yet selected; naming must not block implementation.

This is the source of truth for scope, responsibilities, sequencing, and acceptance. Prior brainstorming is background, not additional requirements. After review, preserve this file in the implementation repository as `CANONICAL_PLAN.md`. Update it when decisions change; do not silently expand scope.

## 1. Product and thesis

Connect a research question to scientific tools and let an agent pursue an evidence-backed investigation: propose hypotheses, predict outcomes, run experiments, interpret results, revise or branch, and conclude within a declared budget.

**The product is the harness. TORAX is the first scientific backend and visual demonstration.** A new scientific discovery is a possible outcome, not a condition for a successful submission.

The demo must establish:

1. The system ran a real closed-loop investigation, not a fixed script dressed as an agent.
2. Its next experiment depends on the preceding results.
3. Conclusions trace to executable experiments and explicit verification criteria.
4. The simulator is integrated through a documented adapter boundary.
5. A researcher can understand the investigation and run the supported example themselves.

We can demonstrate one working integration, not claim universal scientific capability. Generalizability comes from the interface design, not a pretend catalog of supported labs.

## 2. User experience

### Public website

- A polished landing page explaining the product in one sentence and showing a compelling actual investigation.
- Primary CTA: **Explore a real investigation**. Opens recorded playback, clearly labeled as recorded.
- Secondary CTA: **Run your own investigation**. Opens the supported plasma experiment setup, explains prerequisites, and provides an actual local launch path.
- A short How it works section: question → hypothesis → experiment → challenge → conclusion.
- A concrete integration section describing the adapter, with TORAX marked supported and other domains described as future integrations, not functioning products.

### Supported start flow

For v1, the public website can serve recordings without running expensive compute. A visitor chooses the supported question and bounded settings, downloads the configuration, and follows the documented local install/run command. The local application additionally has a working **Start investigation** action that creates a real run.

The setup page must explicitly say whether it is connected to a running local backend. When disconnected it offers **Download configuration / Run locally**, never a fake queued job. Hosted authenticated execution is an optional stretch, not necessary for the reviewed MVP.

This is the proposed scope decision for review: **public self-serve playback + supported local execution**, not an unrestricted public cloud research service.

### Investigation workspace

- 3D plasma view, baseline and selected candidate comparison.
- A research tree with explicit parent/child hypotheses and experiments.
- A synchronized timeline with play/pause, scrub, speed controls, and chapter jumps.
- Clear energy input, simulated output, and baseline-relative metrics.
- Evidence panel showing hypothesis, predicted outcome, actual result, verification checks, caveats, and artifacts.
- Overview for the crowd; progressive disclosure for scientific detail.

## 3. Visual direction

Aim for a polished scientific observatory: dark neutral background, disciplined typography, restrained luminous accents, strong depth and readable instrumentation. Avoid tiny unreadable dashboards and gratuitous motion.

### Hero scene

- Cutaway tokamak schematic with a visible plasma volume/surface.
- Map actual radial temperature data onto toroidal geometry; select time from recorded simulation snapshots.
- Show applied heating as a distinguishable overlay representing the configured spatial deposition, not a invented beam-physics simulation.
- Use a consistent temperature color scale for baseline and candidate. Auto-rescaling must not make a worse candidate appear hotter.
- Use a split comparison or synchronized toggles; never render two expensive scenes unnecessarily on low-performance devices.
- Smooth camera transitions at meaningful investigation events, with manual orbit and reset controls.

### Scientific representation boundaries

TORAX supplies radial transport profiles, not a full 3D turbulent-plasma field. Display **schematic 3D reconstruction of simulated radial profiles** in scene information. Decorative particles, if used at all, must not imply tracked physical particles or simulated instability. Do not label results reactor-safe, experimentally validated, globally optimal, or a new discovery without evidence.

### Research tree

Keep the tree as a readable 2D overlay/panel, not a rotating 3D graph. Branch status: proposed, running, supported, refuted, inconclusive, abandoned. Selecting a node selects its scene, metric history, and evidence. It may show a truthful linear investigation if no branching occurred; do not manufacture branches.

### Playback truthfulness

- Recorded-run badge and actual run date always available.
- Distinguish research wall-clock time, simulation physical time, and playback position.
- Interpolated visuals between stored samples are presentation only; metrics come from saved outputs.
- A summary at time T uses only evidence available at T. Do not reveal later conclusions early.
- Replay must work without model credentials, a live model connection, or TORAX installed.

## 4. Scientific demonstration

Question: **At fixed total heating energy, can the system find a heating profile that improves the chosen simulated outcome, and does that improvement survive stricter checks?**

First controlled search uses heating location and width. Freeze total heating power, duration, electron/ion split, geometry, objective, and bounds before the investigation. Candidate parameters must remain within reviewed ranges. Select a documented TORAX configuration and record every nonphysical/demo assumption, including enhanced-resistivity settings if present.

Provisional objective: integrated simulated fusion output over a fixed duration. Validate that the selected configuration exposes this quantity with understood units. If it does not, deliberately revise the plan to a supported temperature-profile objective before running; do not silently substitute a metric.

### The research loop

1. Read the question, adapter capabilities, constraints, budget, and existing evidence.
2. Propose a hypothesis, predicted outcome, and a next experiment or check.
3. Harness validates the request against the schema and budget.
4. Immutable tool executor runs the experiment and records outputs.
5. Agent writes a concise evidence-linked assessment and decides to revise, branch, verify, or stop.
6. Independent claim gate decides the permissible conclusion label.

The research agent is distinct from the coding agents building the product. It gets bounded scientific tools, not general filesystem/shell access to rewrite its judge. No hidden chain-of-thought collection: record short hypotheses, predictions, decisions, and evidence references.

### Verification and baselines

- Check valid inputs, units, fixed energy budget, solver success, finite outputs, and completion of the requested horizon.
- Re-evaluate both baseline and finalist with refined timestep/grid settings and, where supported, another solver.
- Define numerical tolerances and a minimum meaningful improvement before seeing final results.
- Freeze finalist selection before withheld condition perturbations. Do not repeatedly optimize against the final tests.
- Compare with default configuration and equal-budget grid/random search, including verification cost in budget reporting.
- A simple two-parameter sweep may beat the agent. Report that rather than hiding it.
- Numerical convergence verifies consistency within the model, not the correctness of the learned transport physics.

Useful endings include a supported modest improvement, a fragile candidate, an apparent gain rejected by verification, or no supported improvement within budget. All are legitimate records; none should be staged.

## 5. Architecture and ownership boundaries

```text
Public site + replay assets                 Local research application
React / TypeScript / R3F                   Python API + bounded worker
          |                                          |
          +----- versioned recording contract -------+
                                                     |
                                              Research orchestrator
                                                /             \
                                         Model adapter     Scientific adapter
                                                               |
                                                             TORAX
```

Proposed implementation defaults:

- Web: React + TypeScript + Vite; React Three Fiber/Three.js for the scene. Static-exportable for easy public hosting.
- Local API: FastAPI, one research worker, typed request validation.
- Scientific runtime: isolated Python >=3.12 environment with pinned compatible TORAX/JAX dependencies; CPU first on Israel's M3 Pro/18 GB Mac.
- Persistence: append-only JSONL events, immutable per-experiment artifacts, small SQLite run/job index locally.
- Visualization exchange: compact JSON manifest and profile frames. Preserve original scientific output separately; don't ship huge raw arrays in the initial page load.
- Model backend: one working configurable provider/CLI adapter chosen after credential checks. No hard dependency on a particular model brand.
- Public delivery: static website + selected recording assets. Hosting provider/domain selected at release based on available access; no paid provisioning implicit in this planning step.

Suggested repository layout:

```text
CANONICAL_PLAN.md
BUILD_STATUS.md
apps/web/src/{pages,components,scene,replay}/
services/research/{api,orchestrator,models,adapters,verification}/
contracts/{schemas,examples}/
experiments/torax/
recordings/                 # curated manifests/small assets only
tests/{contracts,research,integration}/
docs/{setup,adapter,science,demo}/
```

Create a standalone implementation repository inside the workspace at build start. The surrounding workspace currently has unrelated changes; never stage or commit those. Inspect reuse/licensing before copying from the existing physics-harness repository, and document what predates the hackathon.

## 6. Contracts to freeze before parallel implementation

### Research event v1

Every event includes `schema_version`, `run_id`, monotonic `sequence`, unique `event_id`, timestamp, event type, and typed payload. Relationships use `hypothesis_id`, `experiment_id`, `parent_id`, and evidence IDs as applicable.

Minimum types:

`run.started`, `hypothesis.proposed`, `experiment.requested`, `experiment.started`, `experiment.completed`, `experiment.failed`, `assessment.recorded`, `verification.requested`, `verification.completed`, `hypothesis.revised`, `branch.created`, `conclusion.recorded`, `run.completed`, `run.failed`, `run.canceled`.

An API acknowledgement is not an experiment result. Failed, canceled, and incomplete runs remain first-class states.

### Run recording v1

Manifest includes question, provenance, software/model/config versions, frozen metric definition, units, parameter bounds, budgets, baseline IDs, event index, artifact hashes, profile-frame references, conclusion scope, and limitations.

Profile frames carry physical time, radial coordinate definition, temperature values/units, geometry metadata sufficient for schematic rendering, and available recorded metrics. Renderer does not invent missing fields or compute scientific conclusions.

### Scientific adapter v1

`describe()` → controls, constraints, observables, units, supported checks.

`validate(config)` → typed accepted/rejected result.

`execute(config, budget)` → experiment handle and saved outputs.

`extract_observations(outputs)` → normalized metrics and profiles.

`verification_cases(candidate, baseline)` → deterministic check specifications.

`cancel(handle)` → explicit outcome if supported.

Generic lifecycle states allow future long-running or human-gated experiments. Implement only the TORAX behavior now; don't build laboratory integrations.

### Local API v1

Health/capabilities; list runs; create bounded run from supported preset; read run and cursor-based events; fetch approved artifacts; cancel owned run. Validate all settings server-side. Keep model keys outside recordings/browser bundles. Bind locally by default; no public unauthenticated compute endpoint.

## 7. Build sequence and gates

### Phase 0: prerequisites and feasibility

- Confirm reviewed scope, repository path, GitHub author identity, Cursor authentication, and actual model identifiers.
- Cursor most recently reported not logged in; model access is unverified.
- Install TORAX in an isolated project environment, not system Python.
- Measure cold compile/runtime, warm runtime, peak memory, and output size for baseline plus one changed configuration and one refined run.
- Close other apps only when Israel does so or explicitly instructs us; don't terminate his applications automatically.
- Run a small non-agent sweep to check whether the outcome changes meaningfully.

**Gate A:** chosen metric exists, parameters affect it, scientific outputs are usable, and total proposed run fits measured resource/time budget. If not, stop and propose a bounded alternative; do not spend the remaining build polishing an unusable domain.

### Phase 1: foundations

Freeze schemas, package scaffold, typed examples, and ownership. Create a clearly marked synthetic fixture solely for development. Establish one genuine experiment recording as early as possible.

**Gate B:** Python export loads into the TypeScript player with matching IDs, units, and metrics.

### Phase 2: parallel product construction

Harness, 3D/playback, and website/start flow proceed independently against the frozen contract. Integrate small batches, not three giant final branches.

**Gate C:** one real experiment runs through the backend, appears in the research view, and can be replayed with the backend/model stopped.

### Phase 3: actual investigation

Run a bounded closed loop with sequential simulation execution. Save all experiments. Perform baseline comparisons and verification, then freeze a representative real recording regardless of whether it improves the objective.

**Gate D:** at least one next-step decision responds to actual prior evidence; every displayed finding is backed by artifacts. No fabricated successful branch or unseen future evidence.

### Phase 4: release and demo

Finish the public site, recording delivery, setup instructions, attribution, artifact export, and presentation. Exercise public URL on a separate browser/device; test camera interaction, replay without backend, and local start flow.

**Gate E:** URL reachable, recording genuine and labeled, local setup reproducible, visual performance acceptable, no misleading controls. Publication/repository visibility must follow the approved release scope.

Allocate actual time after checking the remaining submission window and smoke-test timings. Protect the last portion for integration and demo rehearsal rather than allocating it all to extra experiments.

## 8. Cursor agent plan

Use multiple actual Cursor CLI sessions, not native subagents as a silent substitute. Requested model-family assignments are preferences to verify against account availability:

| Owner | Preferred model | Exclusive primary area |
| --- | --- | --- |
| H: research harness | Grok | Python research service, scientific adapter, verifier, experiment recording |
| V: 3D and replay | GPT Astra | Scene components, visual data mapping, playback engine |
| U: website and UX | Claude | Landing, setup flow, workspace shell, evidence/tree presentation |
| I: coordinator | Parent assistant | Contracts, scaffolding, integration, real-run checks, release, canonical plan |

Use separate worktrees/branches so agents cannot stage one another's files. Coordinator owns root configuration and shared contracts. Interface changes require a brief contract update before dependent agents implement against them. Default three concurrent coding sessions, but reduce concurrency if machine pressure affects simulations.

Every agent kickoff includes this plan, owned paths, assigned task IDs, dependencies, acceptance checks, commit rules, and explicit non-goals. Every handoff reports commits, changed interfaces, checks performed, known limitations, and next dependency.

## 9. Fine-grained commit work breakdown

**Target: approximately 64 substantive implementation commits, not a fixed quota.** Each listed item is an intended independently reviewable commit. Split further when there are genuinely separate changes; do not manufacture empty commits, whitespace churn, backdated history, or break working changes merely to increase counts. Necessary fixes are additional real commits. If scope/time requires cuts, remove tasks honestly rather than faking completion.

### I: coordinator/foundations/integration — 16 planned commits

| ID | Commit-sized deliverable | Dependency |
| --- | --- | --- |
| I01 | Initialize standalone repository and preserve approved plan | Review |
| I02 | Establish web/Python scaffold and ignore rules | I01 |
| I03 | Define versioned event schema and lifecycle semantics | I02 |
| I04 | Define recording/profile schema with units and provenance | I03 |
| I05 | Add labeled contract fixtures for branches and failures | I04 |
| I06 | Add cross-language contract validation check | I05 |
| I07 | Document local API and adapter interface | I04 |
| I08 | Add project commands for local web/API development | I02 |
| I09 | Integrate first real experiment recording end-to-end | H06, V03, I06 |
| I10 | Connect setup form to local create-run API | H13, U11 |
| I11 | Integrate research tree, scene, and timeline selection | V12, U12 |
| I12 | Validate genuine run and publish its local replay bundle | H16, V14 |
| I13 | Add deployable static build and recording asset manifest | U15, I12 |
| I14 | Document fresh-clone setup and adapter extension example | H16, I08 |
| I15 | Add scientific attribution and demo provenance report | I12 |
| I16 | Final cross-device fixes and release/runbook checklist | I13–I15 |

### H: Grok / harness — 16 planned commits

| ID | Commit-sized deliverable | Dependency |
| --- | --- | --- |
| H01 | Pin isolated TORAX environment and benchmark command | I02 |
| H02 | Save baseline/warm/refined benchmark measurements | H01 |
| H03 | Implement typed TORAX config validation and bounds | Gate A, I07 |
| H04 | Implement sequential simulator execution and timeouts | H03 |
| H05 | Extract objective metrics with explicit units | H04 |
| H06 | Export profile frames and original-output references | H05, I04 |
| H07 | Implement append-only event/provenance recording | I03, H04 |
| H08 | Add deterministic baseline/random-grid comparison runner | H05 |
| H09 | Add one credential-safe research model adapter | I07 |
| H10 | Implement hypothesis/prediction/experiment decision loop | H07, H09 |
| H11 | Implement evidence-linked revision/branch/stop decisions | H10 |
| H12 | Enforce budgets, failure handling, and cancellation | H10 |
| H13 | Expose local run creation/status/events API | H07, H12 |
| H14 | Implement refinement checks and frozen perturbation cases | H05, H08 |
| H15 | Implement deterministic conclusion gate and critical tests | H11, H14 |
| H16 | Export a genuine completed investigation with analysis | H06, H13, H15 |

### V: Astra / 3D and playback — 16 planned commits

| ID | Commit-sized deliverable | Dependency |
| --- | --- | --- |
| V01 | Establish scene canvas, quality settings, and viewport API | I02 |
| V02 | Build cutaway torus geometry and camera controls | V01 |
| V03 | Implement typed profile-frame loader | I04–I05 |
| V04 | Map radial temperature onto schematic geometry | V02–V03 |
| V05 | Implement stable color scale, units, and legend | V04 |
| V06 | Render heating-profile overlay from recorded config | V04 |
| V07 | Implement baseline/candidate synchronized comparison | V05–V06 |
| V08 | Build deterministic event-to-playback state reducer | I03–I05 |
| V09 | Implement play/pause and selectable speed | V08 |
| V10 | Implement timeline scrubbing and state reconstruction | V09 |
| V11 | Add experiment/verification chapter navigation | V10 |
| V12 | Connect selected tree node to scene and playback state | V07, V11 |
| V13 | Add restrained event-driven camera transitions | V12 |
| V14 | Support lazy-loaded genuine replay assets and error states | I09, V12 |
| V15 | Add responsive quality reduction and WebGL fallback | V14 |
| V16 | Tune visual performance and verify replay determinism | V13–V15 |

### U: Claude / website and UX — 16 planned commits

| ID | Commit-sized deliverable | Dependency |
| --- | --- | --- |
| U01 | Define design tokens, typography, and responsive shell | I02 |
| U02 | Build landing hero and clear product proposition | U01 |
| U03 | Add real-investigation showcase and playback CTA | U02 |
| U04 | Build scientific-loop explanation section | U02 |
| U05 | Build supported-adapter/integration explanation | I07, U04 |
| U06 | Build investigation workspace layout | U01 |
| U07 | Add metric cards and unit-aware comparison charts | I04, U06 |
| U08 | Build research-tree nodes and status styling | I03, U06 |
| U09 | Add evidence panel and linked experiment details | U08 |
| U10 | Add persistent recorded/live mode and provenance labels | U06 |
| U11 | Build bounded preset/budget setup form | I07, U01 |
| U12 | Wire research tree selection through shared view props | U08–U09, V12 |
| U13 | Add backend readiness, queued/running/failure presentation | U11, H13 |
| U14 | Add configuration download and truthful local-run guide | U11, I07 |
| U15 | Add metadata, shareable run routes, and responsive navigation | U03, U10 |
| U16 | Complete keyboard/reduced-motion/mobile UX pass | U12–U15 |

Milestone integration order: contracts → benchmark → first real frame → first full real replay → closed-loop recorded investigation → public release. Agents can develop visuals using labeled fixtures while the harness is being built, but fixtures never become the published research record.

## 10. Commit and GitHub contribution policy

Israel explicitly wants many small commits. Preserve that preference across all agents and merges:

- Commit each completed, meaningful task or smaller coherent unit; do not hold all work for one end-of-session commit.
- Suggested format: `feat(harness): validate heating bounds [H03]` or `feat(scene): map radial temperature data [V04]`.
- Stage explicit owned files; never `git add .` in the shared workspace.
- Use Israel's confirmed repository-local Git author identity and an email associated with his GitHub account. Verify this before implementation commits; do not invent an attribution identity or alter global Git settings.
- Integrate tested branches with history preserved; avoid squash merging when it would collapse these commits.
- Make commits reachable from the intended standalone repository's default branch through the agreed release workflow.
- Push visibility/publication follows Israel's approved build/release scope. Local commits alone do not populate GitHub.
- Keep factual AI/tool attribution in project documentation and any required trailers; agent assignments can also be recorded in task IDs.

GitHub contribution eligibility depends on account-linked commit email, qualifying repository and branch, and other documented conditions. Graph updates may take up to 24 hours; no exact green intensity/count is guaranteed. Sources: [contribution criteria](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference), [missing contributions](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions).

## 11. Tests and final acceptance

Test the important failure modes, not every cosmetic change:

- Malformed config rejected; fixed energy constraint enforced.
- Agent cannot modify evaluator or fabricate an accepted experiment result.
- Budget/timeout/cancellation prevent uncontrolled compute.
- Hypothesis relationships and event sequences validate; replay scrubbing reconstructs the same state.
- Units and selected baseline/candidate match displayed data.
- Failed simulations cannot receive supported-success labels.
- An actual result influences a subsequent model decision.
- Genuine recording plays when all research services and model connections are off.
- Public setup distinguishes local execution from recorded playback and never displays false job progress.
- Website reachable on separate device; scene usable on demo Mac; functional low-performance fallback.
- Shared Git history contains substantive, correctly attributed commits without unrelated workspace/private data.

Visual target: smooth interaction on the demo Mac, aiming for 60 fps and accepting a measured >=30 fps baseline with adaptive quality. Do not sacrifice reliable playback for visual effects. Desktop presentation first; mobile remains usable, not necessarily identical.

## 12. Scope guardrails and cuts

Required: one working TORAX backend, one bounded research question, genuine adaptive loop, evidence ledger, real recorded investigation, attractive truthful 3D replay, public website, supported local start flow, reproducible setup, small commits.

Out of scope: arbitrary researcher onboarding, multiple scientific backends, lab hardware, unlimited public jobs, new foundation-model training, billing, social collaboration, full experiment scheduler, fabricated findings, a universal proof engine, or real 3D plasma turbulence simulation.

Cut first if time is short: decorative effects, elaborate camera choreography, hosted live execution, extra model providers, extra experiment families, cross-run comparisons. Preserve authentic data, reliable playback, the actual local run path, and scientific honesty.

If TORAX fails Gate A, bring the measured blocker and a concrete alternative back to Israel. A different scientific problem materially changes the reviewed demo; do not quietly switch to a toy simulator under TORAX branding.

## 13. Review points and working status

The plan is complete enough to review. Defaults proposed for approval: plasma fixed-energy question; recorded-first public demo; local real-run flow; Grok/Astra/Claude Cursor ownership; approximately 64 substantive commits; no requirement to discover new physics.

Still to resolve during prerequisites: name/domain, actual Cursor model IDs/authentication, GitHub author/account and repository visibility, runtime timings, exact TORAX version/config/objective, research-model credentials, public hosting access.

During implementation maintain `BUILD_STATUS.md` with task IDs, status, commit hashes, checks, blockers, and the next gate. Update this plan's version and decision log for scope changes. Each agent rereads its assigned scope after handoff or context reset.

Decision log:

- v1.0: initial review draft. No implementation, real TORAX experiment, repository publishing, or deployment performed under this plan.

Background: [research recommendation](../../research/ai-science-hackathon/RECOMMENDATION.md). Historical voice-layer plan is shelved and is not part of this product.
