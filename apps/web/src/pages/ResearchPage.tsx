import { useEffect, useRef, useState } from 'react';
import type { Recording } from '../types';
import Workspace from '../components/workspace/Workspace';
import { isLiveId, resolveRecording } from '../lib/resolveRecording';
import { useAsync } from '../lib/useAsync';
import { useRoute } from '../lib/router';
import { type Moment, readMoment } from '../lib/shareLink';

/** How often a run held by the local service is re-read while it is open. */
const LIVE_POLL_MS = 5000;

interface ResearchPageProps {
  id: string;
}

export default function ResearchPage({ id }: ResearchPageProps) {
  const live = isLiveId(id);
  const [tick, setTick] = useState(0);
  const [lastGood, setLastGood] = useState<Recording | null>(null);
  const route = useRoute();

  // The opening position is read once per run. Afterwards the URL follows the
  // reader rather than the reverse, so copying a link never rewinds the page.
  const momentFor = useRef<string | null>(null);
  const moment = useRef<Moment>({ sequence: null, node: null });
  if (momentFor.current !== id) {
    momentFor.current = id;
    moment.current = readMoment(route.query);
  }

  useEffect(() => {
    setLastGood(null);
  }, [id]);

  useEffect(() => {
    if (!live) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), LIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [live]);

  const state = useAsync((signal) => resolveRecording(id, signal), [id, tick]);

  useEffect(() => {
    if (state.status === 'ready') setLastGood(state.data);
  }, [state]);

  // Live refreshes keep the last successful read on screen instead of flashing
  // a loading state every few seconds.
  if (state.status === 'loading' && lastGood) {
    return <Workspace initial={moment.current} key={lastGood.id} recording={lastGood} />;
  }

  if (state.status === 'loading') {
    return (
      <div className="shell section" aria-busy="true">
        <p className="label">Loading investigation</p>
        <div className="skeleton" style={{ height: '2.6rem', width: '46%', marginTop: 'var(--s-4)' }} />
        <div className="skeleton" style={{ height: '1rem', width: '66%', marginTop: 'var(--s-4)' }} />
        <div className="skeleton" style={{ height: '46vh', marginTop: 'var(--s-6)' }} />
      </div>
    );
  }

  if (state.status === 'error') {
    if (lastGood) return <Workspace initial={moment.current} key={lastGood.id} recording={lastGood} />;
    return (
      <div className="shell section">
        <div className="notice notice--error" role="alert">
          <p className="label">Investigation unavailable</p>
          <h1 className="notice__title">This run could not be opened</h1>
          <p className="notice__body">
            {live
              ? 'Live runs are read from a research service on this machine. If the service has stopped, the run is not lost — it is simply not readable from here right now.'
              : 'Playback reads saved evidence files directly. When one is missing the page says so rather than showing an approximation of what the run might have contained.'}
          </p>
          <p className="notice__detail">{state.error}</p>
          <div className="notice__actions">
            <a className="btn btn--sm" href="#/research">
              All investigations
            </a>
            <a className="btn btn--sm btn--ghost" href="#/start">
              Run one locally
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <Workspace initial={moment.current} key={state.data.id} recording={state.data} />;
}
