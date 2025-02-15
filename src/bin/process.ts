import {ModuleResolver} from "./resolve.js";
import fs from "fs/promises";
import {Statement, importDeclaration, program, stringLiteral} from "@babel/types";
import generate from "@babel/generator";
import {build} from "esbuild";
import parse, {HTMLElement} from "node-html-parser";

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
