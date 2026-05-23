import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const baseDir = process.cwd();
const repoRoot = path.resolve(baseDir, "..");
const distDir = path.join(baseDir, "dist");
const auraUiDir = path.join(repoRoot, "gemini_clone_ui");
const auraDistDir = path.join(auraUiDir, "dist");

function runNpm(args) {
  if (process.platform === "win32") {
    const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    execFileSync("node", [npmCli, ...args], {
      cwd: auraUiDir,
      stdio: "inherit",
    });
    return;
  }

  execFileSync("npm", args, {
    cwd: auraUiDir,
    stdio: "inherit",
  });
}

function cleanDir(target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

cleanDir(distDir);

if (!fs.existsSync(path.join(auraUiDir, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"))) {
  runNpm(["ci", "--include=dev"]);
}

runNpm(["run", "build"]);

fs.cpSync(auraDistDir, distDir, { recursive: true });
fs.cpSync(path.join(repoRoot, "firebase_runtime_config.js"), path.join(distDir, "firebase_runtime_config.js"));

fs.renameSync(path.join(distDir, "index.html"), path.join(distDir, "app.html"));
[
  "index.html",
  "landing.html",
  "landing.css",
  "landing.js",
  "login.html",
  "login.css",
  "login.js",
  "signup.html",
  "signup.js",
  "auth.js",
  "api.js",
].forEach((file) => {
  const source = path.join(repoRoot, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(distDir, file));
});

console.log("Netlify Aura UI bundle prepared at", distDir);
