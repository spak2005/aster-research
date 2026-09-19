import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SHORTCUTS } from './useTransportKeys';

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="keyhelp" role="dialog" aria-modal="true" aria-labelledby="keyhelp-title">
      <div className="keyhelp__scrim" onClick={onClose} />
      <div className="keyhelp__panel panel">
        <div className="keyhelp__head">
          <p className="label" id="keyhelp-title">
            Keyboard
          </p>
          <button
            aria-label="Close keyboard shortcuts"
            className="keyhelp__close"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <dl className="keyhelp__list">
          {SHORTCUTS.map((shortcut) => (
            <div className="keyhelp__row" key={shortcut.keys}>
              <dt className="keyhelp__keys numeric">{shortcut.keys}</dt>
              <dd className="keyhelp__action">{shortcut.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
