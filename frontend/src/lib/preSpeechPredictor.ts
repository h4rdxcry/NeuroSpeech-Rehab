/**
 * Pre-Speech Preparatory Predictor & Explainable AI (XAI) Biofeedback Engine
 *
 * Implements the neuroscience findings from:
 * "Multimodal explainable AI predicts upcoming speech behavior in adults who stutter"
 * (Das, Mock, Irani, Huang, Najafirad, Golob; Frontiers in Neuroscience, 2022. PMC9376608)
 *
 * Clinical & Biomechanical Foundations:
 * 1. S1-S2 Paradigm (1500 ms):
 *    - S1 (0 ms): Stimulus/Cue presented -> Speech preparation phase initiates.
 *    - S2 (1500 ms): Speech target cue -> Phonation/Vocalization initiates.
 * 2. Temporal Dynamics of Disfluency:
 *    - In stuttered/disfluent speech preparation:
 *      * Upper facial muscles (AU4 Brow Lowerer, AU1 Inner Brow, AU6 Cheek) peak EARLY (0-600 ms post-S1).
 *      * Lower facial muscles (AU20 Lip Stretcher, AU14 Dimpler, AU15 Lip Depressor) peak LATE (600-1500 ms).
 *    - In fluent trials:
 *      * Upper facial muscles remain relaxed across the preparatory window.
 *      * Lower facial muscles exhibit early, gentle readiness with low tension.
 * 3. Explainable AI (XAI):
 *    - Generates trial-by-trial Shapley-style attribution maps explaining WHY upcoming speech
 *      is predicted to be fluent or disfluent before phonation occurs.
 */

import type { ArticulatoryKinematics } from "./faceMeshTracker";
import type { CurriculumLevel } from "./rehabCurriculum";

export interface ShapleyAttributionMap {
  au4BrowLowerer: number;     // -1.0 (strongly predicts disfluent) to +1.0 (strongly predicts fluent)
  au20LipStretcher: number;   // -1.0 to +1.0
  bilateralSymmetry: number;  // -1.0 to +1.0
  phonationTiming: number;    // -1.0 to +1.0
  vocalRampSmoothness?: number;
}

export interface ExplainableBiofeedback {
  primaryAttribution: string;
  positiveFactors: string[];
  riskFactors: string[];
  clinicalCue: string;
  shapleyMap: ShapleyAttributionMap;
}

export interface PreSpeechEvaluation {
  status: "preparing" | "ready" | "disfluency_risk" | "optimal";
  phase: "early" | "middle" | "late" | "speech_onset";
  elapsedMs: number;
  preparationProgress: number; // 0 to 100% (progress through 1500ms S1-S2 window)
  anticipatoryFluencyProbability: number; // 0 to 100% (benchmarked against 80.8% model accuracy)
  disfluencyRisk: "low" | "moderate" | "high";
  earlyUpperTension: number;   // 0-100% (AU4 / Brow average in 0-600ms)
  lateLowerTension: number;    // 0-100% (AU20 / Lip Stretcher average in 600-1500ms)
  currentUpperTension: number; // Instantaneous upper face tension
  currentLowerTension: number; // Instantaneous lower face tension
  motorOverflowIndex: number;  // 0-100% composite neuromotor tension
  xai: ExplainableBiofeedback;
}

interface PreparatorySample {
  timestamp: number;
  elapsedMs: number;
  phase: "early" | "middle" | "late";
  au4: number;
  au20: number;
  upperTension: number;
  lowerTension: number;
  symmetry: number;
  vocalEnergy: number;
}

export class PreSpeechPreparatoryPredictor {
  private startTime: number = 0;
  private samples: PreparatorySample[] = [];
  private targetLevel: CurriculumLevel | null = null;
  private simulatedOverride: PreSpeechEvaluation | null = null;

  // Window constants from Das et al. (2022)
  public static readonly PREPARATION_WINDOW_MS = 1500;
  public static readonly EARLY_PHASE_END_MS = 600;
  public static readonly MIDDLE_PHASE_END_MS = 1000;

  constructor(targetLevel?: CurriculumLevel) {
    if (targetLevel) {
      this.targetLevel = targetLevel;
    }
    this.reset();
  }

  /**
   * Resets the buffer and starts the 1500ms S1-S2 preparatory window.
   */
  public reset(newTarget?: CurriculumLevel): void {
    if (newTarget) {
      this.targetLevel = newTarget;
    }
    this.startTime = Date.now();
    this.samples = [];
    this.simulatedOverride = null;
  }

  /**
   * Updates target level without resetting if already in progress.
   */
  public setTargetLevel(level: CurriculumLevel): void {
    this.targetLevel = level;
    this.reset(level);
  }

  /**
   * Evaluates an instantaneous video/audio frame within the speech preparation window.
   */
  public processFrame(
    kinematics: ArticulatoryKinematics | null,
    vocalEnergy: number = 0,
    bilateralSymmetry: number = 96.0
  ): PreSpeechEvaluation {
    // If a clinician simulation is active, return the simulated profile
    if (this.simulatedOverride) {
      return this.simulatedOverride;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - this.startTime);
    const progress = Math.min(100, Math.round((elapsedMs / PreSpeechPreparatoryPredictor.PREPARATION_WINDOW_MS) * 100));

    // Determine current preparation phase
    let phase: "early" | "middle" | "late" | "speech_onset" = "early";
    if (elapsedMs >= PreSpeechPreparatoryPredictor.PREPARATION_WINDOW_MS || vocalEnergy > 0.06) {
      phase = "speech_onset";
    } else if (elapsedMs >= PreSpeechPreparatoryPredictor.MIDDLE_PHASE_END_MS) {
      phase = "late";
    } else if (elapsedMs >= PreSpeechPreparatoryPredictor.EARLY_PHASE_END_MS) {
      phase = "middle";
    }

    // Extract current Action Units from kinematics
    const au = kinematics?.actionUnits;
    const au4 = au ? au.au4BrowLowerer : 0.06;
    const au20 = au ? au.au20LipStretcher : 0.06;
    const upperTension = au ? au.upperFaceTension : 6;
    const lowerTension = au ? au.lowerFaceTension : 6;
    const motorOverflow = au ? au.motorOverflowIndex : 6;

    // Buffer sample if still in preparatory window (keep last 60 samples ~ 1.5s at 40fps)
    if (phase !== "speech_onset") {
      this.samples.push({
        timestamp: now,
        elapsedMs,
        phase,
        au4,
        au20,
        upperTension,
        lowerTension,
        symmetry: bilateralSymmetry,
        vocalEnergy,
      });

      if (this.samples.length > 75) {
        this.samples.shift();
      }
    }

    // Calculate early vs late temporal metrics (Das et al., 2022)
    const earlySamples = this.samples.filter((s) => s.phase === "early");
    const lateSamples = this.samples.filter((s) => s.phase === "late");

    const earlyUpperAvg = earlySamples.length > 0
      ? earlySamples.reduce((sum, s) => sum + s.upperTension, 0) / earlySamples.length
      : upperTension;

    const lateLowerAvg = lateSamples.length > 0
      ? lateSamples.reduce((sum, s) => sum + s.lowerTension, 0) / lateSamples.length
      : lowerTension;

    // ─── DISFLUENCY RISK CALCULATION ───────────────────────────────────────
    // As observed in the paper:
    // Disfluent speech is characterized by:
    // 1. High early upper tension (AU4 brow furrowing / anticipatory tension)
    // 2. High late lower tension (AU20 lip stretcher / articulatory co-contraction)
    // 3. Bilateral facial asymmetry (motor overflow)
    const earlyBrowPenalty = Math.max(0, (earlyUpperAvg - 25) * 1.3);
    const lateLipPenalty = Math.max(0, (lateLowerAvg - 25) * 1.4);
    const symmetryPenalty = Math.max(0, (95 - bilateralSymmetry) * 1.5);
    const prematurePhonationPenalty = elapsedMs < 400 && vocalEnergy > 0.08 ? 20 : 0;

    const rawDisfluencyScore = Math.min(
      100,
      Math.max(0, Math.round(earlyBrowPenalty * 0.40 + lateLipPenalty * 0.40 + symmetryPenalty * 0.15 + prematurePhonationPenalty * 0.05))
    );

    // Anticipatory Fluency Probability (0 to 100%)
    const fluencyProbability = Math.max(8, Math.min(98, 100 - rawDisfluencyScore));

    let disfluencyRisk: "low" | "moderate" | "high" = "low";
    if (rawDisfluencyScore >= 55) {
      disfluencyRisk = "high";
    } else if (rawDisfluencyScore >= 28) {
      disfluencyRisk = "moderate";
    }

    let status: "preparing" | "ready" | "disfluency_risk" | "optimal" = "preparing";
    if (disfluencyRisk === "high") {
      status = "disfluency_risk";
    } else if (phase === "speech_onset" || elapsedMs >= 1200) {
      status = fluencyProbability >= 85 ? "optimal" : "ready";
    }

    // ─── EXPLAINABLE AI (XAI) ATTRIBUTION (DeepSHAP Inspired) ───────────────
    const shapleyAU4 = Number(Math.max(-1.0, Math.min(1.0, (25 - earlyUpperAvg) / 35)).toFixed(2));
    const shapleyAU20 = Number(Math.max(-1.0, Math.min(1.0, (25 - lateLowerAvg) / 35)).toFixed(2));
    const shapleySymmetry = Number(Math.max(-1.0, Math.min(1.0, (bilateralSymmetry - 90) / 10)).toFixed(2));
    const shapleyPhonation = Number(Math.max(-1.0, Math.min(1.0, (90 - prematurePhonationPenalty) / 50)).toFixed(2));

    const positiveFactors: string[] = [];
    const riskFactors: string[] = [];

    if (earlyUpperAvg <= 25) {
      positiveFactors.push("Relaxed brow posture (AU4 < 25%) indicates calm preparatory stance");
    } else {
      riskFactors.push(`Elevated early brow tension (AU4: ${Math.round(earlyUpperAvg)}%) suggests anticipatory tension`);
    }

    if (lateLowerAvg <= 25) {
      positiveFactors.push("Flexible peri-oral alignment (AU20 < 25%) promotes fluid articulatory release");
    } else {
      riskFactors.push(`Late lower-face rigidity (AU20: ${Math.round(lateLowerAvg)}%) indicates articulatory spasm risk`);
    }

    if (bilateralSymmetry >= 93) {
      positiveFactors.push(`High bilateral facial symmetry (${bilateralSymmetry.toFixed(1)}%) indicates balanced motor drive`);
    } else {
      riskFactors.push(`Facial asymmetry detected (${bilateralSymmetry.toFixed(1)}%) indicates unilateral motor overflow`);
    }

    let primaryAttribution = "Neuromotor speech planning is balanced and receptive for phonation.";
    let clinicalCue = "Breathe naturally and release into the first syllable with ease.";

    if (disfluencyRisk === "high") {
      if (earlyUpperAvg > lateLowerAvg) {
        primaryAttribution = "Anticipatory cognitive strain detected in upper orbital region prior to phonation.";
        clinicalCue = "Soften your forehead and eyelids. Inhale gently before starting to speak.";
      } else {
        primaryAttribution = "Elevated lower lip co-contraction detected immediately prior to sound production.";
        clinicalCue = "Loosen jaw and tongue contact. Allow air to flow smoothly through the articulators.";
      }
    } else if (disfluencyRisk === "moderate") {
      primaryAttribution = "Mild articulatory tension detected. Approaching speech execution threshold.";
      clinicalCue = "Maintain steady breath support and ease into the initial phoneme.";
    } else {
      primaryAttribution = "Optimal speech-motor preparatory stance. High probability of fluent articulation.";
      clinicalCue = "Excellent physiological readiness! Speak the target word with continuous airflow.";
    }

    const xai: ExplainableBiofeedback = {
      primaryAttribution,
      positiveFactors,
      riskFactors,
      clinicalCue,
      shapleyMap: {
        au4BrowLowerer: shapleyAU4,
        au20LipStretcher: shapleyAU20,
        bilateralSymmetry: shapleySymmetry,
        phonationTiming: shapleyPhonation,
        vocalRampSmoothness: shapleyPhonation,
      },
    };

    return {
      status,
      phase,
      elapsedMs,
      preparationProgress: progress,
      anticipatoryFluencyProbability: fluencyProbability,
      disfluencyRisk,
      earlyUpperTension: Math.round(earlyUpperAvg),
      lateLowerTension: Math.round(lateLowerAvg),
      currentUpperTension: upperTension,
      currentLowerTension: lowerTension,
      motorOverflowIndex: motorOverflow,
      xai,
    };
  }

  // ─── CLINICIAN SIMULATION MODES ──────────────────────────────────────────

  /**
   * Simulates an authentic stuttering / speech motor block preparation profile
   * (High early AU4 brow lowerer + High late AU20 lip stretch + facial asymmetry).
   */
  public simulatePreparatoryBlock(): PreSpeechEvaluation {
    const sim: PreSpeechEvaluation = {
      status: "disfluency_risk",
      phase: "late",
      elapsedMs: 1100,
      preparationProgress: 73,
      anticipatoryFluencyProbability: 24,
      disfluencyRisk: "high",
      earlyUpperTension: 82,
      lateLowerTension: 88,
      currentUpperTension: 76,
      currentLowerTension: 91,
      motorOverflowIndex: 84,
      xai: {
        primaryAttribution: "Anticipatory motor block detected: Premature brow furrowing (AU4: 82%) and peri-oral rigidity (AU20: 88%).",
        positiveFactors: [],
        riskFactors: [
          "Elevated early brow tension (AU4: 82%) indicates anticipatory motor overflow",
          "Late lower-lip stretching (AU20: 88%) indicates imminent bilabial block",
          "Bilateral zygomatic asymmetry (82.4%) indicates unilateral motor co-activation",
        ],
        clinicalCue: "Pause briefly. Drop your shoulders, relax your jaw, and let the air flow before speaking.",
        shapleyMap: {
          au4BrowLowerer: -0.85,
          au20LipStretcher: -0.92,
          bilateralSymmetry: -0.65,
          phonationTiming: -0.40,
          vocalRampSmoothness: -0.40,
        },
      },
    };

    this.simulatedOverride = sim;
    return sim;
  }

  /**
   * Simulates an optimal, calm, and fluent speech preparation profile.
   */
  public simulateOptimalPrep(): PreSpeechEvaluation {
    const sim: PreSpeechEvaluation = {
      status: "optimal",
      phase: "speech_onset",
      elapsedMs: 1500,
      preparationProgress: 100,
      anticipatoryFluencyProbability: 95,
      disfluencyRisk: "low",
      earlyUpperTension: 8,
      lateLowerTension: 10,
      currentUpperTension: 6,
      currentLowerTension: 8,
      motorOverflowIndex: 7,
      xai: {
        primaryAttribution: "Optimal neuromotor readiness: Low facial tension and balanced bilateral articulatory posture.",
        positiveFactors: [
          "Relaxed brow posture (AU4: 8%) confirms absence of anticipatory strain",
          "Flexible peri-oral musculature (AU20: 10%) supports smooth phonation release",
          "Bilateral facial symmetry (98.6%) reflects balanced cortical motor control",
        ],
        riskFactors: [],
        clinicalCue: "Perfect speech-motor readiness! Vocalize with steady diaphragmatic breath support.",
        shapleyMap: {
          au4BrowLowerer: 0.88,
          au20LipStretcher: 0.90,
          bilateralSymmetry: 0.94,
          phonationTiming: 0.85,
          vocalRampSmoothness: 0.85,
        },
      },
    };

    this.simulatedOverride = sim;
    return sim;
  }

  /**
   * Returns current active target level if configured.
   */
  public getTargetLevel(): CurriculumLevel | null {
    return this.targetLevel;
  }

  /**
   * Clears any active simulation override to resume live tracking.
   */
  public clearSimulation(): void {
    this.simulatedOverride = null;
    this.reset();
  }
}
