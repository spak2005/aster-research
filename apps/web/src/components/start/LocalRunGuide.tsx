import { Download } from 'lucide-react';
import CodeBlock from '../common/CodeBlock';
import { type RunConfig, configFilename, toRequestBody } from '../../lib/runConfig';

interface LocalRunGuideProps {
  config: RunConfig;
}

const STEPS: { title: string; body: string; code?: string; caption?: string }[] = [
  {
    "title": "Get the project and connect the research model",
    "body": "Clone the project and sign in to Cursor CLI. The research proposer uses that local login; credentials are never sent to the browser.",
    "caption": "terminal",
    "code": "git clone https://github.com/spak2005/aster-research.git\ncd aster-research\nagent login"
  },
  {
    "title": "Install the scientific environment",
    "body": "Create a project-local Python 3.12 environment and install the pinned scientific stack. uv can install the required Python version for you.",
    "caption": "in the project root",
    "code": "uv venv --python 3.12\nuv pip install --python .venv/bin/python -r requirements.lock.txt"
  },
  {
    "title": "Start Aster locally",
    "body": "This launches the local research service and the website together. Open the address printed by Vite in your terminal.",
    "caption": "in the project root",
    "code": "npm ci\nnpm run dev:all"
  }
];

export default function LocalRunGuide({ config }: LocalRunGuideProps) {
  const body = toRequestBody(config);
  const filename = configFilename(config);

  function download() {
    const blob = new Blob([`${JSON.stringify(body, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="guide">
      <div className="section__head">
        <p className="eyebrow">Run it locally</p>
        <h2 className="section__title">Run your first investigation</h2>
        <p className="section__lede">
          Everything below runs on your own machine. The configuration you picked above is the
          supported request body, so you can also post it directly to the local service.
        </p>
      </div>

      <p className="setup__hint">
        Prerequisites: <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">Node.js 22.12+</a>,{' '}
        <a href="https://docs.astral.sh/uv/getting-started/installation/" target="_blank" rel="noreferrer">uv</a>, and{' '}
        <a href="https://cursor.com/docs/cli/installation" target="_blank" rel="noreferrer">Cursor CLI</a>.
        {' '}<a href="https://github.com/spak2005/aster-research" target="_blank" rel="noreferrer">View the source</a>.
      </p>
      <div className="guide__config">
        <CodeBlock caption={filename} code={JSON.stringify(body, null, 2)} />
        <div className="guide__config-actions">
          <button className="btn" onClick={download} type="button">
            <Download size={15} aria-hidden />
            Download configuration
          </button>
          <p className="setup__hint">
            Saved as <code className="numeric">{filename}</code>. It contains no credentials and no
            machine-specific paths.
          </p>
        </div>
      </div>

      <ol className="guide__steps">
        {STEPS.map((step, index) => (
          <li className="guide__step" key={step.title}>
            <span className="guide__ordinal numeric">{String(index + 1).padStart(2, '0')}</span>
            <div className="guide__step-body">
              <h3 className="guide__step-title">{step.title}</h3>
              <p className="guide__step-text">{step.body}</p>
              {step.code ? <CodeBlock caption={step.caption} code={step.code} /> : null}
            </div>
          </li>
        ))}

        <li className="guide__step">
          <span className="guide__ordinal numeric">04</span>
          <div className="guide__step-body">
            <h3 className="guide__step-title">Start the investigation</h3>
            <p className="guide__step-text">
              In the local website, open Run locally and choose Start investigation. Or run the
              command below from the folder containing your downloaded configuration.
            </p>
            <CodeBlock
              caption="direct request"
              code={`curl -X POST http://127.0.0.1:8765/api/runs \\\n  -H 'content-type: application/json' \\\n  -d @${filename}`}
            />
          </div>
        </li>
      </ol>

      <p className="guide__caveat">
        Each experiment executes the simulator once, on CPU. Wall time depends on your machine and
        is recorded with the run rather than estimated here. A run that fails, is cancelled, or ends
        without a supported improvement is saved and replayable exactly like any other.
      </p>
    </section>
  );
}
