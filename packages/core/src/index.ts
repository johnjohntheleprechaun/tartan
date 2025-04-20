import {DirectoryProcessor, PageProcessor} from "./process.js";
import {Resolver} from "./resolve.js";
import {TartanConfig} from "./tartan-config.js";
import path from "path";

export class TartanProject {
    public readonly config: TartanConfig;
    private readonly directoryProcessor: DirectoryProcessor;
    private readonly resolver: Resolver;
    private initialized: boolean = false;

    constructor(config: TartanConfig) {
        this.config = config;
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

    public async process() {
        const pages: Promise<any>[] = [];
        for (const page in this.directoryProcessor.contextTree) {
            const context = this.directoryProcessor.contextTree[page];
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
            }, this.config, this.resolver);
            pages.push(pageProcessor.process());
        }

        // wait for all the pages to be processed
        await Promise.all(pages);
    }
}


export * from "./tartan-export.js";
export * from "./tartan-config.js";
export * from "./tartan-context.js";
export * from "./process.js";
export * from "./resolve.js";
