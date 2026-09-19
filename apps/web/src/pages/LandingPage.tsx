import { useEffect } from 'react';
import Hero from '../components/landing/Hero';
import Showcase from '../components/landing/Showcase';
import LoopSection from '../components/landing/LoopSection';
import AdapterSection from '../components/landing/AdapterSection';
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
      <Showcase />
      <LoopSection />
      <AdapterSection />
    </>
  );
}
