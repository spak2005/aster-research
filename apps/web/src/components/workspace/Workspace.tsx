import { useEffect } from 'react';
import type { Recording } from '../../types';
import { setRunBadge } from '../../lib/runBadge';
import ModeBadge from '../common/ModeBadge';
import { useWorkspace } from './useWorkspace';
import Transport from './Transport';
import ResearchTree from './ResearchTree';
import EvidencePanel from './EvidencePanel';
import Dossier from './Dossier';
import ScenePane from './ScenePane';
import ShareMoment from './ShareMoment';
import type { Moment } from '../../lib/shareLink';
import { formatDate } from '../../lib/format';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import '../../styles/workspace.css';

interface WorkspaceProps {
  recording: Recording;
  /** Opening position carried by a shared link, if any. */
  initial?: Moment;
}

/**
 * Three-pane research console: reasoning on the left, the physical picture in
 * the middle, evidence on the right, transport underneath. Below it the page
 * continues into a longer-form dossier for detail that does not belong in a
 * fixed-height panel.
 */
export default function Workspace({ recording, initial }: WorkspaceProps) {
  // The question, never the conclusion: the page may still be withholding it.
  useDocumentMeta(recording.title, recording.question);

  // Keep the recorded/live label and run date in the site header while open.
  useEffect(() => {
    setRunBadge({
      mode: recording.mode,
      createdAt: recording.created_at,
      title: recording.title,
    });
    return () => setRunBadge(null);
  }, [recording.id, recording.mode, recording.created_at, recording.title]);

  const workspace = useWorkspace(recording, initial);
  const { visible } = workspace;
  const selectedHypothesis =
    visible.hypotheses.find((item) => item.id === workspace.selectedHypothesisId) ?? null;

  return (
    <div className="workspace">
      <header className="workspace__head shell">
        <div className="workspace__identity">
          <ModeBadge mode={recording.mode} detail={formatDate(recording.created_at)} />
          <h1 className="workspace__title">{recording.title}</h1>
          <p className="workspace__question">{recording.question}</p>
        </div>
        <ShareMoment
          nodeId={workspace.selectedNodeId}
          runId={recording.id}
          sequence={workspace.sequence}
        />
      </header>

      <div className="workspace__console">
        <aside className="workspace__pane workspace__pane--tree" aria-label="Research tree">
          <p className="label workspace__pane-label">
            Research tree · {visible.hypotheses.length} visible
          </p>
          <ResearchTree
            state={visible}
            selectedHypothesisId={workspace.selectedHypothesisId}
            selectedExperimentId={workspace.selectedExperimentId}
            onSelect={workspace.select}
          />
        </aside>

        <section className="workspace__pane workspace__pane--scene" aria-label="Plasma view">
          <ScenePane recording={recording} workspace={workspace} />
        </section>

        <aside className="workspace__pane workspace__pane--evidence" aria-label="Evidence">
          <p className="label workspace__pane-label">
            Evidence available at event {visible.sequence}
          </p>
          <EvidencePanel
            recording={recording}
            state={visible}
            hypothesis={selectedHypothesis}
            experiment={workspace.selectedExperiment}
          />
        </aside>
      </div>

      <div className="workspace__transport">
        <Transport workspace={workspace} />
      </div>

      <Dossier recording={recording} workspace={workspace} />
    </div>
  );
}
