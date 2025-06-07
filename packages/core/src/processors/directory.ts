import { Resolver } from "../resolve.js";
import path from "path";
import { TartanConfig } from "../tartan-config.js";
import {
    PartialTartanContext,
    FullTartanContext,
    TartanContextFile,
} from "../tartan-context.js";
import { glob } from "glob";
import { Logger } from "../logger.js";
import { SourceType } from "../source-processor.js";
import { createFsFromVolume, Volume } from "memfs";

export type ContextTreeNode = {
    defaultContext: FullTartanContext;
    currentContext: PartialTartanContext;
    mergedContext: FullTartanContext;
    sourceType: SourceType;
    parent?: string;
    skip?: boolean;
};
export class DirectoryProcessor {
    private readonly resolver: Resolver;
    private projectConfig: TartanConfig;
    public contextTree: {
        [key: string]: ContextTreeNode;
    } = {};
    private rootContext: FullTartanContext = {
        pageMode: "directory",
        pageSource: "index.html",
    };
    /**
     * @param config The project's config
     * @param resolver The fully initialized module resovler to use
     */
    constructor(config: TartanConfig, resolver: Resolver) {
        this.projectConfig = config;
        this.resolver = resolver;
    }

    /**
     * Traverse the entire tree, loading context files, and merging with default values.
     * `this.contextTree` is set to the result, and returned.
     */
    public async loadContextTree(): Promise<typeof this.contextTree> {
        // This should be... better.
        if (this.projectConfig.rootContext) {
            this.rootContext = (await this.resolver.initializeContext(
                this.projectConfig.rootContext,
            )) as FullTartanContext;
        }
        // set up the queue
        type QueueItem = {
            path: string;
            sourceType: SourceType;
            parent?: string;
        };
        const queue: QueueItem[] = [
            {
                path: path.normalize(this.projectConfig.rootDir),
                sourceType: "page",
            },
        ];
        // this is needed cause otherwise if just put queue.length in the while loop it would present 1, and wouldn't change as the length changes (I think?)
        let queueSize = queue.length;
        for (let i = 0; i < queueSize; i++) {
            /**
             * The current queue item being processed.
             */
            const item = queue[i];

            Logger.log(
                `Now processing queue item ${item.path} (parent is ${item.parent})`,
            );

            /*
             * Now we figure out where the item we're processing is, and how to find its context file.
             */
            let contextFilename: string;
            let dir: string;

            const isDirectory = (
                await Resolver.ufs.stat(item.path)
            ).isDirectory();
            Logger.log(
                `${item.path} is${isDirectory ? "" : " not"} a directory`,
                2,
            );
            if (isDirectory) {
                dir = item.path;
                contextFilename = "tartan.context";

                // add child directories
                const dirContents = await Resolver.ufs.readdir(item.path, {
                    withFileTypes: true,
                });
                for (const child of dirContents) {
                    if (child.isDirectory()) {
                        Logger.log(
                            `adding the subdirectory ${child.name} from ${item.path} to the queue`,
                            2,
                        );
                        queue.push({
                            path: path.normalize(
                                path.join(item.path, child.name, "./"),
                            ),
                            sourceType: "page",
                            parent: item.path,
                        });
                    }
                }
            } else {
                dir = path.dirname(item.path);
                contextFilename = `${path.basename(item.path)}.context`;
            }

            let defaultContextFile: TartanContextFile | undefined;
            // you only actually need to load this if you're a directory, cause files aren't allowed to have default contexts (cause they can't have children)
            if (isDirectory) {
                Logger.log(`Trying to load the default context file`);
                defaultContextFile =
                    await Resolver.loadObjectFromFile<TartanContextFile>(
                        path.join(dir, "tartan.context.default"),
                    );
                Logger.log(
                    `Default context file has contents:\n${JSON.stringify(defaultContextFile)}`,
                );
            }
            let currentContextFile: TartanContextFile | undefined =
                await Resolver.loadObjectFromFile<TartanContextFile>(
                    path.join(dir, contextFilename),
                );

            let defaultContext: FullTartanContext;
            let currentContext: PartialTartanContext = {};

            /*
             * Figure out what your default context is
             */
            if (defaultContextFile) {
                // you just wanna load from file
                const loadedContext: PartialTartanContext =
                    await this.resolver.initializeContext(defaultContextFile);
                defaultContext = this.mergeContexts(
                    item.parent
                        ? this.contextTree[item.parent].defaultContext
                        : this.rootContext,
                    loadedContext,
                ) as FullTartanContext;
            } else if (!item.parent) {
                // your default context is just the root context
                defaultContext = this.mergeContexts(
                    {},
                    this.rootContext,
                ) as FullTartanContext;
            } else {
                defaultContext = this.contextTree[item.parent].defaultContext;
            }

            // if you've got your own special context, initialize it
            if (currentContextFile) {
                currentContext =
                    await this.resolver.initializeContext(currentContextFile);
            }

            const contexts: {
                defaultContext: FullTartanContext;
                currentContext: PartialTartanContext;
                mergedContext: FullTartanContext;
            } = {
                defaultContext,
                currentContext,
                mergedContext: this.mergeContexts(
                    defaultContext,
                    currentContext,
                ) as FullTartanContext,
            };

            if (isDirectory && contexts.mergedContext.pageMode === "mock") {
                Logger.log(
                    `the page mode for ${item.path} was "mock", so we're creating an in-memory filesystem and re-adding this path to the queue`,
                );
                const mockDirectory =
                    await contexts.mergedContext.mockGenerator();
                // if anything is an absolute path, abort
                if (
                    Object.keys(mockDirectory).some((key) =>
                        path.isAbsolute(key),
                    )
                ) {
                    throw "mock generator illegally attempted to specify a non-relative directory";
                }
                const volume = Volume.fromJSON(mockDirectory, dir);
                const memfs = createFsFromVolume(volume);

                Resolver.baseUfs.use(memfs as any); // type fuckery
                // reprocess this directory, now that we've got the mocked filesystem in place
                queue.push(item);
            }

            // Add pages to the queue for file mode and asset mode
            if (
                (isDirectory && contexts.mergedContext.pageMode === "file") ||
                contexts.mergedContext.pageMode === "asset"
            ) {
                Logger.log(
                    `this is a ${contexts.mergedContext.pageMode} page mode directory`,
                );
                if (!contexts.mergedContext.pagePattern) {
                    throw new Error(`You don't have a pagePattern for ${dir}`);
                }
                const files = await glob(contexts.mergedContext.pagePattern, {
                    noglobstar: true,
                    nodir: true,
                    cwd: dir,
                    // ignore the pageSource if it was defined and this is a filemode directory
                    ignore:
                        contexts.mergedContext.pageSource &&
                        contexts.mergedContext.pageMode === "file"
                            ? [contexts.mergedContext.pageSource]
                            : [],
                });

                for (const file of files) {
                    Logger.log(
                        `Adding the file ${file} from ${item.path} to the queue (matched by pagePattern)`,
                    );
                    queue.push({
                        path: path.normalize(path.join(item.path, file)),
                        sourceType:
                            contexts.mergedContext.pageMode === "asset"
                                ? "asset"
                                : "page",
                        parent: item.path,
                    });
                }
            }

            const extraAssetFiles = await glob(
                contexts.mergedContext.extraAssets || [],
                {
                    noglobstar: true,
                    nodir: true,
                    cwd: dir,
                },
            );
            for (const asset of extraAssetFiles) {
                queue.push({
                    path: path.normalize(path.join(item.path, asset)),
                    sourceType: "asset",
                    parent: item.path,
                });
            }

            /*
             * If you're a directory but you don't have a file that matches page source (or no page source at all), don't add it to the results.
             * Not having a page source is... technically allowed. idk why anyone would ever want that though lol.
             */
            let skip: boolean = false;
            if (
                isDirectory &&
                (contexts.mergedContext.pageSource === undefined ||
                    contexts.mergedContext.pageMode === "asset" ||
                    // no access to file
                    !(await Resolver.ufs
                        .access(
                            path.join(dir, contexts.mergedContext.pageSource),
                        )
                        .then(() => true)
                        .catch(() => false)))
            ) {
                Logger.log(`the root page for ${dir} should be skipped`);
                skip = true;
            }
            this.contextTree[item.path] = {
                ...contexts,
                sourceType: item.sourceType,
                parent: item.parent,
                skip,
            };

            queueSize = queue.length;
        }

        return this.contextTree;
    }

    /**
     * Merge a context object with a default context object. Effectively just properties from `b` override properties from `a`.
     *
     * @param a The default context object.
     * @param b The context object to merge with it.
     *
     * @returns The merged context object.
     */
    private mergeContexts(
        a: PartialTartanContext,
        b: PartialTartanContext,
    ): PartialTartanContext {
        if (b.inherit === false) {
            a = this.rootContext;
            delete b.inherit;
        }

        return { ...a, ...b };
    }
}
