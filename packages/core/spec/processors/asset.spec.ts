import mock from "mock-fs";
import fs from "fs/promises";
import { AssetHandler, AssetProcessorOutput } from "../../src/processors/asset";
import { Resolver } from "../../src/resolve";
describe("The AssetHandler class", () => {
    afterEach(() => {
        mock.restore();
    });
    it("should use registered processors", async () => {
        spyOn(Resolver, "import").and.callFake(
            async <T>(path: string): Promise<T> => {
                if (path === "fake") {
                    return (() =>
                        ({
                            processedContents: Buffer.from("hello world"),
                        }) as AssetProcessorOutput) as T;
                } else {
                    throw "fuck";
                }
            },
        );

        await AssetHandler.registerProcessor("**/*.png", "fake");
        const handler = new AssetHandler({
            outputDir: "out/",
            sourcePath: "src/test.png",
        });
        mock({
            "src/test.png": "",
            out: {},
        });
        await handler.process();

        return expectAsync(fs.readFile("out/test.png", "utf8")).toBeResolvedTo(
            "hello world",
        );
    });
    it("should allow file renaming", async () => {
        spyOn(Resolver, "import").and.callFake(
            async <T>(path: string): Promise<T> => {
                if (path === "fake") {
                    return (() =>
                        ({
                            processedContents: Buffer.from("hello world"),
                            filename: "shit.png",
                        }) as AssetProcessorOutput) as T;
                } else {
                    throw "fuck";
                }
            },
        );

        await AssetHandler.registerProcessor("**/*.png", "fake");
        const handler = new AssetHandler({
            outputDir: "out/",
            sourcePath: "src/test.png",
        });
        mock({
            "src/test.png": "",
            out: {},
        });
        await handler.process();

        return expectAsync(fs.readFile("out/shit.png", "utf8")).toBeResolvedTo(
            "hello world",
        );
    });
});
