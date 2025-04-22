import {Resolver} from "../resolve.js";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import {TartanConfig} from "../tartan-config.js";
import {TartanContext, TartanContextFile} from "../tartan-context.js";
import Handlebars from "handlebars";
import {glob} from "glob";
import {Logger} from "../logger.js";

export class DirectoryProcessor {
    private readonly resolver: Resolver;
    private projectConfig: TartanConfig;
    public contextTree: {[key: string]: TartanContext} = {};
    private readonly rootContext: TartanContext = {
        pageMode: "directory",
        pageSource: "index.html",
    }

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
    public async loadContextTree(): Promise<{[key: string]: TartanContext}> {
        // Go through the treeeeeee
        interface QueueItem {
            path: string;
            parent?: string;
        };
        const queue: QueueItem[] = [{path: path.normalize(this.projectConfig.rootDir)}];
        const results: {[key: string]: {defaultContext: TartanContext, currentContext: TartanContext, mergedContext: TartanContext}} = {};
        let queueSize = 1;
        for (let i = 0; i < queueSize; i++) {
            /**
             * The current queue item being processed.
             */
            const item = queue[i]
            Logger.log(item);
            Logger.log(queue.slice(i));

            let dir: string;
            let dirContents: fsSync.Dirent[];
            let defaultContextFilename: fsSync.Dirent | undefined;
            let contextFilename: fsSync.Dirent | undefined;

            const isDirectory = (await fs.stat(item.path)).isDirectory();
            Logger.log(isDirectory);
            if (isDirectory) {
                dir = item.path;
                dirContents = await fs.readdir(item.path, {withFileTypes: true});
                defaultContextFilename = dirContents.find((val) => /^tartan\.context\.default\.(mjs|js|json)$/.exec(val.name) && val.isFile());
                contextFilename = dirContents.find((val) => /^tartan\.context\.(mjs|js|json)$/.exec(val.name) && val.isFile());

                // add child directories
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
                dir = path.join(path.dirname(item.path), "./");
                dirContents = await fs.readdir(path.dirname(item.path), {withFileTypes: true});
                defaultContextFilename = dirContents.find((val) => /^tartan\.context\.default\.(mjs|js|json)$/.exec(val.name) && val.isFile());
                contextFilename = dirContents.find((val) => new RegExp(`^${path.basename(item.path)}\\.context\\.(mjs|js|json)$`).exec(val.name) && val.isFile());
            }

            let defaultContext: TartanContext = {};
            let currentContext: TartanContext = {};

            if (defaultContextFilename) {
                const loadedContext = await this.loadContext(path.join(dir, defaultContextFilename.name));
                defaultContext = this.mergeContexts(item.parent ? results[item.parent].defaultContext : this.rootContext, loadedContext);
            }
            else if (!item.parent) {
                defaultContext = this.mergeContexts({}, this.rootContext);
            }
            else {
                defaultContext = results[item.parent].defaultContext;
            }

            // get context
            if (contextFilename) {
                currentContext = await this.loadContext(path.join(dir, contextFilename.name));
            }

            const contexts = {
                defaultContext,
                currentContext,
                mergedContext: this.mergeContexts(defaultContext, currentContext),
            }

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

            results[item.path] = contexts;
            queueSize = queue.length;
        }

        for (const key in results) {
            this.contextTree[key] = results[key].mergedContext;
        }

        return this.contextTree;
    }

    /**
     * Merge a context object with a default context object.
     *
     * @param a The default context object.
     * @param b The context object to merge with it.
     *
     * @returns The merged context object.
     */
    private mergeContexts(a: TartanContext, b: TartanContext): TartanContext {
        if (b.inherit === false) {
            a = this.rootContext;
        }

        return {
            pageMode: b.pageMode ? b.pageMode : a.pageMode,
            handlebarsParameters: b.handlebarsParameters ? b.handlebarsParameters : a.handlebarsParameters,
            template: b.template ? b.template : a.template,
            pageSource: b.pageSource ? b.pageSource : a.pageSource,
            pagePattern: b.pagePattern ? b.pagePattern : a.pagePattern,
            sourceProcessor: b.sourceProcessor ? b.sourceProcessor : a.sourceProcessor,
            assets: b.assets ? b.assets : a.assets,
        };
    }

    /**
     * Load a context file, whether it's a js module or a JSON file.
     *
     * @param contextPath The path to the context file.
     * @returns The context object.
     */
    private async loadContext(contextPath: string): Promise<TartanContext> {
        if (!contextPath.startsWith("./")) {
            contextPath = path.join("./", contextPath);
        }
        let contextFile: TartanContextFile = {};
        if (contextPath.endsWith(".js") || contextPath.endsWith(".mjs")) {
            const module = await Resolver.import("." + path.sep + contextPath);
            contextFile = module;
        }
        else if (contextPath.endsWith(".json")) {
            const contents = (await fs.readFile(contextPath)).toString();
            contextFile = JSON.parse(contents);
        }

        const context: TartanContext = {
            ...contextFile,
            template: contextFile.template ? Handlebars.compile(
                (await fs.readFile(this.resolver.resolvePath(contextFile.template, contextPath))).toString()
            ) : undefined,
            sourceProcessor: contextFile.sourceProcessor ? await Resolver.import(this.resolver.resolvePath(contextFile.sourceProcessor, contextPath)) as (content: string) => Promise<string> | string : undefined,
        }

        return context;
    }
}
