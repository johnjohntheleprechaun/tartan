import {Logger} from "./logger.js";
import {DirectoryProcessor, PageProcessor} from "./processors/index.js";
import {Resolver} from "./resolve.js";
import {TartanConfig} from "./tartan-config.js";
import path from "path";
import {TartanContext} from "./tartan-context.js";
import {PageMeta, SubPageMeta} from "./source-processor.js";

type TreeNode = {
    key: string;
    value: TartanContext;
    children: TreeNode[];
};
type SubPageMetaWithDepth = Omit<SubPageMeta, "distance"> & {depth: number};

export class TartanProject {
    public readonly config: TartanConfig;
    private readonly directoryProcessor: DirectoryProcessor;
    private readonly resolver: Resolver;
    private initialized: boolean = false;

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
        this.directoryProcessor = new DirectoryProcessor(this.config, this.resolver);
    }

    /**
     * Traverse the project's root directory to load page contexts and load any component libraries specified by the project config.
     * Essentially, prepare the project for processing.
     */
    public async init() {
        await this.resolver.init();
        await this.directoryProcessor.loadContextTree();
    }

    private flatToTree(flat: typeof this.directoryProcessor.contextTree): TreeNode {
        Logger.log(flat);
        const nodes: Record<string, TreeNode> = {};
        let root: TreeNode | undefined = undefined;

        for (const key in flat) {
            nodes[key] = {
                key: key,
                value: flat[key].context,
                children: [],
            };
        }

        for (const key in flat) {
            const parent = flat[key].parent;
            Logger.log(parent);
            if (parent === undefined) {
                root = nodes[key];
            }
            else {
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
        const processPage = async (page: string, context: TartanContext, subpageMeta: SubPageMeta[]): Promise<PageMeta> => {
            Logger.log(`${page} : ${context}`);
            let sourcePath: string;
            let outputDir: string;

            // if it's a directory
            if (page.endsWith(path.sep)) {
                sourcePath = page.endsWith(path.sep) ? path.join(page, context.pageSource || "") : page;
                outputDir = path.join(this.config.outputDir as string, path.relative(this.config.rootDir as string, page));
            }
            // if it's a file
            else {
                const parsed = path.parse(page);
                sourcePath = page;
                outputDir = path.join(this.config.outputDir as string, path.relative(this.config.rootDir as string, parsed.dir), parsed.name);
            }

            const pageProcessor = new PageProcessor({
                sourcePath,
                context: context,
                outputDir,
                subpageMeta: subpageMeta,
            }, this.config, this.resolver);

            const result = await pageProcessor.process();
            return result;
        }

        /*
         * Define the recursive function to process the tree bottom-up
         */
        const processFromBottom = async (node: TreeNode, depth: number = 0): Promise<SubPageMetaWithDepth[]> => {
            let results: SubPageMetaWithDepth[] = [];
            for (const child of node.children) {
                results = results.concat(await processFromBottom(child, depth + 1));
            }
            return results.concat({
                ...(await processPage(node.key, node.value, results.map(a => ({...a, distance: a.depth - depth})))),
                depth: depth,
            } as SubPageMetaWithDepth);
        }

        const thing = await processFromBottom(tree);
        Logger.log(thing)
    }
}


export * from "./tartan-module.js";
export * from "./tartan-config.js";
export * from "./tartan-context.js";
export * from "./source-processor.js";
export * from "./processors/index.js";
export * from "./resolve.js";
export * from "./handlebars.js";
