import { ArrowUpRight } from 'lucide-react';
import ModeBadge from '../common/ModeBadge';
import { RECORDING_INDEX_URL, fetchRecordingIndex } from '../../lib/recordings';
import { useAsync } from '../../lib/useAsync';
import { formatDate } from '../../lib/format';
import '../../styles/recordings.css';

/** Rows shown while the catalogue is being read. */
function CatalogueSkeleton() {
  return (
    <ul className="run-list" aria-busy="true">
      {[0, 1].map((row) => (
        <li className="run-row run-row--loading" key={row}>
          <span className="skeleton" style={{ height: '0.7rem', width: '4rem' }} />
          <span className="skeleton" style={{ height: '1.35rem', width: `${72 - row * 18}%` }} />
          <span className="skeleton" style={{ height: '0.8rem', width: `${54 - row * 10}%` }} />
        </li>
      ))}
    </ul>
  );
}

export default function RecordingCatalogue() {
  const state = useAsync((signal) => fetchRecordingIndex(signal), []);

  if (state.status === 'loading') {
    return (
      <div>
        <p className="label" style={{ marginBottom: 'var(--s-3)' }}>
          Reading {RECORDING_INDEX_URL}
        </p>
        <CatalogueSkeleton />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="notice notice--error" role="alert">
        <p className="label">Catalogue unreadable</p>
        <h3 className="notice__title">The recording index could not be read</h3>
        <p className="notice__body">
          The site will not substitute stand-in data for a missing investigation, so nothing is
          shown below. The underlying error is printed verbatim:
        </p>
        <p className="notice__detail">{state.error}</p>
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div className="notice notice--signal">
        <p className="label">Catalogue empty</p>
        <h3 className="notice__title">No investigation has been published yet</h3>
        <p className="notice__body">
          <code className="numeric">{RECORDING_INDEX_URL}</code> is written by the harness when a
          completed run is exported, together with its event log, saved profiles and artifact
          hashes. Until a genuine run exists there is nothing truthful to replay here, and this
          build ships no placeholder result in its place.
        </p>
        <div className="notice__actions">
          <a className="btn btn--sm" href="#/start">
            Run an investigation locally
          </a>
          <a className="btn btn--sm btn--ghost" href="#/?section=loop">
            See what a run produces
          </a>
        </div>
      </div>
    );
  }

  return (
    <ul className="run-list">
      {state.data.map((run, index) => (
        <li key={run.id}>
          <a className="run-row" href={`#/research/${encodeURIComponent(run.id)}`}>
            <span className="run-row__index numeric">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="run-row__body">
              <span className="run-row__title">{run.title}</span>
              {run.description ? (
                <span className="run-row__description">{run.description}</span>
              ) : null}
            </span>
            <span className="run-row__meta">
              <ModeBadge mode={run.mode} detail={run.created_at ? formatDate(run.created_at) : undefined} />
              <ArrowUpRight size={16} className="run-row__arrow" aria-hidden />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
