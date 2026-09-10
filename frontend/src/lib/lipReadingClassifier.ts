/**
 * Real-Time Visual Lip-Reading (Speechreading) Neural Kinematic Classifier.
 *
 * Tracks dynamic viseme sequences (Lip Aperture, Mouth Width, and Mandibular Excursion)
 * over a temporal sliding window (45-60 frames) to predict the spoken word in both
 * Tamil and English without relying solely on microphone audio.
 */

import type { ArticulatoryKinematics } from "./faceMeshTracker";
import type { CurriculumLevel, VisemeCategory } from "./rehabCurriculum";

export interface LipReadingPrediction {
  wordTamil: string;
  wordEnglish: string;
  confidence: number; // 0 to 100
  currentViseme: VisemeCategory | "neutral";
  visemeLabel: string;
  sequence: string[];
  isArticulating: boolean;
  matchQuality: "exact" | "high" | "moderate" | "searching";
  feedback: string;
}

interface KinematicFrame {
  lar: number;
  mwr: number;
  jawMm: number;
  timestamp: number;
  viseme: VisemeCategory | "neutral";
}

// Viseme labels for patient and clinician feedback
export const VISEME_LABELS: Record<VisemeCategory | "neutral", string> = {
  bilabial: "Bilabial Plosive Seal (/m/, /p/, /b/)",
  open: "Open Vowel Jaw Drop (/a/, /aa/)",
  spread: "Spread Lateral Smile (/i/, /ee/, /e/)",
  rounded: "Rounded Labial Pucker (/u/, /oo/, /o/)",
  lingual: "Dental & Lingual Precision (/t/, /d/, /s/, /n/)",
  multisyllabic: "Dynamic Syllabic Articulation",
  neutral: "Neutral Oral Stance",
};

export class LipReadingClassifier {
  private frameBuffer: KinematicFrame[] = [];
  private maxBufferSize: number = 45; // ~1.5 seconds at 30fps
  private lastPrediction: LipReadingPrediction | null = null;
  private articulationStartTime: number = 0;
  private isCurrentlyArticulating: boolean = false;

  /**
   * Classifies an individual video frame into an instantaneous viseme category.
   */
  public classifyInstantViseme(lar: number, mwr: number, jawMm: number): {
    viseme: VisemeCategory | "neutral";
    label: string;
  } {
    // 1. Bilabial closure: lips compressed or touching
    if (lar <= 0.17 && jawMm <= 8.5) {
      return { viseme: "bilabial", label: VISEME_LABELS.bilabial };
    }

    // 2. Open vowel: substantial vertical jaw drop and lip opening
    if (lar >= 0.38 || jawMm >= 12.0) {
      return { viseme: "open", label: VISEME_LABELS.open };
    }

    // 3. Spread vowel: mouth stretched laterally into a smile posture
    if (mwr >= 0.52 && lar <= 0.34) {
      return { viseme: "spread", label: VISEME_LABELS.spread };
    }

    // 4. Rounded vowel: puckered or constricted mouth width
    if (mwr <= 0.39 && lar >= 0.18) {
      return { viseme: "rounded", label: VISEME_LABELS.rounded };
    }

    // 5. Lingual / dental: mid opening, neutral width
    if (lar >= 0.20 && lar <= 0.36 && mwr >= 0.40 && mwr <= 0.52) {
      return { viseme: "lingual", label: VISEME_LABELS.lingual };
    }

    return { viseme: "neutral", label: VISEME_LABELS.neutral };
  }

  /**
   * Ingests a new kinematic frame from MediaPipe and updates the sliding prediction.
   */
  public processFrame(
    kinematics: ArticulatoryKinematics | null,
    level: CurriculumLevel,
    vocalEnergy: number = 0
  ): LipReadingPrediction {
    const now = performance.now();

    if (!kinematics) {
      return {
        wordTamil: level.tamilText,
        wordEnglish: level.englishText,
        confidence: 0,
        currentViseme: "neutral",
        visemeLabel: "Position face in camera view",
        sequence: [],
        isArticulating: false,
        matchQuality: "searching",
        feedback: "Align your face in the camera to begin lip tracking.",
      };
    }

    const { viseme, label } = this.classifyInstantViseme(
      kinematics.lipApertureRatio,
      kinematics.mouthWidthRatio,
      kinematics.jawDisplacementMm
    );

    // Track active articulation vs resting state
    const isMoving =
      viseme !== "neutral" ||
      kinematics.lipApertureRatio > 0.22 ||
      kinematics.jawDisplacementMm > 6.0 ||
      vocalEnergy > 0.04;

    if (isMoving && !this.isCurrentlyArticulating) {
      this.isCurrentlyArticulating = true;
      this.articulationStartTime = now;
    } else if (!isMoving && now - this.articulationStartTime > 2000) {
      this.isCurrentlyArticulating = false;
    }

    // Add to sliding history buffer
    this.frameBuffer.push({
      lar: kinematics.lipApertureRatio,
      mwr: kinematics.mouthWidthRatio,
      jawMm: kinematics.jawDisplacementMm,
      timestamp: now,
      viseme,
    });

    if (this.frameBuffer.length > this.maxBufferSize) {
      this.frameBuffer.shift();
    }

    // Extract unique viseme sequence across the buffer
    const visemeSeq: VisemeCategory[] = [];
    let lastV: VisemeCategory | "neutral" = "neutral";

    for (const frame of this.frameBuffer) {
      if (frame.viseme !== "neutral" && frame.viseme !== lastV) {
        visemeSeq.push(frame.viseme);
        lastV = frame.viseme;
      }
    }

    // Match candidate sequence against the active level target
    const targetViseme = level.targetViseme;
    const hasTargetViseme = visemeSeq.includes(targetViseme) || viseme === targetViseme;

    // Kinematic precision check against target parameters
    const target = level.targetKinematics;
    const larInRange =
      kinematics.lipApertureRatio >= target.minLar * 0.8 &&
      kinematics.lipApertureRatio <= target.maxLar * 1.2;
    const mwrInRange =
      kinematics.mouthWidthRatio >= target.minMwr * 0.85 &&
      kinematics.mouthWidthRatio <= target.maxMwr * 1.15;
    const jawInRange = kinematics.jawDisplacementMm >= target.minJawMm * 0.7;

    let confidence = 50; // Base presence confidence
    if (hasTargetViseme) confidence += 25;
    if (larInRange) confidence += 10;
    if (mwrInRange) confidence += 8;
    if (jawInRange) confidence += 7;

    // Bonus for vocal energy co-occurrence
    if (vocalEnergy > 0.05) {
      confidence = Math.min(98, confidence + 5);
    }

    // Determine match quality
    let matchQuality: LipReadingPrediction["matchQuality"] = "searching";
    let feedback = level.clinicalCue;

    if (confidence >= 80) {
      matchQuality = "exact";
      feedback = `Excellent articulation! Lips matched target viseme: ${label}`;
    } else if (confidence >= 65) {
      matchQuality = "high";
      feedback = `Good lip movement! Approaching target: ${level.englishText} (${level.tamilText})`;
    } else if (isMoving) {
      matchQuality = "moderate";
      feedback = `Active speech movement detected: ${label}. Adjust mouth aperture.`;
    } else {
      feedback = level.clinicalCue;
    }

    const prediction: LipReadingPrediction = {
      wordTamil: level.tamilText,
      wordEnglish: level.englishText,
      confidence: isMoving ? Math.round(confidence) : 0,
      currentViseme: viseme,
      visemeLabel: label,
      sequence: visemeSeq.map((v) => VISEME_LABELS[v]),
      isArticulating: isMoving,
      matchQuality,
      feedback,
    };

    this.lastPrediction = prediction;
    return prediction;
  }

  public getLastPrediction(): LipReadingPrediction | null {
    return this.lastPrediction;
  }

  public reset(): void {
    this.frameBuffer = [];
    this.lastPrediction = null;
    this.isCurrentlyArticulating = false;
  }
}
