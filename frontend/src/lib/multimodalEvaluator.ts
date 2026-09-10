/**
 * Multimodal Speech & Lip-Reading Machine Learning Evaluator.
 *
 * Fuses:
 * 1. Computer Vision: MediaPipe 3D Lip Aperture, Mouth Width, and Jaw Displacement.
 * 2. Acoustic Processing: Audio Tone, Vocal Energy (RMS), and Fundamental Frequency (F0).
 * 3. Bilingual Phonemic ASR: Speech transcript match across Tamil & English.
 */

import type { ArticulatoryKinematics } from "./faceMeshTracker";
import type { CurriculumLevel } from "./rehabCurriculum";

export interface MultimodalEvaluationResult {
  compositeScore: number; // 0 to 100
  isMastered: boolean;
  starsAwarded: 0 | 1 | 2 | 3;
  xpEarned: number;

  // Modality Sub-Scores (0 to 100)
  kinematicScore: number;
  audioToneScore: number;
  phonemicScore: number;

  // Clinical Diagnostic Metrics
  detectedViseme: string;
  isVisemeMatched: boolean;
  isPitchStable: boolean;
  speechMatchRatio: number;

  // Feedback & Advice
  primaryFeedback: string;
  kinematicFeedback: string;
  toneFeedback: string;
}

/**
 * Calculates normalized Levenshtein similarity between two strings (0.0 to 1.0).
 */
function calculateTextSimilarity(s1: string, s2: string): number {
  const str1 = s1.trim().toLowerCase().replace(/[^a-zA-Z0-9஀-௿]/g, "");
  const str2 = s2.trim().toLowerCase().replace(/[^a-zA-Z0-9஀-௿]/g, "");

  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.92;

  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.max(0, 1.0 - distance / maxLen);
}

/**
 * Evaluates patient attempt across vision, audio, and speech modalities.
 */
export function evaluateMultimodalAttempt(
  kinematics: ArticulatoryKinematics | null,
  vocalEnergy: number,
  fundamentalFreq: number | null,
  spokenTranscript: string,
  level: CurriculumLevel
): MultimodalEvaluationResult {
  const target = level.targetKinematics;

  // ─── 1. LIP READING & JAW KINEMATICS EVALUATION (35% WEIGHT) ───────────────
  let kinematicScore = 80; // Baseline
  let detectedViseme = "Neutral Oral Stance";
  let isVisemeMatched = false;
  let kinematicFeedback = "Good overall articulatory positioning.";

  if (kinematics) {
    const lar = kinematics.lipApertureRatio;
    const mwr = kinematics.mouthWidthRatio;
    const jawMm = kinematics.jawDisplacementMm;

    // Detect observed viseme category
    if (lar <= 0.18) {
      detectedViseme = "Bilabial Plosive Seal (/p/, /b/, /m/)";
    } else if (lar >= 0.40) {
      detectedViseme = "Open Vowel Jaw Lowering (/a/, /aa/)";
    } else if (mwr >= 0.58) {
      detectedViseme = "Lateral Corner Retraction (/i/, /ee/)";
    } else if (mwr <= 0.40 && lar >= 0.15) {
      detectedViseme = "Labial Protrusion / Rounding (/u/, /oo/)";
    } else {
      detectedViseme = "Lingual / Dental Mid-Stance";
    }

    // Evaluate against target level requirements
    switch (level.targetViseme) {
      case "bilabial": {
        // Did patient achieve tight or near-complete closure?
        if (lar <= target.maxLar) {
          kinematicScore = 98;
          isVisemeMatched = true;
          kinematicFeedback = "Excellent bilabial contact. Clean lip seal achieved!";
        } else if (lar <= 0.28) {
          kinematicScore = 82;
          isVisemeMatched = true;
          kinematicFeedback = "Moderate lip approximation. Press lips slightly firmer together.";
        } else {
          kinematicScore = 55;
          isVisemeMatched = false;
          kinematicFeedback = "Lips remained open. Bring upper and lower lips together for /m/ or /p/.";
        }
        break;
      }

      case "open": {
        // Did patient lower jaw and open aperture?
        if (lar >= target.minLar && jawMm >= target.minJawMm) {
          kinematicScore = 96;
          isVisemeMatched = true;
          kinematicFeedback = "Ideal open vowel aperture. Great mandibular excursion!";
        } else if (lar >= 0.28) {
          kinematicScore = 80;
          isVisemeMatched = true;
          kinematicFeedback = "Good opening. Lower your jaw a little further for full resonance.";
        } else {
          kinematicScore = 58;
          isVisemeMatched = false;
          kinematicFeedback = "Oral aperture too narrow. Open mouth wider for vowel /a/.";
        }
        break;
      }

      case "spread": {
        // Did patient retract mouth corners?
        if (mwr >= target.minMwr) {
          kinematicScore = 96;
          isVisemeMatched = true;
          kinematicFeedback = "Splendid lateral smile retraction. Perfect vowel /i/ spread!";
        } else {
          kinematicScore = 65;
          isVisemeMatched = false;
          kinematicFeedback = "Extend mouth corners outward towards ears for /i/.";
        }
        break;
      }

      case "rounded": {
        // Did patient protrude lips?
        if (mwr <= target.maxMwr && lar >= 0.12) {
          kinematicScore = 95;
          isVisemeMatched = true;
          kinematicFeedback = "Wonderful circular lip protrusion for rounded vowel /u/!";
        } else {
          kinematicScore = 65;
          isVisemeMatched = false;
          kinematicFeedback = "Round and purse your lips forward into a small circle for /u/.";
        }
        break;
      }

      case "lingual":
      case "multisyllabic":
      default: {
        if (kinematics.withinTarget) {
          kinematicScore = 94;
          isVisemeMatched = true;
          kinematicFeedback = "Fluid syllable boundary articulation!";
        } else {
          kinematicScore = 78;
          isVisemeMatched = true;
          kinematicFeedback = "Adequate motor control. Maintain rhythm through syllables.";
        }
        break;
      }
    }
  }

  // ─── 2. AUDIO TONE & PHONATION EVALUATION (25% WEIGHT) ─────────────────────
  let audioToneScore = 70;
  const isPitchStable = fundamentalFreq !== null && fundamentalFreq >= 90 && fundamentalFreq <= 320;
  let toneFeedback = "Good acoustic phonation.";

  // Intensity (RMS energy) check
  const energyFactor = Math.min(1.0, Math.max(0.2, vocalEnergy * 6));
  const pitchFactor = isPitchStable ? 1.0 : (vocalEnergy > 0.08 ? 0.88 : 0.65);

  audioToneScore = Math.round((energyFactor * 60 + pitchFactor * 40));

  if (vocalEnergy > 0.12 && isPitchStable) {
    audioToneScore = Math.min(100, Math.max(88, audioToneScore));
    toneFeedback = "Strong vocal cord vibration and stable fundamental pitch.";
  } else if (vocalEnergy < 0.05) {
    audioToneScore = Math.max(45, audioToneScore - 20);
    toneFeedback = "Vocal volume is low. Take a deeper breath and speak louder.";
  } else if (!isPitchStable) {
    toneFeedback = "Sustain vocal cord phonation smoothly through the sound.";
  }

  // ─── 3. BILINGUAL SPEECH RECOGNITION (40% WEIGHT) ──────────────────────────
  let phonemicScore = 80;
  let speechMatchRatio = 0.85;

  const spoken = spokenTranscript.trim();
  if (spoken) {
    // Compare against Tamil text, English text, transliteration, and meaning
    const simTamil = calculateTextSimilarity(spoken, level.tamilText);
    const simEnglish = calculateTextSimilarity(spoken, level.englishText);
    const simTrans = calculateTextSimilarity(spoken, level.transliteration);
    const simMeaning = calculateTextSimilarity(spoken, level.meaning);

    speechMatchRatio = Math.max(simTamil, simEnglish, simTrans, simMeaning);
    phonemicScore = Math.round(speechMatchRatio * 100);

    // If partial match or multi-word level
    if (spoken.length > 2 && speechMatchRatio < 0.6) {
      // Check if words overlap
      const spokenWords = spoken.toLowerCase().split(/\s+/);
      const targetWords = (level.englishText + " " + level.tamilText + " " + level.transliteration).toLowerCase().split(/\s+/);
      let matchCount = 0;
      for (const sw of spokenWords) {
        if (targetWords.some(tw => tw.includes(sw) || sw.includes(tw))) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        speechMatchRatio = Math.max(speechMatchRatio, matchCount / Math.max(spokenWords.length, 1));
        phonemicScore = Math.max(phonemicScore, Math.round(speechMatchRatio * 85));
      }
    }
  } else {
    // If no mic transcript was picked up (browser speech API timeout/silence):
    // If kinematic lip reading was excellent and vocal energy was present, award compensatory score
    if (isVisemeMatched && vocalEnergy > 0.10) {
      phonemicScore = 86;
      speechMatchRatio = 0.86;
    } else {
      phonemicScore = 65;
      speechMatchRatio = 0.65;
    }
  }

  // ─── 4. COMPOSITE SCORE & LEVEL MASTERY ────────────────────────────────────
  const compositeScore = Math.round(
    kinematicScore * 0.35 +
    audioToneScore * 0.25 +
    phonemicScore * 0.40
  );

  const isMastered = compositeScore >= 75;

  let starsAwarded: 0 | 1 | 2 | 3 = 0;
  if (compositeScore >= 90) starsAwarded = 3;
  else if (compositeScore >= 82) starsAwarded = 2;
  else if (compositeScore >= 75) starsAwarded = 1;

  const xpEarned = isMastered ? 50 + starsAwarded * 25 : 15;

  let primaryFeedback = "Level Complete! Excellent multimodal articulation.";
  if (!isMastered) {
    primaryFeedback = "Keep practicing! Focus on coordinating your lip movement with clear vocal sound.";
  } else if (starsAwarded === 3) {
    primaryFeedback = "Mastery Achieved! 🌟 Perfect synchrony between lips, tone, and speech!";
  }

  return {
    compositeScore,
    isMastered,
    starsAwarded,
    xpEarned,
    kinematicScore,
    audioToneScore,
    phonemicScore,
    detectedViseme,
    isVisemeMatched,
    isPitchStable,
    speechMatchRatio,
    primaryFeedback,
    kinematicFeedback,
    toneFeedback,
  };
}
