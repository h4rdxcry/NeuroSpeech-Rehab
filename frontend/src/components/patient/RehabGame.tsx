import { useEffect, useRef, useState, useMemo } from "react";
import { Sparkles, Star, Volume2, ShieldCheck, Heart, ArrowRight } from "lucide-react";
import type { ArticulatoryKinematics } from "../../lib/faceMeshTracker";

interface RehabGameProps {
  targetPhrase: string;
  isRecording: boolean;
  vocalEnergy: number;
  kinematics: ArticulatoryKinematics;
  masteryPercentage?: number;
  onAttemptComplete?: () => void;
}

export default function RehabGame({
  targetPhrase,
  isRecording,
  vocalEnergy,
  kinematics,
  masteryPercentage = 0,
  onAttemptComplete,
}: RehabGameProps) {
  const [difficulty, setDifficulty] = useState<"novice" | "standard" | "clinical">("standard");
  const [avatarY, setAvatarY] = useState(50); // 0 to 100 percentage altitude
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [starsCollected, setStarsCollected] = useState(0);
  const [cheerMessage, setCheerMessage] = useState<string>("Take a gentle breath and speak when ready");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Target threshold based on difficulty
  const targetThreshold = useMemo(() => {
    switch (difficulty) {
      case "novice": return 75;
      case "standard": return 85;
      case "clinical": return 95;
    }
  }, [difficulty]);

  // Modulate avatar altitude based on vocal energy and lip aperture
  useEffect(() => {
    if (isRecording) {
      const targetAltitude = Math.min(Math.max(20 + vocalEnergy * 140, 15), 85);
      setAvatarY((prev) => prev * 0.85 + targetAltitude * 0.15);
      setDistanceTraveled((prev) => prev + 0.4);

      if (kinematics.withinTarget && vocalEnergy > 0.15) {
        setStarsCollected((prev) => Math.min(prev + 0.05, 3));
        setCheerMessage("Wonderful lip positioning & clear vocal tone!");
      } else if (vocalEnergy > 0.1) {
        setCheerMessage(kinematics.cue);
      }
    }
  }, [isRecording, vocalEnergy, kinematics]);

  // Render peaceful journey backdrop on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Soft atmospheric gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.5, "#1e1b4b");
    grad.addColorStop(1, "#311042");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Rolling peaceful horizon hills
    ctx.fillStyle = "rgba(79, 70, 229, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 30) {
      const hillY = h * 0.72 + Math.sin((x + distanceTraveled * 8) * 0.015) * 20;
      ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 3. Floating Therapeutic Checkpoint Rings
    const ringX = ((w * 0.75 - (distanceTraveled * 15)) % (w * 0.9)) + (w * 0.1);
    const ringY = h * 0.50;
    ctx.strokeStyle = kinematics.withinTarget ? "rgba(52, 211, 153, 0.85)" : "rgba(167, 139, 250, 0.5)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(ringX, ringY, 32, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Therapeutic Journey Avatar (Hot air balloon / Light Orb)
    const avatarPxX = w * 0.22;
    const avatarPxY = (h * (100 - avatarY)) / 100;

    // Glowing aura
    const aura = ctx.createRadialGradient(avatarPxX, avatarPxY, 4, avatarPxX, avatarPxY, 36);
    aura.addColorStop(0, kinematics.withinTarget ? "rgba(52, 211, 153, 0.9)" : "rgba(129, 140, 248, 0.8)");
    aura.addColorStop(1, "rgba(99, 102, 241, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(avatarPxX, avatarPxY, 36, 0, 2 * Math.PI);
    ctx.fill();

    // Avatar orb core
    ctx.fillStyle = kinematics.withinTarget ? "#10b981" : "#6366f1";
    ctx.beginPath();
    ctx.arc(avatarPxX, avatarPxY, 14, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(avatarPxX - 3, avatarPxY - 3, 4, 0, 2 * Math.PI);
    ctx.fill();
  }, [avatarY, distanceTraveled, kinematics.withinTarget]);

  const earnedStarCount = Math.floor(starsCollected);

  return (
    <div className="stitch-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '1px solid rgba(11,28,48,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'linear-gradient(135deg, #0058bd 0%, #712ae2 100%)', boxShadow: '0 4px 14px rgba(0,88,189,0.25)', flexShrink: 0 }}>
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0b1c30', margin: 0 }}>
              PhonoVocal Journey — Supportive Speech Therapy
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#727785', margin: 0, marginTop: 1 }}>
              Your voice &amp; facial movement guide the journey at your own pace
            </p>
          </div>
        </div>

        {/* Difficulty Tier Selector */}
        <div className="nav-pill" style={{ borderRadius: '12px', padding: 3 }}>
          {(["novice", "standard", "clinical"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setDifficulty(lvl)}
              style={{
                borderRadius: 9,
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: difficulty === lvl ? '#0058bd' : 'transparent',
                color: difficulty === lvl ? '#fff' : '#4a4455',
                boxShadow: difficulty === lvl ? '0 2px 8px rgba(0,88,189,0.3)' : 'none',
              }}
            >
              {lvl === "novice" && "Gentle (75%)"}
              {lvl === "standard" && "Standard (85%)"}
              {lvl === "clinical" && "Mastery (95%+)"}
            </button>
          ))}
        </div>
      </div>

      {/* Target Phrase Hero Banner */}
      <div style={{ borderRadius: '1rem', background: 'linear-gradient(135deg, #0058bd 0%, #712ae2 100%)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
              Therapeutic Target Prompt
            </span>
            <div style={{ marginTop: 4, fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', fontFamily: 'Outfit, sans-serif' }}>
              {targetPhrase || "வணக்கம் (Vanakkam)"}
            </div>
            <p style={{ marginTop: 2, fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0' }}>
              Focus on steady vocalization and clear vowel articulation
            </p>
          </div>

          {/* Stars & Mastery Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 14px', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[1, 2, 3].map((starIdx) => (
                <Star
                  key={starIdx}
                  style={{
                    width: 18, height: 18,
                    color: starIdx <= earnedStarCount ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                    fill: starIdx <= earnedStarCount ? '#fbbf24' : 'none',
                  }}
                />
              ))}
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 12 }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Target Accuracy</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#6ffbbe' }}>
                {masteryPercentage > 0 ? `${masteryPercentage.toFixed(1)}%` : `≥ ${targetThreshold}% Goal`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Game Canvas */}
      <div style={{ position: 'relative', height: 224, width: '100%', overflow: 'hidden', borderRadius: '1rem', border: '1px solid rgba(11,28,48,0.08)', background: '#0b1c30' }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={240}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Live Articulatory Biofeedback Banner */}
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, background: 'rgba(11,28,48,0.80)', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', fontWeight: 600, color: '#e2eaff', backdropFilter: 'blur(8px)' }}>
            <Volume2 style={{ width: 14, height: 14, color: isRecording ? '#6ffbbe' : '#727785', flexShrink: 0 }} />
            <span>{cheerMessage}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, background: kinematics.withinTarget ? 'rgba(0,118,80,0.85)' : 'rgba(11,28,48,0.80)', padding: '5px 10px', border: `1px solid ${kinematics.withinTarget ? 'rgba(111,251,190,0.4)' : 'rgba(255,255,255,0.08)'}`, fontSize: '0.72rem', fontWeight: 700, color: kinematics.withinTarget ? '#6ffbbe' : '#adb8cc', backdropFilter: 'blur(8px)' }}>
            <ShieldCheck style={{ width: 13, height: 13 }} />
            <span>{kinematics.withinTarget ? "Target Match ✓" : "Adjusting…"}</span>
          </div>
        </div>

        {/* Live Vocal Energy Bar */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
          <div style={{ flex: 1, borderRadius: 9999, background: 'rgba(11,28,48,0.7)', padding: 4, border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
            <div
              style={{
                height: 6,
                borderRadius: 9999,
                background: 'linear-gradient(90deg, #0058bd, #712ae2, #6ffbbe)',
                width: `${Math.min(vocalEnergy * 250, 100)}%`,
                transition: 'width 75ms linear',
              }}
            />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#adb8cc', background: 'rgba(11,28,48,0.8)', padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
            Vocal Power
          </span>
        </div>
      </div>

      {/* Clinical Encouragement & Action Panel */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#4a4455' }}>
          <Heart style={{ width: 16, height: 16, color: '#712ae2', fill: 'rgba(113,42,226,0.15)', flexShrink: 0 }} />
          <span>Practice at your natural pace. Every repetition strengthens speech motor pathways.</span>
        </div>

        {onAttemptComplete && (
          <button
            type="button"
            onClick={onAttemptComplete}
            className="stitch-btn-primary"
            style={{ fontSize: '0.82rem', minHeight: 38, padding: '8px 18px' }}
          >
            <span>Finish Attempt</span>
            <ArrowRight style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
    </div>
  );
}
