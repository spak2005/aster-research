/** Shared v1 contract. Only coordinator edits this file. Values have explicit units. */
export type Verdict = 'proposed'|'running'|'supported'|'refuted'|'inconclusive'|'abandoned';
export type EventType = 'run.started'|'hypothesis.proposed'|'experiment.requested'|'experiment.started'|'experiment.completed'|'experiment.failed'|'assessment.recorded'|'verification.requested'|'verification.completed'|'hypothesis.revised'|'branch.created'|'conclusion.recorded'|'run.completed'|'run.failed'|'run.canceled';
export interface ResearchEvent {
  schema_version: '1.0'; event_id: string; run_id: string; sequence: number;
  timestamp: string; type: EventType; hypothesis_id?: string; experiment_id?: string;
  parent_id?: string; title: string; summary: string; evidence_ids: string[];
  payload: Record<string, unknown>;
}
export interface ProfileFrame {
  time_s: number; rho: number[]; electron_temperature_kev: number[];
  ion_temperature_kev: number[]; fusion_power_mw: number;
  cumulative_fusion_energy_mj: number; cumulative_heating_energy_mj: number;
}
export interface Experiment {
  id: string; hypothesis_id: string; label: string; role: 'baseline'|'candidate'|'verification'|'control';
  status: 'completed'|'failed'|'running';
  config: {heating_location: number; heating_width: number; heating_power_mw: number; duration_s: number; [key:string]:unknown};
  metrics: {fusion_energy_mj: number; heating_energy_mj: number; peak_ion_temperature_kev: number; improvement_pct: number|null; [key:string]:unknown};
  frames: ProfileFrame[]; artifacts: {label:string; path:string; sha256?:string}[];
  checks: {name:string; status:'passed'|'failed'|'pending'|'inconclusive'; detail:string}[];
  wall_time_s: number; error?: string;
}
export interface Hypothesis {
  id: string; parent_id: string|null; title: string; prediction: string;
  status: Verdict; assessment: string; experiment_ids: string[];
  evidence_ids: string[]; created_sequence: number; resolved_sequence?: number;
}
export interface Recording {
  schema_version:'1.0'; id:string; title:string; question:string; created_at:string;
  mode:'recorded'|'live'|'development-fixture'; status:'running'|'completed'|'failed'|'canceled';
  simulator:string; model:string; description:string; limitations:string[];
  provenance:{software_versions:Record<string,string>; seed:number; objective:string; objective_units:string; config_hash:string; raw_artifact_path?:string};
  budget:{max_experiments:number; completed_experiments:number; wall_time_s:number};
  baseline_id:string; best_experiment_id:string|null;
  temperature_scale_kev:[number,number]; geometry:{major_radius_m:number; minor_radius_m:number; elongation:number};
  hypotheses:Hypothesis[]; experiments:Experiment[]; events:ResearchEvent[];
  conclusion:{status:Verdict; title:string; summary:string; evidence_ids:string[]};
}

/** Scene component owned by V. UI passes data; renderer never invents experiment results. */
export interface PlasmaSceneProps {
  experiment:Experiment|null; baseline?:Experiment|null; frameIndex:number;
  temperatureScale:[number,number]; geometry:Recording['geometry'];
  compare?:boolean; reducedMotion?:boolean; className?:string;
}
