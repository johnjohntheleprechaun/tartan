import { firstValueFrom, Observable, of } from "rxjs";
import { initializeContext } from "../../src/inputs/context.js";
import {
    FullTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { makeTempFiles } from "../utils/index.js";
import path from "node:path";

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

        const initializedTartanContext: Observable<FullTartanContext> = of(
            context,
        ).pipe(
            initializeContext(path.join(tmpDir, "tartan.context"), of(true)),
        );

        const firstContext = await firstValueFrom(initializedTartanContext);

        expect(firstContext.sourceProcessor).toBeDefined();
        expect(firstContext.handoffHandler).toBeDefined();
        expect(firstContext.template).toBeDefined();
        // @ts-ignore
        expect(firstContext.sourceProcessor()).toBe(42); // the answer to life the universe and everything
        // @ts-ignore
        expect(firstContext.handoffHandler()).toBe(84); // twice the answer idk lol
        // @ts-ignore
        expect(firstContext.template({ test: "hewwo" })).toBe("hewwo");
    });
    // I'm not going to test reloading, cause it should just use loadModule
});
