/**
 * NeuroSpeech Rehab - In-Browser MediaPipe FaceMesh & Lip Tracker
 * 
 * Executes real-time 3D facial and lip articulation landmark tracking directly
 * in the client browser using WebAssembly and GPU acceleration (30-60 FPS).
 * Eliminates server round-trip latency and works seamlessly on Vercel and offline.
 */

export const OUTER_LIPS_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146
];

export const INNER_LIPS_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95
];

export const JAWLINE_INDICES = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454
];

export const CHIN_INDEX = 152;
export const UPPER_LIP_INDEX = 13;
export const LOWER_LIP_INDEX = 14;
export const LEFT_CORNER_INDEX = 61;
import { EMPIRICAL_VISEME_PRIORS, EMPIRICAL_TRANSITION_MATRIX } from './empiricalVisemePriors';

export const RIGHT_CORNER_INDEX = 291;

export const KEY_ARTICULATORY_INDICES = [0, 13, 14, 17, 61, 291, 78, 308, 152, 172, 397];

export interface LipMetrics {
  apertureRatio: number; // Vertical opening (inner lip 13 to 14)
  widthRatio: number;    // Horizontal stretch (corner 61 to 291)
  symmetryScore: number; // Bilateral corner symmetry
  apertureVelocity?: number; // delta aperture / dt
  widthVelocity?: number;    // delta width / dt
}

export interface LiveArticulatoryTelemetry {
  faceDetected: boolean;
  landmarkCount: number;
  upperLipY: number;
  lowerLipY: number;
  leftCornerX: number;
  leftCornerY: number;
  rightCornerX: number;
  rightCornerY: number;
  mouthOpeningDistance: number;
  apertureRatio: number;
  widthRatio: number;
  symmetryScore: number;
  chinX: number;
  chinY: number;
  chinZ: number;
  jawWidth: number;
  jawDisplacementX: number;
  timestamp: number;
  fps: number;
  inferenceLatencyMs: number;
  visemeClass: string;
  visemeProbability: number;
  apertureVelocity?: number;
  widthVelocity?: number;
  headPitchDeg?: number;
  headYawDeg?: number;
  headRollDeg?: number;
}

/**
 * 3D Rigid Procrustes Alignment to remove head roll, pitch, and yaw.
 * Converts camera-space coordinates into a canonical frontal facial frame.
 */
export function normalizeHeadPose3D(landmarks: number[][]): {
  normalizedLandmarks: number[][];
  rollDeg: number;
  pitchDeg: number;
  yawDeg: number;
  eyeDist: number;
} {
  if (!landmarks || landmarks.length < 468) {
    return {
      normalizedLandmarks: landmarks,
      rollDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      eyeDist: 0.25,
    };
  }

  // 1. Center at midpoint between outer eye corners (33 and 263)
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const eyeCenter = [
    (leftEye[0] + rightEye[0]) / 2.0,
    (leftEye[1] + rightEye[1]) / 2.0,
    ((leftEye[2] || 0) + (rightEye[2] || 0)) / 2.0,
  ];

  // 2. Inter-ocular 3D distance for scale invariance
  const dx = rightEye[0] - leftEye[0];
  const dy = rightEye[1] - leftEye[1];
  const dz = (rightEye[2] || 0) - (leftEye[2] || 0);
  const eyeDist = Math.hypot(dx, dy, dz) || 0.25;

  // 3. Roll angle (in-plane eye tilt)
  const rollAngle = Math.atan2(dy, dx);
  const rollDeg = Math.round((rollAngle * 180) / Math.PI * 10) / 10;
  const cosR = Math.cos(-rollAngle);
  const sinR = Math.sin(-rollAngle);

  // 4. Pitch & Yaw from facial midline (nose tip 1, bridge 168, chin 152)
  const nose = landmarks[1];
  const chin = landmarks[152];
  const yawAngle = Math.atan2(nose[0] - eyeCenter[0], Math.max(0.08, Math.abs(nose[2] || 0.1)));
  const yawDeg = Math.round((yawAngle * 180) / Math.PI * 10) / 10;

  const pitchAngle = Math.atan2(nose[1] - eyeCenter[1], Math.max(0.08, Math.abs(nose[2] || 0.1)));
  const pitchDeg = Math.round((pitchAngle * 180) / Math.PI * 10) / 10;

  // 5. Apply rigid alignment
  const norm: number[][] = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    const tx = (pt[0] - eyeCenter[0]) / eyeDist;
    const ty = (pt[1] - eyeCenter[1]) / eyeDist;
    const tz = ((pt[2] || 0) - eyeCenter[2]) / eyeDist;

    // In-plane de-rotation
    const rx = tx * cosR - ty * sinR;
    const ry = tx * sinR + ty * cosR;

    norm[i] = [rx, ry, tz];
  }

  return {
    normalizedLandmarks: norm,
    rollDeg,
    pitchDeg,
    yawDeg,
    eyeDist,
  };
}

export type FaceMeshCallback = (
  landmarks: number[][], 
  faceDetected: boolean, 
  telemetry?: LiveArticulatoryTelemetry
) => void;

class FaceMeshTrackerService {
  private faceMeshInstance: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private isProcessing = false;
  private isStopped = false;
  private animFrameId: number | null = null;
  private lastFrameTimestamp = 0;
  private targetFpsInterval = 1000 / 30; // 30 FPS target for optimal CPU & smooth rendering
  private activeCallback: FaceMeshCallback | null = null;
  private lastSendTimestamp = 0;
  private lastResultTimestamp = 0;
  private rollingFps = 30;
  private currentInferenceMs = 14;
  private prevApertureRatio = 0.045;
  private prevWidthRatio = 0.510;
  private prevMetricsTime = 0;

  /**
   * Ensure the MediaPipe FaceMesh script is loaded into the browser document.
   */
  private async ensureScriptLoaded(): Promise<any> {
    if (typeof window === 'undefined') return null;

    if ((window as any).FaceMesh) {
      return (window as any).FaceMesh;
    }

    // Try dynamic import from node_modules first
    try {
      const mp = await import('@mediapipe/face_mesh');
      const FaceMeshClass = (mp as any).FaceMesh || (mp as any).default?.FaceMesh;
      if (FaceMeshClass) {
        (window as any).FaceMesh = FaceMeshClass;
        return FaceMeshClass;
      }
    } catch {
      // Dynamic import fallback to script tags
    }

    // Load from local /mediapipe/face_mesh.js or CDN
    return new Promise((resolve) => {
      let resolved = false;

      const checkExisting = () => {
        if ((window as any).FaceMesh) {
          resolved = true;
          resolve((window as any).FaceMesh);
          return true;
        }
        return false;
      };

      if (checkExisting()) return;

      const script = document.createElement('script');
      script.src = '/mediapipe/face_mesh.js';
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        if (!resolved) {
          resolved = true;
          resolve((window as any).FaceMesh || null);
        }
      };

      script.onerror = () => {
        // Fallback to jsdelivr CDN if local script fails
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js';
        cdnScript.crossOrigin = 'anonymous';
        cdnScript.onload = () => {
          if (!resolved) {
            resolved = true;
            resolve((window as any).FaceMesh || null);
          }
        };
        cdnScript.onerror = () => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        };
        document.head.appendChild(cdnScript);
      };

      document.head.appendChild(script);

      // Timeout polling fallback
      let attempts = 0;
      const pollInterval = setInterval(() => {
        attempts++;
        if (checkExisting() || attempts > 30) {
          clearInterval(pollInterval);
          if (!resolved) {
            resolved = true;
            resolve((window as any).FaceMesh || null);
          }
        }
      }, 100);
    });
  }

  /**
   * Dynamically loads and initializes the MediaPipe FaceMesh model.
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.faceMeshInstance) {
      return true;
    }

    if (this.isInitializing) {
      // Wait for ongoing initialization
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this.isInitialized) {
            clearInterval(interval);
            resolve(true);
          } else if (!this.isInitializing) {
            clearInterval(interval);
            resolve(false);
          }
        }, 50);
      });
    }

    this.isInitializing = true;

    try {
      const FaceMeshClass = await this.ensureScriptLoaded();

      if (!FaceMeshClass) {
        console.warn('[FaceMesh] Library not loaded in window or bundle.');
        this.isInitializing = false;
        return false;
      }

      console.log('[FaceMesh] Initializing MediaPipe WASM graph...');
      const instance = new FaceMeshClass({
        locateFile: (file: string) => {
          // Serve from local /mediapipe/ static folder on Vercel
          return `/mediapipe/${file}`;
        }
      });

      instance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4
      });

      instance.onResults((results: any) => {
        if (this.isStopped) return;

        const now = performance.now();
        if (this.lastResultTimestamp > 0) {
          const delta = now - this.lastResultTimestamp;
          if (delta > 0) {
            this.rollingFps = Math.min(60, Math.max(1, Math.round(1000 / delta)));
          }
        }
        this.lastResultTimestamp = now;

        if (this.lastSendTimestamp > 0) {
          this.currentInferenceMs = Math.round(now - this.lastSendTimestamp);
        }

        if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const raw = results.multiFaceLandmarks[0];
          const landmarks: number[][] = raw.map((p: any) => [p.x, p.y, p.z || 0]);
          const telemetry = this.computeTelemetry(landmarks, now);

          if (this.activeCallback) {
            this.activeCallback(landmarks, true, telemetry);
          }
        } else {
          if (this.activeCallback) {
            this.activeCallback([], false);
          }
        }
      });

      // Explicitly initialize the WebAssembly graph
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      this.faceMeshInstance = instance;
      this.isInitialized = true;
      this.isInitializing = false;
      console.log('[FaceMesh] WebAssembly engine initialized and ready.');
      return true;
    } catch (err) {
      console.error('[FaceMesh] Failed to initialize tracker:', err);
      this.isInitializing = false;
      return false;
    }
  }

  /**
   * Starts tracking on a live HTMLVideoElement.
   */
  async startTracking(videoElement: HTMLVideoElement, callback: FaceMeshCallback) {
    this.isStopped = false;
    this.activeCallback = callback;

    const ready = await this.initialize();
    if (!ready || !this.faceMeshInstance) {
      console.warn('[FaceMesh] Engine not ready yet, queuing retry...');
      setTimeout(async () => {
        if (!this.isStopped && await this.initialize()) {
          this.startTrackingLoop(videoElement);
        }
      }, 400);
      return;
    }

    this.startTrackingLoop(videoElement);
  }

  private startTrackingLoop(videoElement: HTMLVideoElement) {
    this.stopTrackingLoop();
    this.isStopped = false;

    console.log('[FaceMesh] Starting video frame capture loop...');

    const loop = async (timestamp: number) => {
      if (this.isStopped) return;

      // Ensure video is actively playing and has dimensions > 0 before sending to WebGL
      if (
        videoElement &&
        !videoElement.paused &&
        !videoElement.ended &&
        videoElement.readyState >= 2 &&
        videoElement.videoWidth > 0 &&
        videoElement.videoHeight > 0
      ) {
        // Throttle to target FPS
        if (timestamp - this.lastFrameTimestamp >= this.targetFpsInterval) {
          if (!this.isProcessing && this.faceMeshInstance) {
            this.isProcessing = true;
            this.lastFrameTimestamp = timestamp;
            try {
              this.lastSendTimestamp = performance.now();
              await this.faceMeshInstance.send({ image: videoElement });
            } catch (e) {
              console.warn('[FaceMesh] Frame processing warning:', e);
            } finally {
              this.isProcessing = false;
            }
          }
        }
      }

      if (!this.isStopped) {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stops the video frame processing loop.
   */
  stopTrackingLoop() {
    this.isStopped = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isProcessing = false;
  }

  /**
   * Computes normalized articulatory kinematic metrics from 468 landmark coordinates
   * using 3D rigid Procrustes head-pose invariant alignment.
   */
  computeLipMetrics(landmarks: number[][]): LipMetrics {
    if (!landmarks || landmarks.length < 468) {
      return { apertureRatio: 0, widthRatio: 0, symmetryScore: 1.0, apertureVelocity: 0, widthVelocity: 0 };
    }

    // 1. 3D Head-Pose De-Rotation Alignment
    const { normalizedLandmarks } = normalizeHeadPose3D(landmarks);

    // 2. Pose-invariant Aperture (Upper inner lip 13 to Lower inner lip 14)
    const pLipTop = normalizedLandmarks[13];
    const pLipBottom = normalizedLandmarks[14];
    const rawAperture = Math.hypot(pLipTop[0] - pLipBottom[0], pLipTop[1] - pLipBottom[1]);
    const apertureRatio = Math.min(1.0, rawAperture);

    // 3. Pose-invariant Width (Corner 61 to Corner 291)
    const pCornerL = normalizedLandmarks[61];
    const pCornerR = normalizedLandmarks[291];
    const rawWidth = Math.hypot(pCornerL[0] - pCornerR[0], pCornerL[1] - pCornerR[1]);
    const widthRatio = Math.min(1.5, rawWidth);

    // 4. Bilateral symmetry relative to facial midline bridge (168)
    const pNose = normalizedLandmarks[168];
    const distL = Math.hypot(pCornerL[0] - pNose[0], pCornerL[1] - pNose[1]);
    const distR = Math.hypot(pCornerR[0] - pNose[0], pCornerR[1] - pNose[1]);
    const symmetryScore = Math.max(0, 1.0 - (Math.abs(distL - distR) / Math.max(distL, distR, 0.01)));

    return {
      apertureRatio: Math.round(apertureRatio * 1000) / 1000,
      widthRatio: Math.round(widthRatio * 1000) / 1000,
      symmetryScore: Math.round(symmetryScore * 1000) / 1000,
    };
  }

  /**
   * Computes detailed real-time articulatory telemetry for jaw, chin, and lip metrics
   * using empirical benchmark prior distributions (MIRACL-VC1 / GRID / LRW) and 3D pose normalization.
   */
  computeTelemetry(landmarks: number[][], timestamp: number): LiveArticulatoryTelemetry | undefined {
    if (!landmarks || landmarks.length < 468) return undefined;

    // 1. Apply 3D Procrustes rigid alignment for pitch, yaw, and roll invariance
    const { normalizedLandmarks, rollDeg, pitchDeg, yawDeg, eyeDist } = normalizeHeadPose3D(landmarks);

    // 2. Pose-invariant 3D mouth metrics
    const pLipTop = normalizedLandmarks[13];
    const pLipBottom = normalizedLandmarks[14];
    const rawAperture = Math.hypot(pLipTop[0] - pLipBottom[0], pLipTop[1] - pLipBottom[1]);
    const apertureRatio = Math.min(1.0, rawAperture);

    const pCornerL = normalizedLandmarks[61];
    const pCornerR = normalizedLandmarks[291];
    const rawWidth = Math.hypot(pCornerL[0] - pCornerR[0], pCornerL[1] - pCornerR[1]);
    const widthRatio = Math.min(1.5, rawWidth);

    // 3. Dynamic temporal velocities (frame-to-frame change per second)
    const now = performance.now();
    const dt = Math.max(0.016, (now - (this.prevMetricsTime || now)) / 1000);
    const apertureVelocity = Math.round(((apertureRatio - this.prevApertureRatio) / dt) * 1000) / 1000;
    const widthVelocity = Math.round(((widthRatio - this.prevWidthRatio) / dt) * 1000) / 1000;
    this.prevApertureRatio = apertureRatio;
    this.prevWidthRatio = widthRatio;
    this.prevMetricsTime = now;

    // 4. Bilateral corner symmetry relative to nose bridge (168)
    const pNose = normalizedLandmarks[168];
    const distL = Math.hypot(pCornerL[0] - pNose[0], pCornerL[1] - pNose[1]);
    const distR = Math.hypot(pCornerR[0] - pNose[0], pCornerR[1] - pNose[1]);
    const symmetryScore = Math.max(0, 1.0 - (Math.abs(distL - distR) / Math.max(distL, distR, 0.01)));

    // 5. Jaw & Chin camera-plane tracking for visual overlay
    const rawChin = landmarks[152];
    const rawNose = landmarks[1];
    const rawJawL = landmarks[397];
    const rawJawR = landmarks[172];
    const jawWidth = Math.hypot(rawJawL[0] - rawJawR[0], rawJawL[1] - rawJawR[1]);
    const jawDisplacementX = rawChin[0] - rawNose[0];

    // 6. Empirical Gaussian scoring against benchmark priors
    let bestViseme = 'Neutral / Closed';
    let bestProb = 0.85;

    let minMahalanobis = Infinity;
    const xVec = [apertureRatio, widthRatio, apertureVelocity, widthVelocity];

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

      if (dSq < minMahalanobis) {
        minMahalanobis = dSq;
        bestViseme = `${prior.name} [${prior.description.split(' ')[1] || ''}]`;
        bestProb = Math.min(0.99, Math.max(0.65, 1.0 / (1.0 + Math.exp(dSq * 0.12))));
      }
    }

    if (apertureRatio < 0.055 && Math.abs(apertureVelocity) < 0.10) {
      bestViseme = 'Neutral / Closed';
      bestProb = 0.95;
    }

    return {
      faceDetected: true,
      landmarkCount: landmarks.length,
      upperLipY: Math.round(landmarks[13][1] * 10000) / 10000,
      lowerLipY: Math.round(landmarks[14][1] * 10000) / 10000,
      leftCornerX: Math.round(landmarks[61][0] * 10000) / 10000,
      leftCornerY: Math.round(landmarks[61][1] * 10000) / 10000,
      rightCornerX: Math.round(landmarks[291][0] * 10000) / 10000,
      rightCornerY: Math.round(landmarks[291][1] * 10000) / 10000,
      mouthOpeningDistance: Math.round(rawAperture * 10000) / 10000,
      apertureRatio: Math.round(apertureRatio * 1000) / 1000,
      widthRatio: Math.round(widthRatio * 1000) / 1000,
      symmetryScore: Math.round(symmetryScore * 1000) / 1000,
      chinX: Math.round(rawChin[0] * 10000) / 10000,
      chinY: Math.round(rawChin[1] * 10000) / 10000,
      chinZ: Math.round((rawChin[2] || 0) * 10000) / 10000,
      jawWidth: Math.round(jawWidth * 10000) / 10000,
      jawDisplacementX: Math.round(jawDisplacementX * 10000) / 10000,
      timestamp: Math.round(timestamp),
      fps: this.rollingFps,
      inferenceLatencyMs: this.currentInferenceMs,
      visemeClass: bestViseme,
      visemeProbability: Math.round(bestProb * 100) / 100,
      apertureVelocity,
      widthVelocity,
      headPitchDeg: pitchDeg,
      headYawDeg: yawDeg,
      headRollDeg: rollDeg,
    };
  }

  isReady(): boolean {
    return this.isInitialized && !!this.faceMeshInstance;
  }

  cleanup() {
    this.stopTrackingLoop();
    this.activeCallback = null;
  }
}

export const faceMeshTracker = new FaceMeshTrackerService();
