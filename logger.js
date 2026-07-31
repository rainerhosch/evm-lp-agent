import fs from "fs";
import { repoPath } from "./repo-root.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[process.env.LOG_LEVEL || "info"] ?? 20;

function ensureLogsDir() {
  const dir = repoPath("logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function log(tag, message) {
  const level = tag.includes("error") || tag.includes("fail")
    ? "error"
    : tag.includes("warn")
      ? "warn"
      : "info";
  if ((LEVELS[level] ?? 20) < minLevel) return;
  const line = `[${new Date().toISOString()}] [${String(tag).toUpperCase()}] ${message}`;
  console.log(line);
  try {
    ensureLogsDir();
    fs.appendFileSync(repoPath("logs", `agent-${today()}.log`), line + "\n");
  } catch { /* ignore */ }
}

export function logAction(entry) {
  try {
    ensureLogsDir();
    fs.appendFileSync(
      repoPath("logs", `actions-${today()}.jsonl`),
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
    );
  } catch { /* ignore */ }
}
