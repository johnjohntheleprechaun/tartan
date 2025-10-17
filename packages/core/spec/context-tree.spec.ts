import { firstValueFrom, of, ReplaySubject, Subject } from "rxjs";
import { ContextTreeNode, loadContextTreeNode } from "../src/context-tree.js";
import {
    FullTartanContext,
    PartialTartanContext,
    TartanContextFile,
} from "../src/types/tartan-context.js";
import {
    makeTempFile,
    makeTempFiles,
    performOperationAfterEachEmission,
    removeTempFile,
    updateTempFile,
} from "./utils/index.js";
import path from "path";

describe("The context tree loader", () => {
    it("should return the root context when no context files are on disk", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "yourmom.html",
        };
        const node = loadContextTreeNode({
            directory: process.env["TMP_DIR"] as string,
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
            directory: process.env["TMP_DIR"] as string,
            rootContext,
        });

        const localContext = await firstValueFrom(node.context);
        expect(localContext).toEqual(expectedResult);
    });
    it("should overlay a local context on the root context when a new local context file is created", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "root.html",
        };
        const localContextFile: PartialTartanContext = {
            pageSource: "local.html",
        };

        const node = loadContextTreeNode({
            directory: process.env["TMP_DIR"] as string,
            rootContext,
        });

        const results = await performOperationAfterEachEmission(node.context, [
            async () =>
                makeTempFile(
                    "tartan.context.json",
                    JSON.stringify(localContextFile),
                ),
        ]);

        expect(results).toEqual([
            {
                pageMode: "directory",
                pageSource: "root.html",
            },
            {
                pageMode: "directory",
                pageSource: "local.html",
            },
        ]);
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
            directory: process.env["TMP_DIR"] as string,
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
            directory: process.env["TMP_DIR"] as string,
        });

        const results = await performOperationAfterEachEmission(node.context, [
            async () =>
                updateTempFile("tartan.context.json", JSON.stringify({})),
            async () =>
                updateTempFile(
                    "tartan.context.default.json",
                    JSON.stringify({ pageSource: "abcdefg" }),
                ),
        ]);

        expect(results).toEqual([
            { pageMode: "directory", pageSource: "index.md" },
            { pageMode: "directory", pageSource: "index.html" },
            { pageMode: "directory", pageSource: "abcdefg" },
        ]);
    });
    it("should allow rootContext param to be observable", async () => {
        const rootContext: Subject<FullTartanContext> = new Subject();
        const node = loadContextTreeNode({
            directory: process.env["TMP_DIR"] as string,
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
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "aldkfjnaslkdjfn",
        };
        const childSubject: Subject<Set<ContextTreeNode>> = new ReplaySubject();
        const parent: ContextTreeNode = {
            inheritableContext: of({
                pageMode: "directory",
                pageSource: "index.html",
            } as FullTartanContext),
            context: of(),
            children: childSubject,
            type: of("page"),
            attached: of(true),
            path: "",
        };

        const childNode = loadContextTreeNode({
            directory: process.env["TMP_DIR"] as string,
            parent,
            rootContext,
        });
        childSubject.next(new Set([childNode]));

        const childContext = await firstValueFrom(childNode.context);
        expect(childContext).toEqual({
            pageMode: "directory",
            pageSource: "index.html",
        });
    });
    it("should override parent context when parent is provided", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "aldkfjnaslkdjfn",
        };
        const childSubject: Subject<Set<ContextTreeNode>> = new ReplaySubject();
        const parent: ContextTreeNode = {
            inheritableContext: of({
                pageMode: "directory",
                pageSource: "index.html",
            } as FullTartanContext),
            context: of(),
            children: childSubject,
            type: of("page"),
            attached: of(true),
            path: "",
        };
        await makeTempFile(
            "tartan.context.json",
            JSON.stringify({
                pageSource: "index.md",
            }),
        );

        const childNode = loadContextTreeNode({
            directory: process.env["TMP_DIR"] as string,
            parent,
            rootContext,
        });
        childSubject.next(new Set([childNode]));

        const childContext = await firstValueFrom(childNode.context);
        expect(childContext).toEqual({
            pageMode: "directory",
            pageSource: "index.md",
        });
    });

    // Loading children
    describe("when loading children", () => {
        it("should properly report that node is attached", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "file",
                pagePattern: "*.md",
            };
            const tmpDir = await makeTempFiles({
                "child.md": "assdjfasdlknjca",
            });

            const node = loadContextTreeNode({
                directory: tmpDir,
                rootContext,
            });

            const child: ContextTreeNode = (await firstValueFrom(node.children))
                .values()
                .next().value as ContextTreeNode;

            const results = await performOperationAfterEachEmission(
                child.attached,
                [async () => removeTempFile("child.md")],
            );
            expect(results).toEqual([true, false]);
        });
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
        describe("when `pageMode` is `file`", () => {
            it("should load children", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "test.md": "hewwo world",
                    "nibbledoober.md": "haiii kawaii uwu",
                });
                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(2);
            });
            it("should give children the proper type", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "test.md": "asdfjjjcnaksjdn",
                });
                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                const children = await firstValueFrom(node.children);
                expect(await firstValueFrom(Array.from(children)[0].type)).toBe(
                    "page.file",
                );
            });
            it("should add a child after a new file is created", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const first = await makeTempFile("first.md", "uwuw");
                const node = loadContextTreeNode({
                    directory: process.env["TMP_DIR"] as string,
                    rootContext,
                });

                const results: Set<ContextTreeNode>[] =
                    await performOperationAfterEachEmission(node.children, [
                        async () => makeTempFile("second.md", "asdfjasnldjkn"),
                    ]);

                expect(results[0]).toHaveSize(1);
                expect(results[1]).toHaveSize(2);
            });
            it("should still add sub directories as children", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "first.md": "asdflkjncksjan",
                    "second.md": "adkfnasdlknnncaklsdjnlka",
                    "sub-dir/poo.md": "adkfjlkncnl",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(3);
            });
            it("should add files as children when switched form `directory` to `file` page mode", async () => {
                // for some reason this test fails if I try to create a context file
                const rootContext: FullTartanContext = {
                    pageMode: "directory",
                    pageSource: "index.md",
                };
                const tmpDir = await makeTempFiles({
                    "first.md": "asdflkjncksjan",
                    "second.md": "adkfnasdlknnncaklsdjnlka",
                    "sub-dir/poo.md": "adkfjlkncnl",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                const results = await performOperationAfterEachEmission(
                    node.children,
                    [
                        async () =>
                            makeTempFile(
                                "tartan.context.json",
                                JSON.stringify({
                                    pageMode: "file",
                                    pagePattern: "*.md",
                                }),
                            ),
                        () => {},
                    ],
                );
                expect(results[0]).toHaveSize(1);
                // double emission for some reason?
                // seems to be because you get a trigger from watching the dir for children
                // and another trigger from watching the dir for context files
                expect(results[2]).toHaveSize(3);
            });
            it("shouldn't add unmatching files as children", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "file.md": "uwu",
                    "ignored.txt": "ignore me uwu :3",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(1);
            });
            it("shouldn't add the file matched by `pageSource` as a child, even if it would otherwise be matched by `pagePattern`", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pageSource: "index.md",
                    pagePattern: "*.md",
                };

                const tmpDir = await makeTempFiles({
                    "index.md": "I'm not a child >:3",
                    "child.md": "I'm a child uwuwuwuwuwu",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(1);
            });
        });
        describe("when `pageMode` is `asset`", () => {
            it("should load only matching files as assets", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pagePattern: "*.png",
                };
                const tmpDir = await makeTempFiles({
                    "one.png": "definteily png aatatddat",
                    "two.png": "aslos for sure png hmm",
                    "notapng.notpng": "wow lok im not a png",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(2);
            });
            it("should still load sub directory as a child", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pagePattern: "*.png",
                };
                const tmpDir = await makeTempFiles({
                    "one.png": "adljnlkjasndf",
                    "two.png": "skdlafjnsd",
                    "child-dir/asdfkj.doesn;tatmtma": "asdf",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(3);
            });
            it("should ignore the file matched by `pageSource`", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pageSource: "index.md",
                    pagePattern: "*.md",
                };

                const tmpDir = await makeTempFiles({
                    "index.md": "I'm not a child >:3",
                    "child.md": "I'm a child uwuwuwuwuwu",
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                expect(await firstValueFrom(node.children)).toHaveSize(1);
            });
            it("should add new files as children on creation", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pagePattern: "*.png",
                };
                const tmpDir = await makeTempFiles({
                    "one.png": "uwu",
                });
                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                const results = await performOperationAfterEachEmission(
                    node.children,
                    [async () => makeTempFile("two.png", "askdfjnlakjn")],
                );

                expect(results[0]).toHaveSize(1);
                expect(results[1]).toHaveSize(2);
            });
            it("should remove deleted files from the child set", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pagePattern: "*.png",
                };
                const tmpDir = await makeTempFiles({
                    "one.png": "uwu",
                    "two.png": "asdfasfffdjsk",
                });
                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                const results = await performOperationAfterEachEmission(
                    node.children,
                    [async () => removeTempFile("two.png")],
                );

                expect(results[0]).toHaveSize(2);
                expect(results[1]).toHaveSize(1);
            });
        });
        describe("when `pageMode` is `handoff`", () => {
            it("should set the node type to be `handoff`", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "directory",
                    pageSource: "index.html",
                };

                const localContext: TartanContextFile = {
                    pageMode: "handoff",
                };

                const tmpDir = await makeTempFiles({
                    "tartan.context.json": JSON.stringify(localContext),
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                const result = await firstValueFrom(node.type);
                expect(result).toBe("handoff");
            });
            it("should set the node type to be `handoff.file` if the context that declares handoff is for a file", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };

                const localContext: TartanContextFile = {
                    pageMode: "handoff",
                };

                const tmpDir = await makeTempFiles({
                    "test.md": "uwu",
                    "test.md.context.json": JSON.stringify(localContext),
                });

                const node = loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                });

                const children = await firstValueFrom(node.children);
                expect(children).toHaveSize(1);
                const child = Array.from(children)[0];
                expect(await firstValueFrom(child.type)).toBe("handoff.file");
            });
        });
    });
});
