import { useState } from 'react';
import SetupForm from '../components/start/SetupForm';
import { DEFAULT_CONFIG, type RunConfig } from '../lib/runConfig';
import '../styles/start.css';

export default function StartPage() {
  const [config, setConfig] = useState<RunConfig>(DEFAULT_CONFIG);

  return (
    <div className="shell section">
      <div className="section__head">
        <p className="eyebrow">Run your own</p>
        <h1 className="section__title" style={{ marginTop: 'var(--s-3)' }}>
          Start an investigation on your machine
        </h1>
        <p className="section__lede">
          Aster runs the simulator locally. This page configures the run, tells you whether a
          research service is actually reachable from here, and gives you the configuration and the
          commands either way.
        </p>
      </div>

      <div className="start__grid">
        <SetupForm config={config} onChange={setConfig} />
        <aside className="start__aside" />
      </div>
    </div>
  );
}
