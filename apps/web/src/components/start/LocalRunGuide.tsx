import { Download } from 'lucide-react';
import CodeBlock from '../common/CodeBlock';
import { type RunConfig, configFilename, toRequestBody } from '../../lib/runConfig';

interface LocalRunGuideProps {
  config: RunConfig;
}

const STEPS: { title: string; body: string; code?: string; caption?: string }[] = [
  {
    title: 'Create the isolated environment',
    body: 'From a clone of the project, build a project-local Python environment. The pinned lock file keeps the scientific stack at the versions the runs were measured with.',
    caption: 'in the project root',
    code: 'python3.12 -m venv .venv\n.venv/bin/pip install -r requirements.lock.txt',
  },
  {
    title: 'Start the research service',
    body: 'It binds to localhost only. There is no public compute endpoint, and model credentials stay in your environment rather than in any recording or page.',
    caption: 'research service',
    code: '.venv/bin/python -m uvicorn services.research.api:app \\\n  --host 127.0.0.1 --port 8765',
  },
  {
    title: 'Serve the interface',
    body: 'The dev server proxies /api to the service above, so this page will detect it and switch out of download-only mode.',
    caption: 'web interface',
    code: 'npm install\nnpm run dev',
  },
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
        <h2 className="section__title">Four steps, no hosted queue</h2>
        <p className="section__lede">
          Everything below runs on your own machine. The configuration you picked above is the
          entire request body the service accepts, so you can post it directly if you would rather
          not use this page at all.
        </p>
      </div>

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
              Reload this page with the service running and the panel above will offer a real start
              button. Or post the downloaded file yourself — same endpoint, same validation.
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
