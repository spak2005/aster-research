# Demonstration runbook

## One-minute story

1. **The product:** Aster is a research harness. It turns a bounded question into experiments, evidence and a recorded investigation that someone else can inspect.
2. **The question:** With the same heating input, does changing where we heat a simulated plasma produce more fusion energy? The scene shows actual TORAX radial temperatures as a labeled 3D schematic.
3. **The closed loop:** Select the broad-heating hypothesis, show its prediction, advance to its measured result, then show how the next model decision changes direction in response. Do not describe a fixed sweep as adaptive research.
4. **The check:** Contrast apparent gains with verification and the predeclared acceptance threshold. In the first six-experiment study, the best apparent gain was 2.32%, so the harness reported no verified improvement. That refusal to overclaim is part of the product.
5. **The portability:** The browser replays recorded evidence without a running model or solver. Open setup to show the supported local-run flow and explain the adapter boundary. Another scientific setup needs its own validator, evaluator and verifier; universal plug-and-play support is not shipped.

## Before presenting

- Load the final public URL and the featured recorded study.
- Keep a local production preview available as a network fallback.
- Confirm the recording is labeled Recorded, not Live or Development fixture.
- Exercise play/pause, timeline scrub, experiment selection, baseline compare and reset view.
- Confirm no later conclusion or result appears before its evidence event.
- Open at least one raw evidence download and verify its listed hash.
- Use the known-good screen size and reduced-motion setting chosen during visual review.
- Do not depend on Cursor, TORAX startup, a fresh model answer or a long compile during judging.

## What not to claim

No new physics, reactor design, net power production, validated turbulent transport, arbitrary-lab integration, or demonstrated superiority to a deterministic search. The evidence supports the narrower statements in each recorded conclusion.

## Commands

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

For live local operation use `npm run dev:all`. Live runs are optional during the demonstration. Cancellation is cooperative between solver experiments.

## Release verification

Run contract tests, replay checks, scene tests and backend tests. Validate the public artifact catalog. Check that the static site works without the local API. Record the actual public URL, source commit and final study ID in the release report before submission.
