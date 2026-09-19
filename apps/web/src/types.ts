/**
 * Local re-export of the frozen v1 recording contract.
 *
 * The contract itself lives in `contracts/recording.ts` and is coordinator-owned.
 * UI modules import from here so a future path alias is a one-line change.
 */
export type {
  Verdict,
  EventType,
  ResearchEvent,
  ProfileFrame,
  Experiment,
  Hypothesis,
  Recording,
  PlasmaSceneProps,
} from '../../../contracts/recording';

/** Entry in the public `/recordings/index.json` catalogue. */
export interface RecordingSummary {
  id: string;
  title: string;
  description: string;
  path: string;
  mode: 'recorded' | 'live' | 'development-fixture';
  created_at: string;
}
