import { firstValueFrom, Observable } from "rxjs";
import { initializeContextFile } from "../../src/inputs/context";
import {
    FullTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context";
import {
    makeTempFile,
    makeTempFiles,
    performOperationAfterEachEmission,
    updateTempFile,
} from "../utils";
import path from "node:path";

describe("The context initializer", () => {
    it("should load a source processor and handoff handler", async () => {
        const tmpDir = await makeTempFiles({
            // these are *not* the right format but I don't need them to be right now
            "processor.js": "export default () => 42",
            "handoff.js": "export default () => 84",
        });

        const context: TartanContextFile = {
            sourceProcessor: "./processor.js",
            handoffHandler: "./handoff.js",
        };

        const initializedTartanContext: Observable<FullTartanContext> =
            initializeContextFile(context, path.join(tmpDir, "tartan.context"));

        const firstContext = await firstValueFrom(initializedTartanContext);

        expect(firstContext.sourceProcessor).toBeDefined();
        expect(firstContext.handoffHandler).toBeDefined();
        // @ts-ignore
        expect(firstContext.sourceProcessor()).toBe(42); // the answer to life the universe and everything

        // @ts-ignore
        expect(firstContext.handoffHandler()).toBe(84); // twice the answer idk lol
    });
    // I'm not going to test reloading, cause it should just use loadModule
});
