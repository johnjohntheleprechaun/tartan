import {ModuleResolver} from "./resolve.js";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import {Statement, importDeclaration, program, stringLiteral} from "@babel/types";
import generate from "@babel/generator";
import {build} from "esbuild";
import parse, {HTMLElement} from "node-html-parser";
import {TartanConfig} from "./tartan-config.js";
import {TartanContext} from "./tartan-context.js";
import Handlebars from "handlebars";
import {glob} from "glob";

export class DirectoryProcessor {
    private readonly resolver: ModuleResolver;
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
    constructor(config: TartanConfig, resolver: ModuleResolver) {
        this.projectConfig = config;
        this.resolver = resolver;
    }

    /**
     * Traverse the entire tree, loading context files, and merging with default values.
     * `this.contextTree` is set to the result, and returned.
     */
    public async loadContextTree(): Promise<{[key: string]: TartanContext}> {
        // Go through the treeeeeee
        const queue: string[] = [path.normalize(this.projectConfig.rootDir)];
        const results: {[key: string]: {defaultContext: TartanContext, currentContext: TartanContext, mergedContext: TartanContext}} = {};
        let queueSize = 1;
        for (let i = 0; i < queueSize; i++) {
            /**
             * The current queue item being processed.
             */
            const item = queue[i]
            console.log(item);
            console.log(queue.slice(i));

            let dir: string;
            let dirContents: fsSync.Dirent[];
            let defaultContextFilename: fsSync.Dirent | undefined;
            let contextFilename: fsSync.Dirent | undefined;

            const isDirectory = (await fs.stat(item)).isDirectory();
            console.log(isDirectory);
            if (isDirectory) {
                dir = item;
                dirContents = await fs.readdir(item, {withFileTypes: true});
                defaultContextFilename = dirContents.find((val) => /^tartan\.context\.default\.(mjs|js|json)$/.exec(val.name) && val.isFile());
                contextFilename = dirContents.find((val) => /^tartan\.context\.(mjs|js|json)$/.exec(val.name) && val.isFile());

                // add child directories
                for (const child of dirContents) {
                    console.log(child)
                    if (child.isDirectory()) {
                        console.log(true);
                        queue.push(
                            path.normalize(path.join(item, child.name, "./"))
                        );
                    }
                }
            }
            else {
                dir = path.join(path.dirname(item), "./");
                dirContents = await fs.readdir(path.dirname(item), {withFileTypes: true});
                defaultContextFilename = dirContents.find((val) => /^tartan\.context\.default\.(mjs|js|json)$/.exec(val.name) && val.isFile());
                contextFilename = dirContents.find((val) => new RegExp(`^${path.basename(item)}\\.context\\.(mjs|js|json)$`).exec(val.name) && val.isFile());
            }

            let defaultContext: TartanContext = {};
            let currentContext: TartanContext = {};

            const parentPath = path.normalize(path.join(dir, "../"));
            if (defaultContextFilename) {
                const loadedContext = await this.loadContext(path.join(dir, defaultContextFilename.name));
                defaultContext = this.mergeContexts(dir === this.projectConfig.rootDir ? this.rootContext : results[parentPath].defaultContext, loadedContext);
            }
            else if (dir === this.projectConfig.rootDir) {
                defaultContext = this.mergeContexts({}, this.rootContext);
            }
            else {
                defaultContext = results[parentPath].defaultContext;
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

            // Add to the queue
            if (isDirectory && contexts.mergedContext.pageMode === "file") {
                console.log("this is a pagemode directory", contexts);
                if (!contexts.mergedContext.pagePattern) {
                    throw new Error(`You don't have a pagePattern for ${dir}`);
                }
                const pages = await glob(contexts.mergedContext.pagePattern, {
                    noglobstar: true,
                    nodir: true,
                    cwd: dir,
                });

                for (const page of pages.filter(val => path.normalize(val) !== path.normalize(contexts.mergedContext.pageSource as string))) {
                    console.log(page);
                    queue.push(
                        path.normalize(path.join(item, page))
                    );
                }
            }

            results[item] = contexts;
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
        let context: TartanContext = {};
        if (contextPath.endsWith(".js") || contextPath.endsWith(".mjs")) {
            const module = await this.resolver.import("." + path.sep + contextPath);
            context = module;
        }
        else if (contextPath.endsWith(".json")) {
            const contents = (await fs.readFile(contextPath)).toString();
            context = JSON.parse(contents);
        }

        return context;
    }
}

export interface PageProcessorConfig {
    /**
     * The path to the actual source file.
     */
    sourcePath: string;
    /**
     * The fully processed context for this page.
     */
    context: TartanContext;
    /**
     * The fully resolved output directory (as an absolute path).
     */
    outputDir: string;
}
export class PageProcessor {
    private readonly resolver: ModuleResolver;
    private readonly config: PageProcessorConfig;
    private readonly projectConfig: TartanConfig;
    private readonly context: TartanContext;

    constructor(pageConfig: PageProcessorConfig, projectConfig: TartanConfig, resolver: ModuleResolver) {
        this.config = pageConfig;
        this.resolver = resolver;
        this.context = this.config.context;
        this.projectConfig = projectConfig;
    }

    public async process() {
        console.log(this.config);
        try {
            await fs.access(this.config.outputDir);
        }
        catch {
            await fs.mkdir(this.config.outputDir);
        }
        // load and process the content
        const pageContent = await fs.readFile(this.config.sourcePath);
        const sourceProcessor: (content: string) => Promise<string> = this.context.sourceProcessor ? await this.resolver.import(this.context.sourceProcessor) : (a: string) => a;
        const processed = await sourceProcessor(pageContent.toString());

        // pass it into the handlebars template, if you need to
        let finished: string;
        if (!this.context.template) {
            finished = processed;
        }
        else {
            const templatePath = this.projectConfig.templates ? this.projectConfig.templates[this.context.template] : undefined;
            if (!templatePath) {
                throw new Error("undefined template");
            }

            const templateFile = await fs.readFile(templatePath);
            const template = Handlebars.compile(templateFile.toString());
            finished = template({
                pageContent: processed,
                pageContext: this.context.handlebarsParameters,
            });
        }

        // now run it through the HTMLProcessor
        const processor = new HTMLProcessor(finished, this.resolver, this.config.sourcePath);
        const processedHTML = await processor.process();

        // now write to the output directory
        const outputFilename = path.join(this.config.outputDir, "index.html");
        await fs.writeFile(outputFilename, processedHTML.content);
    }
}

export interface HTMLProcessorResult {
    content: string;
    dependencies: string[];
}
export class HTMLProcessor {
    private readonly htmlContent: string;
    private readonly rootNode: HTMLElement;
    private readonly resolver: ModuleResolver;
    private readonly pagePath: string | undefined;

    /**
     * @param htmlContent The content to process.
     * @param resolver The (fully initialized) resolver to use.
     */
    constructor(htmlContent: string, resolver: ModuleResolver, pagePath?: string) {
        this.htmlContent = htmlContent;
        this.pagePath = pagePath;
        this.resolver = resolver;
        this.rootNode = parse.default(this.htmlContent);
    }

    /**
     * Entirely process the HTML file, and return a complete HTML file with a script tag at the top of `body` which registers all the necessary web components.
     */
    public async process(): Promise<HTMLProcessorResult> {
        const customTags = this.findCustomTags();

        const moduleSpecifiers = customTags.map(tag => this.resolver.resolveTagName(tag));

        const bundledCode = await this.bundleWebComponents(moduleSpecifiers);

        const documentCopy = this.rootNode.clone().parentNode;
        const bodyElement = documentCopy.querySelector("body");
        bodyElement?.insertAdjacentHTML("afterbegin", `<script>${bundledCode}</script>`);

        return {
            content: documentCopy.toString(),
            dependencies: this.findDependencies(),
        };
    }

    /**
     * Take a list of module specifiers that register web components, and return completely bundled code that imports all of those modules.
     *
     * @param moduleSpecifiers A list of module specifiers that need to be imported.
     */
    private async bundleWebComponents(moduleSpecifiers: string[]) {
        const statements: Statement[] = [];
        for (const moduleSpecifier of moduleSpecifiers) {
            statements.push(
                importDeclaration(
                    [],
                    stringLiteral(moduleSpecifier)
                )
            );
        }

        const programAST = program(statements);
        const generatedProgram = generate.default(programAST).code;

        const bundledProgram = await build({
            stdin: {
                contents: generatedProgram,
                resolveDir: ".",
            },
            format: "iife",
            platform: "browser",
            bundle: true,
            write: false,
        });

        return bundledProgram.outputFiles[0].text;
    }

    /**
     * Recursive tree search that finds all elements that match any of the prefixes defined by component libraries.
     * @param node If undefined, the root node is used.
     */
    private findCustomTags(node?: HTMLElement): string[] {
        if (!node) {
            node = this.rootNode;
        }
        let customTags: string[] = [];
        const matchResult = /^([^-]+).*$/.exec(node.rawTagName);
        if (matchResult && this.resolver.elementPrefixMap[matchResult[1]]) {
            customTags.push(node.rawTagName);
        }

        for (const child of node.children) {
            customTags = customTags.concat(this.findCustomTags(child));
        }

        return customTags.filter((tag, i) => customTags.indexOf(tag) === i);
    }

    /**
     * Recursive tree search that finds any dependencies (like images and the like)
     * @param node If undefined, the root node is used.
     */
    private findDependencies(node?: HTMLElement): string[] {
        if (!node) {
            node = this.rootNode;
        }
        let dependencies: string[] = [];

        dependencies = dependencies.concat([
            node.getAttribute("href") || "",
            node.getAttribute("src") || "",
            node.getAttribute("srcset") || "",
        ].filter((val) => val !== ""));

        for (const child of node.children) {
            dependencies = dependencies.concat(this.findDependencies(child));
        }

        return dependencies.filter((tag, i) => dependencies.indexOf(tag) === i);
    }
}
