import { ArrowRight, Terminal } from 'lucide-react';
import TokamakSchematic from './TokamakSchematic';
import { useReveal } from '../../lib/useReveal';

/** Facts about the harness itself, not results. Nothing here is a measurement. */
const FACTS: { label: string; value: string }[] = [
  { label: 'Simulator', value: 'TORAX — 1D core transport' },
  { label: 'Objective', value: 'Declared and frozen before the run' },
  { label: 'Replay', value: 'No model, credentials or solver required' },
];

export default function Hero() {
  const reveal = useReveal<HTMLElement>();

  return (
    <section className="hero" aria-labelledby="hero-title" ref={reveal}>
      <div className="shell hero__inner">
        <div className="hero__copy">
          <p className="eyebrow">Closed-loop scientific investigation</p>

          <h1 className="hero__title" id="hero-title">
            A question in.
            <br />
            <em>Evidence</em> out.
          </h1>

          <p className="hero__lede prose">
            Aster hands a research question to an agent with bounded scientific tools, then records
            the entire investigation — every hypothesis, prediction, simulator run, verification
            check, and the conclusion each one actually earns. You replay the reasoning instead of
            trusting a summary of it.
          </p>

          <div className="hero__actions">
            <a className="btn btn--primary" href="#/research">
              Explore a real investigation
              <ArrowRight size={16} aria-hidden />
            </a>
            <a className="btn" href="#/start">
              <Terminal size={15} aria-hidden />
              Run your own
            </a>
          </div>

          <dl className="hero__facts">
            {FACTS.map((fact) => (
              <div className="hero__fact" key={fact.label}>
                <dt className="label">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="hero__figure">
          <TokamakSchematic className="hero__schematic" />
          <figcaption className="hero__caption">
            <span className="label">Figure 01</span>
            Schematic poloidal cross-section. Flux-surface geometry only — this figure carries no
            simulation output.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
