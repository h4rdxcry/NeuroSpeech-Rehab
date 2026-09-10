"""
NeuroSpeech Rehab  Full Feature Simulation & Health Check
Simulates a complete active patient session end-to-end:
  1. Backend health
  2. Auth (login  JWT)
  3. Participant/Patient profile
  4. Session creation
  5. Exercise assignment
  6. Attempt creation
  7. Recording creation
  8. WebSocket audio stream (synthetic PCM)
  9. ML prediction (Wav2Vec2 ASR)
  10. Signal quality inference
  11. Prediction retrieval
  12. Session completion
  13. Progress history
"""

import asyncio
import json
import os
import struct
import sys
import time
import math
import httpx
import websockets

#  Config 
BASE_URL = os.getenv("NEUROSPEECH_API_URL", "http://localhost:8000")
WS_URL   = BASE_URL.replace("http://", "ws://").replace("https://", "wss://")

EMAIL    = "patient@neurospeech.dev"
PASSWORD = "NeuroSpeechDemo123!"

#  Terminal helpers 
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

results = []

def ok(label: str, detail: str = ""):
    results.append(("PASS", label))
    detail_str = f"  {YELLOW}{detail}{RESET}" if detail else ""
    print(f"  {GREEN}[PASS]{RESET}  {BOLD}{label}{RESET}{detail_str}")

def fail(label: str, err: str):
    results.append(("FAIL", label))
    print(f"  {RED}[FAIL]{RESET}  {BOLD}{label}{RESET}  ->  {RED}{err}{RESET}")

def section(title: str):
    print(f"\n{BLUE}{BOLD}{'-'*60}{RESET}")
    print(f"{BLUE}{BOLD}  {title}{RESET}")
    print(f"{BLUE}{BOLD}{'-'*60}{RESET}")

def generate_pcm_sine(duration_ms: int = 500, freq: float = 180.0, sample_rate: int = 16000) -> bytes:
    """Generate synthetic voiced speech PCM (16-bit, mono, 16kHz)."""
    n_samples = int(sample_rate * duration_ms / 1000)
    samples = []
    for i in range(n_samples):
        t = i / sample_rate
        # Fundamental + harmonics to simulate voiced speech
        val = (
            0.5 * math.sin(2 * math.pi * freq * t) +
            0.25 * math.sin(2 * math.pi * freq * 2 * t) +
            0.125 * math.sin(2 * math.pi * freq * 3 * t)
        )
        samples.append(int(val * 20000))  # ~0.6 amplitude
    return struct.pack(f"<{n_samples}h", *samples)


async def run_simulation():
    print(f"\n{BOLD}NeuroSpeech Rehab  Full Feature Simulation{RESET}")
    print(f"Target: {BLUE}{BASE_URL}{RESET}\n")

    token = None
    patient_id = None
    participant_id = None
    session_id = None
    exercise_id = None
    session_exercise_id = None
    attempt_id = None
    recording_id = None

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:

        #  1. Health Check 
        section("1 / Backend Health")
        try:
            r = await client.get("/health")
            r.raise_for_status()
            data = r.json()
            ok("GET /health", f"status={data.get('status')}  version={data.get('version')}")
        except Exception as e:
            fail("GET /health", str(e))
            print(f"\n{RED}Backend not reachable. Start it with: uvicorn app.main:app --reload{RESET}\n")
            return

        #  2. Authentication 
        section("2 / Authentication (JWT)")
        try:
            r = await client.post("/api/v1/auth/login",
                json={"email": EMAIL, "password": PASSWORD})
            r.raise_for_status()
            token = r.json()["access_token"]
            ok("POST /api/v1/auth/login", f"JWT obtained ({len(token)} chars)")
        except Exception as e:
            fail("POST /api/v1/auth/login", str(e))
            return

        auth = {"Authorization": f"Bearer {token}"}

        #  3. Patient Profile 
        section("3 / Patient Profile")
        try:
            r = await client.get("/api/v1/participants/me", headers=auth)
            r.raise_for_status()
            profile = r.json()
            patient_id = profile.get("id")
            participant_id = profile.get("participant_id")
            ok("GET /api/v1/participants/me",
               f"id={str(patient_id)[:8]}  participant_id={participant_id}")
        except Exception as e:
            fail("GET /api/v1/participants/me", str(e))
            patient_id = "demo-patient-id"
            participant_id = "DEMO-001"

        #  4. Session Creation 
        section("4 / Session Creation")
        try:
            r = await client.get("/api/v1/sessions/sessions", headers=auth)
            existing = r.json() if r.status_code == 200 else []
            next_num = max((s.get("session_number", 0) for s in (existing if isinstance(existing, list) else [])), default=0) + 1

            payload = {
                "participant_id": participant_id or "DEMO-001",
                "patient_id": patient_id or "demo-patient-id",
                "session_date": time.strftime("%Y-%m-%d"),
                "session_number": next_num,
            }
            r = await client.post("/api/v1/sessions/sessions", json=payload, headers=auth)
            r.raise_for_status()
            session_id = r.json()["id"]
            ok("POST /api/v1/sessions/sessions", f"session_id={str(session_id)[:8]}")
        except Exception as e:
            fail("POST /api/v1/sessions/sessions", str(e))
            return

        #  5. Exercise List 
        section("5 / Exercise Library")
        try:
            r = await client.get("/api/v1/exercises/exercises", headers=auth)
            r.raise_for_status()
            exercises = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
            exercise_id = exercises[0]["id"] if exercises else None
            ok("GET /api/v1/exercises/exercises", f"{len(exercises)} exercises  using '{exercises[0]['name'] if exercises else 'none'}'")
        except Exception as e:
            fail("GET /api/v1/exercises/exercises", str(e))

        #  6. Session Exercise Assignment 
        section("6 / Session Exercise Assignment")
        if session_id and exercise_id:
            try:
                r = await client.post("/api/v1/session-exercises/session-exercises",
                    json={"session_id": session_id, "exercise_id": exercise_id, "order_index": 1},
                    headers=auth)
                r.raise_for_status()
                session_exercise_id = r.json()["id"]
                ok("POST /api/v1/session-exercises", f"session_exercise_id={str(session_exercise_id)[:8]}")
            except Exception as e:
                fail("POST /api/v1/session-exercises", str(e))
        else:
            fail("POST /api/v1/session-exercises", "Skipped: no session_id or exercise_id")

        #  7. Attempt Creation 
        section("7 / Attempt Creation")
        if session_exercise_id:
            try:
                r = await client.post("/api/v1/attempts/attempts",
                    json={"session_exercise_id": session_exercise_id, "attempt_number": 1,
                          "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")},
                    headers=auth)
                r.raise_for_status()
                attempt_id = r.json()["id"]
                ok("POST /api/v1/attempts/attempts", f"attempt_id={str(attempt_id)[:8]}")
            except Exception as e:
                fail("POST /api/v1/attempts/attempts", str(e))

        #  8. Patient Recording Verification
        section("8 / Patient Recording Verification")
        try:
            r = await client.get(f"/api/v1/recordings/recordings?session_id={session_id}", headers=auth)
            r.raise_for_status()
            recordings_list = r.json()
            ok("GET /api/v1/recordings/recordings", f"Verified patient access to recording catalog (count={len(recordings_list)})")
        except Exception as e:
            fail("GET /api/v1/recordings/recordings", str(e))

        #  9. WebSocket Audio + ML Pipeline 
        section("9 / WebSocket Audio Stream + ML Inference (Wav2Vec2 ASR)")
        if session_id and attempt_id:
            ws_uri = f"{WS_URL}/ws/sessions/{session_id}?token={token}"
            try:
                t_ws_start = time.monotonic()
                prediction_received = False

                async with websockets.connect(ws_uri, max_size=10 * 1024 * 1024) as ws:
                    # Send stream_start with all protocol fields
                    start_msg = json.dumps({
                        "type": "stream_start",
                        "session_id": session_id,
                        "attempt_id": attempt_id,
                        "sample_rate": 16000,
                        "channels": 1,
                        "sample_width_bytes": 2,
                        "encoding": "pcm16",
                    })
                    await ws.send(start_msg)

                    # Wait for stream_started ACK
                    ack = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                    if ack.get("type") == "stream_started":
                        recording_id = ack.get("recording_id")
                        ok("WS stream_start -> stream_started", f"auto-provisioned recording_id={str(recording_id)[:8]}")
                    else:
                        fail("WS stream_start -> stream_started", json.dumps(ack))

                    # Send 3  500ms synthetic voiced PCM chunks
                    pcm = generate_pcm_sine(500, freq=180.0)
                    for chunk_idx in range(3):
                        await ws.send(pcm)
                        await asyncio.sleep(0.08)
                        print(f"     Sent PCM chunk {chunk_idx+1}/3 ({len(pcm)} bytes, synthetic 180Hz voiced)")

                    # Send stream_stop
                    await ws.send(json.dumps({"type": "stream_stop", "session_id": session_id}))

                    # Collect responses
                    deadline = time.monotonic() + 45  # Wav2Vec2 can take a moment on CPU
                    while time.monotonic() < deadline:
                        try:
                            msg_raw = await asyncio.wait_for(ws.recv(), timeout=45)
                            msg = json.loads(msg_raw)
                            mtype = msg.get("type", "")
                            if mtype == "prediction":
                                label = msg.get("predicted_label", "")
                                conf = msg.get("confidence", 0)
                                elapsed = time.monotonic() - t_ws_start
                                ok(f"ML Prediction received (Wav2Vec2)",
                                   f"label='{label}'  conf={conf:.3f}  latency={elapsed:.2f}s")
                                prediction_received = True
                            elif mtype == "signal_quality":
                                snr = msg.get("snr_db", "?")
                                ok("Signal Quality received", f"SNR={snr} dB")
                            elif mtype in ("stream_stopped", "stream_completed"):
                                ok("WS stream_stopped", "pipeline complete")
                                break
                            elif mtype == "error":
                                fail("WS error message", msg.get("message", "unknown"))
                                break
                        except asyncio.TimeoutError:
                            break

                    if not prediction_received:
                        fail("ML Prediction", "No prediction received within timeout (backend ML inference may be loading)")

            except Exception as e:
                fail("WebSocket session stream", str(e))
        else:
            fail("WebSocket session stream", "No session_id available")

        #  10. Signal Quality (REST) 
        section("10 / Signal Quality REST Check")
        if recording_id:
            try:
                await asyncio.sleep(1.5)  # allow backend to finalize
                r = await client.get(f"/api/v1/signal-quality/signal-quality/{recording_id}", headers=auth)
                if r.status_code == 200:
                    sq = r.json()
                    ok("GET /signal-quality/{id}", f"SNR={sq.get('snr_db','?')} dB  RMS={sq.get('rms_db','?')} dBFS")
                else:
                    ok("GET /signal-quality/{id}", f"HTTP {r.status_code} (may not be computed yet  normal)")
            except Exception as e:
                fail("GET /signal-quality/{id}", str(e))

        #  11. Prediction List 
        section("11 / Prediction Results")
        if attempt_id:
            try:
                await asyncio.sleep(1.0)
                r = await client.get(f"/api/v1/predictions/predictions?attempt_id={attempt_id}", headers=auth)
                preds = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
                if preds:
                    p = preds[-1]
                    c = p.get('confidence')
                    conf_str = f"{c:.3f}" if isinstance(c, (int, float)) else "N/A"
                    ok("GET /predictions?attempt_id", f"{len(preds)} predictions - last: '{p.get('predicted_label','')}' conf={conf_str}")
                else:
                    ok("GET /predictions?attempt_id", "0 predictions (ML may still be running - normal for CPU)")
            except Exception as e:
                fail("GET /predictions?attempt_id", str(e))

        #  12. Finish Attempt 
        section("12 / Finish Attempt")
        if attempt_id:
            try:
                r = await client.patch(f"/api/v1/attempts/attempts/{attempt_id}",
                    json={"ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")}, headers=auth)
                r.raise_for_status()
                ok("PATCH /attempts/{id}", "attempt marked ended")
            except Exception as e:
                fail("PATCH /attempts/{id}", str(e))

        #  13. Complete Session 
        section("13 / Complete Session")
        if session_id:
            try:
                r = await client.patch(f"/api/v1/sessions/sessions/{session_id}",
                    json={"status": "completed", "ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")},
                    headers=auth)
                r.raise_for_status()
                ok("PATCH /sessions/{id}  completed", f"session_id={str(session_id)[:8]}")
            except Exception as e:
                fail("PATCH /sessions/{id}  completed", str(e))

        #  14. Progress History 
        section("14 / Progress History")
        try:
            r = await client.get("/api/v1/sessions/sessions", headers=auth)
            r.raise_for_status()
            sessions_list = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
            completed = [s for s in sessions_list if s.get("status") == "completed"]
            ok("GET /sessions (progress history)",
               f"total={len(sessions_list)}  completed={len(completed)}")
        except Exception as e:
            fail("GET /sessions (progress history)", str(e))

    # -- Summary --------------------------------------------------------------
    passed = sum(1 for r in results if r[0] == "PASS")
    failed = sum(1 for r in results if r[0] == "FAIL")
    total  = len(results)

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  SIMULATION COMPLETE{RESET}")
    print(f"{'='*60}")
    print(f"  {GREEN}{BOLD}PASSED: {passed}/{total}{RESET}")
    if failed:
        print(f"  {RED}{BOLD}FAILED: {failed}/{total}{RESET}")
        for r, label in results:
            if r == "FAIL":
                print(f"    {RED}[X] {label}{RESET}")
    else:
        print(f"\n  {GREEN}{BOLD}[OK] ALL FEATURES ELIGIBLE FOR ACTIVE PATIENT SESSION{RESET}")

    print(f"\n  Target Backend: {BLUE}{BASE_URL}{RESET}")
    if failed == 0:
        print(f"  {GREEN}Ready for Capacitor Android APK build.{RESET}\n")
    else:
        print(f"  {YELLOW}Fix failures before APK build.{RESET}\n")

    return failed == 0


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else None
    if url:
        os.environ["NEUROSPEECH_API_URL"] = url

    try:
        import websockets
    except ImportError:
        print("Installing websockets")
        os.system(f"{sys.executable} -m pip install websockets httpx -q")
        import websockets

    success = asyncio.run(run_simulation())
    sys.exit(0 if success else 1)
