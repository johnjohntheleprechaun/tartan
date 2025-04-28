import {DirectoryProcessor} from "../../src/processors/directory";
import mock from "mock-fs";
import {Resolver} from "../../src/resolve";
import {TartanConfig} from "../../src/tartan-config";
import {TartanContext} from "../../src/tartan-context";

describe("The directory processor", () => {
    let directoryProcessor: DirectoryProcessor;
    beforeAll(() => {
        spyOn(process, "cwd").and.callFake(() => "/mock");
    })
    beforeEach(async () => {
        const config: TartanConfig = {
            rootDir: "src",
            outputDir: "dist",
        };
        const resolver = await Resolver.create(config);
        directoryProcessor = new DirectoryProcessor(config, resolver);
    });

    it("should use rootContext by default", async () => {
        mock({
            "/mock/src": {},
        });

        const results = await directoryProcessor.loadContextTree();
        // the root dir
        expect(results["src"]).toBeDefined();
        expect(results["src"]).toEqual({
            pageMode: "directory",
            pageSource: "index.html",
        } as TartanContext);
    })
});
