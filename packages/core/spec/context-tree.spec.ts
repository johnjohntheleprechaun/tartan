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
import { ContextTreeNode, loadContextTreeNode } from "../src/context-tree";
import { FullTartanContext, PartialTartanContext } from "../src/tartan-context";
import {
    makeTempFile,
    makeTempFiles,
    performOperationAfterEachEmission,
} from "./utils";
import fs from "fs/promises";
import path from "path";

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
            node.context.pipe(skip(2)),
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
    it("should inherit context from a parent if provided", async () => {
        const parent: ContextTreeNode = {
            inheritableContext: of({
                pageMode: "directory",
                pageSource: "index.html",
            } as FullTartanContext),
            context: of(),
            children: of(),
            type: of(),
            attached: of(),
        };

        const childNode = loadContextTreeNode({
            directory: globalThis.tmpDir,
            parent,
        });

        const childContext = await firstValueFrom(childNode.context);
        expect(childContext).toEqual({
            pageMode: "directory",
            pageSource: "index.html",
        });
    });
    it("should override parent context when parent is provided", async () => {
        const parent: ContextTreeNode = {
            inheritableContext: of({
                pageMode: "directory",
                pageSource: "index.html",
            } as FullTartanContext),
            context: of(),
            children: of(),
            type: of(),
            attached: of(),
        };
        await makeTempFile(
            "tartan.context.json",
            JSON.stringify({
                pageSource: "index.md",
            }),
        );

        const childNode = loadContextTreeNode({
            directory: globalThis.tmpDir,
            parent,
        });

        const childContext = await firstValueFrom(childNode.context);
        expect(childContext).toEqual({
            pageMode: "directory",
            pageSource: "index.md",
        });
    });

    // Loading children
    describe("when `pageMode` is `directory`", () => {
        it("should load child", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };
            const tmpDir = await makeTempFiles({
                "index.html": "aldjkfnjdn", // contents don't matter
                "child/index.md": "adlskjfnasldk",
                "child/tartan.context.json": JSON.stringify({
                    pageSource: "index.md",
                }),
                "subdir/index.txt": "adksjfnkjnncadsjnjk",
                "subdir/tartan.context.json": JSON.stringify({
                    pageSource: "index.txt",
                }),
            });

            const node = loadContextTreeNode({
                directory: path.join(tmpDir),
                rootContext,
            });

            expect(await firstValueFrom(node.inheritableContext)).toEqual(
                rootContext,
            );

            const children: Set<ContextTreeNode> = await firstValueFrom(
                node.children,
            );
            expect(children).toHaveSize(2);

            const childContexts: Promise<FullTartanContext[]> = Promise.all(
                Array.from(children.values()).map((child) =>
                    firstValueFrom(child.context),
                ),
            );

            expect(await childContexts).toEqual(
                jasmine.arrayWithExactContents([
                    {
                        pageMode: "directory",
                        pageSource: "index.md",
                    },
                    { pageMode: "directory", pageSource: "index.txt" },
                ] as FullTartanContext[]),
            );
        });
        it("Should load a new child when a new sub-dir is created", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };
            const tmpDir = await makeTempFiles({
                "index.html": "aldjkfnjdn", // contents don't matter
                "child/index.html": "adlskjfnasldk",
            });

            const node = loadContextTreeNode({
                directory: path.join(tmpDir),
                rootContext,
            });

            expect(await firstValueFrom(node.inheritableContext)).toEqual(
                rootContext,
            );

            const children: Set<ContextTreeNode>[] =
                await performOperationAfterEachEmission(node.children, [
                    async () =>
                        makeTempFiles({
                            "subdir/index.html": "adksjfnkjnncadsjnjk",
                        }),
                ]);
            expect(children[0]).toHaveSize(1);
            expect(children[1]).toHaveSize(2);
        });
    });
});
