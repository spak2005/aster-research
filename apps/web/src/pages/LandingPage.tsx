import { useEffect } from 'react';
import Hero from '../components/landing/Hero';
import Showcase from '../components/landing/Showcase';
import LoopSection from '../components/landing/LoopSection';
import AdapterSection from '../components/landing/AdapterSection';
import { SITE_NAME, useDocumentMeta } from '../lib/useDocumentMeta';
import '../styles/landing.css';

interface LandingPageProps {
  /** Optional in-page target carried by `#/?section=<id>`. */
  section: string | null;
}

export default function LandingPage({ section }: LandingPageProps) {
  useDocumentMeta(
    SITE_NAME,
    'Aster gives a research question to an agent with bounded scientific tools and records the whole investigation: hypotheses, simulator runs, verification checks, and the conclusion the evidence supports.',
  );

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
