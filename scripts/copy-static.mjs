import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

function copyRecursive(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const s = join(srcDir, entry);
    const d = join(destDir, entry);
    if (statSync(s).isDirectory()) copyRecursive(s, d);
    else if (/\.(html|css|json)$/.test(entry)) copyFileSync(s, d);
  }
}

// Copy popup/options html+css (tsc emits only js)
for (const sub of ["popup", "options", "icons"]) {
  copyRecursive(join(src, sub), join(dist, sub));
}

// Extension icons live in root icons/ (main.jpg is art source only).
// Copy just the PNGs next to the loadable manifest in dist/.
{
  const iconSrc = join(root, "icons");
  const iconDest = join(dist, "icons");
  if (existsSync(iconSrc)) {
    mkdirSync(iconDest, { recursive: true });
    for (const entry of readdirSync(iconSrc)) {
      if (/^icon-\d+\.png$/.test(entry)) {
        copyFileSync(join(iconSrc, entry), join(iconDest, entry));
      }
    }
  }
}

// Copy manifest to dist for store packaging (keep root manifest as source of truth)
const manifestSrc = join(root, "manifest.json");
const manifestDest = join(dist, "manifest.json");
if (existsSync(manifestSrc)) copyFileSync(manifestSrc, manifestDest);

console.log("Static assets copied to dist/");
