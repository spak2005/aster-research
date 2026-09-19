import Workspace from '../components/workspace/Workspace';
import { resolveRecording } from '../lib/resolveRecording';
import { useAsync } from '../lib/useAsync';

interface ResearchPageProps {
  id: string;
}

export default function ResearchPage({ id }: ResearchPageProps) {
  const state = useAsync((signal) => resolveRecording(id, signal), [id]);

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
    return (
      <div className="shell section">
        <div className="notice notice--error" role="alert">
          <p className="label">Investigation unavailable</p>
          <h1 className="notice__title">This run could not be opened</h1>
          <p className="notice__body">
            Playback reads saved evidence files directly. When one is missing the page says so
            rather than showing an approximation of what the run might have contained.
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

  return <Workspace recording={state.data} />;
}
