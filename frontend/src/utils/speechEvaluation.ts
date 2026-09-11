/**
 * NeuroSpeech Rehab - Speech & Pronunciation Evaluation Engine
 * Evaluates patient speech attempts using Web Speech API transcripts,
 * phonetic character matching, and real acoustic energy levels.
 */

import { VisualPredictionResult } from './visualLipReader';

export interface SpeechEvaluationResult {
  speechDetected: boolean;
  transcript: string;
  isMatch: boolean;
  matchScore: number; // 0.0 to 1.0
  feedbackMessage: string;
  actionableTip?: string;
  acousticQuality: 'good' | 'fair' | 'poor';
  visualMatch?: boolean;
  visualConfidence?: number;
  visemeSequence?: string;
}

/**
 * Normalize text for bilingual matching:
 * Strips punctuation, excess whitespace, and lowercases English.
 */
export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,?!;:""''()—–\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein-based similarity between target and transcript (0.0 to 1.0).
 */
export function calculateTextSimilarity(target: string, transcript: string): number {
  const s1 = normalizeSpeechText(target);
  const s2 = normalizeSpeechText(transcript);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.max(0.75, Math.min(0.95, Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)));
  }

  // Token-level overlap (for multi-word phrases)
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  if (words1.length > 1 && commonWords.length > 0) {
    const wordScore = (commonWords.length / words1.length) * 0.9;
    return Math.max(wordScore, 0.4);
  }

  // Character edit distance
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null)
  );

  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Objective evaluation of an attempt based on:
 * 1. Measured audio level (Web Audio API volume)
 * 2. Speech activity duration
 * 3. Speech recognition transcript (if browser speech recognition fired)
 */
export function evaluateAttempt(
  targetText: string,
  transcript: string | null,
  peakAudioLevel: number,
  recordingSeconds: number,
  language: 'ta-IN' | 'en-IN',
  visualPrediction?: VisualPredictionResult | null
): SpeechEvaluationResult {
  const normTarget = normalizeSpeechText(targetText);
  const normTranscript = transcript ? normalizeSpeechText(transcript) : '';
  const hasVisualMatch = !!(visualPrediction && visualPrediction.isTargetMatch);

  // Case 1: Visual lip-reading match (Works silently or alongside audio)
  if (hasVisualMatch && visualPrediction) {
    const audioSimilarity = normTranscript.length > 0 ? calculateTextSimilarity(normTarget, normTranscript) : 0;
    const combinedScore = Math.max(audioSimilarity, visualPrediction.visualConfidence);

    return {
      speechDetected: true,
      transcript: normTranscript.length > 0 ? (transcript || targetText) : visualPrediction.predictedWord,
      isMatch: true,
      matchScore: combinedScore,
      feedbackMessage: normTranscript.length > 0
        ? `Speech and lip movement verified! Articulation sequence: ${visualPrediction.visemeSequenceString}`
        : `Visual lip movement matched! Recognized: "${visualPrediction.predictedWord}"`,
      actionableTip: visualPrediction.articulatoryFeedback || 'Well-articulated lip movement and vowel projection.',
      acousticQuality: peakAudioLevel > 30 ? 'good' : 'fair',
      visualMatch: true,
      visualConfidence: visualPrediction.visualConfidence,
      visemeSequence: visualPrediction.visemeSequenceString
    };
  }

  // Case 2: Transcript was captured by Speech Recognition
  if (normTranscript.length > 0) {
    const similarity = calculateTextSimilarity(normTarget, normTranscript);
    const threshold = normTarget.split(' ').length > 4 ? 0.35 : 0.45;

    if (similarity >= threshold) {
      return {
        speechDetected: true,
        transcript: transcript || '',
        isMatch: true,
        matchScore: similarity,
        feedbackMessage: 'Speech detected clearly and exercise completed.',
        acousticQuality: peakAudioLevel > 35 ? 'good' : 'fair',
        visualMatch: false,
        visualConfidence: visualPrediction?.visualConfidence,
        visemeSequence: visualPrediction?.visemeSequenceString
      };
    } else {
      // Transcript captured but words differed
      return {
        speechDetected: true,
        transcript: transcript || '',
        isMatch: false,
        matchScore: similarity,
        feedbackMessage: "Let's try that once more.",
        actionableTip: visualPrediction?.articulatoryFeedback || (language === 'ta-IN' 
          ? 'Listen to the pronunciation and pronounce each Tamil syllable clearly.' 
          : 'Listen to the audio guidance and repeat the words at a comfortable pace.'),
        acousticQuality: 'fair',
        visualMatch: false,
        visualConfidence: visualPrediction?.visualConfidence,
        visemeSequence: visualPrediction?.visemeSequenceString
      };
    }
  }

  // Case 3: Insufficient volume / no audio and no visual match
  if (peakAudioLevel < 12 && recordingSeconds < 1.5 && !visualPrediction?.isMotionDetected) {
    return {
      speechDetected: false,
      transcript: '',
      isMatch: false,
      matchScore: 0,
      feedbackMessage: "Let's try that once more.",
      actionableTip: 'Speak into your microphone or move your lips deliberately in front of the camera.',
      acousticQuality: 'poor',
      visualMatch: false
    };
  }

  // Case 4: General non-match
  return {
    speechDetected: peakAudioLevel > 14 || !!visualPrediction?.isMotionDetected,
    transcript: visualPrediction?.isMotionDetected ? visualPrediction.predictedWord : '',
    isMatch: false,
    matchScore: visualPrediction ? visualPrediction.matchScore : 0.0,
    feedbackMessage: visualPrediction?.isMotionDetected
      ? `Observed lip sequence: ${visualPrediction.visemeSequenceString}. Focus on target shape.`
      : "We couldn't evaluate this attempt. Please speak or move your lips clearly.",
    actionableTip: visualPrediction?.articulatoryFeedback || (language === 'ta-IN' 
      ? 'Pronounce each Tamil syllable distinctly and ensure your mouth is well lit.' 
      : 'Repeat the target word at a comfortable pace and keep your face centered.'),
    acousticQuality: peakAudioLevel > 35 ? 'good' : (peakAudioLevel > 14 ? 'fair' : 'poor'),
    visualMatch: false,
    visualConfidence: visualPrediction?.visualConfidence,
    visemeSequence: visualPrediction?.visemeSequenceString
  };
}
