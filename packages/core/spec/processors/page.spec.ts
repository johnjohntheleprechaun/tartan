import { TartanConfig } from "../../src/tartan-config";
import {
    InvalidOutputDirectoryError,
    PageProcessor,
} from "../../src/processors/page";
import { Resolver } from "../../src/resolve";
import mock from "mock-fs";
import { HTMLProcessor } from "../../src/processors/html";
import fs from "fs/promises";
import path from "path";
import { SourceProcessor } from "../../src/source-processor";

describe("The PageProcessor class", () => {
    afterEach(() => {
        mock.restore();
    });
    const projectConfig: TartanConfig = {
        rootDir: "src",
        outputDir: "dist",
    };
    beforeAll(async () => {
        spyOn(HTMLProcessor.prototype, "process").and.callFake(
            async function () {
                return {
                    content: this.htmlContent,
                    dependencies: [],
                };
            },
        );
    });
    describe("(when using neither a source processor nor a template)", () => {
        let pageProcessor: PageProcessor;
        let resolver: Resolver;
        beforeEach(async () => {
            resolver = await Resolver.create(projectConfig);
            pageProcessor = new PageProcessor(
                {
                    context: {
                        pageMode: "directory",
                        pageSource: "index.html",
                    },
                    sourcePath: "src/index.html",
                    outputDir: "dist/",
                    subpageMeta: [],
                },
                projectConfig,
                resolver,
            );
        });
        it("should not modify the source content", async () => {
            const content = crypto.randomUUID();
            mock({
                "src/index.html": content,
            });

            const result = await pageProcessor.process();
            const outputted = await fs.readFile(
                path.join(result.outputDir, "index.html"),
            );

            expect(outputted.toString()).toBe(content);
        });
    });
    describe("(when using a source processor)", () => {
        let resolver: Resolver;
        beforeEach(async () => {
            resolver = await Resolver.create(projectConfig);
        });
        it("should not allow the modified output dir to be above the original dir", async () => {
            const pageProcessor = new PageProcessor(
                {
                    context: {
                        pageMode: "directory",
                        pageSource: "index.html",
                        sourceProcessor: async () => ({
                            processedContents: Buffer.from("", "utf8"),
                            outputDir: "sub/../..",
                        }),
                    },
                    sourcePath: "src/index.html",
                    outputDir: "dist/",
                    subpageMeta: [],
                },
                projectConfig,
                resolver,
            );

            mock({
                "src/index.html": "",
            });
            await expectAsync(pageProcessor.process()).toBeRejectedWithError(
                InvalidOutputDirectoryError,
            );
        });
        it("should not allow duplicate output directories to be provided by source processors", async () => {
            const outputDir = crypto.randomUUID();
            const sourceProcessor: SourceProcessor = async () => ({
                processedContents: Buffer.from("", "utf8"),
                outputDir,
            });
            const processorOne = new PageProcessor(
                {
                    context: {
                        pageMode: "directory",
                        pageSource: "index.html",
                        sourceProcessor,
                    },
                    sourcePath: "src/index.html",
                    outputDir: "dist/",
                    subpageMeta: [],
                },
                projectConfig,
                resolver,
            );
            const processorTwo = new PageProcessor(
                {
                    context: {
                        pageMode: "directory",
                        pageSource: "index.html",
                        sourceProcessor,
                    },
                    sourcePath: "src/index.html",
                    outputDir: "dist/",
                    subpageMeta: [],
                },
                projectConfig,
                resolver,
            );

            mock({
                "src/index.html": "",
            });

            await processorOne.process();
            await expectAsync(processorTwo.process()).toBeRejectedWithError(
                InvalidOutputDirectoryError,
            );
        });
        it("should pass return the modified output directory, not the original output directory", async () => {
            const outputDir: string = crypto.randomUUID();
            const sourceProcessor: SourceProcessor = (input) => ({
                processedContents: input.sourceContents,
                outputDir,
            });
            const processor = new PageProcessor(
                {
                    context: {
                        pageMode: "directory",
                        pageSource: "index.html",
                        sourceProcessor,
                    },
                    subpageMeta: [],
                    sourcePath: "src/index.html",
                    outputDir: crypto.randomUUID(),
                },
                projectConfig,
                resolver,
            );

            mock({
                "src/index.html": "",
            });

            const result = await processor.process();
            expect(result.outputDir).toBe(outputDir);
        });
        it("should pass through extra meta from the source processor", async () => {
            const extraMeta: any = {
                someData: "asdlkfjansldkfjsdf",
                someOtherData: "adslfjnlaskdjcnlkajsndlkjnasdf",
            };
            const sourceProcessor: SourceProcessor = (input) => ({
                processedContents: input.sourceContents,
                extraMeta,
            });
            const processor = new PageProcessor(
                {
                    context: {
                        pageMode: "directory",
                        pageSource: "index.html",
                        sourceProcessor,
                    },
                    subpageMeta: [],
                    sourcePath: "src/index.html",
                    outputDir: crypto.randomUUID(),
                },
                projectConfig,
                resolver,
            );

            mock({
                "src/index.html": "",
            });

            const result = await processor.process();
            expect(result.extra).toEqual(extraMeta);
        });
    });
    describe("(when using a template)", () => {
        it("", async () => {});
    });
});
