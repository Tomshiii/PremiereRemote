/**
 * @fileoverview Cross-platform replacement for `rm -rf`, so the npm scripts also work in Windows cmd/PowerShell.
 * Usage: node scripts/clean.js <path> [<path> ...]
 */

import * as fs from "fs";

for (const target of process.argv.slice(2)) {
    fs.rmSync(target, { recursive: true, force: true });
}
