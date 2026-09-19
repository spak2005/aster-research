import { useCallback, useEffect, useState } from 'react';
import { Play, RefreshCw, Square } from 'lucide-react';
import {
  type BackendProbe,
  type CreateRunResponse,
  cancelRun,
  createRun,
  getRun,
  probeBackend,
} from '../../lib/api';
import { type RunConfig, toRequestBody } from '../../lib/runConfig';

type Launch =
  | { state: 'idle' }
  | { state: 'creating' }
  | { state: 'created'; run: CreateRunResponse; status: string; experiments: number | null }
  | { state: 'error'; message: string };

interface BackendStatusProps {
  config: RunConfig;
}

/**
 * Reports whether a research service is actually reachable, and starts a real
 * run when it is.
 *
 * There is no queued-looking state for visitors without a backend: if nothing
 * answers on /api, the page says so and the download path takes over.
 */
export default function BackendStatus({ config }: BackendStatusProps) {
  const [probe, setProbe] = useState<BackendProbe | null>(null);
  const [checking, setChecking] = useState(true);
  const [launch, setLaunch] = useState<Launch>({ state: 'idle' });

  const check = useCallback(async () => {
    setChecking(true);
    const result = await probeBackend();
    setProbe(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Follow a started run until it stops changing state.
  useEffect(() => {
    if (launch.state !== 'created') return undefined;
    const id = launch.run.id;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const recording = await getRun(id);
        if (!active) return;
        setLaunch((current) =>
          current.state === 'created' && current.run.id === id
            ? {
                ...current,
                status: recording.status,
                experiments: recording.budget.completed_experiments,
              }
            : current,
        );
      } catch {
        // A transient read failure is not a run failure; the next tick retries.
      }
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [launch.state, launch.state === 'created' ? launch.run.id : null]);

  async function start() {
    setLaunch({ state: 'creating' });
    try {
      const run = await createRun(toRequestBody(config));
      setLaunch({ state: 'created', run, status: run.status, experiments: null });
    } catch (error) {
      setLaunch({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function stop() {
    if (launch.state !== 'created') return;
    try {
      await cancelRun(launch.run.id);
      setLaunch({ ...launch, status: 'canceling' });
    } catch (error) {
      setLaunch({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const connected = probe?.state === 'connected';

  return (
    <section className={`backend${connected ? ' backend--connected' : ''}`}>
      <header className="backend__head">
        <span className="label">Local research service</span>
        <button className="backend__recheck" onClick={() => void check()} disabled={checking}>
          <RefreshCw size={12} aria-hidden className={checking ? 'backend__spin' : undefined} />
          {checking ? 'Checking' : 'Check again'}
        </button>
      </header>

      {checking && probe === null ? (
        <p className="backend__line">Looking for a service on this machine…</p>
      ) : null}

      {probe?.state === 'connected' ? (
        <>
          <p className="backend__state backend__state--live">
            <span className="backend__dot" aria-hidden />
            Connected · {probe.health.simulator}
          </p>
          <p className="backend__line">
            {probe.health.ready
              ? 'The simulator reports ready. Starting here creates a real run on this machine.'
              : 'The service answered but reports that the simulator is not ready. Starting now may fail; check its logs first.'}
          </p>
        </>
      ) : null}

      {probe?.state === 'absent' ? (
        <>
          <p className="backend__state backend__state--absent">
            <span className="backend__dot" aria-hidden />
            Not connected
          </p>
          <p className="backend__line">
            Nothing answered at <code className="numeric">/api/health</code>. That is expected on the
            public site. Download the configuration below and run it on a machine where the service
            is installed — this page will not pretend to queue a job.
          </p>
        </>
      ) : null}

      {probe?.state === 'error' ? (
        <>
          <p className="backend__state backend__state--absent">
            <span className="backend__dot" aria-hidden />
            Unreadable response
          </p>
          <p className="backend__line">Something answered, but not the research service.</p>
          <p className="notice__detail">{probe.message}</p>
        </>
      ) : null}

      {connected ? (
        <div className="backend__actions">
          <button
            className="btn btn--primary"
            onClick={() => void start()}
            disabled={launch.state === 'creating' || launch.state === 'created'}
          >
            <Play size={15} aria-hidden />
            {launch.state === 'creating' ? 'Creating run…' : 'Start investigation'}
          </button>
          {launch.state === 'created' ? (
            <button className="btn btn--sm" onClick={() => void stop()}>
              <Square size={13} aria-hidden />
              Cancel run
            </button>
          ) : null}
        </div>
      ) : null}

      {launch.state === 'created' ? (
        <div className="backend__run">
          <p className="backend__line">
            <span className="numeric">{launch.run.id}</span> · status{' '}
            <span className="numeric">{launch.status}</span>
            {launch.experiments !== null ? (
              <>
                {' '}
                · <span className="numeric">{launch.experiments}</span> experiments completed
              </>
            ) : null}
          </p>
          <a className="btn btn--sm" href={`#/research/live:${encodeURIComponent(launch.run.id)}`}>
            Open the workspace
          </a>
        </div>
      ) : null}

      {launch.state === 'error' ? (
        <div className="notice notice--error" role="alert">
          <p className="label">Run not created</p>
          <p className="notice__body">
            The service refused the request. Nothing was started, and no partial run exists.
          </p>
          <p className="notice__detail">{launch.message}</p>
        </div>
      ) : null}
    </section>
  );
}
