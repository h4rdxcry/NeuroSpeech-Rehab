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
  jawDepressionRatio?: number; // Mandibular vertical drop (subnasale to chin)
  jawLateralDeviationMm?: number; // Lateral deviation from midline (mm)
  apertureVelocity?: number; // delta aperture / dt
  widthVelocity?: number;    // delta width / dt
  jawVelocity?: number;      // delta jaw depression / dt
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
  jawDepressionRatio: number;      // Pose-normalized mandibular opening
  jawOpeningMm: number;             // Physical calibrated mandibular drop (mm)
  jawLateralDeviationMm: number;    // Asymmetry indicator for hemiparetic stroke tracking (mm)
  jawVelocity?: number;             // Rate of mandibular vertical displacement
  jawProtrusionRatio?: number;      // Relative Z depth difference
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

  // 3. Center and scale all points relative to eye center and 3D eye distance
  const centered: number[][] = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    centered[i] = [
      (pt[0] - eyeCenter[0]) / eyeDist,
      (pt[1] - eyeCenter[1]) / eyeDist,
      ((pt[2] || 0) - eyeCenter[2]) / eyeDist,
    ];
  }

  // 4. Gram-Schmidt 3D Orthonormal Basis Alignment
  // Vector 1: Horizontal Eye Axis (pointing from left eye to right eye)
  const cLeft = centered[33];
  const cRight = centered[263];
  let vx = [cRight[0] - cLeft[0], cRight[1] - cLeft[1], cRight[2] - cLeft[2]];
  const lenVx = Math.hypot(vx[0], vx[1], vx[2]) || 1e-6;
  vx = [vx[0] / lenVx, vx[1] / lenVx, vx[2] / lenVx];

  // Vector 2: Vertical Axis from Eye Center (0,0,0) to Chin (152)
  const cChin = centered[152];
  let vy = [cChin[0], cChin[1], cChin[2]];
  // Project out any component along vx to ensure strict orthogonality (vy = vy - (vy . vx) * vx)
  const dotYx = vy[0] * vx[0] + vy[1] * vx[1] + vy[2] * vx[2];
  vy = [vy[0] - dotYx * vx[0], vy[1] - dotYx * vx[1], vy[2] - dotYx * vx[2]];
  const lenVy = Math.hypot(vy[0], vy[1], vy[2]) || 1e-6;
  vy = [vy[0] / lenVy, vy[1] / lenVy, vy[2] / lenVy];

  // Vector 3: Normal Axis (Z) via cross product (vz = vx x vy)
  let vz = [
    vx[1] * vy[2] - vx[2] * vy[1],
    vx[2] * vy[0] - vx[0] * vy[2],
    vx[0] * vy[1] - vx[1] * vy[0],
  ];
  const lenVz = Math.hypot(vz[0], vz[1], vz[2]) || 1e-6;
  vz = [vz[0] / lenVz, vz[1] / lenVz, vz[2] / lenVz];

  // 5. Compute Euler angles for telemetry display
  const rollAngle = Math.atan2(dy, dx);
  const rollDeg = Math.round(((rollAngle * 180) / Math.PI) * 10) / 10;
  const yawAngle = Math.asin(Math.max(-1, Math.min(1, vx[2])));
  const yawDeg = Math.round(((yawAngle * 180) / Math.PI) * 10) / 10;
  const pitchAngle = Math.atan2(-vy[2], vz[2]);
  const pitchDeg = Math.round(((pitchAngle * 180) / Math.PI) * 10) / 10;

  // 6. Rotate all landmarks into canonical frontal coordinates: [rx, ry, rz] = [dot(p, vx), dot(p, vy), dot(p, vz)]
  const norm: number[][] = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const cp = centered[i];
    norm[i] = [
      cp[0] * vx[0] + cp[1] * vx[1] + cp[2] * vx[2],
      cp[0] * vy[0] + cp[1] * vy[1] + cp[2] * vy[2],
      cp[0] * vz[0] + cp[1] * vz[1] + cp[2] * vz[2],
    ];
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
  private prevJawRatio = 0.650;
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

    // 5. Mandibular & Jaw kinematics in pose-invariant coordinates
    const pSubnasale = normalizedLandmarks[2] || normalizedLandmarks[1];
    const pChinNorm = normalizedLandmarks[152];
    const jawDepressionRatio = Math.round(Math.hypot(pChinNorm[0] - pSubnasale[0], pChinNorm[1] - pSubnasale[1]) * 1000) / 1000;
    const jawLateralDeviationMm = Math.round((pChinNorm[0] - pSubnasale[0]) * 75 * 10) / 10;

    return {
      apertureRatio: Math.round(apertureRatio * 1000) / 1000,
      widthRatio: Math.round(widthRatio * 1000) / 1000,
      symmetryScore: Math.round(symmetryScore * 1000) / 1000,
      jawDepressionRatio,
      jawLateralDeviationMm,
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

    // 3. Mandibular & Jaw tracking in 3D normalized coordinates
    const pSubnasale = normalizedLandmarks[2] || normalizedLandmarks[1];
    const pChinNorm = normalizedLandmarks[152];
    const jawDepressionRatio = Math.round(Math.hypot(pChinNorm[0] - pSubnasale[0], pChinNorm[1] - pSubnasale[1]) * 1000) / 1000;
    // Calibrated physical opening in millimeters (resting distance ~0.65 units = 0mm opening)
    const jawOpeningMm = Math.max(0, Math.round((jawDepressionRatio - 0.65) * 80));
    // Asymmetry / lateral shift in mm (deviation from facial midline)
    const jawLateralDeviationMm = Math.round((pChinNorm[0] - pSubnasale[0]) * 75 * 10) / 10;
    const jawProtrusionRatio = Math.round(((pChinNorm[2] || 0) - (pSubnasale[2] || 0)) * 1000) / 1000;

    // 4. Dynamic temporal velocities (frame-to-frame change per second)
    const now = performance.now();
    const dt = Math.max(0.016, (now - (this.prevMetricsTime || now)) / 1000);
    const apertureVelocity = Math.round(((apertureRatio - this.prevApertureRatio) / dt) * 1000) / 1000;
    const widthVelocity = Math.round(((widthRatio - this.prevWidthRatio) / dt) * 1000) / 1000;
    const jawVelocity = Math.round(((jawDepressionRatio - this.prevJawRatio) / dt) * 1000) / 1000;
    this.prevApertureRatio = apertureRatio;
    this.prevWidthRatio = widthRatio;
    this.prevJawRatio = jawDepressionRatio;
    this.prevMetricsTime = now;

    // 5. Bilateral corner symmetry relative to nose bridge (168)
    const pNose = normalizedLandmarks[168];
    const distL = Math.hypot(pCornerL[0] - pNose[0], pCornerL[1] - pNose[1]);
    const distR = Math.hypot(pCornerR[0] - pNose[0], pCornerR[1] - pNose[1]);
    const symmetryScore = Math.max(0, 1.0 - (Math.abs(distL - distR) / Math.max(distL, distR, 0.01)));

    // 6. Camera-plane metrics for diagnostics
    const rawChin = landmarks[152];
    const rawNose = landmarks[1];
    const rawJawL = landmarks[397];
    const rawJawR = landmarks[172];
    const jawWidth = Math.hypot(rawJawL[0] - rawJawR[0], rawJawL[1] - rawJawR[1]);
    const jawDisplacementX = rawChin[0] - rawNose[0];

    // 7. Empirical Gaussian scoring against benchmark priors
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
      jawDepressionRatio,
      jawOpeningMm,
      jawLateralDeviationMm,
      jawVelocity,
      jawProtrusionRatio,
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

/**
 * Real-Time Canvas Overlay Renderer for Facial, Lip, and Jaw Articulation.
 * Renders vermilion lip borders, inner aperture glow, mandibular jawline arc,
 * and live articulatory dimension gauges over the mirrored webcam canvas.
 */
export function drawArticulatoryOverlay(
  canvas: HTMLCanvasElement | null,
  landmarks: number[][],
  telemetry?: LiveArticulatoryTelemetry,
  isSpeechActive: boolean = false
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!landmarks || landmarks.length < 468) return;

  // Helper to map normalized coordinates to canvas pixels
  const pt = (idx: number) => ({
    x: landmarks[idx][0] * w,
    y: landmarks[idx][1] * h,
  });

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const isSpeaking = isSpeechActive || (telemetry && telemetry.apertureRatio > 0.07);

  // 1. Draw Mandibular Jawline Arc (21 landmarks from left ramus to right ramus)
  if (JAWLINE_INDICES.length > 0) {
    ctx.beginPath();
    const p0 = pt(JAWLINE_INDICES[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < JAWLINE_INDICES.length; i++) {
      const p = pt(JAWLINE_INDICES[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = isSpeaking ? 'rgba(59, 130, 246, 0.75)' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2. Vertical Mandibular Excursion Gauge Line (Nose base 2 to Chin 152)
  const pNoseBase = pt(2);
  const pChin = pt(CHIN_INDEX);
  ctx.beginPath();
  ctx.moveTo(pNoseBase.x, pNoseBase.y);
  ctx.lineTo(pChin.x, pChin.y);
  ctx.strokeStyle = isSpeaking ? 'rgba(96, 165, 250, 0.60)' : 'rgba(148, 163, 184, 0.30)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Chin tracker pin
  ctx.beginPath();
  ctx.arc(pChin.x, pChin.y, 4.0, 0, Math.PI * 2);
  ctx.fillStyle = isSpeaking ? '#38bdf8' : '#94a3b8';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // 3. Outer Lip Vermilion Contour (20 landmarks)
  if (OUTER_LIPS_INDICES.length > 0) {
    ctx.beginPath();
    const pStart = pt(OUTER_LIPS_INDICES[0]);
    ctx.moveTo(pStart.x, pStart.y);
    for (let i = 1; i < OUTER_LIPS_INDICES.length; i++) {
      const p = pt(OUTER_LIPS_INDICES[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = isSpeaking ? '#10b981' : 'rgba(52, 211, 153, 0.75)';
    ctx.lineWidth = isSpeaking ? 2.8 : 2.0;
    ctx.shadowColor = isSpeaking ? 'rgba(16, 185, 129, 0.6)' : 'transparent';
    ctx.shadowBlur = isSpeaking ? 8 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 4. Inner Lip Aperture Contour & Dynamic Opening Fill (20 landmarks)
  if (INNER_LIPS_INDICES.length > 0) {
    ctx.beginPath();
    const pInStart = pt(INNER_LIPS_INDICES[0]);
    ctx.moveTo(pInStart.x, pInStart.y);
    for (let i = 1; i < INNER_LIPS_INDICES.length; i++) {
      const p = pt(INNER_LIPS_INDICES[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    // Fill inner mouth opening with reactive cyan luminescence
    const apRatio = telemetry?.apertureRatio || 0.04;
    const fillAlpha = Math.min(0.50, Math.max(0.08, (apRatio - 0.04) * 1.5));
    ctx.fillStyle = `rgba(6, 182, 212, ${fillAlpha})`;
    ctx.fill();

    ctx.strokeStyle = isSpeaking ? '#06b6d4' : 'rgba(34, 211, 238, 0.75)';
    ctx.lineWidth = isSpeaking ? 2.2 : 1.6;
    ctx.stroke();
  }

  // 5. Oral Commissure (Corners) Excursion Pins
  const pL = pt(LEFT_CORNER_INDEX);
  const pR = pt(RIGHT_CORNER_INDEX);
  for (const pCorner of [pL, pR]) {
    ctx.beginPath();
    ctx.arc(pCorner.x, pCorner.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isSpeaking ? '#f59e0b' : '#cbd5e1';
    ctx.fill();
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // 6. Real-Time Telemetry Callout on Canvas (Aperture & Jaw Opening)
  if (telemetry && telemetry.apertureRatio > 0.06) {
    const pTop = pt(UPPER_LIP_INDEX);
    const pBot = pt(LOWER_LIP_INDEX);
    const midX = (pTop.x + pBot.x) / 2 + 35;
    const midY = (pTop.y + pBot.y) / 2;

    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
    const text = `${Math.round(telemetry.apertureRatio * 120)}mm`;
    const metrics = ctx.measureText(text);

    // Callout badge background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(midX - 4, midY - 11, metrics.width + 8, 16, 4);
    } else {
      ctx.rect(midX - 4, midY - 11, metrics.width + 8, 16);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Callout text
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(text, midX, midY + 1);

    // Measurement connector line
    ctx.beginPath();
    ctx.moveTo((pTop.x + pBot.x) / 2, midY);
    ctx.lineTo(midX - 4, midY);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}
