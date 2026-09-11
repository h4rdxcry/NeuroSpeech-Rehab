/**
 * NeuroSpeech Rehab - Client-Side Visual Lip-Reading & Viseme Sequence Decoder
 * 
 * Provides continuous real-time visual speech recognition directly from facial
 * kinematics (aperture, width, bilabial closure, labiodental tuck, and vowel elongation).
 * Translates articulatory movement trajectories into Viseme sequences and decodes
 * words using Continuous Dynamic Time Warping (DTW) alignment.
 */

import { EMPIRICAL_VISEME_PRIORS, EMPIRICAL_TRANSITION_MATRIX } from './empiricalVisemePriors';

export enum VisemeClass {
  BILABIAL = 0,        // /p, b, m/ -> Closed lips (aperture < 0.045)
  LABIODENTAL = 1,     // /f, v/ -> Lower lip tuck (aperture 0.045-0.085)
  DENTAL_ALVEOLAR = 2, // /t, d, s, z, n, l/ -> Teeth slit, neutral width
  VELAR_PALATAL = 3,   // /k, g, c, j/ -> Back constriction, mid aperture
  OPEN_VOWEL = 4,      // /a, aa/ -> High vertical aperture (> 0.16)
  SPREAD_VOWEL = 5,    // /i, e, ee/ -> High horizontal stretch (widthRatio > 1.04)
  ROUNDED_VOWEL = 6,   // /u, o, oo/ -> Pursing/rounding (widthRatio < 0.86, aperture > 0.05)
  NEUTRAL_REST = 7     // Rest / silence
}

export const VISEME_LABELS: Record<VisemeClass, string> = {
  [VisemeClass.BILABIAL]: 'Bilabial Seal [p, b, m]',
  [VisemeClass.LABIODENTAL]: 'Labiodental [f, v]',
  [VisemeClass.DENTAL_ALVEOLAR]: 'Dental / Slit [t, d, s, n]',
  [VisemeClass.VELAR_PALATAL]: 'Velar / Mid [k, g]',
  [VisemeClass.OPEN_VOWEL]: 'Open Vowel [a, aa]',
  [VisemeClass.SPREAD_VOWEL]: 'Spread [i, e]',
  [VisemeClass.ROUNDED_VOWEL]: 'Rounded [o, u]',
  [VisemeClass.NEUTRAL_REST]: 'Neutral / Rest'
};

export const VISEME_SHORT_CODES: Record<VisemeClass, string> = {
  [VisemeClass.BILABIAL]: 'BILABIAL',
  [VisemeClass.LABIODENTAL]: 'LABIODENTAL',
  [VisemeClass.DENTAL_ALVEOLAR]: 'DENTAL',
  [VisemeClass.VELAR_PALATAL]: 'VELAR',
  [VisemeClass.OPEN_VOWEL]: 'OPEN_VOWEL',
  [VisemeClass.SPREAD_VOWEL]: 'SPREAD',
  [VisemeClass.ROUNDED_VOWEL]: 'ROUNDED',
  [VisemeClass.NEUTRAL_REST]: 'REST'
};

export interface FrameArticulatoryState {
  timestamp: number;
  apertureRatio: number;
  widthRatio: number;
  mouthOpeningMm: number;
  jawDisplacementX: number;
  viseme: VisemeClass;
  confidence: number;
  apertureVelocity?: number;
  widthVelocity?: number;
}

export interface VisualPredictionResult {
  predictedWord: string;
  visualConfidence: number; // 0.0 to 1.0
  isTargetMatch: boolean;
  matchScore: number;
  observedVisemes: VisemeClass[];
  targetVisemes: VisemeClass[];
  visemeSequenceString: string;
  articulatoryFeedback: string;
  isMotionDetected: boolean;
}

/**
 * Maps Tamil and English words to canonical expected articulatory viseme sequences.
 */
export class VisualSpeechPhonetics {
  private static TAMIL_CONSONANTS: Record<string, VisemeClass> = {
    'ப': VisemeClass.BILABIAL,
    'ம': VisemeClass.BILABIAL,
    'வ': VisemeClass.LABIODENTAL,
    'த': VisemeClass.DENTAL_ALVEOLAR,
    'ந': VisemeClass.DENTAL_ALVEOLAR,
    'ற': VisemeClass.DENTAL_ALVEOLAR,
    'ன': VisemeClass.DENTAL_ALVEOLAR,
    'ட': VisemeClass.DENTAL_ALVEOLAR,
    'ண': VisemeClass.DENTAL_ALVEOLAR,
    'ல': VisemeClass.DENTAL_ALVEOLAR,
    'ள': VisemeClass.DENTAL_ALVEOLAR,
    'ழ': VisemeClass.DENTAL_ALVEOLAR,
    'ர': VisemeClass.DENTAL_ALVEOLAR,
    'ச': VisemeClass.DENTAL_ALVEOLAR,
    'ஸ': VisemeClass.DENTAL_ALVEOLAR,
    'ஷ': VisemeClass.DENTAL_ALVEOLAR,
    'ஜ': VisemeClass.VELAR_PALATAL,
    'க': VisemeClass.VELAR_PALATAL,
    'ங': VisemeClass.VELAR_PALATAL,
    'ய': VisemeClass.VELAR_PALATAL,
    'ஹ': VisemeClass.NEUTRAL_REST
  };

  private static TAMIL_VOWELS: Record<string, VisemeClass> = {
    'அ': VisemeClass.OPEN_VOWEL,
    'ஆ': VisemeClass.OPEN_VOWEL,
    'ா': VisemeClass.OPEN_VOWEL,
    'இ': VisemeClass.SPREAD_VOWEL,
    'ஈ': VisemeClass.SPREAD_VOWEL,
    'ி': VisemeClass.SPREAD_VOWEL,
    'ீ': VisemeClass.SPREAD_VOWEL,
    'எ': VisemeClass.SPREAD_VOWEL,
    'ஏ': VisemeClass.SPREAD_VOWEL,
    'ெ': VisemeClass.SPREAD_VOWEL,
    'ே': VisemeClass.SPREAD_VOWEL,
    'ஐ': VisemeClass.SPREAD_VOWEL,
    'ை': VisemeClass.SPREAD_VOWEL,
    'உ': VisemeClass.ROUNDED_VOWEL,
    'ஊ': VisemeClass.ROUNDED_VOWEL,
    'ு': VisemeClass.ROUNDED_VOWEL,
    'ூ': VisemeClass.ROUNDED_VOWEL,
    'ஒ': VisemeClass.ROUNDED_VOWEL,
    'ஓ': VisemeClass.ROUNDED_VOWEL,
    'ொ': VisemeClass.ROUNDED_VOWEL,
    'ோ': VisemeClass.ROUNDED_VOWEL,
    'ஔ': VisemeClass.ROUNDED_VOWEL,
    'ௌ': VisemeClass.ROUNDED_VOWEL
  };

  // Comprehensive clinical canonical dictionary for rehab levels 1 to 25 + common phrases
  private static CANONICAL_VISEMES: Record<string, VisemeClass[]> = {
    // Stage 1: Beginner (Levels 1–10)
    'அம்மா': [VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL],
    'hello': [VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL],
    'அப்பா': [VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL],
    'yes': [VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'நீர்': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'no': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL],
    'பால்': [VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'good': [VisemeClass.VELAR_PALATAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'கண்': [VisemeClass.VELAR_PALATAL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'water': [VisemeClass.ROUNDED_VOWEL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR],

    // Stage 2: Foundation (Levels 11–25)
    'வணக்கம்': [VisemeClass.LABIODENTAL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.VELAR_PALATAL, VisemeClass.BILABIAL],
    'morning': [VisemeClass.BILABIAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.SPREAD_VOWEL, VisemeClass.VELAR_PALATAL],
    'நன்றி': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL],
    'please': [VisemeClass.BILABIAL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'சாப்பாடு': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL, VisemeClass.ROUNDED_VOWEL],
    'help': [VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.BILABIAL],
    'தண்ணீர்': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'doctor': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL, VisemeClass.VELAR_PALATAL, VisemeClass.DENTAL_ALVEOLAR],
    'வலி': [VisemeClass.LABIODENTAL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL],
    'today': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL],
    'மருந்து': [VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'family': [VisemeClass.LABIODENTAL, VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'மூச்சு': [VisemeClass.BILABIAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL],
    'listen': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR],
    'உதவி': [VisemeClass.ROUNDED_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.LABIODENTAL, VisemeClass.SPREAD_VOWEL],

    // Common clinical phrases
    'good morning': [VisemeClass.VELAR_PALATAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.BILABIAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.SPREAD_VOWEL],
    'thank you': [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.VELAR_PALATAL, VisemeClass.SPREAD_VOWEL, VisemeClass.ROUNDED_VOWEL]
  };

  /**
   * Converts a Tamil or English word/phrase into an expected canonical sequence of Visemes.
   * Automatically recognizes script (Tamil Unicode vs English Latin) to prevent cross-language pollution.
   */
  public static textToVisemes(text: string, language?: 'ta-IN' | 'en-IN'): VisemeClass[] {
    const clean = text.trim().toLowerCase();
    if (!clean) return [VisemeClass.NEUTRAL_REST];

    // 1. Direct canonical lookup
    if (this.CANONICAL_VISEMES[clean]) {
      return [...this.CANONICAL_VISEMES[clean]];
    }

    // 2. Auto-detect language by Unicode block (U+0B80 to U+0BFF is Tamil)
    const isTamil = /[\u0B80-\u0BFF]/.test(clean);

    if (isTamil) {
      const visemes: VisemeClass[] = [];
      const chars = Array.from(clean);
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (this.TAMIL_VOWELS[c] !== undefined) {
          visemes.push(this.TAMIL_VOWELS[c]);
        } else if (this.TAMIL_CONSONANTS[c] !== undefined) {
          visemes.push(this.TAMIL_CONSONANTS[c]);
          const nextC = chars[i + 1];
          // If no following dependent vowel sign and not pulli, consonant carries inherent open vowel 'அ'
          if (!nextC || (this.TAMIL_VOWELS[nextC] === undefined && nextC !== '்')) {
            visemes.push(VisemeClass.OPEN_VOWEL);
          }
        }
      }
      return this.collapseConsecutive(visemes.length > 0 ? visemes : [VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR]);
    }

    // English letter mapping
    const enMap: Record<string, VisemeClass> = {
      p: VisemeClass.BILABIAL, b: VisemeClass.BILABIAL, m: VisemeClass.BILABIAL,
      f: VisemeClass.LABIODENTAL, v: VisemeClass.LABIODENTAL,
      t: VisemeClass.DENTAL_ALVEOLAR, d: VisemeClass.DENTAL_ALVEOLAR,
      s: VisemeClass.DENTAL_ALVEOLAR, z: VisemeClass.DENTAL_ALVEOLAR,
      n: VisemeClass.DENTAL_ALVEOLAR, l: VisemeClass.DENTAL_ALVEOLAR,
      k: VisemeClass.VELAR_PALATAL, g: VisemeClass.VELAR_PALATAL, c: VisemeClass.VELAR_PALATAL,
      a: VisemeClass.OPEN_VOWEL,
      e: VisemeClass.SPREAD_VOWEL, i: VisemeClass.SPREAD_VOWEL, y: VisemeClass.SPREAD_VOWEL,
      o: VisemeClass.ROUNDED_VOWEL, u: VisemeClass.ROUNDED_VOWEL, w: VisemeClass.ROUNDED_VOWEL
    };

    const visemes: VisemeClass[] = [];
    for (const ch of clean) {
      if (enMap[ch] !== undefined) {
        visemes.push(enMap[ch]);
      }
    }
    return this.collapseConsecutive(visemes.length > 0 ? visemes : [VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR]);
  }

  public static collapseConsecutive(arr: VisemeClass[]): VisemeClass[] {
    if (arr.length === 0) return [];
    const res: VisemeClass[] = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1]) {
        res.push(arr[i]);
      }
    }
    return res;
  }
}

/**
 * Continuous Visual Lip-Reading Engine with Rolling Buffer and Dynamic Time Warping
 */
export class VisualLipReaderEngine {
  // Continuous rolling buffer of the last 75 frames (~2.5 seconds at 30 FPS)
  private continuousBuffer: FrameArticulatoryState[] = [];
  private maxContinuousLength = 75;

  // Active attempt buffer (when user presses Start Attempt)
  private attemptBuffer: FrameArticulatoryState[] = [];
  private maxAttemptLength = 180; // 6 seconds
  private isRecording = false;

  private prevApertureRatio = 0.045;
  private prevWidthRatio = 0.510;
  private prevTimestamp = 0;
  private prevViseme: VisemeClass = VisemeClass.NEUTRAL_REST;

  public startAttempt() {
    this.attemptBuffer = [];
    this.isRecording = true;
  }

  public stopAttempt(): FrameArticulatoryState[] {
    this.isRecording = false;
    return [...this.attemptBuffer];
  }

  /**
   * Ingests a new video frame's articulatory measurements.
   * ALWAYS updates the continuous rolling buffer for instant real-time predictions.
   */
  public processFrame(
    apertureRatio: number, 
    widthRatio: number, 
    jawDisplacementX: number,
    apertureVel?: number,
    widthVel?: number
  ): FrameArticulatoryState {
    const now = performance.now();
    const dt = Math.max(0.016, (now - (this.prevTimestamp || now)) / 1000);
    const apVel = apertureVel !== undefined ? apertureVel : ((apertureRatio - this.prevApertureRatio) / dt);
    const wVel = widthVel !== undefined ? widthVel : ((widthRatio - this.prevWidthRatio) / dt);
    this.prevApertureRatio = apertureRatio;
    this.prevWidthRatio = widthRatio;
    this.prevTimestamp = now;

    const classification = this.classifySingleFrame(apertureRatio, widthRatio, apVel, wVel, this.prevViseme);
    this.prevViseme = classification.viseme;
    const mm = Math.round(apertureRatio * 120);

    const state: FrameArticulatoryState = {
      timestamp: now,
      apertureRatio,
      widthRatio,
      mouthOpeningMm: mm,
      jawDisplacementX,
      viseme: classification.viseme,
      confidence: classification.confidence,
      apertureVelocity: Math.round(apVel * 1000) / 1000,
      widthVelocity: Math.round(wVel * 1000) / 1000
    };

    // 1. Always maintain continuous rolling window
    this.continuousBuffer.push(state);
    if (this.continuousBuffer.length > this.maxContinuousLength) {
      this.continuousBuffer.shift();
    }

    // 2. If in formal recording attempt, record to attempt buffer
    if (this.isRecording) {
      this.attemptBuffer.push(state);
      if (this.attemptBuffer.length > this.maxAttemptLength) {
        this.attemptBuffer.shift();
      }
    }

    return state;
  }

  /**
   * Classifies a single physical frame into one of 8 Viseme classes
   * using empirical benchmark distributions (MIRACL-VC1 / GRID / LRW) and dynamic velocity.
   */
  public classifySingleFrame(
    apertureRatio: number, 
    widthRatio: number,
    apertureVel: number = 0,
    widthVel: number = 0,
    prevViseme?: VisemeClass
  ): {
    viseme: VisemeClass;
    confidence: number;
  } {
    // 1. Evaluate empirical multivariate Gaussian log-likelihood from benchmark dataset
    const xVec = [apertureRatio, widthRatio, apertureVel, widthVel];
    let bestViseme: VisemeClass = VisemeClass.NEUTRAL_REST;
    let minMahalanobis = Infinity;
    const scores: number[] = new Array(8).fill(0);

    for (let vId = 0; vId < 8; vId++) {
      const prior = EMPIRICAL_VISEME_PRIORS[String(vId)];
      if (!prior) continue;

      const mu = prior.gaussian_4d.mean;
      const invCov = prior.gaussian_4d.inv_cov;

      const diff = [
        xVec[0] - mu[0],
        xVec[1] - mu[1],
        (xVec[2] - mu[2]) * 0.35, // velocity variance scaling
        (xVec[3] - mu[3]) * 0.35
      ];

      let dSq = 0;
      for (let r = 0; r < 4; r++) {
        let rowSum = 0;
        for (let c = 0; c < 4; c++) {
          rowSum += diff[c] * (invCov[r]?.[c] || 0);
        }
        dSq += diff[r] * rowSum;
      }

      // Transition probability prior
      let transitionBonus = 0;
      if (prevViseme !== undefined && EMPIRICAL_TRANSITION_MATRIX[prevViseme]) {
        const transProb = EMPIRICAL_TRANSITION_MATRIX[prevViseme][vId] || 0.05;
        transitionBonus = Math.log(Math.max(transProb, 1e-4)) * 0.45;
      }

      const score = -0.5 * dSq + transitionBonus;
      scores[vId] = score;

      if (dSq < minMahalanobis) {
        minMahalanobis = dSq;
        bestViseme = vId as VisemeClass;
      }
    }

    // Softmax probabilities
    const maxS = Math.max(...scores);
    const expScores = scores.map(s => Math.exp(Math.max(-40, s - maxS)));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const bestProb = expScores[bestViseme] / (sumExp || 1.0);

    // Anatomical hard limits for clear disambiguation
    if (apertureRatio < 0.038) {
      return { viseme: VisemeClass.BILABIAL, confidence: 0.96 };
    }
    if (apertureRatio > 0.25) {
      return { viseme: VisemeClass.OPEN_VOWEL, confidence: 0.95 };
    }
    if (widthRatio > 1.12 && apertureRatio < 0.20) {
      return { viseme: VisemeClass.SPREAD_VOWEL, confidence: 0.94 };
    }
    if (widthRatio < 0.76 && apertureRatio > 0.08) {
      return { viseme: VisemeClass.ROUNDED_VOWEL, confidence: 0.92 };
    }

    return { 
      viseme: bestViseme, 
      confidence: Math.round(Math.min(0.99, Math.max(0.68, bestProb)) * 100) / 100 
    };
  }

  /**
   * Continuous / Live prediction on the current buffer against candidate phrases.
   */
  public decodeCurrentBuffer(
    targetText: string,
    language: 'ta-IN' | 'en-IN',
    vocabularyCandidates: string[] = []
  ): VisualPredictionResult {
    // Choose buffer: active attempt buffer if available, else continuous rolling buffer
    const rawFrames = (this.isRecording && this.attemptBuffer.length >= 8)
      ? this.attemptBuffer
      : this.continuousBuffer;

    const targetVisemes = VisualSpeechPhonetics.textToVisemes(targetText, language);

    if (rawFrames.length < 6) {
      return {
        predictedWord: 'Ready: Mouth word...',
        visualConfidence: 0.0,
        isTargetMatch: false,
        matchScore: 0.0,
        observedVisemes: [],
        targetVisemes,
        visemeSequenceString: targetVisemes.map(v => VISEME_SHORT_CODES[v]).join(' → '),
        articulatoryFeedback: `Mouth "${targetText}" to predict words from lip movements.`,
        isMotionDetected: false
      };
    }

    // Inspect dynamic articulatory range in the recent window (last 45 frames)
    const recentWindow = rawFrames.slice(-45);
    let minAp = 1.0;
    let maxAp = 0.0;
    let minW = 2.0;
    let maxW = 0.0;

    for (const f of recentWindow) {
      if (f.apertureRatio < minAp) minAp = f.apertureRatio;
      if (f.apertureRatio > maxAp) maxAp = f.apertureRatio;
      if (f.widthRatio < minW) minW = f.widthRatio;
      if (f.widthRatio > maxW) maxW = f.widthRatio;
    }

    const apertureRange = maxAp - minAp;
    const widthRange = maxW - minW;
    const isMotionDetected = (apertureRange > 0.035) || (widthRange > 0.045);

    if (!isMotionDetected) {
      return {
        predictedWord: 'Ready: Mouth word...',
        visualConfidence: 0.0,
        isTargetMatch: false,
        matchScore: 0.0,
        observedVisemes: [],
        targetVisemes,
        visemeSequenceString: targetVisemes.map(v => VISEME_SHORT_CODES[v]).join(' → '),
        articulatoryFeedback: `Mouth "${targetText}" clearly in front of the camera.`,
        isMotionDetected: false
      };
    }

    // 1. Temporal Smoothing: 3-frame mode window to filter single-frame noise
    const smoothed: VisemeClass[] = [];
    for (let i = 0; i < recentWindow.length; i++) {
      const window = recentWindow.slice(Math.max(0, i - 1), Math.min(recentWindow.length, i + 2));
      const counts: Record<number, number> = {};
      window.forEach(f => {
        counts[f.viseme] = (counts[f.viseme] || 0) + 1;
      });
      let bestViseme = recentWindow[i].viseme;
      let maxC = 0;
      for (const [k, v] of Object.entries(counts)) {
        if (v > maxC) {
          maxC = v;
          bestViseme = Number(k) as VisemeClass;
        }
      }
      smoothed.push(bestViseme);
    }

    // 2. Collapse consecutive identical frames (CTC reduction)
    const collapsed = VisualSpeechPhonetics.collapseConsecutive(smoothed);

    // 3. Compute DTW alignment against target
    const targetMatchScore = this.computeDTWAlignment(collapsed, targetVisemes);

    // 4. Test candidate words to see if another word in vocabulary is a better match
    const allCandidates = Array.from(new Set([targetText, ...vocabularyCandidates.slice(0, 15)]));
    let bestWord = targetText;
    let bestScore = targetMatchScore;

    for (const candidate of allCandidates) {
      if (!candidate || candidate === targetText) continue;
      const candVisemes = VisualSpeechPhonetics.textToVisemes(candidate);
      const score = this.computeDTWAlignment(collapsed, candVisemes);
      if (score > bestScore + 0.12) {
        bestScore = score;
        bestWord = candidate;
      }
    }

    // 5. Target-specific multi-feature articulatory verification boost
    let verifiedBoost = 0.0;
    let feedback = 'Clear articulatory trajectory detected.';

    // Check specific landmark transitions for clinical accuracy across all target visemes:
    // A. Bilabial Closure (B/P/M)
    if (targetVisemes.includes(VisemeClass.BILABIAL)) {
      if (collapsed.includes(VisemeClass.BILABIAL) || minAp < 0.050) {
        verifiedBoost += 0.22;
        feedback = 'Excellent bilabial closure!';
      }
    }
    // B. Open Vowel (AA/A)
    if (targetVisemes.includes(VisemeClass.OPEN_VOWEL)) {
      if (collapsed.includes(VisemeClass.OPEN_VOWEL) || maxAp > 0.13 || apertureRange > 0.05) {
        verifiedBoost += 0.22;
        feedback = 'Clear vertical open vowel projection!';
      }
    }
    // C. Rounded Vowel (OO/U/O)
    if (targetVisemes.includes(VisemeClass.ROUNDED_VOWEL)) {
      if (collapsed.includes(VisemeClass.ROUNDED_VOWEL) || minW < 0.90) {
        verifiedBoost += 0.22;
        feedback = 'Great lip rounding shape!';
      }
    }
    // D. Spread Vowel (EE/I/E)
    if (targetVisemes.includes(VisemeClass.SPREAD_VOWEL)) {
      if (collapsed.includes(VisemeClass.SPREAD_VOWEL) || maxW > 0.98 || widthRange > 0.04) {
        verifiedBoost += 0.22;
        feedback = 'Good lateral spread and horizontal extension!';
      }
    }
    // E. Dental / Alveolar (T/D/S/N/L)
    if (targetVisemes.includes(VisemeClass.DENTAL_ALVEOLAR)) {
      if (collapsed.includes(VisemeClass.DENTAL_ALVEOLAR)) {
        verifiedBoost += 0.12;
      }
    }
    // F. Velar / Palatal (K/G/J/Y)
    if (targetVisemes.includes(VisemeClass.VELAR_PALATAL)) {
      if (collapsed.includes(VisemeClass.VELAR_PALATAL)) {
        verifiedBoost += 0.12;
      }
    }

    const boostedScore = Math.min(0.98, targetMatchScore + verifiedBoost);

    // Robust matching criteria:
    // 1) Boosted score meets threshold (>= 0.50)
    // 2) Raw DTW match score meets threshold (>= 0.40)
    // 3) Target word is the top vocabulary candidate and has detected articulatory alignment (>= 0.40)
    const isMatch = (boostedScore >= 0.50) || 
                    (targetMatchScore >= 0.40) || 
                    (bestWord === targetText && boostedScore >= 0.40);

    const finalWord = isMatch ? targetText : bestWord;
    const finalConfidence = isMatch ? Math.max(boostedScore, 0.76) : Math.min(0.95, bestScore);

    // If final predicted word matches the target, ensure isTargetMatch is TRUE so prompt appears
    const isTargetMatch = isMatch || (finalWord.toLowerCase() === targetText.toLowerCase() && finalConfidence >= 0.45);

    return {
      predictedWord: finalWord,
      visualConfidence: Math.round(finalConfidence * 100) / 100,
      isTargetMatch,
      matchScore: Math.round(finalConfidence * 100) / 100,
      observedVisemes: collapsed,
      targetVisemes,
      visemeSequenceString: collapsed.map(v => VISEME_SHORT_CODES[v]).join(' → '),
      articulatoryFeedback: feedback,
      isMotionDetected: true
    };
  }

  /**
   * Dynamic Time Warping (DTW) distance between observed and expected viseme sequences.
   */
  private computeDTWAlignment(observed: VisemeClass[], expected: VisemeClass[]): number {
    const n = observed.length;
    const m = expected.length;
    if (n === 0 || m === 0) return 0.0;

    let expIdx = 0;
    for (let i = 0; i < n; i++) {
      if (observed[i] === expected[expIdx]) {
        expIdx++;
        if (expIdx >= m) break;
      }
    }
    const subsequenceRatio = expIdx / m;

    const dtw: number[][] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(Infinity));
    dtw[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = this.visemeDistance(observed[i - 1], expected[j - 1]);
        dtw[i][j] = cost + Math.min(
          dtw[i - 1][j],
          dtw[i][j - 1],
          dtw[i - 1][j - 1]
        );
      }
    }

    const totalDistance = dtw[n][m];
    const maxPossibleDistance = Math.max(n, m) * 2.0;
    const dtwScore = Math.max(0, 1.0 - (totalDistance / maxPossibleDistance));

    const blendedScore = (dtwScore * 0.45) + (subsequenceRatio * 0.55);
    return Math.min(1.0, Math.max(0.0, blendedScore));
  }

  private visemeDistance(a: VisemeClass, b: VisemeClass): number {
    if (a === b) return 0.0;

    if (
      (a === VisemeClass.OPEN_VOWEL && b === VisemeClass.SPREAD_VOWEL) ||
      (a === VisemeClass.SPREAD_VOWEL && b === VisemeClass.OPEN_VOWEL)
    ) return 0.5;

    if (
      (a === VisemeClass.ROUNDED_VOWEL && b === VisemeClass.OPEN_VOWEL) ||
      (a === VisemeClass.OPEN_VOWEL && b === VisemeClass.ROUNDED_VOWEL)
    ) return 0.6;

    if (
      (a === VisemeClass.BILABIAL && b === VisemeClass.LABIODENTAL) ||
      (a === VisemeClass.LABIODENTAL && b === VisemeClass.BILABIAL)
    ) return 0.4;

    if (
      (a === VisemeClass.DENTAL_ALVEOLAR && b === VisemeClass.VELAR_PALATAL) ||
      (a === VisemeClass.VELAR_PALATAL && b === VisemeClass.DENTAL_ALVEOLAR)
    ) return 0.5;

    if (
      (a === VisemeClass.BILABIAL && a !== b && (b === VisemeClass.OPEN_VOWEL || b === VisemeClass.SPREAD_VOWEL)) ||
      (b === VisemeClass.BILABIAL && a !== b && (a === VisemeClass.OPEN_VOWEL || a === VisemeClass.SPREAD_VOWEL))
    ) return 1.6;

    return 1.0;
  }
}

export const visualLipReader = new VisualLipReaderEngine();
