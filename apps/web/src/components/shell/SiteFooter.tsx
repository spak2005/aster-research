export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="site-footer__grid">
          <div>
            <a className="wordmark" href="#/">
              <span className="wordmark__name">ASTER</span>
            </a>
            <p className="site-footer__statement" style={{ marginTop: 'var(--s-4)' }}>
              A harness for evidence-backed machine investigation. Aster runs bounded experiments
              against a real scientific simulator and records every hypothesis, result and check so
              the reasoning can be audited rather than trusted.
            </p>
          </div>

          <div className="site-footer__col">
            <h4>Explore</h4>
            <ul>
              <li>
                <a href="#/research">Recorded investigations</a>
              </li>
              <li>
                <a href="#/start">Run one locally</a>
              </li>
              <li>
                <a href="#/?section=adapter">Adapter interface</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h4>Scientific basis</h4>
            <ul>
              <li>
                <a href="https://github.com/google-deepmind/torax" rel="noreferrer noopener" target="_blank">
                  TORAX transport solver
                </a>
              </li>
              <li>
                <span>Profiles are radial 1D transport output</span>
              </li>
              <li>
                <span>3D views are schematic reconstructions</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer__base">
          <span>Built for questions that can be tested.</span>
          <span className="numeric">Recording contract v1.0</span>
        </div>
      </div>
    </footer>
  );
}
