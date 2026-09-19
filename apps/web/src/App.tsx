import { type MouseEvent, useEffect, useRef } from 'react';
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
  const mainRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // New routes start at the top with focus on the content, so a keyboard reader
  // does not traverse the header again after every navigation. In-page section
  // targets are honoured by the page instead.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!route.query.get('section')) window.scrollTo({ top: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [route.path]);

  // The router owns the hash, so the skip link moves focus itself rather than
  // navigating to `#main` and landing on a route that does not exist.
  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    mainRef.current?.focus();
    mainRef.current?.scrollIntoView({ block: 'start' });
  }

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
      <a className="skip-link" href="#main" onClick={skipToContent}>
        Skip to content
      </a>
      <SiteHeader path={route.path} />
      <main className="app__main" id="main" ref={mainRef} tabIndex={-1}>
        {page}
      </main>
      <SiteFooter />
    </div>
  );
}
