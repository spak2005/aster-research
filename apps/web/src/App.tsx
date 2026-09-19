import { useEffect } from 'react';
import SiteHeader from './components/shell/SiteHeader';
import SiteFooter from './components/shell/SiteFooter';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import { useRoute } from './lib/router';
import './styles/shell.css';

export default function App() {
  const route = useRoute();
  const [head] = route.segments;

  // New routes start at the top; in-page section targets are honoured by the page.
  useEffect(() => {
    if (!route.query.get('section')) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route.path]);

  let page = <NotFoundPage path={route.path} />;
  if (head === undefined) {
    page = <LandingPage section={route.query.get('section')} />;
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader path={route.path} />
      <main className="app__main" id="main" tabIndex={-1}>
        {page}
      </main>
      <SiteFooter />
    </div>
  );
}
