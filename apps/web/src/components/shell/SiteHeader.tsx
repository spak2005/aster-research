import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  /** Route prefix that marks this item as current. */
  match: string;
}

// Single-hash routing means in-page anchors travel as a query parameter.
const NAV: NavItem[] = [
  { label: 'Investigation', href: '#/research', match: '/research' },
  { label: 'How it works', href: '#/?section=loop', match: '__never__' },
  { label: 'Integration', href: '#/?section=adapter', match: '__never__' },
];

interface SiteHeaderProps {
  /** Current route path, e.g. `/`, `/research/abc`, `/start`. */
  path: string;
}

export default function SiteHeader({ path }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the mobile sheet on navigation and on Escape.
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const links = NAV.map((item) => (
    <a
      key={item.label}
      className="site-nav__link"
      href={item.href}
      aria-current={path.startsWith(item.match) ? 'page' : undefined}
    >
      {item.label}
    </a>
  ));

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <a className="wordmark" href="#/" aria-label="Aster Research, home">
          <span className="wordmark__name">ASTER</span>
          <span className="wordmark__kind">Research Harness</span>
        </a>

        <nav className="site-nav" aria-label="Primary">
          {links}
          <a
            className="btn btn--sm site-nav__cta"
            href="#/start"
            aria-current={path.startsWith('/start') ? 'page' : undefined}
          >
            Run locally
          </a>
        </nav>

        <button
          ref={toggleRef}
          className="site-header__toggle"
          aria-expanded={open}
          aria-controls="site-nav-sheet"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </div>

      <div className="site-header__sheet" id="site-nav-sheet" hidden={!open}>
        <nav className="site-nav" aria-label="Primary, mobile">
          {links}
          <a className="btn site-nav__cta" href="#/start">
            Run locally
          </a>
        </nav>
      </div>
    </header>
  );
}
