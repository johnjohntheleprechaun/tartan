import { DirectoryProcessor } from "../../src/processors/directory";
import mock from "mock-fs";
import { Resolver } from "../../src/resolve";
import { TartanConfig } from "../../src/tartan-config";
import { FullTartanContext, TartanContextFile } from "../../src/tartan-context";

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
            expect(result.context).toEqual(rootContext);
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
            expect(result.context).toEqual(defaultContext);
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
        expect(results["src"].context).toEqual({
            pageMode: "directory",
            pageSource: "index.html",
        });

        expect(results["src/subpage/"].context).toEqual(overrideContext);
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

        expect(results).toEqual({
            src: {
                context: defaultContextFile as FullTartanContext,
                parent: undefined,
            },
            "src/subpage/": {
                context: { ...rootContext },
                parent: "src",
            },
        });
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

        expect(results).toEqual({
            src: {
                context: rootDefaultContext as FullTartanContext,
                parent: undefined,
            },
            "src/page/": {
                context: rootContext,
                parent: "src",
            },
            "src/page/subpage/": {
                context: rootContext,
                parent: "src/page/",
            },
        });
    });
});
