"""NeuroSpeech Rehab — Live PC Workstation Launcher.
Starts local FastAPI with hot-reloading + Cloudflare Tunnel to expose your local
GPU-powered backend to the public Vercel web application.

Whenever you modify any Python file in backend/app/, Uvicorn reloads automatically,
and all remote users connected to your link get the update instantly!
"""
import os
import re
import sys
import time
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PYTHON_EXE = ROOT / "backend" / ".venv-ml" / "Scripts" / "python.exe"
if not PYTHON_EXE.exists():
    PYTHON_EXE = Path(sys.executable)

CLOUDFLARED = ROOT / "cloudflared.exe"
VERCEL_PUBLIC_URL = "https://neurospeech.vercel.app"


def main():
    print("=" * 74)
    print("  NEUROSPEECH REHAB · LIVE RESEARCH PC WORKSTATION")
    print("=" * 74)
    print(f"  [1/2] Launching local FastAPI backend on port 8000 (Hot-Reloading)...")

    # Start Uvicorn backend with --reload
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = str(ROOT / "backend")
    backend_cmd = [
        str(PYTHON_EXE),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload",
        "--reload-dir",
        str(ROOT / "backend" / "app"),
    ]

    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT / "backend"),
        env=backend_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    # Start thread to pump backend logs
    def stream_backend():
        for line in backend_proc.stdout:
            print(f"[Backend] {line.rstrip()}")

    t_backend = threading.Thread(target=stream_backend, daemon=True)
    t_backend.start()

    time.sleep(2)
    print(f"  [2/2] Opening secure Cloudflare Tunnel to local port 8000...")

    if not CLOUDFLARED.exists():
        print(f"ERROR: {CLOUDFLARED} not found! Please check file location.")
        backend_proc.terminate()
        return

    tunnel_cmd = [str(CLOUDFLARED), "tunnel", "--url", "http://127.0.0.1:8000"]
    tunnel_proc = subprocess.Popen(
        tunnel_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    tunnel_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    # Read tunnel output to extract the public URL
    start_time = time.time()
    while time.time() - start_time < 20 and tunnel_url is None:
        line = tunnel_proc.stdout.readline()
        if line:
            match = url_pattern.search(line)
            if match:
                tunnel_url = match.group(0)
                break

    if not tunnel_url:
        print("\n  [Warning] Tunnel URL extraction timed out. Reading logs...")
    else:
        shareable_link = f"{VERCEL_PUBLIC_URL}?apiUrl={tunnel_url}"
        print("\n" + "=" * 74)
        print("  🎉 WORKSTATION IS LIVE & CONNECTED!")
        print("=" * 74)
        print(f"  Local Backend URL : http://127.0.0.1:8000")
        print(f"  Public Tunnel URL : {tunnel_url}")
        print(f"  FastAPI API Docs  : {tunnel_url}/docs")
        print("-" * 74)
        print("  🌐 PUBLIC SHAREABLE LINK (Share with ANYONE on ANY computer):")
        print(f"\n  👉 {shareable_link}\n")
        print("-" * 74)
        print("  ⚡ INSTANT HOT-RELOAD WORKFLOW:")
        print("  1. When anyone opens that link, their browser connects to YOUR PC.")
        print("  2. If you find a bug or want to update ML logic:")
        print("     Edit any file in 'backend/app/' and press Save.")
        print("  3. Uvicorn on your PC reloads in <1s, and everyone sees the change")
        print("     instantly without any re-deploying!")
        print("=" * 74 + "\n")

    # Keep streaming tunnel logs
    try:
        for line in tunnel_proc.stdout:
            # Filter verbose connection pings
            if "trycloudflare.com" in line or "error" in line.lower():
                print(f"[Tunnel] {line.rstrip()}")
    except KeyboardInterrupt:
        print("\nStopping workstation...")
    finally:
        tunnel_proc.terminate()
        backend_proc.terminate()


if __name__ == "__main__":
    main()
