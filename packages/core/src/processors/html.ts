import { Resolver } from "../resolve.js";
import {
    Statement,
    importDeclaration,
    program,
    stringLiteral,
} from "@babel/types";
import generate from "@babel/generator";
import { build } from "esbuild";
import parse, { HTMLElement } from "node-html-parser";
import path from "path";
import { TartanConfig } from "../tartan-config.js";
import crypto from "crypto";

export interface HTMLProcessorResult {
    content: string;
    dependencies: DependencyMap[];
}
export type DependencyMap = {
    /**
     * fully resolved path to the dependency.
     */
    source: string;
    /**
     * a path relative to the output directory
     */
    output: string;
};
export class HTMLProcessor {
    private readonly htmlContent: string;
    private readonly rootNode: HTMLElement;
    private readonly resolver: Resolver;
    private readonly pagePath: string | undefined;
    private readonly projectConfig: TartanConfig;

    /**
     * @param htmlContent The content to process.
     * @param resolver The (fully initialized) resolver to use.
     */
    constructor(
        htmlContent: string,
        projectConfig: TartanConfig,
        resolver: Resolver,
        pagePath: string,
    ) {
        this.htmlContent = htmlContent;
        this.projectConfig = projectConfig;
        this.pagePath = pagePath;
        this.resolver = resolver;
        this.rootNode = parse.default(this.htmlContent);
    }

    /**
     * Entirely process the HTML file, and return a complete HTML file with a script tag at the top of `body` which registers all the necessary web components.
     */
    public async process(): Promise<HTMLProcessorResult> {
        const moduleSpecifiers = this.findCustomTags();

        const bundledCode = await this.bundleWebComponents(moduleSpecifiers);

        const documentCopy = this.rootNode.clone().parentNode;
        const bodyElement = documentCopy.querySelector("body");
        bodyElement?.insertAdjacentHTML(
            "afterbegin",
            `<script>${bundledCode}</script>`,
        );

        // `findDependencies` modifies `documentCopy` in place, so I'm pretty sure this needs to be assigned to a variable before the return statement
        const dependencies = this.findDependencies(documentCopy);

        return {
            content: documentCopy.toString(),
            dependencies: dependencies,
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
                importDeclaration([], stringLiteral(moduleSpecifier)),
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
     * Recursive tree search that finds all elements that are registered by a component library, and returns the modules that need to be imported
     * @param node If undefined, the root node is used.
     *
     * @returns a list of module specifiers to be imported
     */
    private findCustomTags(node?: HTMLElement): string[] {
        if (!node) {
            node = this.rootNode;
        }
        let customTags: string[] = [];
        const result = this.resolver.resolveTagName(node.rawTagName);
        if (result !== undefined) {
            customTags.push(result);
        }

        for (const child of node.children) {
            customTags = customTags.concat(this.findCustomTags(child));
        }

        return customTags.filter((tag, i) => customTags.indexOf(tag) === i);
    }

    /**
     * Recursive tree search that finds any dependencies in the HTML (like images), and resolves them to be whatever they should be in the output directory.
     * Paths are modified in place, so it's recommended to provide a copy of the root node when you call this function.
     *
     * @param node If undefined, the root node is used.
     */
    private findDependencies(
        node: HTMLElement,
        seen: Set<string> = new Set(),
    ): DependencyMap[] {
        let dependencies: DependencyMap[] = [];

        let localDependencies: Record<string, string | undefined> = {
            href: node.getAttribute("href"),
            src: node.getAttribute("src"),
            srcset: node.getAttribute("srcset"),
        };

        if (node.tagName === "A") {
            localDependencies = {};
        }

        for (const key in localDependencies) {
            const dependency = localDependencies[key];
            if (dependency === undefined) {
                continue;
            }
            const sourcePath: string = this.resolver.resolvePath(
                dependency,
                this.pagePath,
            );
            /*
             * Ok so now we need to figure out where in the output directory this is going
             */
            const relativeToRoot: string = path.relative(
                this.projectConfig.rootDir,
                sourcePath,
            );

            let outputPath: string;
            if (relativeToRoot.startsWith("..")) {
                outputPath = path.join(
                    this.projectConfig.outputDir,
                    "assets",
                    // We're doing a hash of the fully resolved source path, so that two assets with the same basename don't overwrite each other
                    crypto.hash("sha256", sourcePath) +
                        "-" +
                        path.basename(relativeToRoot),
                );
            } else {
                outputPath = path.join(
                    this.projectConfig.outputDir,
                    relativeToRoot,
                );
            }
            node.setAttribute(
                key,
                path.join(
                    "/",
                    path.relative(this.projectConfig.outputDir, outputPath),
                ),
            );
            if (!seen.has(outputPath)) {
                dependencies.push({
                    source: sourcePath,
                    output: outputPath,
                });
                seen.add(outputPath);
            }
        }

        for (const child of node.children) {
            dependencies = dependencies.concat(this.findDependencies(child));
        }

        return dependencies;
    }
}
