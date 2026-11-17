/**
 * @fileoverview Rewrites `host` in manifest.json so the plugin can be loaded in Premiere Pro, After Effects, or both.
 *
 * Usage: node scripts/set-host.js <premierepro|aftereffects|both>
 *
 * Note: Adobe only allows a `host` array while developing (e.g. loading via the UXP Developer Tool).
 * For a packaged .ccx, use a single host (`premierepro` or `aftereffects`).
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const HOSTS = {
    premierepro: { app: "premierepro", minVersion: "25.6" },
    // The After Effects UXP API starts at 27.0 (see the "Min Version" column of the API reference).
    aftereffects: { app: "aftereffects", minVersion: "27.0" },
};

const choice = process.argv[2];
const choices = [...Object.keys(HOSTS), "both"];
if (!choices.includes(choice)) {
    console.error(`Usage: node scripts/set-host.js <${choices.join("|")}>`);
    process.exit(1);
}

const manifestPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../manifest.json",
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
manifest.host = choice === "both" ? Object.values(HOSTS) : HOSTS[choice];

// The repo uses CRLF line endings.
fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2).replace(/\n/g, "\r\n"),
);
console.log(
    `manifest.json host set to: ${choice}` +
        (choice === "both"
            ? " (development only - package with a single host)"
            : ""),
);
