import RecordingCatalogue from '../recordings/RecordingCatalogue';

export default function Showcase() {
  return (
    <section className="section showcase" id="investigations" aria-labelledby="showcase-title">
      <div className="shell">
        <div className="section__head showcase__head">
          <div>
            <p className="eyebrow">Recorded investigations</p>
            <h2 className="section__title" id="showcase-title" style={{ marginTop: 'var(--s-4)' }}>
              Replay the run, not a highlight reel
            </h2>
          </div>
          <p className="section__lede">
            A published investigation carries its full event log, the saved profiles behind every
            frame, the verification checks each claim had to survive, and hashes for the raw
            simulator output. Playback reads those files directly, so it works with the research
            service stopped and no model credentials present.
          </p>
        </div>

        <RecordingCatalogue />
      </div>
    </section>
  );
}
