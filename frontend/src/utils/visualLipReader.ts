/**
 * NeuroSpeech Rehab - Client-Side Visual Lip-Reading & Viseme Sequence Decoder
 * 
 * Provides continuous real-time visual speech recognition directly from facial
 * kinematics (aperture, width, bilabial closure, labiodental tuck, and vowel elongation).
 * Translates articulatory movement trajectories into Viseme sequences and decodes
 * words using Continuous Dynamic Time Warping (DTW) alignment.
 */

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

  /**
   * Converts a Tamil or English word/phrase into an expected canonical sequence of Visemes.
   */
  public static textToVisemes(text: string, language: 'ta-IN' | 'en-IN'): VisemeClass[] {
    const clean = text.trim().toLowerCase();
    if (!clean) return [VisemeClass.NEUTRAL_REST];

    // Explicit Tamil clinical targets
    if (clean === 'அம்மா') {
      return [VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL];
    }
    if (clean === 'அப்பா') {
      return [VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL];
    }
    if (clean === 'வணக்கம்') {
      return [VisemeClass.LABIODENTAL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.VELAR_PALATAL, VisemeClass.BILABIAL];
    }
    if (clean === 'நன்றி') {
      return [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL];
    }
    if (clean === 'சாப்பாடு') {
      return [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL, VisemeClass.ROUNDED_VOWEL];
    }
    if (clean === 'தண்ணீர்') {
      return [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL];
    }

    if (language === 'ta-IN') {
      const visemes: VisemeClass[] = [];
      const chars = Array.from(text);
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (this.TAMIL_VOWELS[c] !== undefined) {
          visemes.push(this.TAMIL_VOWELS[c]);
        } else if (this.TAMIL_CONSONANTS[c] !== undefined) {
          visemes.push(this.TAMIL_CONSONANTS[c]);
          const nextC = chars[i + 1];
          if (!nextC || (this.TAMIL_VOWELS[nextC] === undefined && nextC !== '்')) {
            visemes.push(VisemeClass.OPEN_VOWEL);
          }
        }
      }
      return this.collapseConsecutive(visemes.length > 0 ? visemes : [VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL]);
    }

    // English clinical targets
    if (clean === 'hello') return [VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL];
    if (clean === 'yes') return [VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR];
    if (clean === 'no') return [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.ROUNDED_VOWEL];
    if (clean === 'water') return [VisemeClass.ROUNDED_VOWEL, VisemeClass.OPEN_VOWEL, VisemeClass.DENTAL_ALVEOLAR];
    if (clean === 'good') return [VisemeClass.VELAR_PALATAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.DENTAL_ALVEOLAR];
    if (clean === 'morning') return [VisemeClass.BILABIAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.SPREAD_VOWEL, VisemeClass.VELAR_PALATAL];
    if (clean === 'good morning') return [VisemeClass.VELAR_PALATAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.BILABIAL, VisemeClass.ROUNDED_VOWEL, VisemeClass.SPREAD_VOWEL];
    if (clean === 'thank you') return [VisemeClass.DENTAL_ALVEOLAR, VisemeClass.OPEN_VOWEL, VisemeClass.VELAR_PALATAL, VisemeClass.SPREAD_VOWEL, VisemeClass.ROUNDED_VOWEL];
    if (clean === 'please') return [VisemeClass.BILABIAL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR];
    if (clean === 'help') return [VisemeClass.SPREAD_VOWEL, VisemeClass.DENTAL_ALVEOLAR, VisemeClass.BILABIAL];

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
    jawDisplacementX: number
  ): FrameArticulatoryState {
    const classification = this.classifySingleFrame(apertureRatio, widthRatio);
    const mm = Math.round(apertureRatio * 120);

    const state: FrameArticulatoryState = {
      timestamp: performance.now(),
      apertureRatio,
      widthRatio,
      mouthOpeningMm: mm,
      jawDisplacementX,
      viseme: classification.viseme,
      confidence: classification.confidence
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
   * Classifies a single physical frame into one of 8 Viseme classes based on geometry.
   */
  public classifySingleFrame(apertureRatio: number, widthRatio: number): {
    viseme: VisemeClass;
    confidence: number;
  } {
    // 1. Bilabial Closure: Lips pressed together or sealed
    if (apertureRatio < 0.045) {
      const conf = Math.min(0.99, 0.82 + (0.045 - apertureRatio) * 5);
      return { viseme: VisemeClass.BILABIAL, confidence: Math.round(conf * 100) / 100 };
    }

    // 2. Open Vowel: Wide vertical mouth opening
    if (apertureRatio > 0.16) {
      const conf = Math.min(0.99, 0.80 + (apertureRatio - 0.16) * 2);
      return { viseme: VisemeClass.OPEN_VOWEL, confidence: Math.round(conf * 100) / 100 };
    }

    // 3. Rounded Vowel: Pursing or rounding lips (width narrow, opening moderate)
    if (widthRatio < 0.86 && apertureRatio > 0.05) {
      const conf = Math.min(0.98, 0.78 + (0.86 - widthRatio) * 2);
      return { viseme: VisemeClass.ROUNDED_VOWEL, confidence: Math.round(conf * 100) / 100 };
    }

    // 4. Spread Vowel: Wide mouth stretch
    if (widthRatio > 1.04) {
      const conf = Math.min(0.98, 0.78 + (widthRatio - 1.04) * 2);
      return { viseme: VisemeClass.SPREAD_VOWEL, confidence: Math.round(conf * 100) / 100 };
    }

    // 5. Labiodental: Slight opening with lower lip contact
    if (apertureRatio < 0.085 && widthRatio >= 0.86 && widthRatio <= 1.04) {
      return { viseme: VisemeClass.LABIODENTAL, confidence: 0.84 };
    }

    // 6. Dental / Alveolar / Neutral slit
    if (apertureRatio < 0.14) {
      return { viseme: VisemeClass.DENTAL_ALVEOLAR, confidence: 0.82 };
    }

    return { viseme: VisemeClass.VELAR_PALATAL, confidence: 0.78 };
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
      const candVisemes = VisualSpeechPhonetics.textToVisemes(candidate, language);
      const score = this.computeDTWAlignment(collapsed, candVisemes);
      if (score > bestScore + 0.12) {
        bestScore = score;
        bestWord = candidate;
      }
    }

    // 5. Target-specific articulatory verification boost
    let verifiedBoost = 0.0;
    let feedback = 'Clear articulatory trajectory detected.';

    // Check specific landmark transitions for clinical accuracy:
    // e.g., "அம்மா" / "அப்பா" must exhibit bilabial closure + open vowel
    if (targetVisemes.includes(VisemeClass.BILABIAL) && targetVisemes.includes(VisemeClass.OPEN_VOWEL)) {
      const hasBilabial = collapsed.includes(VisemeClass.BILABIAL) || minAp < 0.045;
      const hasOpenVowel = collapsed.includes(VisemeClass.OPEN_VOWEL) || maxAp > 0.16;
      if (hasBilabial && hasOpenVowel) {
        verifiedBoost += 0.35;
        feedback = 'Excellent bilabial closure and open vowel projection!';
      }
    } else if (targetVisemes.includes(VisemeClass.ROUNDED_VOWEL)) {
      // e.g. "Hello", "Water", "Good morning"
      if (collapsed.includes(VisemeClass.ROUNDED_VOWEL) || minW < 0.86) {
        verifiedBoost += 0.30;
        feedback = 'Great lip rounding shape and vocal resonance.';
      }
    } else if (targetVisemes.includes(VisemeClass.SPREAD_VOWEL)) {
      // e.g. "Yes", "நன்றி"
      if (collapsed.includes(VisemeClass.SPREAD_VOWEL) || maxW > 1.04) {
        verifiedBoost += 0.30;
        feedback = 'Good lateral spread and tongue position.';
      }
    }

    const boostedScore = Math.min(0.98, targetMatchScore + verifiedBoost);
    const isMatch = (boostedScore >= 0.65) || (targetMatchScore >= 0.50);
    const finalWord = isMatch ? targetText : bestWord;
    const finalConfidence = isMatch ? boostedScore : Math.min(0.95, bestScore);

    return {
      predictedWord: finalWord,
      visualConfidence: Math.round(finalConfidence * 100) / 100,
      isTargetMatch: isMatch,
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
