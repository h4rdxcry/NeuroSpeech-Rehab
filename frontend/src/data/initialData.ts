import { 
  SpeechExercise, 
  SessionRecord, 
  PatientParticipant, 
  DatasetRecord, 
  RecordingRecord, 
  EvaluationRun, 
  ModelRegistryItem, 
  AnnotationRecord,
  SpeechProgressMetric 
} from '../types';

export const INITIAL_EXERCISES: SpeechExercise[] = [
  {
    id: 'ex-01',
    number: 1,
    phraseTamil: 'வணக்கம்',
    phoneticEnglish: 'Va-nak-kam',
    englishMeaning: 'Hello / Traditional Greeting',
    category: 'Greetings',
    difficulty: 'Gentle',
    guidanceNote: 'Begin with gentle labial closure for "Va", followed by retroflex nasal "na". Focus on natural vocal onset.',
    targetDurationSec: 3.5,
  },
  {
    id: 'ex-02',
    number: 2,
    phraseTamil: 'நன்றி',
    phoneticEnglish: 'Nan-dri',
    englishMeaning: 'Thank you',
    category: 'Greetings',
    difficulty: 'Gentle',
    guidanceNote: 'Alveolar nasal transition to tap/trill "dri". Maintain steady exhalation through the vowel.',
    targetDurationSec: 3.0,
  },
  {
    id: 'ex-03',
    number: 3,
    phraseTamil: 'நான் நலமாக இருக்கிறேன்',
    phoneticEnglish: 'Naan na-la-maa-ga i-ruk-ki-ren',
    englishMeaning: 'I am doing well',
    category: 'Social Conversation',
    difficulty: 'Moderate',
    guidanceNote: 'Multi-word phrasing. Take a calm breath between syllables. Observe soft palate elevation on "ga".',
    targetDurationSec: 5.5,
  },
  {
    id: 'ex-04',
    number: 4,
    phraseTamil: 'தண்ணீர் வேண்டும்',
    phoneticEnglish: 'Than-neer ven-dum',
    englishMeaning: 'I need water',
    category: 'Daily Needs',
    difficulty: 'Gentle',
    guidanceNote: 'Crucial functional phrase. Dental stop "Tha" followed by prolonged vowel "neer" and bilabial "dum".',
    targetDurationSec: 4.0,
  },
  {
    id: 'ex-05',
    number: 5,
    phraseTamil: 'மருந்து எடுத்துக் கொண்டேன்',
    phoneticEnglish: 'Ma-run-dhu e-duth-thuk kon-den',
    englishMeaning: 'I took my medicine',
    category: 'Health & Care',
    difficulty: 'Extended',
    guidanceNote: 'Articulatory sequencing practice. Gentle pacing between "eduthuk" and "konden".',
    targetDurationSec: 6.0,
  },
  {
    id: 'ex-06',
    number: 6,
    phraseTamil: 'எனக்கு உதவி தேவை',
    phoneticEnglish: 'E-nak-ku u-dha-vi the-vai',
    englishMeaning: 'I need help',
    category: 'Daily Needs',
    difficulty: 'Moderate',
    guidanceNote: 'Functional safety phrase. Steady open vowel "E", transition to bilabial "vi" and dental "the-vai".',
    targetDurationSec: 4.5,
  }
];

export const INITIAL_SESSIONS: SessionRecord[] = [
  {
    id: 'sess-108',
    sessionNumber: 108,
    participantId: 'PT-TML-0104',
    patientName: 'P. Ramanathan',
    date: '2026-09-09',
    time: '09:30 AM',
    status: 'completed',
    attemptsCount: 6,
    speechDetectedCount: 6,
    durationMinutes: 14,
    modality: 'multimodal',
    completedExercisesCount: 6,
    totalExercisesCount: 6,
    notes: 'Completed full set with synchronized audio & facial camera positioning. Consistent voicing on all phrases.'
  },
  {
    id: 'sess-107',
    sessionNumber: 107,
    participantId: 'PT-TML-0104',
    patientName: 'P. Ramanathan',
    date: '2026-09-07',
    time: '10:15 AM',
    status: 'completed',
    attemptsCount: 5,
    speechDetectedCount: 4,
    durationMinutes: 12,
    modality: 'multimodal',
    completedExercisesCount: 5,
    totalExercisesCount: 6,
    notes: 'Mild vocal fatigue on phrase 5. Rest period observed between attempts.'
  },
  {
    id: 'sess-106',
    sessionNumber: 106,
    participantId: 'PT-TML-0104',
    patientName: 'P. Ramanathan',
    date: '2026-09-04',
    time: '11:00 AM',
    status: 'completed',
    attemptsCount: 6,
    speechDetectedCount: 5,
    durationMinutes: 16,
    modality: 'audio',
    completedExercisesCount: 6,
    totalExercisesCount: 6,
    notes: 'Baseline session using dedicated desktop microphone. Clean acoustic signal.'
  },
  {
    id: 'sess-109',
    sessionNumber: 109,
    participantId: 'PT-TML-0108',
    patientName: 'M. Shanthi',
    date: '2026-09-10',
    time: '10:00 AM',
    status: 'planned',
    attemptsCount: 0,
    speechDetectedCount: 0,
    durationMinutes: 0,
    modality: 'multimodal',
    completedExercisesCount: 0,
    totalExercisesCount: 6,
    notes: 'Scheduled for morning practice block.'
  },
  {
    id: 'sess-105',
    sessionNumber: 105,
    participantId: 'PT-TML-0102',
    patientName: 'K. Balaji',
    date: '2026-09-02',
    time: '02:30 PM',
    status: 'completed',
    attemptsCount: 6,
    speechDetectedCount: 6,
    durationMinutes: 15,
    modality: 'multimodal',
    completedExercisesCount: 6,
    totalExercisesCount: 6,
    notes: 'Full multimodal session captured. Good mouth aspect ratio tracking.'
  }
];

export const INITIAL_PARTICIPANTS: PatientParticipant[] = [
  {
    id: 'p-01',
    pseudonymId: 'PT-TML-0104',
    enrollmentStatus: 'enrolled',
    consentDate: '2026-06-12',
    cohort: 'Post-Stroke Dysarthria Rehab Cohort A',
    assignedClinician: 'Dr. V. Sundaram, SLP',
    totalSessions: 14,
    completedSessions: 12,
    lastActiveDate: '2026-09-09'
  },
  {
    id: 'p-02',
    pseudonymId: 'PT-TML-0108',
    enrollmentStatus: 'enrolled',
    consentDate: '2026-07-03',
    cohort: 'Post-Stroke Dysarthria Rehab Cohort A',
    assignedClinician: 'Dr. V. Sundaram, SLP',
    totalSessions: 8,
    completedSessions: 7,
    lastActiveDate: '2026-09-08'
  },
  {
    id: 'p-03',
    pseudonymId: 'PT-TML-0102',
    enrollmentStatus: 'enrolled',
    consentDate: '2026-05-20',
    cohort: 'Articulatory Apraxia Research Trial B',
    assignedClinician: 'Dr. S. K. Narayanan, Neurologist',
    totalSessions: 22,
    completedSessions: 20,
    lastActiveDate: '2026-09-02'
  },
  {
    id: 'p-04',
    pseudonymId: 'PT-TML-0115',
    enrollmentStatus: 'local_practice',
    consentDate: '2026-08-14',
    cohort: 'Community Outpatient Tele-Rehab',
    assignedClinician: 'Self-Guided Practice Protocol',
    totalSessions: 5,
    completedSessions: 4,
    lastActiveDate: '2026-09-05'
  }
];

export const INITIAL_DATASETS: DatasetRecord[] = [
  {
    id: 'ds-tml-01',
    name: 'NeuroTamil-Speech-Acoustic-v2',
    version: '2.4.0',
    modality: 'Audio PCM (48kHz, 16-bit Mono)',
    participantCount: 48,
    recordingCount: 720,
    durationHours: 18.5,
    description: 'Acoustic recordings of structured Tamil rehabilitation phrases collected in clinical SLP settings under institutional protocol.',
    sourceOrganization: 'Madras Medical Neuro-Speech Consortium',
    license: 'CC BY-NC-ND 4.0 Research Only',
    accessType: 'Restricted Academic',
    dataClassification: 'REAL',
    qcState: 'QC_PASS',
    splits: { train: 70, val: 15, test: 15 },
    lineage: 'Raw multi-channel capture -> de-noising filter (48kHz) -> phoneme boundary alignment -> automated acoustic quality check.',
    rawJsonMetadata: {
      dataset_doi: '10.5281/zenodo.neurotamil.2026.01',
      ethics_approval: 'IEC-MMC-2025-084',
      primary_language: 'Tamil (ta-IN)',
      speech_sampling_rate_hz: 48000,
      snr_threshold_db: 22.5
    }
  },
  {
    id: 'ds-tml-02',
    name: 'Multimodal-Articulatory-Face-Tamil',
    version: '1.2.0',
    modality: 'Synchronized Multimodal (Audio + 60fps Video)',
    participantCount: 32,
    recordingCount: 450,
    durationHours: 12.0,
    description: 'Frontal video capture with synchronized high-fidelity speech audio for facial articulatory kinematics and mouth aspect ratio analysis.',
    sourceOrganization: 'National Institute of Speech & Hearing Sciences',
    license: 'IRB Restricted Protocol',
    accessType: 'IRB Protocol Only',
    dataClassification: 'REAL',
    qcState: 'QC_PASS',
    splits: { train: 65, val: 15, test: 20 },
    lineage: 'Calibrated rig capture -> frame drop audit -> timecode sync -> facial landmark verification.',
    rawJsonMetadata: {
      camera_resolution: '1920x1080',
      frame_rate_fps: 60,
      audio_sync_drift_ms: 1.4,
      facial_mesh_points: 468
    }
  },
  {
    id: 'ds-tml-03',
    name: 'Synthetic-Dysarthric-Tamil-Bench',
    version: '3.0.1',
    modality: 'Synthesized Acoustic Audio',
    participantCount: 100,
    recordingCount: 1200,
    durationHours: 24.0,
    description: 'Neural vocoder-based acoustic perturbations modeling vowel centralization, syllable prolongation, and imbalanced formants for benchmark testing.',
    sourceOrganization: 'AI-Speech Engineering Laboratory',
    license: 'Open Access Research',
    accessType: 'Open Research',
    dataClassification: 'SYNTHETIC',
    qcState: 'QC_WARNING',
    splits: { train: 80, val: 10, test: 10 },
    lineage: 'Text-to-speech baseline -> articulatory degradation transfer -> acoustic filter bank -> algorithmic QC.',
    rawJsonMetadata: {
      generator_model: 'VocalTractSynth-Tamil-v3',
      jitter_simulation_range: '1.2% - 4.5%',
      shimmer_simulation_range: '3.0% - 9.0%',
      cautionary_note: 'Not real human recordings; strictly for benchmark stress testing.'
    }
  },
  {
    id: 'ds-tml-04',
    name: 'Demo-SingleSubject-Trial',
    version: '1.0.0',
    modality: 'Audio & Visual Features',
    participantCount: 1,
    recordingCount: 12,
    durationHours: 0.4,
    description: 'Pre-flight calibration and hardware integration reference trial recorded during initial workstation deployment.',
    sourceOrganization: 'NeuroSpeech Core Engineering',
    license: 'Internal Project Use',
    accessType: 'Open Research',
    dataClassification: 'DEMO',
    qcState: 'QC_PASS',
    splits: { train: 50, val: 25, test: 25 },
    lineage: 'Standard lab calibration hardware verification trial.',
    rawJsonMetadata: {
      reference_profile: 'Lab-Standard-01',
      device_calibration_valid: true
    }
  }
];

export const INITIAL_RECORDINGS: RecordingRecord[] = [
  {
    id: 'rec-0914',
    sessionId: 'sess-108',
    participantId: 'PT-TML-0104',
    deviceName: 'Focusrite Scarlett Solo + Shure SM7B',
    deviceId: 'hw-audio-slp-01',
    modality: 'Synchronized Multimodal',
    fileFormat: 'WAV (16-bit Linear PCM) + MP4',
    samplingRate: '48,000 Hz',
    channelCount: 1,
    durationSec: 3.42,
    processingStatus: 'completed',
    dataClassification: 'REAL',
    qcStatus: 'QC_PASS',
    sourceHashSha256: '9f8e4a2c1b7d5e3f8a0c2d4b6e8f1a3c5e7b9d0f2a4c6e8b0d2f4a6c8e0b2d4f',
    createdAt: '2026-09-09 09:32:14',
    features: {
      sourceHash: '9f8e4a2c1b7d5e3f8a0c2d4b6e8f1a3c5e7b9d0f2a4c6e8b0d2f4a6c8e0b2d4f',
      computedAt: '2026-09-09 09:32:16',
      f0MeanHz: 124.5,
      f0StdHz: 11.2,
      f1FormantHz: 680,
      f2FormantHz: 1420,
      jitterPercent: 0.82,
      shimmerPercent: 2.14,
      mouthAspectRatioMean: 0.46,
      lipClosureDurationMs: 140,
      mfccCoefficients: [-14.2, 28.5, -4.1, 8.9, -12.4, 5.7, -3.2, 6.1, -1.8, 3.4, -0.9, 2.1, 0.4]
    }
  },
  {
    id: 'rec-0915',
    sessionId: 'sess-108',
    participantId: 'PT-TML-0104',
    deviceName: 'Logitech Brio 4K / USB Audio',
    deviceId: 'hw-web-usb-02',
    modality: 'Audio PCM',
    fileFormat: 'WAV (16-bit PCM)',
    samplingRate: '48,000 Hz',
    channelCount: 1,
    durationSec: 2.95,
    processingStatus: 'completed',
    dataClassification: 'REAL',
    qcStatus: 'QC_PASS',
    sourceHashSha256: '3d5b7f9a1c2e4d6f8b0a2c4e6f8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b',
    createdAt: '2026-09-09 09:34:02',
    features: {
      sourceHash: '3d5b7f9a1c2e4d6f8b0a2c4e6f8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b',
      computedAt: '2026-09-09 09:34:05',
      f0MeanHz: 121.8,
      f0StdHz: 9.8,
      f1FormantHz: 620,
      f2FormantHz: 1390,
      jitterPercent: 0.91,
      shimmerPercent: 2.45,
      mouthAspectRatioMean: 0.42,
      lipClosureDurationMs: 125,
      mfccCoefficients: [-15.1, 26.8, -3.8, 7.6, -11.2, 4.9, -2.8, 5.5, -1.4, 2.9, -0.6, 1.8, 0.2]
    }
  },
  {
    id: 'rec-0902',
    sessionId: 'sess-107',
    participantId: 'PT-TML-0104',
    deviceName: 'Focusrite Scarlett Solo',
    deviceId: 'hw-audio-slp-01',
    modality: 'Audio PCM',
    fileFormat: 'WAV (16-bit Linear PCM)',
    samplingRate: '48,000 Hz',
    channelCount: 1,
    durationSec: 4.88,
    processingStatus: 'completed',
    dataClassification: 'REAL',
    qcStatus: 'QC_PASS',
    sourceHashSha256: '7a1c3e5b7d9f0a2c4e6f8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a',
    createdAt: '2026-09-07 10:19:40',
    features: {
      sourceHash: '7a1c3e5b7d9f0a2c4e6f8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a',
      computedAt: '2026-09-07 10:19:43',
      f0MeanHz: 128.4,
      f0StdHz: 14.6,
      f1FormantHz: 710,
      f2FormantHz: 1530,
      jitterPercent: 1.15,
      shimmerPercent: 2.98,
      mouthAspectRatioMean: 0.49,
      lipClosureDurationMs: 160,
      mfccCoefficients: [-13.7, 30.2, -4.5, 9.4, -13.1, 6.2, -3.7, 6.8, -2.1, 3.8, -1.2, 2.4, 0.6]
    }
  },
  {
    id: 'rec-0881',
    sessionId: 'sess-105',
    participantId: 'PT-TML-0102',
    deviceName: 'Shure MV7 USB',
    deviceId: 'hw-audio-lab-04',
    modality: 'Audio PCM',
    fileFormat: 'WAV (16-bit PCM)',
    samplingRate: '48,000 Hz',
    channelCount: 1,
    durationSec: 5.20,
    processingStatus: 'completed',
    dataClassification: 'REAL',
    qcStatus: 'QC_WARNING',
    sourceHashSha256: '5e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6f8b0d2f4a6c8e',
    createdAt: '2026-09-02 14:35:12',
    features: {
      sourceHash: '5e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6f8b0d2f4a6c8e',
      computedAt: '2026-09-02 14:35:15',
      f0MeanHz: 138.1,
      f0StdHz: 18.2,
      f1FormantHz: 740,
      f2FormantHz: 1610,
      jitterPercent: 1.65,
      shimmerPercent: 3.72,
      mouthAspectRatioMean: 0.51,
      lipClosureDurationMs: 175,
      mfccCoefficients: [-12.9, 31.4, -5.1, 10.1, -14.0, 6.9, -4.2, 7.3, -2.5, 4.2, -1.5, 2.7, 0.8]
    }
  }
];

export const INITIAL_ANNOTATIONS: AnnotationRecord[] = [
  {
    id: 'ann-301',
    recordingId: 'rec-0914',
    sessionId: 'sess-108',
    participantId: 'PT-TML-0104',
    author: 'Dr. V. Sundaram, SLP',
    role: 'Clinical Speech-Language Pathologist',
    type: 'phonetic_boundary',
    timestamp: '2026-09-09 11:20:00',
    value: 'Clear bilabial closure duration measured at 140ms. Retroflex contact intact on syllable 2.'
  },
  {
    id: 'ann-302',
    recordingId: 'rec-0914',
    sessionId: 'sess-108',
    participantId: 'PT-TML-0104',
    author: 'K. Meenakshi, Research Assistant',
    role: 'Acoustic Signal Annotator',
    type: 'signal_quality',
    timestamp: '2026-09-09 11:45:00',
    value: 'Acoustic SNR measured at 26.4 dB. Zero clipped frames across full utterance.'
  },
  {
    id: 'ann-303',
    recordingId: 'rec-0902',
    sessionId: 'sess-107',
    participantId: 'PT-TML-0104',
    author: 'Dr. V. Sundaram, SLP',
    role: 'Clinical Speech-Language Pathologist',
    type: 'articulatory_note',
    timestamp: '2026-09-07 14:10:00',
    value: 'Vowel prolongation observed on final word. Recommended pacing pause between phrases.'
  }
];

export const INITIAL_EVALUATIONS: EvaluationRun[] = [
  {
    id: 'eval-run-2026-08',
    modelVersion: 'Conformer-CTC-Tamil-v2.4',
    datasetName: 'NeuroTamil-Speech-Acoustic-v2',
    split: 'Held-Out Test Set',
    protocol: '5-fold Cross-Validation with Speaker Disjoint Partition',
    sampleCount: 108,
    metrics: {
      cer: 0.084, // 8.4% Character Error Rate
      wer: 0.162, // 16.2% Word Error Rate
      latencyMs: 142,
      sampleLoss: 0.218
    },
    timestamp: '2026-09-05 18:30:00',
    limitationsNote: 'Measured on adult dysarthric speech in controlled acoustic room. Not validated for noisy ambient environments or pediatric cohorts.'
  },
  {
    id: 'eval-run-2026-07',
    modelVersion: 'Conformer-CTC-Tamil-v2.3',
    datasetName: 'NeuroTamil-Speech-Acoustic-v2',
    split: 'Validation Set',
    protocol: 'Standard Speaker-Overlapping Validation',
    sampleCount: 108,
    metrics: {
      cer: 0.106, // 10.6% Character Error Rate
      wer: 0.198, // 19.8% Word Error Rate
      latencyMs: 155,
      sampleLoss: 0.284
    },
    timestamp: '2026-08-22 14:15:00',
    limitationsNote: 'Ablation baseline run without facial visual alignment loss.'
  },
  {
    id: 'eval-run-2026-05',
    modelVersion: 'Whisper-Tamil-Rehab-LoRA-v1.8',
    datasetName: 'Synthetic-Dysarthric-Tamil-Bench',
    split: 'Cross-Subject Split',
    protocol: 'Synthetic Stress-Test Evaluation Suite',
    sampleCount: 240,
    metrics: {
      cer: 0.138, // 13.8% Character Error Rate
      wer: 0.245, // 24.5% Word Error Rate
      latencyMs: 210,
      sampleLoss: 0.365
    },
    timestamp: '2026-08-10 10:00:00',
    limitationsNote: 'Evaluated solely against synthetic perturbation benchmark. Results do not reflect clinical efficacy.'
  }
];

export const INITIAL_MODELS: ModelRegistryItem[] = [
  {
    id: 'mdl-01',
    versionName: 'Conformer-CTC-Tamil-v2.4',
    checkpointName: 'conformer_ctc_tamil_dysarthria_epoch48.pt',
    registeredAt: '2026-09-04',
    trainingDataset: 'NeuroTamil-Speech-Acoustic-v2 (v2.4.0)',
    active: true,
    architecture: 'Hybrid Conformer Encoder + CTC Decoder with Tamil Character Tokenizer',
    parametersMillion: 86.4,
    tamilAcousticContext: 'Optimized for Tamil retroflex consonants (ட், ண், ழ்) and elongated vowel boundaries under dysarthric articulation.',
    technicalNotes: 'Trained with SpecAugment and speed perturbation (0.9x - 1.1x). FP16 precision.'
  },
  {
    id: 'mdl-02',
    versionName: 'Whisper-Tamil-Rehab-LoRA-v1.8',
    checkpointName: 'whisper_small_tamil_rehab_lora_r16.bin',
    registeredAt: '2026-08-15',
    trainingDataset: 'Multimodal-Articulatory-Face-Tamil (v1.2.0)',
    active: false,
    architecture: 'OpenAI Whisper-Small with Low-Rank Adaptation (LoRA rank=16) on cross-attention projection layers',
    parametersMillion: 244.0,
    tamilAcousticContext: 'Standard Whisper Tamil vocabulary with adapted acoustic encoder for slower speech rates.',
    technicalNotes: 'Higher inference latency (~210ms); designated for offline batch research transcripts.'
  },
  {
    id: 'mdl-03',
    versionName: 'Articulatory-FaceMesh-Tracker-v1.1',
    checkpointName: 'mediapipe_facemesh_tamil_lip_closure_v1.onnx',
    registeredAt: '2026-07-28',
    trainingDataset: 'Multimodal-Articulatory-Face-Tamil (v1.2.0)',
    active: true,
    architecture: '468-point 3D Facial Mesh with specialized Mouth Aspect Ratio (MAR) & Lip Velocity Estimator',
    parametersMillion: 12.8,
    tamilAcousticContext: 'Focuses on upper and lower vermilion border tracking to gauge articulatory readiness.',
    technicalNotes: 'Client-side WebAssembly execution (~15ms per frame). Research feedback only.'
  }
];
