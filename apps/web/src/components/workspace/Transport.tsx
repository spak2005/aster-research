import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { SPEEDS, type Speed, type WorkspaceController } from './useWorkspace';
import { formatClock, formatNumber } from '../../lib/format';

interface TransportProps {
  workspace: WorkspaceController;
}

/**
 * Playback transport over the research event log.
 *
 * Three different clocks are deliberately kept apart: where you are in the
 * recorded reasoning, how long the investigation actually took by then, and
 * which stored simulation sample the plasma view is showing.
 */
export default function Transport({ workspace }: TransportProps) {
  const { visible, chapters } = workspace;
  const span = Math.max(1, visible.maxSequence - visible.minSequence);
  const frame = workspace.selectedExperiment?.result?.frames[workspace.frameIndex] ?? null;
  const lastFrame = workspace.selectedExperiment?.result?.frames.at(-1) ?? null;
  const event = visible.latestEvent;

  return (
    <div className="transport">
      <div className="transport__controls">
        <button
          className="transport__key"
          onClick={() => workspace.jumpChapter(-1)}
          title="Previous chapter (Shift + Left)"
        >
          <ChevronFirst size={16} aria-hidden />
          <span className="visually-hidden">Previous chapter</span>
        </button>
        <button
          className="transport__key"
          onClick={() => workspace.stepSequence(-1)}
          title="Previous event (Left)"
        >
          <ChevronLeft size={16} aria-hidden />
          <span className="visually-hidden">Previous event</span>
        </button>
        <button
          className="transport__key transport__key--play"
          onClick={workspace.togglePlaying}
          title={workspace.playing ? 'Pause (Space)' : 'Play (Space)'}
          aria-pressed={workspace.playing}
        >
          {workspace.playing ? <Pause size={17} aria-hidden /> : <Play size={17} aria-hidden />}
          <span className="visually-hidden">{workspace.playing ? 'Pause' : 'Play'}</span>
        </button>
        <button
          className="transport__key"
          onClick={() => workspace.stepSequence(1)}
          title="Next event (Right)"
        >
          <ChevronRight size={16} aria-hidden />
          <span className="visually-hidden">Next event</span>
        </button>
        <button
          className="transport__key"
          onClick={() => workspace.jumpChapter(1)}
          title="Next chapter (Shift + Right)"
        >
          <ChevronLast size={16} aria-hidden />
          <span className="visually-hidden">Next chapter</span>
        </button>
      </div>

      <div className="transport__track">
        <div className="transport__marks" aria-hidden>
          {chapters.map((chapter) => (
            <span
              key={chapter.sequence}
              className={`transport__mark${
                chapter.sequence <= visible.sequence ? ' transport__mark--passed' : ''
              }`}
              style={{ left: `${((chapter.sequence - visible.minSequence) / span) * 100}%` }}
              title={chapter.title}
            />
          ))}
        </div>
        <input
          className="transport__scrub"
          type="range"
          min={visible.minSequence}
          max={visible.maxSequence}
          step={1}
          value={visible.sequence}
          onChange={(input) => workspace.setSequence(Number(input.target.value))}
          aria-label="Playback position in the research event log"
          aria-valuetext={`Event ${visible.sequence} of ${visible.maxSequence}${
            event ? `: ${event.title}` : ''
          }`}
        />
        <p className="transport__event">
          {event ? (
            <>
              <span className="transport__event-type numeric">{event.type}</span>
              <span className="transport__event-title">{event.title}</span>
            </>
          ) : (
            <span className="transport__event-title">Before the first recorded event</span>
          )}
        </p>
      </div>

      <div className="transport__speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((value: Speed) => (
          <button
            key={value}
            className={`transport__speed-key${workspace.speed === value ? ' is-active' : ''}`}
            onClick={() => workspace.setSpeed(value)}
            aria-pressed={workspace.speed === value}
          >
            {value}×
          </button>
        ))}
      </div>

      <dl className="transport__clocks">
        <div>
          <dt className="label">Position</dt>
          <dd className="numeric">
            {visible.sequence} <span className="transport__of">/ {visible.maxSequence} events</span>
          </dd>
        </div>
        <div>
          <dt className="label">Research time</dt>
          <dd className="numeric">{formatClock(visible.elapsedWallTimeS)}</dd>
        </div>
        <div>
          <dt className="label">Simulation time</dt>
          <dd className="numeric">
            {frame ? `${formatNumber(frame.time_s, 2)} s` : '—'}
            {lastFrame ? (
              <span className="transport__of"> / {formatNumber(lastFrame.time_s, 2)} s</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </div>
  );
}
