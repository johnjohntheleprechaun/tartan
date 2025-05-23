import { Resolver } from "../resolve.js";
import fs from "fs/promises";
import path from "path";
import { TartanConfig } from "../tartan-config.js";
import { PartialTartanContext, FullTartanContext, TartanContextFile } from "../tartan-context.js";
import { glob } from "glob";
import { Logger } from "../logger.js";

export class DirectoryProcessor {
    private readonly resolver: Resolver;
    private projectConfig: TartanConfig;
    public contextTree: { [key: string]: { context: FullTartanContext, parent?: string } } = {};
    private rootContext: FullTartanContext = { pageMode: "directory", pageSource: "index.html" };
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
            this.rootContext = await this.resolver.initializeContext(this.projectConfig.rootContext) as FullTartanContext;
        }
        // Go through the treeeeeee
        type QueueItem = {
            path: string;
            parent?: string;
        };
        const queue: QueueItem[] = [{ path: path.normalize(this.projectConfig.rootDir) }];
        const results: { [key: string]: { defaultContext: PartialTartanContext, currentContext: PartialTartanContext, mergedContext: PartialTartanContext, parent?: string } } = {};
        let queueSize = 1;
        for (let i = 0; i < queueSize; i++) {
            /**
             * The current queue item being processed.
             */
            const item = queue[i]
            Logger.log(item);
            Logger.log(queue.slice(i));

            let contextFilename: string;
            let dir: string;

            const isDirectory = (await fs.stat(item.path)).isDirectory();
            Logger.log(isDirectory);
            if (isDirectory) {
                dir = item.path;
                contextFilename = "tartan.context";

                // add child directories
                const dirContents = await fs.readdir(item.path, { withFileTypes: true });
                for (const child of dirContents) {
                    Logger.log(child)
                    if (child.isDirectory()) {
                        Logger.log(true);
                        queue.push(
                            {
                                path: path.normalize(path.join(item.path, child.name, "./")),
                                parent: item.path,
                            }
                        );
                    }
                }
            }
            else {
                dir = path.dirname(item.path);
                contextFilename = `${path.basename(item.path)}.context`;
            }

            let defaultContextFile: TartanContextFile | undefined = await Resolver.loadObjectFromFile<TartanContextFile>(path.join(dir, "tartan.context.default"));
            let currentContextFile: TartanContextFile | undefined = await Resolver.loadObjectFromFile<TartanContextFile>(path.join(dir, contextFilename));

            let defaultContext: PartialTartanContext;
            let currentContext: PartialTartanContext = {};

            if (defaultContextFile) {
                const loadedContext: PartialTartanContext = await this.resolver.initializeContext(defaultContextFile);
                defaultContext = this.mergeContexts(item.parent ? results[item.parent].defaultContext : this.rootContext, loadedContext);
            }
            else if (!item.parent) {
                defaultContext = this.mergeContexts({}, this.rootContext);
            }
            else {
                defaultContext = results[item.parent].defaultContext;
            }

            // get context
            if (currentContextFile) {
                const loadedContext: PartialTartanContext = await this.resolver.initializeContext(currentContextFile);
                currentContext = loadedContext;
            }

            const contexts = {
                defaultContext,
                currentContext,
                mergedContext: this.mergeContexts(defaultContext, currentContext),
            };

            // Add pages to the queue for file mode
            if (isDirectory && contexts.mergedContext.pageMode === "file") {
                Logger.log(`this is a pagemode directory ${contexts}`);
                if (!contexts.mergedContext.pagePattern) {
                    throw new Error(`You don't have a pagePattern for ${dir}`);
                }
                const pages = await glob(contexts.mergedContext.pagePattern, {
                    noglobstar: true,
                    nodir: true,
                    cwd: dir,
                });

                for (const page of pages.filter(val => path.normalize(val) !== path.normalize(contexts.mergedContext.pageSource as string))) {
                    Logger.log(page);
                    queue.push(
                        {
                            path: path.normalize(path.join(item.path, page)),
                            parent: item.path,
                        }
                    );
                }
            }

            results[item.path] = {
                ...contexts,
                parent: item.parent,
            };

            queueSize = queue.length;
        }

        for (const key in results) {
            this.contextTree[key] = {
                context: results[key].mergedContext as FullTartanContext,
                parent: results[key].parent,
            };
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
    private mergeContexts(a: PartialTartanContext, b: PartialTartanContext): PartialTartanContext {
        if (b.inherit === false) {
            a = this.rootContext;
            delete b.inherit;
        }

        return { ...a, ...b };
    }
}
