import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  /** Shown in the block header, e.g. a file name or shell prompt context. */
  caption?: string;
  /** Hides the copy control for blocks that are illustrative rather than runnable. */
  copyable?: boolean;
  className?: string;
}

export default function CodeBlock({ code, caption, copyable = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the text remains selectable either way.
      setCopied(false);
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <figure className={`code${className ? ` ${className}` : ''}`}>
      {caption || copyable ? (
        <figcaption className="code__head">
          <span className="label">{caption}</span>
          {copyable ? (
            <button className="code__copy" onClick={copy} type="button">
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          ) : null}
        </figcaption>
      ) : null}
      <pre className="code__body">
        <code>{code}</code>
      </pre>
      <span aria-live="polite" className="visually-hidden">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </figure>
  );
}
