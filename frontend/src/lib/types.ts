export type UserRole = "PATIENT" | "CLINICIAN" | "RESEARCHER" | "ADMIN";
export type DataClassification = "REAL" | "SYNTHETIC" | "DEMO";
export type ModalityType = "EEG" | "EMG" | "ECG" | "AUDIO" | "VIDEO_FACIAL" | "OTHER";
export type ProjectUsage = "USED_IN_PROJECT" | "EVALUATED_BUT_NOT_USED" | "REFERENCE_ONLY";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleResponse {
  id: string;
  name: UserRole;
  permissions: string[];
  created_at: string;
}

export interface UserResponse extends Omit<User, "role"> {
  role: RoleResponse | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface Patient {
  id: string;
  user_id: string;
  participant_id?: string | null;
  clinician_id?: string | null;
  date_of_birth?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  exercise_type: string;
  target_modalities: string[];
  difficulty: string;
  duration_seconds?: number;
  repetition_count?: number;
  configuration?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  status: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface Attempt {
  id: string;
  session_exercise_id: string;
  attempt_number: number;
  started_at: string;
  ended_at?: string;
  outcome?: string;
  clinician_rating?: number;
  notes?: string;
  created_at: string;
}

export interface Prediction {
  id: string;
  attempt_id: string;
  recording_id?: string;
  model_id: string;
  model_version: string;
  feature_pipeline_version: string;
  training_dataset_version: string;
  prediction_type: string;
  predicted_label: string;
  confidence?: number;
  uncertainty?: number;
  prediction_json?: Record<string, unknown>;
  signal_quality_state: string;
  signal_quality_details?: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export interface ResearchParticipant {
  id: string;
  pseudonym_id: string;
  demographic_summary?: Record<string, unknown>;
  inclusion_criteria?: Record<string, unknown>;
  exclusion_criteria?: Record<string, unknown>;
  consent_status: string;
  consent_date?: string;
  assigned_clinician_id?: string;
  created_at: string;
}

export interface Session {
  id: string;
  participant_id: string;
  patient_id?: string;
  clinician_id?: string;
  session_date: string;
  session_number: number;
  protocol_id?: string;
  environment?: string;
  notes?: string;
  dataset_split?: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface DatasetProvenance {
  id: string;
  dataset_id: string;
  original_source: string;
  original_dataset_identifier?: string;
  version?: string;
  download_timestamp?: string;
  source_url?: string;
  license_access_info?: string;
  checksum?: string;
  preprocessing_pipeline_version?: string;
  transformations_performed?: string;
  responsible_user_id?: string;
  created_at: string;
}

export interface DatasetSplit {
  id: string;
  dataset_id: string;
  participant_id: string;
  split_type: string;
  split_version?: string;
  is_locked: boolean;
  final_test_flag: boolean;
  created_at: string;
}

export interface DatasetCatalog {
  id: string;
  dataset_id: string;
  modality?: ModalityType;
  source?: string;
  version?: string;
  participants?: number;
  recordings?: number;
  duration?: number;
  population?: string;
  clinical_control?: string;
  license?: string;
  access_requirements?: string;
  project_usage?: ProjectUsage;
  citation?: string;
  url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  session_id: string;
  attempt_id?: string | null;
  session_exercise_id?: string | null;
  modality: ModalityType;
  device_id: string;
  device_name?: string;
  file_path: string;
  file_format: string;
  sampling_rate_hz?: number;
  channel_count?: number;
  channel_names?: string[];
  duration_seconds?: number;
  start_timestamp: string;
  end_timestamp?: string;
  is_synthetic: boolean;
  synthetic_source?: string;
  ground_truth_available: boolean;
  processing_status: string;
  created_at: string;
  participant_pseudonym?: string;
  session_identifier?: string;
  recording_identifier?: string;
  data_classification: DataClassification;
  units?: string;
  source_dataset_id?: string;
  quality_status?: string;
  synchronization_info?: Record<string, unknown>;
}

export interface Dataset {
  id: string;
  name: string;
  version: string;
  description?: string;
  bids_root?: string;
  participant_ids: string[];
  recording_ids: string[];
  split_definition: Record<string, unknown>;
  is_final_test: boolean;
  is_locked: boolean;
  created_by: string;
  created_at: string;
  source_organization?: string;
  source_url?: string;
  citation?: string;
  modality?: ModalityType;
  population_description?: string;
  participant_count?: number;
  recording_count?: number;
  total_duration?: number;
  sampling_information?: string;
  file_format?: string;
  license?: string;
  access_type?: string;
  access_requirements?: string;
  consent_ethics?: string;
  clinical_or_control_population?: string;
  language?: string;
  task_description?: string;
  acquisition_device?: string;
  is_public: boolean;
  is_restricted: boolean;
  is_credentialed: boolean;
  imported_status: string;
  import_date?: string;
  checksum?: string;
  data_classification?: DataClassification;
  notes?: string;
  manifest?: Record<string, unknown>;
  import_error?: string;
  qc_status?: string;
}

export interface Annotation {
  id: string;
  recording_id?: string;
  annotator_id: string;
  annotation_type: string;
  start_timestamp: string;
  end_timestamp?: string;
  label: string;
  confidence?: number;
  notes?: string;
  is_ground_truth: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModelVersion {
  id: string;
  model_name: string;
  version: string;
  model_type: string;
  architecture_json: Record<string, unknown>;
  training_dataset_version: string;
  feature_pipeline_version: string;
  training_params?: Record<string, unknown>;
  performance_metrics?: Record<string, unknown>;
  is_production: boolean;
  is_archived: boolean;
  registered_by: string;
  registered_at: string;
}

export interface EvaluationRun {
  id: string;
  name: string;
  model_version_id: string;
  dataset_version: string;
  dataset_split: string;
  split_definition: Record<string, unknown>;
  metrics: Record<string, unknown>;
  started_at: string;
  completed_at?: string | null;
  notes?: string | null;
}

export interface SignalQuality {
  id: string;
  recording_id: string;
  quality_state: string;
  quality_score?: number | null;
  artifact_ratio?: number | null;
  missing_data_ratio?: number | null;
  rejection_reason?: string | null;
  artifact_indicators?: Record<string, unknown> | null;
  qc_timestamp?: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  result: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type StreamStartMessage = {
  type: "stream_start";
  session_id: string;
  attempt_id: string;
  modality: "AUDIO";
  sample_rate: 16000;
  channels: 1;
  sample_width_bytes: 2;
  encoding: "pcm16";
};

export type WSMessage =
  | { type: "stream_started"; recording_id: string; message: string }
  | { type: "stream_stopped"; recording_id: string; message: string }
  | { type: "status"; status: string; message: string; recording_id?: string; details?: Record<string, unknown> }
  | { type: "prediction"; prediction_id: string; attempt_id: string; recording_id: string; predicted_label: string; model_name: string; model_version: string; model_scope: string; notes: string; prediction_json: Record<string, unknown>; signal_quality_state: string }
  | { type: "error"; message: string; code?: string };
