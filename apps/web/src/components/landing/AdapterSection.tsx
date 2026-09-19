import CodeBlock from '../common/CodeBlock';

const ADAPTER_SOURCE = `class ScientificAdapter(Protocol):
    """All the harness may know about a backend."""

    def describe(self) -> Capabilities:
        # controls, constraints, observables, units

    def validate(self, config) -> Validation:
        # typed accept or reject, with reasons

    def execute(self, config, budget) -> Handle:
        # run it; persist the outputs unmodified

    def extract_observations(self, outputs) -> Observations:
        # normalised metrics and profiles, with units

    def verification_cases(
        self, candidate, baseline
    ) -> list[CheckSpec]:
        # deterministic checks a claim must survive

    def cancel(self, handle) -> CancelOutcome:
        # explicit outcome, including "not supported"`;

interface IntegrationRow {
  name: string;
  detail: string;
  status: string;
  tone: 'supported' | 'absent';
}

const INTEGRATIONS: IntegrationRow[] = [
  {
    name: 'TORAX',
    detail: 'Magnetically confined plasma — 1D core transport, radial temperature profiles',
    status: 'Supported',
    tone: 'supported',
  },
  {
    name: 'Everything else',
    detail:
      'Any simulator that can answer the six methods above could be attached. None has been, and none is scheduled.',
    status: 'Not implemented',
    tone: 'absent',
  },
];

export default function AdapterSection() {
  return (
    <section className="section adapter" id="adapter" aria-labelledby="adapter-title">
      <div className="shell adapter__grid">
        <div className="adapter__copy">
          <p className="eyebrow">Integration</p>
          <h2 className="section__title" id="adapter-title" style={{ marginTop: 'var(--s-4)' }}>
            One boundary, deliberately narrow
          </h2>
          <p className="prose" style={{ marginTop: 'var(--s-5)', color: 'var(--text-dim)' }}>
            The agent never touches a simulator directly. It sees an adapter that declares what can
            be controlled, in what range, and in which units — and it receives results only through
            an extraction step it cannot rewrite. That boundary is what makes a second scientific
            backend a question of engineering rather than a question of trust.
          </p>
          <p className="prose" style={{ marginTop: 'var(--s-4)', color: 'var(--text-dim)' }}>
            What generalises here is the interface. The working integration is one simulator, and
            the list below says exactly that.
          </p>

          <ul className="adapter__list">
            {INTEGRATIONS.map((row) => (
              <li className={`adapter__row adapter__row--${row.tone}`} key={row.name}>
                <span className="adapter__name">{row.name}</span>
                <span className="adapter__detail">{row.detail}</span>
                <span className="adapter__status">{row.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="adapter__code">
          <CodeBlock caption="scientific adapter v1" code={ADAPTER_SOURCE} copyable={false} />
          <p className="adapter__footnote">
            TORAX solves radial transport, not three-dimensional turbulence. Views built from its
            output are schematic reconstructions of 1D profiles and are labelled as such throughout
            the workspace.
          </p>
        </div>
      </div>
    </section>
  );
}
