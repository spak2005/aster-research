import { useEffect } from 'react';
import Hero from '../components/landing/Hero';
import '../styles/landing.css';

interface LandingPageProps {
  /** Optional in-page target carried by `#/?section=<id>`. */
  section: string | null;
}

export default function LandingPage({ section }: LandingPageProps) {
  useEffect(() => {
    if (!section) return;
    const target = document.getElementById(section);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
  }, [section]);

  return (
    <>
      <Hero />
    </>
  );
}
