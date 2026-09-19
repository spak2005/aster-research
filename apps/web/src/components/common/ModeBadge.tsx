import type { Recording } from '../../types';

const COPY: Record<Recording['mode'], { text: string; title: string }> = {
  recorded: {
    text: 'Recorded run',
    title: 'Saved output of a completed investigation. Playback reads stored evidence only.',
  },
  live: {
    text: 'Live local run',
    title: 'Streaming from a research service on this machine. Evidence appears as it is produced.',
  },
  'development-fixture': {
    text: 'Development fixture — not research data',
    title:
      'Synthetic data used to build and test the interface. It is not a scientific result and must never be cited as one.',
  },
};

interface ModeBadgeProps {
  mode: Recording['mode'];
  /** Optional trailing detail, typically the run date. */
  detail?: string;
  className?: string;
}

export default function ModeBadge({ mode, detail, className }: ModeBadgeProps) {
  const copy = COPY[mode];
  return (
    <span
      className={`mode-badge mode-badge--${mode}${className ? ` ${className}` : ''}`}
      title={copy.title}
    >
      <span className="mode-badge__dot" aria-hidden />
      <span className="mode-badge__text">{copy.text}</span>
      {detail ? <span className="mode-badge__detail numeric">{detail}</span> : null}
    </span>
  );
}
