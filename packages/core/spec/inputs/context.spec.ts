import { initializeContext } from "../../src/inputs/context.js";
import {
    PartialTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { makeTempFiles } from "../utils/filesystem.js";
import path from "node:path";
import { TartanInput } from "../../src/types/inputs.js";

describe("The context initializer", () => {
    it("should load a source processor and handoff handler and template", async () => {
        const tmpDir = await makeTempFiles({
            // these are *not* the right format but I don't need them to be right now
            "processor.js": "export default () => 42",
            "handoff.js": "export default () => 84",
            "template.hbs": "{{test}}",
        });

        const context: TartanContextFile = {
            sourceProcessor: "./processor.js",
            handoffHandler: "./handoff.js",
            template: "./template.hbs",
        };

        const tartanContextFile = {
            value: context,
            path: path.join(tmpDir, "tartan.context"),
        };
        const initialized: TartanInput<PartialTartanContext> =
            await initializeContext(tmpDir, tartanContextFile);

        expect(initialized.value.sourceProcessor).toBeDefined();
        expect(initialized.value.handoffHandler).toBeDefined();
        expect(initialized.value.template).toBeDefined();
        // @ts-ignore
        expect(initialized.value.sourceProcessor.value()).toBe(42); // the answer to life the universe and everything
        // @ts-ignore
        expect(initialized.value.handoffHandler.value()).toBe(84); // twice the answer idk lol
        // @ts-ignore
        expect(initialized.value.template.value({ test: "hewwo" })).toBe(
            "hewwo",
        );
    });
    it("should load the asset processors", async () => {
        const tmpDir = await makeTempFiles({
            "png.js": "export default () => 42",
            "jpg.js": "export default () => 21",
        });

        const context: TartanContextFile = {
            assetProcessors: {
                png: "./png.js",
                jpg: "./jpg.js",
            },
        };

        const contextFile = {
            value: context,
            path: path.join(tmpDir, "tartan.context"),
        };
        const initialized: TartanInput<PartialTartanContext> =
            await initializeContext(tmpDir, contextFile);

        expect(initialized.value.assetProcessors).toBeDefined();
        expect(initialized.value.assetProcessors).toEqual({
            png: jasmine.objectContaining({ value: jasmine.any(Function) }),
            jpg: jasmine.objectContaining({ value: jasmine.any(Function) }),
        });
        expect(
            (
                initialized.value.assetProcessors as Record<
                    string,
                    TartanInput<Function>
                >
            ).png.value(),
        ).toBe(42);
        expect(
            (
                initialized.value.assetProcessors as Record<
                    string,
                    TartanInput<Function>
                >
            ).jpg.value(),
        ).toBe(21);
    });
});
