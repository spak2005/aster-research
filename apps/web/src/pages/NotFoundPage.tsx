interface NotFoundPageProps {
  path: string;
}

export default function NotFoundPage({ path }: NotFoundPageProps) {
  return (
    <div className="shell section">
      <p className="eyebrow">404</p>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 'var(--s-4)' }}>No route here</h1>
      <p className="prose" style={{ marginTop: 'var(--s-4)' }}>
        Nothing is registered at <code className="numeric">{path}</code>. Investigations live under{' '}
        <code className="numeric">#/research/&lt;id&gt;</code>.
      </p>
      <div style={{ display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-6)' }}>
        <a className="btn" href="#/">
          Back to the overview
        </a>
        <a className="btn btn--ghost" href="#/research">
          Recorded investigations
        </a>
      </div>
    </div>
  );
}
