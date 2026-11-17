import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { hostFromName, registryForHost } from "../src/core/host.js";
import type { Registry } from "../src/core/types.js";

const require = createRequire(import.meta.url);

describe("hostFromName", () => {
    it.each([
        ["Adobe Premiere Pro", "premierepro"],
        ["premierepro", "premierepro"],
        ["After Effects", "aftereffects"],
        ["Adobe After Effects (Beta)", "aftereffects"],
        ["aftereffects", "aftereffects"],
        ["AEFT", "aftereffects"],
    ])("recognizes %s", (name, expected) => {
        expect(hostFromName(name)).toBe(expected);
    });

    it("returns null for other or empty names", () => {
        expect(hostFromName("Photoshop")).toBeNull();
        expect(hostFromName("")).toBeNull();
    });
});

describe("registryForHost", () => {
    const fn = async () => null;
    const registry = {
        "custom/save": { fn },
        "common/getActiveSequence": { fn },
        "ae/custom/save": { fn },
        "ae/custom/getHostInfo": { fn },
    } as unknown as Registry;

    it("gives Premiere Pro every action outside the ae/ namespace", () => {
        expect(Object.keys(registryForHost(registry, "premierepro"))).toEqual([
            "custom/save",
            "common/getActiveSequence",
        ]);
    });

    it("gives After Effects only the ae/ actions", () => {
        expect(Object.keys(registryForHost(registry, "aftereffects"))).toEqual([
            "ae/custom/save",
            "ae/custom/getHostInfo",
        ]);
    });
});

describe("safeRequire shim", () => {
    const safeRequire = require("../scripts/shims/safeRequire.cjs");

    it("returns the real module when it exists", () => {
        expect(safeRequire("path")).toBe(require("path"));
    });

    it("returns a stub that tolerates property access and calls when the module is missing", () => {
        const stub = safeRequire("definitely-not-a-host-module");
        const { Constants } = stub; // top-level destructuring must not throw
        expect(() => stub.EventManager.addGlobalEventListener(() => {})).not.toThrow();
        expect(Constants.SequenceEvent.ACTIVATED).toBeDefined();
    });

    it("returns a stub that does not look like a promise", async () => {
        const stub = safeRequire("definitely-not-a-host-module");
        await expect(Promise.resolve(stub.Project.getActiveProject())).resolves.toBeDefined();
    });
});
