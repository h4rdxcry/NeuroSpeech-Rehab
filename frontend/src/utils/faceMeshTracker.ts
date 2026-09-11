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

export const KEY_ARTICULATORY_INDICES = [0, 13, 14, 17, 61, 291, 78, 308];

export interface LipMetrics {
  apertureRatio: number; // Vertical opening (inner lip 13 to 14)
  widthRatio: number;    // Horizontal stretch (corner 61 to 291)
  symmetryScore: number; // Bilateral corner symmetry
}

export type FaceMeshCallback = (landmarks: number[][], faceDetected: boolean, metrics?: LipMetrics) => void;

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

        if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const raw = results.multiFaceLandmarks[0];
          const landmarks: number[][] = raw.map((p: any) => [p.x, p.y, p.z || 0]);
          const metrics = this.computeLipMetrics(landmarks);

          if (this.activeCallback) {
            this.activeCallback(landmarks, true, metrics);
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
   * Computes normalized articulatory kinematic metrics from 468 landmark coordinates.
   */
  computeLipMetrics(landmarks: number[][]): LipMetrics {
    if (!landmarks || landmarks.length < 468) {
      return { apertureRatio: 0, widthRatio: 0, symmetryScore: 1.0 };
    }

    // Normalizing scale: Inter-pupillary distance or outer eye corners (33 and 263)
    const pEyeL = landmarks[33];
    const pEyeR = landmarks[263];
    const eyeDist = Math.hypot(pEyeL[0] - pEyeR[0], pEyeL[1] - pEyeR[1]) || 0.25;

    // Upper inner lip (13) and lower inner lip (14)
    const pLipTop = landmarks[13];
    const pLipBottom = landmarks[14];
    const rawAperture = Math.hypot(pLipTop[0] - pLipBottom[0], pLipTop[1] - pLipBottom[1]);
    const apertureRatio = Math.min(1.0, rawAperture / eyeDist);

    // Left mouth corner (61) and right mouth corner (291)
    const pCornerL = landmarks[61];
    const pCornerR = landmarks[291];
    const rawWidth = Math.hypot(pCornerL[0] - pCornerR[0], pCornerL[1] - pCornerR[1]);
    const widthRatio = Math.min(1.5, rawWidth / eyeDist);

    // Bilateral corner symmetry relative to nose bridge (168)
    const pNose = landmarks[168];
    const distL = Math.hypot(pCornerL[0] - pNose[0], pCornerL[1] - pNose[1]);
    const distR = Math.hypot(pCornerR[0] - pNose[0], pCornerR[1] - pNose[1]);
    const symmetryScore = Math.max(0, 1.0 - (Math.abs(distL - distR) / Math.max(distL, distR, 0.01)));

    return {
      apertureRatio: Math.round(apertureRatio * 1000) / 1000,
      widthRatio: Math.round(widthRatio * 1000) / 1000,
      symmetryScore: Math.round(symmetryScore * 1000) / 1000,
    };
  }

  cleanup() {
    this.stopTrackingLoop();
    this.activeCallback = null;
  }
}

export const faceMeshTracker = new FaceMeshTrackerService();
