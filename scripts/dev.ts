import { spawn, spawnSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
for (const binary of ["ffmpeg", "ffprobe"]) {
  if (spawnSync(binary, ["-version"]).status !== 0) {
    console.error("Instale " + binary + " e tente novamente.");
    process.exit(1);
  }
}
const python = resolve(".venv/bin/python");
if (!existsSync(python)) {
  console.error("Execute make setup para preparar o ambiente Python local.");
  process.exit(1);
}
const services = [
  spawn(
    python,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: "apps/media-worker",
      stdio: "inherit",
      env: { ...process.env, CLIPFORGE_ROOT: process.cwd() },
    },
  ),
  spawn(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "--import",
      "tsx",
      "apps/render-worker/src/index.ts",
    ],
    { stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "apps/web", "-H", "127.0.0.1"],
    {
      stdio: "inherit",
      env: { ...process.env, CLIPFORGE_ROOT: process.cwd() },
    },
  ),
];
let stopped = false;
function stop() {
  if (stopped) return;
  stopped = true;
  services.forEach((p) => p.kill("SIGTERM"));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of services)
  child.on("exit", (code) => {
    if (!stopped) {
      console.error(
        "Um serviço encerrou (código " + code + "). Encerrando os demais.",
      );
      stop();
      process.exitCode = code || 1;
    }
  });
