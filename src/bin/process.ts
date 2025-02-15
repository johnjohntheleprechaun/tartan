import {TagNameResolver} from "./resolve.js";
import fs from "fs/promises";
import {ImportDeclaration, Statement, importDeclaration, importDefaultSpecifier, program, stringLiteral} from "@babel/types";
import generate from "@babel/generator";
import {build} from "esbuild";
import parse, {HTMLElement} from "node-html-parser";

export class HTMLParser {
    private readonly htmlFilePath: string;
    private rootNode: HTMLElement;
    private readonly resolver: TagNameResolver;

    public static async create(filePath: string, resolver: TagNameResolver): Promise<HTMLParser> {
        return new HTMLParser(filePath, resolver).init();
    }

    constructor(filePath: string, resolver: TagNameResolver) {
        this.htmlFilePath = filePath;
        this.resolver = resolver;
        this.rootNode = new HTMLElement("", {});
    }

    public async init(): Promise<HTMLParser> {
        const htmlFile = await fs.readFile(this.htmlFilePath);
        this.rootNode = parse.default(htmlFile.toString());
        return this;
    }

    /**
     * Entirely process the HTML file, and return a complete HTML file
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
