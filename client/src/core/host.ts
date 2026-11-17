/**
 * @fileoverview Detects which Adobe application the panel is running in and selects the matching actions.
 *
 * The same bundle is loaded in Premiere Pro and After Effects. Actions in the `ae/` namespace
 * (src/actions/ae/**) belong to After Effects, every other action belongs to Premiere Pro.
 */

import { hostForAction, type HostId } from "premiereremote-shared/config";
import type { Registry } from "./types.js";

/** Maps the name reported by `require("uxp").host.name` to a host. Returns null if it is not recognized. */
export function hostFromName(name: string): HostId | null {
    const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
    if (normalized.includes("premiere")) return "premierepro";
    if (normalized.includes("aftereffects") || normalized === "aeft")
        return "aftereffects";
    return null;
}

/** True if the host module with this name can be loaded. Uses a non-literal require so it bypasses the bundler aliases. */
function canRequire(moduleName: string): boolean {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return !!require(moduleName);
    } catch {
        return false;
    }
}

/**
 * Determines the host application. First by the name UXP reports, then by probing which host module exists.
 * Falls back to Premiere Pro, which is what this plugin did before After Effects support.
 */
export function detectHost(): HostId {
    let reportedName = "";
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        reportedName = String(require("uxp")?.host?.name ?? "");
    } catch {
        /* handled by the probes below */
    }

    const byName = hostFromName(reportedName);
    if (byName) return byName;

    if (canRequire(["after", "effects"].join(""))) return "aftereffects";
    if (canRequire(["premiere", "pro"].join(""))) return "premierepro";

    console.warn(
        `[core] Could not detect the host application (uxp host name: "${reportedName}"). Assuming Premiere Pro.`,
    );
    return "premierepro";
}

/** Returns only the actions that can run in the given host. */
export function registryForHost(registry: Registry, host: HostId): Registry {
    return Object.fromEntries(
        Object.entries(registry).filter(
            ([actionId]) => hostForAction(actionId) === host,
        ),
    );
}
