import { defineConfig, devices } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const root = resolve(configDir, "..");
const databaseUrl = process.env.DATABASE_URL || "postgresql+asyncpg://verification:verification_test_only@127.0.0.1:55432/verification_browser";
const fixtureFile = resolve(configDir, "e2e/browser-fixture.json");
const python = resolve(root, "backend/.venv-ml/Scripts/python.exe");
const seed = spawnSync(python, [resolve(root, "backend/tests/browser_seed.py")], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: databaseUrl, ENVIRONMENT: "test", BROWSER_FIXTURE_FILE: fixtureFile },
  encoding: "utf8",
});
if (seed.status !== 0) throw new Error(`Browser fixture setup failed:\n${seed.stdout}\n${seed.stderr}`);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "../work/verification-20260909/browser.json" }]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
    permissions: ["camera", "microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${resolve(configDir, "e2e/silence.wav")}`] },
  },
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log --log-level warning`,
      cwd: resolve(root, "backend"),
      env: { ...process.env, DATABASE_URL: databaseUrl, ENVIRONMENT: "test", CORS_ORIGINS: "http://127.0.0.1:5173", HF_HUB_OFFLINE: "1", NEUROSPEECH_RECORDING_ROOT: resolve(root, "work/verification-20260909/browser-recordings") },
      url: "http://127.0.0.1:8001/health",
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      cwd: resolve(root, "frontend"),
      env: { ...process.env, VITE_API_URL: "http://127.0.0.1:8001" },
      url: "http://127.0.0.1:5173",
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
