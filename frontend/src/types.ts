/**
 * @license
 * NeuroSpeech Rehab - Core Types & Research Data Models
 */

export type UserRole = 'patient' | 'clinician' | 'researcher';

export type EnrollmentStatus = 'enrolled' | 'not_enrolled' | 'local_practice';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  participantId?: string;
  enrollmentStatus: EnrollmentStatus;
  studyProtocol?: string;
  assignedClinician?: string;
  streakCount: number;
  longestStreak: number;
  lastPracticeDate?: string; // YYYY-MM-DD
  practiceDates: string[]; // List of YYYY-MM-DD dates practiced
}

export type RehabStage = 'Beginner' | 'Foundation' | 'Intermediate' | 'Advanced Practice' | 'Mastery Practice';

export interface RehabLevel {
  level: number;
  language: 'ta-IN' | 'en-IN';
  languageName: 'தமிழ்' | 'English';
  targetText: string;
  phoneticGuide: string;
  meaning: string;
  stage: RehabStage;
  stageRange: '1-10' | '11-25' | '26-50' | '51-75' | '76-100';
  exerciseType: 'Basic Word' | 'Extended Word' | 'Short Phrase' | 'Functional Sentence' | 'Complex Sentence';
  guidanceTip: string;
  targetDurationSec: number;
}

export interface SpeechExercise {
  id: string;
  number: number;
  phraseTamil: string;
  phoneticEnglish: string;
  englishMeaning: string;
  category: 'Greetings' | 'Daily Needs' | 'Health & Care' | 'Social Conversation' | 'Vowel & Consonant Precision';
  difficulty: 'Gentle' | 'Moderate' | 'Extended';
  guidanceNote: string;
  targetDurationSec: number;
}

export type SessionStatus = 'planned' | 'scheduled' | 'in_progress' | 'completed';

export interface PatientAttempt {
  id: string;
  exerciseId: string;
  timestamp: string;
  transcriptDetected: string;
  speechDetected: boolean;
  durationSeconds: number;
  signalQuality: 'good' | 'fair' | 'poor';
  attemptStatus: 'saved' | 'no_speech' | 'processing';
  modelVersion?: string;
  researchNote?: string;
}

export interface SessionRecord {
  id: string;
  sessionNumber: number;
  participantId: string;
  patientName: string;
  date: string;
  time: string;
  status: SessionStatus;
  attemptsCount: number;
  speechDetectedCount: number;
  durationMinutes: number;
  modality: 'audio' | 'facial_video' | 'multimodal';
  completedExercisesCount: number;
  totalExercisesCount: number;
  notes?: string;
}

export interface SpeechProgressMetric {
  id: string;
  sessionNumber: number;
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Jul 14"
  articulationScore: number; // 0 - 100 (%) Articulation precision
  voicingConsistency: number; // 0 - 100 (%) Phonation continuity
  speechDetectedRate: number; // 0 - 100 (%) Voiced speech detection rate
  durationMinutes: number; // Practice duration in minutes
  attemptsCount: number;
  levelReached: number;
  vowelPurity: number; // 0 - 100 (%) Formant stability
  consonantClarity: number; // 0 - 100 (%) Stop/fricative accuracy
  notes?: string;
}

export type DataClassification = 'REAL' | 'SYNTHETIC' | 'DEMO' | 'UNCLASSIFIED';

export type QcStatus = 'QC_PASS' | 'QC_WARNING' | 'QC_FAIL' | 'UNKNOWN';

export interface RecordingRecord {
  id: string;
  sessionId: string;
  participantId: string;
  deviceName: string;
  deviceId: string;
  modality: 'Audio PCM' | 'Facial Video' | 'Synchronized Multimodal' | 'Facial EMG (Archived)' | 'EEG (Archived)';
  fileFormat: string;
  samplingRate: string;
  channelCount: number;
  durationSec: number;
  processingStatus: 'completed' | 'processing' | 'waiting' | 'failed';
  dataClassification: DataClassification;
  qcStatus: QcStatus;
  sourceHashSha256: string;
  createdAt: string;
  features?: ComputedFeatureSet;
}

export interface ComputedFeatureSet {
  sourceHash: string;
  computedAt: string;
  f0MeanHz: number;
  f0StdHz: number;
  f1FormantHz: number;
  f2FormantHz: number;
  jitterPercent: number;
  shimmerPercent: number;
  mouthAspectRatioMean: number;
  lipClosureDurationMs: number;
  mfccCoefficients: number[];
}

export interface DatasetRecord {
  id: string;
  name: string;
  version: string;
  modality: string;
  participantCount: number;
  recordingCount: number;
  durationHours: number;
  description: string;
  sourceOrganization: string;
  license: string;
  accessType: 'Open Research' | 'Restricted Academic' | 'IRB Protocol Only';
  dataClassification: DataClassification;
  qcState: QcStatus;
  splits: {
    train: number;
    val: number;
    test: number;
  };
  lineage: string;
  rawJsonMetadata?: Record<string, unknown>;
}

export interface AnnotationRecord {
  id: string;
  recordingId: string;
  sessionId: string;
  participantId: string;
  author: string;
  role: string;
  type: 'phonetic_boundary' | 'articulatory_note' | 'signal_quality' | 'clinical_observation';
  timestamp: string;
  value: string;
}

export interface EvaluationRun {
  id: string;
  modelVersion: string;
  datasetName: string;
  split: 'Validation Set' | 'Held-Out Test Set' | 'Cross-Subject Split';
  protocol: string;
  sampleCount: number;
  metrics: {
    cer: number; // Character Error Rate
    wer: number; // Word Error Rate
    latencyMs: number;
    sampleLoss: number;
  };
  timestamp: string;
  limitationsNote: string;
}

export interface ModelRegistryItem {
  id: string;
  versionName: string;
  checkpointName: string;
  checkpointFile?: string;
  registeredAt: string;
  trainingDataset: string;
  active: boolean;
  status?: 'active' | 'archived' | 'experimental';
  architecture: string;
  parametersMillion: number;
  parameters?: string;
  tamilAcousticContext: string;
  technicalNotes: string;
  notes?: string;
}

export interface PatientParticipant {
  id: string;
  pseudonymId: string;
  enrollmentStatus: EnrollmentStatus;
  consentDate: string;
  cohort: string;
  assignedClinician: string;
  totalSessions: number;
  completedSessions: number;
  lastActiveDate: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AccessibilitySettings {
  largerText: boolean;
  higherContrast: boolean;
  reduceMotion: boolean;
  calmMode: boolean;
  verbalConfirmation?: boolean;
}

export interface ConnectionConfig {
  endpointUrl: string;
  status: 'connected' | 'testing' | 'unavailable';
  lastPingMs: number | null;
  serverVersion: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'warning' | 'error' | 'info';
}
