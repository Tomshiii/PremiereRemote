/**
 * User-facing configuration for PremiereRemote.
 * Edit this file to change settings without touching the core plugin code.
 * Note: This cannot be done using env variables because the UXP plugin cannot read them.
 */

export const INTERNAL_WS_PORT = 42400;
export const HTTP_PORT = 42401;
export const WS_PORT = 42402;
export const MCP_PORT = 42403;

/** How long to wait for the UXP plugin to respond to a request before timing out. Adjust this number when experiencing timeouts in long-lasting UXP operations, e.g., full video cutting automation. */
export const UXP_REQUEST_TIMEOUT_MS = 60_000;

/** Host applications a UXP panel can run in. */
export const HOSTS = ["premierepro", "aftereffects"];

/** Human-readable host names, used in status and error messages. */
export const HOST_LABELS = {
    premierepro: "Premiere Pro",
    aftereffects: "After Effects",
};

/** Actions in this namespace (src/actions/ae/**) run in After Effects. Everything else runs in Premiere Pro. */
export const AE_ACTION_PREFIX = "ae/";

/** Returns the host an action must be routed to, based on its namespace. */
export function hostForAction(actionId) {
    return actionId.startsWith(AE_ACTION_PREFIX) ? "aftereffects" : "premierepro";
}
