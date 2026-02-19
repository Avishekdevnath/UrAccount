import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "..");
const nextCliPath = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");

const maxOldSpaceSizeMb = process.env.NEXT_BUILD_MAX_OLD_SPACE_SIZE_MB || "512";
const existingNodeOptions = (process.env.NODE_OPTIONS || "").trim();
const memoryFlag = `--max-old-space-size=${maxOldSpaceSizeMb}`;

const nodeOptions = existingNodeOptions.includes("--max-old-space-size=")
  ? existingNodeOptions
  : [existingNodeOptions, memoryFlag].filter(Boolean).join(" ");

const result = spawnSync(process.execPath, [nextCliPath, "build"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error("Failed to execute Next.js build:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
