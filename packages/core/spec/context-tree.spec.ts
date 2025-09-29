import {
    firstValueFrom,
    Observable,
    of,
    shareReplay,
    skip,
    Subject,
    take,
    toArray,
} from "rxjs";
import { loadContextTreeNode } from "../src/context-tree";
import { FullTartanContext, PartialTartanContext } from "../src/tartan-context";
import { makeTempFile, performOperationAfterEachEmission } from "./utils";
import fs from "fs/promises";

describe("The context tree loader", () => {
    it("should return the parent context when no context files are on disk", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "yourmom.html",
        };
        const node = loadContextTreeNode({
            directory: globalThis.tmpDir,
            rootContext,
        });

        const emittedContext: FullTartanContext = await firstValueFrom(
            node.context,
        );
        expect(emittedContext).toEqual(rootContext);
    });
    it("should overlay a local context file on the root context", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "fuck.html",
        };
        const localContextFile: PartialTartanContext = {
            pageSource: "chickennugget.html",
        };
        const expectedResult: FullTartanContext = {
            pageMode: "directory",
            pageSource: "chickennugget.html",
        };

        await makeTempFile(
            "tartan.context.json",
            JSON.stringify(localContextFile),
        );

        const node = loadContextTreeNode({
            directory: globalThis.tmpDir,
            rootContext,
        });

        const localContext = await firstValueFrom(node.context);
        expect(localContext).toEqual(expectedResult);
    });
    it("should use a default context file as both inheritable and local contexts", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.html",
        };
        const defaultContextFile: PartialTartanContext = {
            pageSource: "overridden.uwu",
        };

        await makeTempFile(
            "tartan.context.default.json",
            JSON.stringify(defaultContextFile),
        );

        const node = loadContextTreeNode({
            directory: globalThis.tmpDir,
            rootContext,
        });

        const expectedOutput: FullTartanContext = {
            pageMode: "directory",
            pageSource: "overridden.uwu",
        };
        expect(await firstValueFrom(node.inheritableContext)).toEqual(
            expectedOutput,
        );
        expect(await firstValueFrom(node.context)).toEqual(expectedOutput);
    });
    it("should reload contexts when file changes", async () => {
        const defaultContextFile: PartialTartanContext = {
            pageSource: "index.html",
        };
        const localContextFile: PartialTartanContext = {
            pageSource: "index.md",
        };

        const defaultFilename = await makeTempFile(
            "tartan.context.default.json",
            JSON.stringify(defaultContextFile),
        );
        const localFilename = await makeTempFile(
            "tartan.context.json",
            JSON.stringify(localContextFile),
        );

        const node = loadContextTreeNode({
            rootContext: { pageMode: "directory", pageSource: "asdf" },
            directory: globalThis.tmpDir,
        });

        const results = await performOperationAfterEachEmission(
            node.context.pipe(skip(2)), // skip emissions of file creations
            [
                async () => fs.writeFile(localFilename, JSON.stringify({})),
                async () =>
                    fs.writeFile(
                        defaultFilename,
                        JSON.stringify({ pageSource: "abcdefg" }),
                    ),
            ],
        );

        expect(results).toEqual([
            { pageMode: "directory", pageSource: "index.md" },
            { pageMode: "directory", pageSource: "index.html" },
            { pageMode: "directory", pageSource: "abcdefg" },
        ]);
    });
    it("should allow rootContext param to be observable", async () => {
        const rootContext: Subject<FullTartanContext> = new Subject();
        const node = loadContextTreeNode({
            directory: globalThis.tmpDir,
            rootContext,
        });
        rootContext.next({
            pageMode: "directory",
            pageSource: "source1",
        });

        const results = await performOperationAfterEachEmission(node.context, [
            async () => {
                rootContext.next({
                    pageMode: "directory",
                    pageSource: "source2",
                });
            },
        ]);

        expect(results).toEqual([
            {
                pageMode: "directory",
                pageSource: "source1",
            },
            {
                pageMode: "directory",
                pageSource: "source2",
            },
        ]);
    });
});
