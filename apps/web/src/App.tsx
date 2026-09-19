import SiteHeader from './components/shell/SiteHeader';
import SiteFooter from './components/shell/SiteFooter';
import './styles/shell.css';

export default function App() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader path="/" />
      <main className="app__main" id="main" tabIndex={-1}>
        <div className="shell section">
          <p className="eyebrow">Shell</p>
          <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 'var(--s-4)' }}>
            Aster Research
          </h1>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
