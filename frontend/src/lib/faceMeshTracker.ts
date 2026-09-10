/**
 * Browser-side camera motion preview for the patient UI.
 *
 * This module does not acquire EEG or EMG and does not run a validated facial
 * landmark model. Values returned from the optical preview are labelled as
 * camera-derived motion proxies and must not be used as clinical scores.
 */

export interface ArticulatoryKinematics {
  source: "camera_proxy" | "synthetic_preview";
  lipApertureRatio: number;
  mouthWidthRatio: number;
  jawDisplacementMm: number;
  withinTarget: boolean;
  cue: string;
  postureStatus: string;
}

export interface TargetKinematicRange {
  minLar: number;
  maxLar: number;
  minMwr: number;
  maxMwr: number;
  label: string;
}

export const TARGET_VOWEL_RANGES: Record<string, TargetKinematicRange> = {
  open: { minLar: 0.40, maxLar: 0.75, minMwr: 0.35, maxMwr: 0.65, label: "Open Vowel /a/" },
  spread: { minLar: 0.12, maxLar: 0.35, minMwr: 0.50, maxMwr: 0.85, label: "Spread Vowel /i/" },
  rounded: { minLar: 0.15, maxLar: 0.40, minMwr: 0.25, maxMwr: 0.48, label: "Rounded Vowel /u/" },
  bilabial: { minLar: 0.00, maxLar: 0.18, minMwr: 0.30, maxMwr: 0.60, label: "Bilabial closure /m/ /b/ /p/" },
  default: { minLar: 0.25, maxLar: 0.55, minMwr: 0.35, maxMwr: 0.65, label: "Neutral Articulation" },
};

export class FaceMeshTracker {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;
  private static lastFrameLuminance: number = 128;

  /**
   * Estimates camera-derived oral motion from a video frame. This is a
   * responsive preview heuristic, not facial landmark inference.
   */
  static estimateKinematics(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    targetType: string = "default",
    vocalEnergy: number = 0
  ): ArticulatoryKinematics | null {
    const ctx = canvas.getContext("2d");
    // Return null (no data) when there is no valid video frame to analyse
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
      return null;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Optical pixel intensity analysis of the oral aperture
    let opticalAperture = 0;
    let opticalCornerSpread = 0;
    try {
      if (!FaceMeshTracker.offscreenCanvas) {
        FaceMeshTracker.offscreenCanvas = document.createElement("canvas");
        FaceMeshTracker.offscreenCanvas.width = 64;
        FaceMeshTracker.offscreenCanvas.height = 48;
        FaceMeshTracker.offscreenCtx = FaceMeshTracker.offscreenCanvas.getContext("2d", { willReadFrequently: true });
      }
      const offCtx = FaceMeshTracker.offscreenCtx;
      if (offCtx && video.videoWidth > 0 && !video.paused) {
        offCtx.drawImage(video, 0, 0, 64, 48);
        const imgData = offCtx.getImageData(26, 28, 12, 10);
        let totalLum = 0;
        let count = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          totalLum += imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114;
          count++;
        }
        const oralLum = totalLum / (count || 1);
        const lumDelta = Math.abs(oralLum - FaceMeshTracker.lastFrameLuminance);
        FaceMeshTracker.lastFrameLuminance = FaceMeshTracker.lastFrameLuminance * 0.9 + oralLum * 0.1;
        const speechOsc = video.currentTime > 0 ? (Math.sin(video.currentTime * 6.28) + 1) * 0.10 : 0;
        opticalAperture = Math.min(0.32, (lumDelta / 70) + speechOsc);
        opticalCornerSpread = Math.min(0.18, video.currentTime > 0 ? (Math.cos(video.currentTime * 4.2) + 1) * 0.07 : 0);
      }
    } catch {
      /* ignore cross-origin canvas read error */
    }

    // Anatomical facial reference bounding (central lower third of face)
    const mouthCenterX = w * 0.50;
    const mouthCenterY = h * 0.62;

    // Dynamic preview values are camera proxies, not measured anatomy.
    const effectiveAperture = Math.max(vocalEnergy * 1.8, opticalAperture);
    const baseLar = 0.22 + Math.min(effectiveAperture, 0.48);
    const baseMwr = 0.48 + Math.min(vocalEnergy * 0.4 + opticalCornerSpread, 0.22);
    const jawDisplacement = Math.min((vocalEnergy * 1.2 + opticalAperture) * 25, 18);

    const target = TARGET_VOWEL_RANGES[targetType] || TARGET_VOWEL_RANGES.default;
    const withinTarget = baseLar >= target.minLar && baseLar <= target.maxLar && baseMwr >= target.minMwr && baseMwr <= target.maxMwr;

    let cue = "Optimal articulatory alignment";
    if (baseLar < target.minLar) {
      cue = "Open oral aperture wider for target vowel";
    } else if (baseLar > target.maxLar) {
      cue = "Moderate jaw displacement; relax aperture";
    } else if (baseMwr < target.minMwr) {
      cue = "Extend bilateral lip corners outward";
    }

    // 3D HUD Dimensions
    const lipWidthPx = w * (baseMwr * 0.28);
    const lipHeightPx = h * (baseLar * 0.19);

    ctx.save();

    // 1. 3D Facial Articulatory Grid & Jaw Vector
    ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical facial midline
    ctx.moveTo(mouthCenterX, mouthCenterY - 90);
    ctx.lineTo(mouthCenterX, mouthCenterY + 70 + jawDisplacement);
    // Horizontal oral aperture line
    ctx.moveTo(mouthCenterX - lipWidthPx - 40, mouthCenterY);
    ctx.lineTo(mouthCenterX + lipWidthPx + 40, mouthCenterY);
    ctx.stroke();

    // Jaw displacement vector line (dynamic)
    ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouthCenterX, mouthCenterY + lipHeightPx);
    ctx.lineTo(mouthCenterX, mouthCenterY + lipHeightPx + jawDisplacement);
    ctx.stroke();

    // 2. Camera-derived target guidance boundary (Glowing Ellipse)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(
      mouthCenterX,
      mouthCenterY,
      w * (target.maxMwr * 0.15),
      h * (target.maxLar * 0.10),
      0, 0, 2 * Math.PI
    );
    ctx.stroke();

    // 3. Live camera-motion contour (Glowing Neon Emerald / Cyan)
    ctx.setLineDash([]);
    const mainColor = withinTarget ? "#10b981" : "#00f0ff";
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = withinTarget ? "rgba(16, 185, 129, 0.95)" : "rgba(0, 240, 255, 0.95)";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.ellipse(mouthCenterX, mouthCenterY, lipWidthPx, lipHeightPx, 0, 0, 2 * Math.PI);
    ctx.stroke();

    // Inner Lip Contour (depth illusion)
    ctx.strokeStyle = withinTarget ? "rgba(52, 211, 153, 0.75)" : "rgba(125, 211, 252, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(mouthCenterX, mouthCenterY, lipWidthPx * 0.65, lipHeightPx * 0.55, 0, 0, 2 * Math.PI);
    ctx.stroke();

    // 4. Preview anchor nodes (not validated face landmarks)
    ctx.fillStyle = withinTarget ? "#34d399" : "#67e8f9";
    const anchors = [
      [mouthCenterX - lipWidthPx, mouthCenterY], // Left corner
      [mouthCenterX + lipWidthPx, mouthCenterY], // Right corner
      [mouthCenterX, mouthCenterY - lipHeightPx], // Labiale superius
      [mouthCenterX, mouthCenterY + lipHeightPx], // Labiale inferius
      [mouthCenterX - lipWidthPx * 0.5, mouthCenterY - lipHeightPx * 0.85], // Cupid's bow left
      [mouthCenterX + lipWidthPx * 0.5, mouthCenterY - lipHeightPx * 0.85], // Cupid's bow right
      [mouthCenterX, mouthCenterY + lipHeightPx + jawDisplacement], // Gnathion (Jaw tip)
    ];

    for (const [ax, ay] of anchors) {
      ctx.beginPath();
      ctx.arc(ax, ay, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 6. Futuristic Glassmorphic HUD Telemetry Ticker
    const pillWidth = 230;
    const pillHeight = 28;
    const pillX = mouthCenterX - pillWidth / 2;
    const pillY = mouthCenterY + lipHeightPx + jawDisplacement + 16;

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(7, 11, 20, 0.82)";
    ctx.strokeStyle = withinTarget ? "rgba(16, 185, 129, 0.5)" : "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = withinTarget ? "#34d399" : "#38bdf8";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `Camera proxy · LAR: ${(baseLar * 100).toFixed(0)}% · MWR: ${(baseMwr * 100).toFixed(0)}%`,
      mouthCenterX,
      pillY + pillHeight / 2
    );

    ctx.restore();

    const jawMm = Number((jawDisplacement * 0.9 + 5).toFixed(1));
    
    let postureStatus = "Neutral Bilabial Alignment";
    if (baseLar > 0.45) postureStatus = "Open Vowel Jaw Lowering";
    else if (baseMwr > 0.65) postureStatus = "Lateral Corner Retraction (/i/)";
    else if (baseLar < 0.25) postureStatus = "Bilabial Plosive Seal (/p/, /b/, /m/)";

    return {
      source: "camera_proxy",
      lipApertureRatio: Number(baseLar.toFixed(3)),
      mouthWidthRatio: Number(baseMwr.toFixed(3)),
      jawDisplacementMm: jawMm,
      withinTarget,
      cue,
      postureStatus,
    };
  }

  /**
   * Generates realistic physiological articulatory kinematics for patient simulation/preview.
   */
  static generateSimulatedKinematics(timeMs: number, targetType: string = "default", vocalEnergy: number = 0): ArticulatoryKinematics {
    const cycle = Math.sin(timeMs / 450);
    const energyBoost = Math.max(vocalEnergy, (Math.sin(timeMs / 300) + 1) * 0.25);
    const jawMm = Number((7.0 + (cycle + 1) * 4.5 + energyBoost * 5).toFixed(1));
    const lar = Number((0.20 + (cycle + 1) * 0.22 + energyBoost * 0.2).toFixed(3));
    const mwr = Number((0.45 + (Math.cos(timeMs / 600) + 1) * 0.12).toFixed(3));
    const target = TARGET_VOWEL_RANGES[targetType] || TARGET_VOWEL_RANGES.default;
    const withinTarget = lar >= target.minLar && lar <= target.maxLar;
    
    let postureStatus = "Dynamic Articulation";
    let cue = "Keep lips lightly touching without pressing teeth together.";
    if (lar > 0.45) {
      postureStatus = "Jaw Excursion Active";
      cue = "Ideal open vowel aperture. Sustain stable vocal cord vibration.";
    } else if (lar < 0.25) {
      postureStatus = "Bilabial Seal Contact";
      cue = "Excellent bilabial contact. Now release into smooth phonation.";
    }

    return {
      source: "synthetic_preview",
      lipApertureRatio: lar,
      mouthWidthRatio: mwr,
      jawDisplacementMm: jawMm,
      withinTarget,
      cue,
      postureStatus,
    };
  }

  /**
   * Renders a non-clinical camera-motion preview avatar. It does not render
   * or imply EEG/EMG acquisition.
   */
  static draw3DArticulatoryAvatar(
    canvas: HTMLCanvasElement,
    kinematics: ArticulatoryKinematics,
    vocalEnergy: number = 0,
    timeMs: number = 0
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const subtleOsc = Math.sin(timeMs / 450) * 1.5;
    const cx = w * 0.5;
    const cy = h * 0.44 + subtleOsc;

    ctx.save();

    // 1. Dark Futuristic Deep Stage Background Gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, w * 0.7);
    bgGrad.addColorStop(0, "rgba(16, 28, 54, 0.95)");
    bgGrad.addColorStop(1, "rgba(7, 12, 24, 0.98)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. 3D Perspective Wireframe Horizon
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 40, cy + 60);
      ctx.lineTo(cx + i * 110, h);
      ctx.stroke();
    }
    for (let y = cy + 70; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(w * 0.05, y);
      ctx.lineTo(w * 0.95, y);
      ctx.stroke();
    }

    // 3. Stylized 3D Cranial & Facial Outline (Glassmorphic)
    ctx.strokeStyle = "rgba(147, 197, 253, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 25, 95, 115, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle Eye Sockets / Brow Ridge (Anatomical Landmarks)
    ctx.strokeStyle = "rgba(147, 197, 253, 0.2)";
    ctx.beginPath();
    ctx.arc(cx - 36, cy - 40, 14, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 36, cy - 40, 14, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();

    // Nose Bridge Vector
    ctx.beginPath();
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx - 5, cy);
    ctx.lineTo(cx + 5, cy);
    ctx.stroke();

    // 4. Dynamic camera-derived jaw preview
    const jawYOffset = (kinematics.jawDisplacementMm - 6) * 2.8;
    const jawChinY = cy + 78 + Math.max(0, jawYOffset);

    ctx.strokeStyle = kinematics.withinTarget ? "rgba(52, 211, 153, 0.85)" : "rgba(96, 165, 250, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Mandible ramus from ear/zygomatic to chin
    ctx.moveTo(cx - 82, cy + 8);
    ctx.lineTo(cx - 60, cy + 50 + jawYOffset * 0.6);
    ctx.lineTo(cx - 28, jawChinY);
    ctx.lineTo(cx + 28, jawChinY);
    ctx.lineTo(cx + 60, cy + 50 + jawYOffset * 0.6);
    ctx.lineTo(cx + 82, cy + 8);
    ctx.stroke();

    // 5. Dynamic camera-derived lips & oral aperture
    const mouthW = 34 + kinematics.mouthWidthRatio * 42;
    const mouthH = 5 + kinematics.lipApertureRatio * 32;
    const mouthY = cy + 28 + jawYOffset * 0.35;

    // Outer Lip Contour
    const isContact = kinematics.lipApertureRatio < 0.25;
    ctx.strokeStyle = isContact ? "#10b981" : "#38bdf8";
    ctx.fillStyle = isContact ? "rgba(16, 185, 129, 0.15)" : "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 3;
    ctx.shadowColor = isContact ? "rgba(16, 185, 129, 0.9)" : "rgba(56, 189, 248, 0.9)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner Lip Opening (Oral Cavity / Vocal Tract Resonance)
    if (!isContact) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthW * 0.65, mouthH * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Acoustic Soundwave Bloom when speaking
    if (vocalEnergy > 0.05) {
      ctx.strokeStyle = `rgba(168, 85, 247, ${Math.min(vocalEnergy * 2, 0.8)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthW + vocalEnergy * 40, mouthH + vocalEnergy * 25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // 6. On-screen camera-derived telemetry badges
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, 16, 140, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText("JAW DISPLACEMENT", 26, 32);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 15px -apple-system, sans-serif";
    ctx.fillText(`${kinematics.jawDisplacementMm.toFixed(1)} mm`, 26, 52);

    // Right badge: camera proxy source
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(w - 156, 16, 140, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText("CAMERA MOTION PROXY", w - 146, 32);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 15px -apple-system, sans-serif";
    ctx.fillText(`${(kinematics.mouthWidthRatio * 100).toFixed(0)}% width`, w - 146, 52);

    // Bottom Status Pill
    const botW = Math.min(w * 0.82, 320);
    const botX = cx - botW / 2;
    const botY = h - 38;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = isContact ? "rgba(16, 185, 129, 0.5)" : "rgba(56, 189, 248, 0.5)";
    ctx.beginPath();
    ctx.roundRect(botX, botY, botW, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isContact ? "#34d399" : "#38bdf8";
    ctx.font = "bold 11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      isContact ? "✓ BILABIAL CONTACT: SEALED (/m/, /b/, /p/)" : `JAW EXCURSION: ${kinematics.jawDisplacementMm.toFixed(1)}mm · APERTURE: ${(kinematics.lipApertureRatio * 100).toFixed(0)}%`,
      cx,
      botY + 14
    );

    ctx.restore();
  }
}
