import type { VisibleState } from '../../lib/visibility';
import { VERDICT_META } from '../../lib/status';

interface ConclusionProps {
  state: VisibleState;
  onSelectEvidence: (id: string) => void;
}

/**
 * The recorded conclusion, shown only once playback has reached the event that
 * recorded it. Before that point the section says what it is withholding and
 * why, rather than quietly omitting itself.
 */
export default function Conclusion({ state, onSelectEvidence }: ConclusionProps) {
  if (!state.conclusion) {
    return (
      <section className="conclusion conclusion--withheld">
        <p className="label">Conclusion</p>
        <p className="conclusion__withheld-text">
          No conclusion had been recorded at event {state.sequence} of {state.maxSequence}. It is
          withheld here because a summary shown at this point may only use evidence that existed at
          this point. Move the transport to the end of the run to read it.
        </p>
      </section>
    );
  }

  const meta = VERDICT_META[state.conclusion.status];

  return (
    <section className={`conclusion tone-${meta.tone}`}>
      <header className="conclusion__head">
        <p className="label">Conclusion</p>
        <span className="conclusion__verdict" title={meta.description}>
          {meta.label}
        </span>
      </header>
      <h2 className="conclusion__title">{state.conclusion.title}</h2>
      <p className="conclusion__summary">{state.conclusion.summary}</p>

      {state.conclusion.evidence_ids.length > 0 ? (
        <div className="conclusion__evidence">
          <span className="label">Traced to</span>
          <ul>
            {state.conclusion.evidence_ids.map((id) => (
              <li key={id}>
                <button
                  className="conclusion__evidence-key numeric"
                  onClick={() => onSelectEvidence(id)}
                  disabled={!state.experimentById.has(id)}
                >
                  {id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
