import {ModuleResolver} from "./resolve.js";
import fs from "fs/promises";
import path from "path";
import {Statement, importDeclaration, program, stringLiteral} from "@babel/types";
import generate from "@babel/generator";
import {build} from "esbuild";
import parse, {HTMLElement} from "node-html-parser";
import {TartanConfig} from "../tartan-config.js";
import {TartanContext} from "../tartan-context.js";

export class DirectoryProcessor {
    /**
     * The path of the directory, relative to the CWD
     */
    private readonly rootDir: string;
    private readonly resolver: ModuleResolver;
    private projectConfig?: TartanConfig;
    private contextTree: {[key: string]: TartanContext} = {};
    private rootContext: TartanContext = {
        handlebarsParameters: {},
        pageSource: "index.html",
    }


    /**
     * @param root The path to the directory to process, relative to the current working directory
     * @param resolver The fully initialized module resovler to use
     */
    constructor(root: string, resolver: ModuleResolver) {
        this.rootDir = path.normalize(root);
        this.resolver = resolver;
    }

    /**
     * Initialize the processor
     * This usually involves things like loading config files, but should never write to the disk (only read)
     */
    public async init(): Promise<DirectoryProcessor> {
        this.projectConfig = await this.resolver.getConfigForDir(this.rootDir);

        await this.loadContextTree();

        return this;
    }

    /**
     * @param root The path to the directory to process, relative to the current working directory
     * @param resolver The fully initialized module resovler to use
     */
    public static async create(root: string, resolver: ModuleResolver) {
        return new DirectoryProcessor(root, resolver).init();
    }

    /**
     * Traverse the entire tree, loading context files, and merging with default values.
     * (Set the final value to this.contextTree)
     */
    private async loadContextTree() {
        // Go through the treeeeeee
        const queue: string[] = [this.rootDir];
        const results: {[key: string]: {defaultContext: TartanContext, currentContext: TartanContext, mergedContext: TartanContext}} = {};
        let queueSize = 1;
        for (let i = 0; i < queueSize; i++) {
            const dir = queue[i]

            // look for sub-directories
            const dirContents = await fs.readdir(dir, {withFileTypes: true});
            for (const child of dirContents) {
                if (child.isDirectory()) {
                    queue.push(
                        path.normalize(path.join(dir, child.name, "./"))
                    );
                }
            }
            queueSize = queue.length;


            // load the directory's context
            const defaultContextFilename = dirContents.find((val) => /^tartan\.context\.default\.(mjs|js|json)$/.exec(val.name) && val.isFile());
            const contextFilename = dirContents.find((val) => /^tartan\.context\.(mjs|js|json)$/.exec(val.name) && val.isFile());
            let defaultContext: TartanContext = {};
            let currentContext: TartanContext = {};

            // get default context
            if (defaultContextFilename) {
                defaultContext = await this.loadContext(path.join(dir, defaultContextFilename.name));
            }
            else if (dir === this.rootDir) {
                defaultContext = this.rootContext;
            }
            else {
                defaultContext = results[path.normalize(path.join(dir, "../"))].defaultContext;
            }

            // get context
            if (contextFilename) {
                currentContext = await this.loadContext(path.join(dir, contextFilename.name));
            }

            results[dir] = {
                defaultContext,
                currentContext,
                mergedContext: this.mergeContexts(defaultContext, currentContext),
            };
        }

        for (const key in results) {
            this.contextTree[key] = results[key].mergedContext;
        }
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
            handlebarsParameters: b.handlebarsParameters ? b.handlebarsParameters : a.handlebarsParameters,
            template: b.template ? b.template : a.template,
            pageSource: b.pageSource ? b.pageSource : a.pageSource,
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
    public async loadContext(contextPath: string): Promise<TartanContext> {
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

    public async process() {

    }
}

export class HTMLProcessor {
    private readonly htmlFilePath: string;
    private rootNode: HTMLElement;
    private readonly resolver: ModuleResolver;

    /**
     * Create and initialize an instance of HTMLParser.
     *
     * @param filePath The path to the HTML file to be processed.
     * @param resolver The resolver to use for... resolving.
     */
    public static async create(filePath: string, resolver: ModuleResolver): Promise<HTMLProcessor> {
        return new HTMLProcessor(filePath, resolver).init();
    }

    /**
     * @param filePath The path of the HTML file.
     * @param resolver The (fully initialized) resolver to use.
     */
    constructor(filePath: string, resolver: ModuleResolver) {
        this.htmlFilePath = filePath;
        this.resolver = resolver;
        this.rootNode = new HTMLElement("", {});
    }

    /**
     * Read the file from disk and parse the HTML
     */
    public async init(): Promise<HTMLProcessor> {
        const htmlFile = await fs.readFile(this.htmlFilePath);
        this.rootNode = parse.default(htmlFile.toString());
        return this;
    }

    /**
     * Entirely process the HTML file, and return a complete HTML file with a script tag at the top of `body` which registers all the necessary web components.
     */
    public async process(): Promise<string> {
        console.log("------------------------------")
        console.log(`Processing ${this.htmlFilePath}\n`)
        const customTags = this.findCustomTags();
        console.log(`Found the following web components:\n${customTags.map(tag => `<${tag}>`).join("\n")}\n`);

        const moduleSpecifiers = customTags.map(tag => this.resolver.resolveTagName(tag));

        console.log("Generating bundled script\n");
        const bundledCode = await this.bundleWebComponents(moduleSpecifiers);

        const documentCopy = this.rootNode.clone().parentNode;
        const bodyElement = documentCopy.querySelector("body");
        bodyElement?.insertAdjacentHTML("afterbegin", `<script>${bundledCode}</script>`);
        console.log("Finished");
        console.log("------------------------------")

        return documentCopy.toString();
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
}
