# Aster Research

**A question in. Evidence out.**

[Open the public observatory](https://aster-research.vercel.app/) · [Start a local investigation](https://aster-research.vercel.app/#/start)

A bounded scientific research harness with evidence-linked, recorded playback. Its first supported investigation uses the real [TORAX](https://github.com/google-deepmind/torax) tokamak transport simulator to explore heating profiles at a fixed auxiliary-energy budget.

The product is the closed loop: propose a hypothesis, predict an outcome, run an experiment, inspect measured evidence, revise or verify, and preserve what happened. The 3D observatory replays real recorded radial temperature profiles; it does not run physics in the browser.

## Explore a recording locally

Requires Node 22.12 or newer and npm. No model login or Python simulator is required for playback.

```sh
git clone https://github.com/spak2005/aster-research.git
cd aster-research
npm ci
npm run dev
```

Open the URL printed by Vite. A production build is `npm run build`; `npm run preview` serves it locally.

## Run real research locally

Python 3.12, [uv](https://docs.astral.sh/uv/) and an authenticated [Cursor CLI](https://cursor.com/docs/cli/overview) are required for the supported proposer. Credentials stay in Cursor, outside the browser and recordings.

```sh
uv venv --python 3.12
uv pip install --python .venv/bin/python -r requirements.lock.txt
agent login
npm ci
npm run dev:all
```

The API binds only to `127.0.0.1:8765`; the Vite web app proxies `/api`. Use the site's local setup flow to start a bounded investigation. Only one investigation worker runs at a time. The public static site does not expose an unauthenticated compute service.

Scientific execution was measured on an Apple M3 Pro with 18 GB RAM using TORAX 1.4.3. See [feasibility measurements](docs/science/FEASIBILITY.md). Other operating systems have not yet been independently verified.

## Verify evidence

```sh
npm run test:contracts
npm run check
.venv/bin/python -m unittest discover -s tests/research -v
python3 scripts/validate_recording.py your-recording.json
python3 scripts/check_public.py
```

The final command checks every public recording, linked evidence artifact and available SHA-256 hash. Development fixtures live outside public assets and cannot pass public-recording validation.

## Scope and scientific limits

This is one working adapter, not arbitrary research automation. The scenario uses constant transport, frozen current/density and a one-second horizon. A candidate improvement is evidence within this numerical scenario, not a reactor prediction or new physics claim. Refinement is not experimental validation. Initial stored plasma energy means a short-run fusion/input ratio is not a reactor power-balance result.

- [Scientific provenance and visualization limits](docs/SCIENTIFIC_PROVENANCE.md)
- [Connecting another experimental setup](docs/ADAPTER_GUIDE.md)
- [Canonical build plan](CANONICAL_PLAN.html)
- [Shared interface contract](docs/BUILD_CONTRACT.md)

## Architecture

```text
Research question → proposer → validated experiment → TORAX → raw NetCDF
                      ↑                                  ↓
                 prior evidence ← metrics and verification
                                      ↓
                              append-only events
                                      ↓
                          static 3D research replay
```

TORAX and its contributors provide the physics simulator. React, Three.js, React Three Fiber and Vite provide the interface. Aster records concise decision summaries, not private model chain of thought. See the upstream projects for their licenses.
