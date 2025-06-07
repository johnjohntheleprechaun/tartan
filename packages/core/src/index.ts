import { Logger } from "./logger.js";
import {
    ContextTreeNode,
    DirectoryProcessor,
    PageProcessor,
} from "./processors/index.js";
import { Resolver } from "./resolve.js";
import { TartanConfig } from "./tartan-config.js";
import path from "path";
import { FullTartanContext, PartialTartanContext } from "./tartan-context.js";
import { SourceMeta, SubSourceMeta } from "./source-processor.js";
import fs from "fs/promises";
import { AssetHandler } from "./processors/asset.js";

type TreeNode = {
    key: string;
    value: ContextTreeNode;
    children: TreeNode[];
};
type SubSourceMetaWithDepth = Omit<SubSourceMeta, "distance"> & {
    depth: number;
};

export class TartanProject {
    public readonly config: TartanConfig;
    private readonly directoryProcessor: DirectoryProcessor;
    private readonly resolver: Resolver;

    constructor(config: TartanConfig, logLevel?: number) {
        this.config = config;
        Logger.logLevel = logLevel || Logger.defaultLogLevel;
        /*
         * Ensure rootDir is formatted correctly.
         * Whether this should be handled by this class or not is... tbd
         * In fact, I'm not even sure I should ever be touching the config......
         */
        this.config.rootDir = path.normalize(this.config.rootDir);
        if (!this.config.rootDir.endsWith(path.sep)) {
            this.config.rootDir += path.sep;
        }

        this.resolver = new Resolver(this.config);
        this.directoryProcessor = new DirectoryProcessor(
            this.config,
            this.resolver,
        );
    }

    /**
     * Traverse the project's root directory to load page contexts and load any component libraries specified by the project config.
     * Essentially, prepare the project for processing.
     */
    public async init() {
        await this.resolver.init();
        for (const [glob, processor] of Object.entries(
            this.config.extraAssetProcessors || {},
        )) {
            await AssetHandler.registerProcessor(glob, processor);
        }
        await this.directoryProcessor.loadContextTree();
    }

    private flatToTree(
        flat: typeof this.directoryProcessor.contextTree,
    ): TreeNode {
        Logger.log(flat);
        const nodes: Record<string, TreeNode> = {};
        let root: TreeNode | undefined = undefined;

        for (const key in flat) {
            nodes[key] = {
                key: key,
                value: flat[key],
                children: [],
            };
        }

        for (const key in flat) {
            const parent = flat[key].parent;
            Logger.log(parent);
            if (parent === undefined) {
                root = nodes[key];
            } else {
                nodes[parent].children.push(nodes[key]);
            }
        }

        //Logger.log(nodes);
        if (root === undefined) {
            throw "there's no root lol wtf";
        }
        return root;
    }

    public async process() {
        const tree = this.flatToTree(this.directoryProcessor.contextTree);
        Logger.log(JSON.stringify(tree, null, "  "));

        /*
         * The page processing function
         */
        const processPage = async (
            page: string,
            context: FullTartanContext,
            depth: number,
            subSourceMeta: SubSourceMeta[],
        ): Promise<SourceMeta> => {
            Logger.log(`${page} : ${context}`);
            let sourcePath: string;
            let outputDir: string;

            // if it's a directory
            if (page.endsWith(path.sep)) {
                sourcePath = page.endsWith(path.sep)
                    ? path.join(page, context.pageSource || "")
                    : page;
                outputDir = path.join(
                    this.config.outputDir as string,
                    path.relative(this.config.rootDir as string, page),
                );
            }
            // if it's a file
            else {
                const parsed = path.parse(page);
                sourcePath = page;
                outputDir = path.join(
                    this.config.outputDir as string,
                    path.relative(this.config.rootDir as string, parsed.dir),
                    parsed.name,
                );
            }

            const pageProcessor = new PageProcessor(
                {
                    sourcePath,
                    context: context,
                    outputDir,
                    subpageMeta: subSourceMeta,
                    depth,
                },
                this.config,
                this.resolver,
            );

            const result = await pageProcessor.process();
            return result;
        };
        const processAsset = async (
            filepath: string,
            context: FullTartanContext,
        ): Promise<SourceMeta> => {
            const parsed = path.parse(filepath);
            const sourcePath = filepath;
            const outputDir = path.join(
                this.config.outputDir as string,
                path.relative(this.config.rootDir as string, parsed.dir),
            );
            const handler = new AssetHandler({
                sourcePath,
                outputDir,
            });
            const filename = await handler.process();
            return {
                sourcePath,
                sourceType: "asset",
                outputPath: path.join(outputDir, filename),
                context,
            };
        };

        /*
         * Define the recursive function to process the tree bottom-up
         */
        const processFromBottom = async (
            node: TreeNode,
            depth: number = 0,
        ): Promise<SubSourceMetaWithDepth[]> => {
            let results: SubSourceMetaWithDepth[] = [];
            for (const child of node.children) {
                results = results.concat(
                    await processFromBottom(child, depth + 1),
                );
            }
            Logger.log(node);
            if (node.value.skip) {
                return results;
            }
            return results.concat({
                ...(node.value.sourceType === "page"
                    ? await processPage(
                          node.key,
                          node.value.mergedContext,
                          depth,
                          results.map((a) => ({
                              ...a,
                              distance: a.depth - depth,
                          })),
                      )
                    : await processAsset(node.key, node.value.mergedContext)),
                depth: depth,
            });
        };

        const thing = await processFromBottom(tree);
        Logger.log(thing);
    }
}

export * from "./tartan-config.js";
export * from "./tartan-context.js";
export * from "./source-processor.js";
export * from "./processors/index.js";
export * from "./resolve.js";
export * from "./handlebars.js";
export * from "./logger.js";
export * from "./template-manifest.js";
export * from "./halt-controller.js";
