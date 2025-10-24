import { firstValueFrom, of } from "rxjs";
import {
    ContextTreeNode,
    loadContextTreeNode,
} from "../../src/context-tree.js";
import {
    FullTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { SourceProcessorInput } from "../../src/types/source-processor.js";
import { processPage } from "../../src/processors/page.js";
import { getTempFile, makeTempFiles } from "../utils/filesystem.js";
import path from "node:path";
import { Logger, LogLevel } from "../../src/outputs/logger.js";
import { ProcessedNode } from "../../src/processors/index.js";
import { parse, serialize } from "parse5";

describe("The page processor", () => {
    it("should return metadata from the source processor", async () => {
        const context: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.md",
            sourceProcessor: (input: SourceProcessorInput) => ({
                processedContents: Buffer.from("hello world"),
                extraMetadata: {
                    property: "value",
                },
                //outputDirectory: "chickennugget",
            }),
        };
        const node: ContextTreeNode = {
            type: of("page"),
            children: of(),
            path: "doesn't matter",
            context: of(context),
            inheritableContext: of({} as FullTartanContext),
            attached: of(true),
            id: "someid",
        };
        const tmpDir = await makeTempFiles({
            "index.md": "uwu this doesn't matter uwu",
        });

        const processedPage = processPage({
            node,
            depth: 0,
            children: of([]),
            outputDirectory: path.join(tmpDir, "output"),
            rootContext: context,
        });

        const result = await firstValueFrom(processedPage.nodeInfo);
        expect(result.extraMetadata).toEqual({
            property: "value",
        });
    });
    it("should return the modified output directory", async () => {
        const context: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.md",
            sourceProcessor: (input: SourceProcessorInput) => ({
                processedContents: Buffer.from("hello world"),
                outputDirectory: "chickennugget",
            }),
        };
        const node: ContextTreeNode = {
            type: of("page"),
            children: of(),
            path: "doesn't matter",
            context: of(context),
            inheritableContext: of({} as FullTartanContext),
            attached: of(true),
            id: "someid",
        };
        const tmpDir = await makeTempFiles({
            "index.md": "uwu this doesn't matter uwu",
        });

        const processedPage = processPage({
            node,
            depth: 0,
            children: of([]),
            outputDirectory: path.join(tmpDir, "output"),
            rootContext: context,
        });

        const result = await firstValueFrom(processedPage.nodeInfo);
        expect(result.outputPath).toBe(path.join(tmpDir, "chickennugget"));
    });
    it("should block output directory modifications that go above the node's directory", async () => {
        let spyCalled: () => void = () => {};
        const spyCalledPromise: Promise<void> = new Promise((res) => {
            spyCalled = res;
        });
        const spy = spyOn(Logger, "log").and.callFake(spyCalled);

        const first: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.md",
            sourceProcessor: (input: SourceProcessorInput) => ({
                processedContents: Buffer.from("hello world"),
                extraMetadata: {
                    property: "value",
                },
                outputDirectory: "../chickennugget",
            }),
        };
        const second: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.md",
            sourceProcessor: (input: SourceProcessorInput) => ({
                processedContents: Buffer.from("hello world"),
                extraMetadata: {
                    property: "value",
                },
                outputDirectory: "chickennugget",
            }),
        };
        const node: ContextTreeNode = {
            type: of("page"),
            children: of(),
            path: "doesn't matter",
            context: of(first),
            inheritableContext: of({} as FullTartanContext),
            attached: of(true),
            id: "adskjfnkjn",
        };
        const tmpDir = await makeTempFiles({
            "index.md": "uwu this doesn't matter uwu",
        });
        const processedPage = processPage({
            node,
            depth: 0,
            children: of([]),
            outputDirectory: path.join(tmpDir, "output"),
            rootContext: first,
        });
        processedPage.nodeInfo.subscribe();
        await expectAsync(spyCalledPromise).toBeResolved();
        expect(spy).toHaveBeenCalledWith(jasmine.anything(), LogLevel.Error);
    });
    it("should write the page to the output directory", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.html",
        };

        const tmpDir = await makeTempFiles({
            "index.html": "<p>hello world</p>",
        });
        const node = loadContextTreeNode({
            directory: tmpDir,
            rootContext,
        });
        const processedNode = processPage({
            node,
            depth: 0,
            rootContext,
            outputDirectory: path.join(tmpDir, "output"),
            children: of([]),
        });

        await firstValueFrom(processedNode.change);
        const tempFile = await getTempFile("output/index.html");
        expect(tempFile.toString()).toEqual(
            serialize(parse("<p>hello world</p>")),
        );
    });
    it("should render the template properly", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.txt",
        };
        const localContext: TartanContextFile = {
            template: "./templ.hbs",
        };
        const tmpDir = await makeTempFiles({
            "index.txt": "hello world",
            "templ.hbs": "<p>{{sourceContents}}</p>",
            "tartan.context.json": JSON.stringify(localContext),
        });

        const node = loadContextTreeNode({
            directory: tmpDir,
            rootContext,
        });

        const processedNode = processPage({
            node,
            depth: 0,
            rootContext,
            outputDirectory: path.join(tmpDir, "output"),
            children: of([]),
        });

        await firstValueFrom(processedNode.change);
        const outputtedPage = await getTempFile("output/index.html");
        expect(outputtedPage.toString()).toBe(
            serialize(parse("<p>hello world</p>")),
        );
    });
    it("should use the output from the source processor", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.txt",
        };
        const localContext: TartanContextFile = {
            sourceProcessor: "./processor.ts",
        };
        const tmpDir = await makeTempFiles({
            "index.txt": "hello world",
            "processor.ts":
                'export default () => ({processedContents: "source processor output"})',
            "tartan.context.json": JSON.stringify(localContext),
        });

        const node = loadContextTreeNode({
            directory: tmpDir,
            rootContext,
        });

        const processedNode = processPage({
            node,
            depth: 0,
            rootContext,
            outputDirectory: path.join(tmpDir, "output"),
            children: of([]),
        });

        await firstValueFrom(processedNode.change);
        const outputtedPage = await getTempFile("output/index.html");
        expect(outputtedPage.toString()).toBe(
            serialize(parse("source processor output")),
        );
    });
    describe("when checking for assets", () => {
        it("should load an asset as a derived child", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };
            const tmpDir = await makeTempFiles({
                "index.html": '<img src="hewwo.png"></img>',
                "hewwo.png": "asdjfnasdlkjfn",
            });

            const node = loadContextTreeNode({
                directory: tmpDir,
                rootContext,
            });

            const processedPage: ProcessedNode = await firstValueFrom(
                processPage({
                    node,
                    children: of([]),
                    depth: 0,
                    rootContext,
                    outputDirectory: path.join(tmpDir, "output"),
                }).nodeInfo,
            );

            expect(processedPage.derivedChildren).toHaveSize(1);
        });
    });
});
