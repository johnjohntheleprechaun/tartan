import { DirectoryProcessor } from "../../src/processors/directory";
import fs from "fs/promises";
import mock from "mock-fs";
import { Resolver } from "../../src/resolve";
import { TartanConfig } from "../../src/tartan-config";
import { FullTartanContext, TartanContextFile } from "../../src/tartan-context";
import { MockDirectory } from "../../src/mock-generator";

describe("The directory processor", () => {
    let directoryProcessor: DirectoryProcessor;
    const rootContext: FullTartanContext = {
        pageMode: "directory",
        pageSource: "index.html",
    };
    beforeEach(async () => {
        const config: TartanConfig = {
            rootDir: "src",
            outputDir: "dist",
        };
        const resolver = await Resolver.create(config);
        directoryProcessor = new DirectoryProcessor(config, resolver);
    });
    afterEach(() => {
        mock.restore();
        Resolver.resetUfs();
    });

    it("should use rootContext by default", async () => {
        mock({
            src: {
                page: {
                    "sub-page": {},
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();
        // the root dir
        for (const result of Object.keys(results).map((key) => results[key])) {
            expect(result.mergedContext).toEqual(rootContext);
        }
    });
    it("should use root tartan.context.default.json if provided", async () => {
        const defaultContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "page.md",
        };
        mock({
            src: {
                "tartan.context.default.json": JSON.stringify(defaultContext),
                page: {
                    "sub-page": {},
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();
        for (const result of Object.keys(results).map((key) => results[key])) {
            expect(result.mergedContext).toEqual(defaultContext);
        }
    });
    it("should override tartan.context.default.json with tartan.context.json", async () => {
        const overrideContext: FullTartanContext = {
            pageMode: "file",
            pageSource: "not-index.html",
            pagePattern: "*.md",
        };

        mock({
            src: {
                subpage: {
                    "tartan.context.json": JSON.stringify(overrideContext),
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();
        expect(results["src"].mergedContext).toEqual({
            pageMode: "directory",
            pageSource: "index.html",
        });

        expect(results["src/subpage/"].mergedContext).toEqual(overrideContext);
    });
    it("should not inherit properties from parents if `inherit` is false", async () => {
        const defaultContextFile: TartanContextFile = {
            pageMode: "file",
            pageSource: "index.md",
            pagePattern: "*.md",
        };

        mock({
            src: {
                "tartan.context.default.json":
                    JSON.stringify(defaultContextFile),
                subpage: {
                    "tartan.context.json": JSON.stringify({
                        inherit: false,
                    } as TartanContextFile),
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();

        expect(results).toHaveSize(2);
        // check root dir
        expect(results["src"]).toBeDefined();
        expect(results["src"].mergedContext).toEqual(
            defaultContextFile as FullTartanContext,
        );
        // check the subpage
        expect(results["src/subpage/"]).toBeDefined();
        expect(results["src/subpage/"].mergedContext).toEqual(rootContext);
    });
    it("should stop the cascade of inheritance if `inherit` is false in a default context file", async () => {
        const rootDefaultContext: TartanContextFile = {
            pageMode: "file",
            pageSource: "index.md",
            pagePattern: "*.md",
        };
        const subDefaultContext: TartanContextFile = {
            inherit: false,
        };

        mock({
            src: {
                "tartan.context.default.json":
                    JSON.stringify(rootDefaultContext),
                page: {
                    "tartan.context.default.json":
                        JSON.stringify(subDefaultContext),
                    subpage: {},
                },
            },
        });

        const results = await directoryProcessor.loadContextTree();

        expect(results).toHaveSize(3);

        // Check "src"
        expect(results["src"]).toBeDefined();
        expect(results["src"].mergedContext).toEqual(
            rootDefaultContext as FullTartanContext,
        );

        // Check "src/page/"
        expect(results["src/page/"]).toBeDefined();
        expect(results["src/page/"].mergedContext).toEqual(rootContext);

        // Check "src/page/subpage/"
        expect(results["src/page/subpage/"]).toBeDefined();
        expect(results["src/page/subpage/"].mergedContext).toEqual(rootContext);
    });

    it("should flag directories to be skipped when no `pageSource` is defined", async () => {
        const config: TartanConfig = {
            rootDir: "src",
            outputDir: "dist",
            rootContext: {
                pageMode: "file",
                pagePattern: "*.md",
            },
        };
        const resolver = await Resolver.create(config);
        const specialProcessor = new DirectoryProcessor(config, resolver);
        mock({
            src: {},
        });
        const results = await specialProcessor.loadContextTree();

        expect(results).toHaveSize(1);
        expect(results["src"]).toBeDefined();
        expect(results["src"].skip).toBeTrue();
    });
    it("should flag directories to be skipped when the file defined by `pageSource` doesn't exist", async () => {
        const config: TartanConfig = {
            rootDir: "src",
            outputDir: "dist",
            rootContext: {
                pageMode: "directory",
                pageSource: "index.md",
            },
        };
        const resolver = await Resolver.create(config);
        const specialProcessor = new DirectoryProcessor(config, resolver);
        mock({
            src: {},
        });
        const results = await specialProcessor.loadContextTree();
        expect(results).toHaveSize(1);
        expect(results["src"]).toBeDefined();
        expect(results["src"].skip).toBeTrue();
    });
    it('should add assets and set their sourceType to "asset" when pageMode is "asset"', async () => {
        mock({
            src: {
                "tartan.context.json": JSON.stringify({
                    pageMode: "asset",
                    pagePattern: "*.png",
                } as TartanContextFile),
                "thing.png": "",
            },
        });
        const results = await directoryProcessor.loadContextTree();

        expect(results["src/thing.png"]).toBeDefined();
        expect(results["src/thing.png"].sourceType).toBe("asset");
    });
    it("should add assets defined by the extraAssets context property", async () => {
        mock({
            src: {
                "tartan.context.json": JSON.stringify({
                    extraAssets: ["thing.png"],
                } as TartanContextFile),
                "thing.png": "",
            },
        });

        const results = await directoryProcessor.loadContextTree();

        expect(results["src/thing.png"]).toBeDefined();
        expect(results["src/thing.png"].sourceType).toBe("asset");
    });
    it('should mock and reprocess directories with the "mock" page mode', async () => {
        spyOn(Resolver, "import").and.callFake((() => {
            return () =>
                ({
                    "tartan.context.json": JSON.stringify({
                        pageMode: "directory",
                    } as TartanContextFile), // should override the mock page mode
                }) as MockDirectory;
        }) as any);
        mock({
            src: {
                "tartan.context.json": JSON.stringify({
                    pageMode: "mock",
                    mockGenerator: "mock-gen",
                } as TartanContextFile),
            },
        });

        const results = await directoryProcessor.loadContextTree();
        expect(results["src"]).toBeDefined();
        expect(results["src"].mergedContext.pageMode).toBe("directory");
    });
    it("should stop infinite mocking loop", async () => {
        spyOn(Resolver, "import").and.callFake((() => {
            return () => ({});
        }) as any);
        mock({
            src: {
                "tartan.context.json": JSON.stringify({
                    pageMode: "mock",
                    mockGenerator: "mock-gen",
                } as TartanContextFile),
            },
        });

        return expectAsync(directoryProcessor.loadContextTree()).toBeRejected();
    });
});
