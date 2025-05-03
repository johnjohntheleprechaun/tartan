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
            "/mock/src": {
                "page": {
                    "sub-page": {},
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();
        // the root dir
        for (const result of Object.keys(results).map(key => results[key])) {
            expect(result.context).toEqual({
                pageMode: "directory",
                pageSource: "index.html",
            });
        }
    });
    it("should use root tartan.context.default.json if provided", async () => {
        const defaultContext: TartanContext = {
            pageMode: "directory",
            pageSource: "page.md",
        };
        mock({
            "/mock/src": {
                "tartan.context.default.json": JSON.stringify(defaultContext),
                "page": {
                    "sub-page": {},
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();
        for (const result of Object.keys(results).map(key => results[key])) {
            expect(result.context).toEqual(defaultContext);
        }
    })
});
