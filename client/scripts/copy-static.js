/**
 * @fileoverview Cross-platform replacement for `cp -r static/. build/`, so the npm scripts also work in Windows cmd/PowerShell.
 */

import * as fs from "fs";

fs.mkdirSync("build", { recursive: true });
fs.cpSync("static", "build", { recursive: true });
