import { useEffect } from 'react';
import SiteHeader from './components/shell/SiteHeader';
import SiteFooter from './components/shell/SiteFooter';
import LandingPage from './pages/LandingPage';
import ResearchIndexPage from './pages/ResearchIndexPage';
import ResearchPage from './pages/ResearchPage';
import StartPage from './pages/StartPage';
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
  } else if (head === 'research' && route.segments.length === 1) {
    page = <ResearchIndexPage />;
  } else if (head === 'research' && route.segments.length === 2) {
    page = <ResearchPage id={route.segments[1]} />;
  } else if (head === 'start' && route.segments.length === 1) {
    page = <StartPage />;
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
