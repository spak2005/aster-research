import RecordingCatalogue from '../components/recordings/RecordingCatalogue';

export default function ResearchIndexPage() {
  return (
    <div className="shell section">
      <div className="section__head">
        <p className="eyebrow">Investigations</p>
        <h1 className="section__title" style={{ marginTop: 'var(--s-3)' }}>
          Published investigations
        </h1>
        <p className="section__lede">
          Each entry is a complete recorded run: the question it was given, every experiment it
          requested, the checks applied to the results, and the conclusion the evidence supported.
          Open one to step through it at your own pace.
        </p>
      </div>

      <RecordingCatalogue />

      <p className="prose" style={{ marginTop: 'var(--s-7)', color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>
        Looking for your own run instead?{' '}
        <a href="#/start" style={{ color: 'var(--signal)' }}>
          Start one on your machine
        </a>
        .
      </p>
    </div>
  );
}
