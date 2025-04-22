import {Resolver} from "../resolve.js";
import {Statement, importDeclaration, program, stringLiteral} from "@babel/types";
import generate from "@babel/generator";
import {build} from "esbuild";
import parse, {HTMLElement} from "node-html-parser";

export interface HTMLProcessorResult {
    content: string;
    dependencies: string[];
}
export class HTMLProcessor {
    private readonly htmlContent: string;
    private readonly rootNode: HTMLElement;
    private readonly resolver: Resolver;
    private readonly pagePath: string | undefined;

    /**
     * @param htmlContent The content to process.
     * @param resolver The (fully initialized) resolver to use.
     */
    constructor(htmlContent: string, resolver: Resolver, pagePath?: string) {
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
