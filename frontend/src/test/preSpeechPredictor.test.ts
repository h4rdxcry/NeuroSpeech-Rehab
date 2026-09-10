import { describe, it, expect, beforeEach } from "vitest";
import { PreSpeechPreparatoryPredictor } from "../lib/preSpeechPredictor";
import { DEFAULT_ACTION_UNITS, type ArticulatoryKinematics } from "../lib/faceMeshTracker";
import { getLevelData } from "../lib/rehabCurriculum";

describe("PreSpeechPreparatoryPredictor (Das et al., 2022 Integration)", () => {
  let predictor: PreSpeechPreparatoryPredictor;

  beforeEach(() => {
    predictor = new PreSpeechPreparatoryPredictor(getLevelData(1));
  });

  it("initializes in early preparation phase with baseline values", () => {
    const dummyKin: ArticulatoryKinematics = {
      source: "mediapipe_neural",
      lipApertureRatio: 0.1,
      mouthWidthRatio: 0.48,
      jawDisplacementMm: 5.0,
      withinTarget: true,
      cue: "Neutral",
      postureStatus: "Neutral",
      landmarksDetected: true,
      actionUnits: DEFAULT_ACTION_UNITS,
    };

    const evalResult = predictor.processFrame(dummyKin, 0, 96.5);
    expect(evalResult.phase).toBe("early");
    expect(evalResult.disfluencyRisk).toBe("low");
    expect(evalResult.anticipatoryFluencyProbability).toBeGreaterThan(80);
    expect(evalResult.xai.primaryAttribution).toBeDefined();
    expect(evalResult.xai.shapleyMap).toBeDefined();
  });

  it("detects disfluency risk when early AU4 (brow) and late AU20 (lip stretch) tension is high", () => {
    const tenseKin: ArticulatoryKinematics = {
      source: "mediapipe_neural",
      lipApertureRatio: 0.05,
      mouthWidthRatio: 0.65,
      jawDisplacementMm: 3.0,
      withinTarget: false,
      cue: "Tension",
      postureStatus: "Tense Stance",
      landmarksDetected: true,
      actionUnits: {
        ...DEFAULT_ACTION_UNITS,
        au4BrowLowerer: 0.85,
        au20LipStretcher: 0.90,
        upperFaceTension: 80,
        lowerFaceTension: 85,
        motorOverflowIndex: 82,
      },
    };

    const evalResult = predictor.processFrame(tenseKin, 0, 82.0);
    expect(evalResult.disfluencyRisk).toBe("high");
    expect(evalResult.anticipatoryFluencyProbability).toBeLessThan(50);
    expect(evalResult.xai.riskFactors.length).toBeGreaterThan(0);
    expect(evalResult.xai.shapleyMap.au4BrowLowerer).toBeLessThan(0);
  });

  it("supports clinician simulation of speech motor block", () => {
    const simBlock = predictor.simulatePreparatoryBlock();
    expect(simBlock.status).toBe("disfluency_risk");
    expect(simBlock.disfluencyRisk).toBe("high");
    expect(simBlock.anticipatoryFluencyProbability).toBe(24);
    expect(simBlock.xai.clinicalCue).toContain("relax your jaw");
    expect(simBlock.xai.shapleyMap.au4BrowLowerer).toBeLessThan(-0.5);

    predictor.clearSimulation();
    const resumed = predictor.processFrame(null, 0, 96.0);
    expect(resumed.anticipatoryFluencyProbability).toBeGreaterThan(70);
  });

  it("supports clinician simulation of optimal fluent preparatory state", () => {
    const simOptimal = predictor.simulateOptimalPrep();
    expect(simOptimal.status).toBe("optimal");
    expect(simOptimal.disfluencyRisk).toBe("low");
    expect(simOptimal.anticipatoryFluencyProbability).toBe(95);
    expect(simOptimal.xai.positiveFactors.length).toBeGreaterThan(0);
  });
});
