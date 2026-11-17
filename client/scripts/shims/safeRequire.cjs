/* eslint-disable */
/**
 * @fileoverview Loads a host module (`premierepro` / `aftereffects`) without crashing when the plugin is running in a
 * different host.
 *
 * The plugin is a single bundle that can be loaded in Premiere Pro and After Effects. Each host only provides its own
 * module, so a top-level `require("aftereffects")` inside Premiere would throw and take the whole panel down.
 * A missing module is therefore replaced by an inert stub that accepts any property access and any call.
 *
 * Why calls are tolerated instead of throwing: some Premiere modules do work at load time, e.g. registering event
 * listeners with `ppro.EventManager.addGlobalEventListener(...)`. Inside After Effects those must simply do nothing.
 * Actions of the other host are never registered (see src/core/host.ts), so nothing meaningful can reach the stub.
 */
function inertStub() {
    return new Proxy(function () {}, {
        get: (_target, prop) =>
            // `then` must stay undefined so `await stub` does not hang; symbols are used internally by the engine.
            prop === "then" || typeof prop === "symbol" ? undefined : inertStub(),
        apply: () => inertStub(),
        construct: () => inertStub(),
    });
}

module.exports = function safeRequire(moduleName) {
    try {
        // Non-literal on purpose: the bundler must leave this as a runtime require.
        return require(moduleName);
    } catch (err) {
        return inertStub();
    }
};
