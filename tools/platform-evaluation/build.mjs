import { spawnSync } from "node:child_process";
import { symlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const output = path.join(root, "dist/platform-evaluation");
const modules = path.join(here, "node_modules");
const run = (args, cwd) => {
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || "/tmp/osc-astro-config",
    },
  });
  if (result.status !== 0) process.exit(result.status || 1);
};
const starlight = path.join(output, "starlight");
if (!existsSync(path.join(starlight, "node_modules")))
  symlinkSync(modules, path.join(starlight, "node_modules"), "dir");
run([path.join(modules, "astro/bin/astro.mjs"), "build"], starlight);
run(
  [
    path.join(modules, "tiddlywiki/tiddlywiki.js"),
    path.join(output, "tiddlywiki"),
    "--build",
    "index",
  ],
  root,
);
console.log(
  "Built isolated platform evaluations. Production files and local storage were not changed.",
);
