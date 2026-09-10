import { describe, it, expect } from "vitest";
import { REHAB_100_LEVELS, getLevelData, getLevelsByTier } from "./rehabCurriculum";
import { evaluateMultimodalAttempt } from "./multimodalEvaluator";
import { LipReadingClassifier } from "./lipReadingClassifier";
import { AcousticSpeechDetector, calculateBilingualSimilarity } from "./acousticSpeechDetector";

describe("100-Level Speech Rehabilitation Curriculum", () => {
  it("should have exactly 100 progressive levels across 5 tiers", () => {
    expect(REHAB_100_LEVELS).toHaveLength(100);
    expect(getLevelsByTier(1)).toHaveLength(20);
    expect(getLevelsByTier(2)).toHaveLength(20);
    expect(getLevelsByTier(3)).toHaveLength(20);
    expect(getLevelsByTier(4)).toHaveLength(20);
    expect(getLevelsByTier(5)).toHaveLength(20);
  });

  it("should return valid bilingual level data for Level 1 (Amma) and Level 41 (Vanakkam)", () => {
    const lvl1 = getLevelData(1);
    expect(lvl1.englishText).toBe("Amma");
    expect(lvl1.tamilText).toBe("அம்மா");
    expect(lvl1.targetViseme).toBe("bilabial");

    const lvl41 = getLevelData(41);
    expect(lvl41.englishText).toBe("Vanakkam");
    expect(lvl41.tamilText).toBe("வணக்கம்");
    expect(lvl41.tier).toBe(3);
  });
});

describe("Visual Lip-Reading Neural Classifier", () => {
  it("should classify bilabial closure viseme when lips touch", () => {
    const classifier = new LipReadingClassifier();
    const result = classifier.classifyInstantViseme(0.05, 0.48, 6.0);
    expect(result.viseme).toBe("bilabial");
  });

  it("should classify open vowel when jaw drops", () => {
    const classifier = new LipReadingClassifier();
    const result = classifier.classifyInstantViseme(0.55, 0.46, 14.5);
    expect(result.viseme).toBe("open");
  });

  it("should predict target words in Tamil and English when articulating", () => {
    const classifier = new LipReadingClassifier();
    const lvl1 = getLevelData(1); // Amma
    const mockKinematics = {
      source: "mediapipe_neural" as const,
      lipApertureRatio: 0.08,
      mouthWidthRatio: 0.46,
      jawDisplacementMm: 7.0,
      withinTarget: true,
      cue: "Bilabial seal",
      postureStatus: "Bilabial",
      landmarksDetected: true,
    };

    const prediction = classifier.processFrame(mockKinematics, lvl1, 0.12);
    expect(prediction.wordEnglish).toBe("Amma");
    expect(prediction.wordTamil).toBe("அம்மா");
    expect(prediction.confidence).toBeGreaterThanOrEqual(70);
    expect(prediction.currentViseme).toBe("bilabial");
    expect(prediction.isArticulating).toBe(true);
  });
});

describe("Acoustic Speech & Keyword Detector", () => {
  it("should calculate high similarity for Tamil and English equivalents", () => {
    expect(calculateBilingualSimilarity("Amma", "Amma")).toBe(1.0);
    expect(calculateBilingualSimilarity("அம்மா", "அம்மா")).toBe(1.0);
    expect(calculateBilingualSimilarity("amma", "Amma")).toBe(1.0);
    expect(calculateBilingualSimilarity("vanakkam", "Vanakkam")).toBe(1.0);
  });

  it("should fuse acoustic energy with curriculum level when user vocalizes", () => {
    const lvl1 = getLevelData(1);
    const detector = new AcousticSpeechDetector(lvl1);
    const result = detector.processAcousticFrame(0.15, 160, true);

    expect(result.predictedEnglish).toBe("Amma");
    expect(result.predictedTamil).toBe("அம்மா");
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(80);
    expect(result.source).toBe("acoustic_fusion");
  });
});

describe("Multimodal Machine Learning Evaluator", () => {
  it("should award mastery and 3 stars when bilabial closure and speech match for Level 1", () => {
    const lvl1 = getLevelData(1);
    const mockKinematics = {
      source: "mediapipe_neural" as const,
      lipApertureRatio: 0.04, // tight seal
      mouthWidthRatio: 0.48,
      jawDisplacementMm: 6.5,
      withinTarget: true,
      cue: "Optimal bilabial seal",
      postureStatus: "Bilabial Plosive Seal (/p/, /b/, /m/)",
      landmarksDetected: true,
    };

    const result = evaluateMultimodalAttempt(
      mockKinematics,
      0.18, // good vocal energy
      160,  // stable pitch
      "Amma",
      lvl1
    );

    expect(result.isMastered).toBe(true);
    expect(result.compositeScore).toBeGreaterThanOrEqual(85);
    expect(result.starsAwarded).toBeGreaterThanOrEqual(2);
    expect(result.isVisemeMatched).toBe(true);
  });

  it("should recognize Tamil script match correctly", () => {
    const lvl41 = getLevelData(41);
    const mockKinematics = {
      source: "mediapipe_neural" as const,
      lipApertureRatio: 0.30,
      mouthWidthRatio: 0.50,
      jawDisplacementMm: 8.0,
      withinTarget: true,
      cue: "Optimal alignment",
      postureStatus: "Optimal alignment",
      landmarksDetected: true,
    };

    const result = evaluateMultimodalAttempt(
      mockKinematics,
      0.15,
      175,
      "வணக்கம்",
      lvl41
    );

    expect(result.phonemicScore).toBeGreaterThanOrEqual(90);
    expect(result.isMastered).toBe(true);
  });
});
