import { firstValueFrom, of } from "rxjs";
import { ContextTreeNode } from "../../src/context-tree.js";
import { FullTartanContext } from "../../src/types/tartan-context.js";
import { SourceProcessorInput } from "../../src/types/source-processor.js";
import { processPage } from "../../src/processors/page.js";
import { makeTempFiles } from "../utils/filesystem.js";
import path from "node:path";

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
        };
        const tmpDir = await makeTempFiles({
            "index.md": "uwu this doesn't matter uwu",
        });

        const processedPage = processPage(
            node,
            0,
            of([]),
            path.join(tmpDir, "output"),
        );

        const result = await firstValueFrom(processedPage);
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
            context: of(context),
            inheritableContext: of({} as FullTartanContext),
            attached: of(true),
        };
        const tmpDir = await makeTempFiles({
            "index.md": "uwu this doesn't matter uwu",
        });

        const processedPage = processPage(
            node,
            0,
            of([]),
            path.join(tmpDir, "output"),
        );

        const result = await firstValueFrom(processedPage);
        expect(result.outputDirectory).toBe(path.join(tmpDir, "chickennugget"));
    });
    /*
    it("should block output directory modifications that go above the node's directory", async () => {
        const context: FullTartanContext = {
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
        const node: ContextTreeNode = {
            type: of("page"),
            children: of(),
            path: "doesn't matter",
            context: of(context),
            inheritableContext: of({} as FullTartanContext),
            attached: of(true),
        };
        const tmpDir = await makeTempFiles({
            "index.md": "uwu this doesn't matter uwu",
        });
        const processedPage = processPage(
            node,
            0,
            of([]),
            path.join(tmpDir, "output"),
        );
    });
    */
});
