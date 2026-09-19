import { useReveal } from '../../lib/useReveal';

interface Step {
  title: string;
  body: string;
  /** Fields the harness writes to the event log at this stage. */
  records: string[];
}

const STEPS: Step[] = [
  {
    title: 'Question',
    body:
      'A fixed question, reviewed parameter bounds, an objective with explicit units, and a compute budget. None of these are allowed to move once the run begins.',
    records: ['question', 'bounds', 'objective units', 'budget'],
  },
  {
    title: 'Hypothesis',
    body:
      'The agent states what it believes and what it expects to observe. The prediction is written down before the experiment is executed, not after the number arrives.',
    records: ['hypothesis', 'prediction', 'parent'],
  },
  {
    title: 'Experiment',
    body:
      'The harness validates the request against the schema and the remaining budget. A separate executor runs the simulator and stores its output untouched.',
    records: ['config', 'solver status', 'artifact hash'],
  },
  {
    title: 'Challenge',
    body:
      'Findings are re-run with refined numerics and measured against the baseline and an equal-budget parameter search. Tolerances are set before the results are seen.',
    records: ['checks', 'baseline delta', 'refinement'],
  },
  {
    title: 'Conclusion',
    body:
      'A gate the agent cannot edit decides which claim the evidence permits. "No supported improvement within budget" is a legitimate ending and is recorded as one.',
    records: ['verdict', 'evidence ids', 'limitations'],
  },
];

export default function LoopSection() {
  const reveal = useReveal<HTMLElement>();
  // The rail and the caveat are reached well after the heading, so each waits
  // for its own arrival rather than firing with the section.
  const revealRail = useReveal<HTMLOListElement>();
  const revealCaveat = useReveal<HTMLParagraphElement>();

  return (
    <section className="section loop" id="loop" aria-labelledby="loop-title" ref={reveal}>
      <div className="shell">
        <div className="section__head">
          <p className="eyebrow reveal">How it works</p>
          <h2 className="section__title reveal" id="loop-title">
            Five steps, each one written down
          </h2>
          <p className="section__lede reveal">
            The loop below is the whole product. What makes it a harness rather than a script is
            that step four can send the agent back to step two, and that the record of why is
            preserved either way.
          </p>
        </div>

        <ol className="loop__rail" ref={revealRail}>
          {STEPS.map((step, index) => (
            <li className="loop__step" key={step.title}>
              <span className="loop__node" aria-hidden />
              <span className="loop__ordinal numeric">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="loop__title">{step.title}</h3>
              <p className="loop__body">{step.body}</p>
              <ul className="loop__records">
                {step.records.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p className="loop__caveat prose reveal reveal--self" ref={revealCaveat}>
          An acknowledgement from an API is not an experiment result. Failed, cancelled and
          inconclusive runs stay first-class states in the record, and a summary shown at any point
          in playback uses only the evidence that existed at that point.
        </p>
      </div>
    </section>
  );
}
