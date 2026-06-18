#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
let sha = "local";
try {
  sha = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
} catch {}
const stamp = { version: pkg.version, sha, built_at: new Date().toISOString(), product: pkg.name };
const publicDir = join(root, "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, "build.json"), JSON.stringify(stamp, null, 2) + "\n", "utf8");
for (const file of ["index.html", "playtest.html"]) {
  const p = join(root, file);
  let html = readFileSync(p, "utf8");
  const content = `${stamp.version}+${stamp.sha}`;
  if (html.includes('name="corps-build"')) {
    html = html.replace(/<meta\s+name="corps-build"\s+content="[^"]*"\s*\/?>/i, `<meta name="corps-build" content="${content}" />`);
  } else {
    html = html.replace(/<meta\s+name="viewport"[^>]*>/i, (m) => `${m}\n    <meta name="corps-build" content="${content}" />`);
  }
  writeFileSync(p, html, "utf8");
}
console.log(`build stamp: v${stamp.version}+${stamp.sha}`);
