import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { navigate } from '../../lib/router';
import { absoluteHref, momentHash } from '../../lib/shareLink';

interface ShareMomentProps {
  runId: string;
  sequence: number;
  nodeId: string | null;
}

type Result = 'idle' | 'copied' | 'manual';

/**
 * Copies a link to the exact event position and selection currently on screen.
 * The address bar is updated either way, so the link is still obtainable when
 * the clipboard is unavailable (insecure origins, permission denied).
 */
export default function ShareMoment({ runId, sequence, nodeId }: ShareMomentProps) {
  const [result, setResult] = useState<Result>('idle');

  useEffect(() => {
    if (result === 'idle') return undefined;
    const timer = window.setTimeout(() => setResult('idle'), 2600);
    return () => window.clearTimeout(timer);
  }, [result]);

  async function share() {
    const hash = momentHash(runId, sequence, nodeId);
    navigate(hash, { replace: true });
    try {
      await navigator.clipboard.writeText(absoluteHref(hash));
      setResult('copied');
    } catch {
      setResult('manual');
    }
  }

  return (
    <div className="share">
      <button className="btn btn--sm btn--ghost" onClick={share} type="button">
        {result === 'copied' ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
        Link this moment
      </button>
      <p aria-live="polite" className="share__status">
        {result === 'copied' ? `Copied · event ${sequence}` : null}
        {result === 'manual' ? 'Clipboard blocked — the link is in the address bar' : null}
      </p>
    </div>
  );
}
