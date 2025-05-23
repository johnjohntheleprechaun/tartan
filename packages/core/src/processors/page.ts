/*
 * @format
 */
import { Resolver } from "../resolve.js";
import fs from "fs/promises";
import path from "path";
import { TartanConfig } from "../tartan-config.js";
import { PartialTartanContext } from "../tartan-context.js";
import { DependencyMap, HTMLProcessor } from "./html.js";
import { Logger } from "../logger.js";
import {
    PageMeta,
    SourceProcessorOutput,
    SubPageMeta,
} from "../source-processor.js";
import { HandlebarsContext } from "../handlebars.js";

export interface PageProcessorConfig {
    /**
     * The path to the actual source file.
     */
    sourcePath: string;
    /**
     * The fully processed context for this page.
     */
    context: PartialTartanContext;
    /**
     * The depth of this page within the root directory
     */
    depth?: number;
    /**
     * The fully resolved output directory (as an absolute path), *unless it's modified by the sourceProcessor*
     */
    outputDir: string;
    /**
     */
    subpageMeta: SubPageMeta[];
}
export class PageProcessor {
    private readonly resolver: Resolver;
    private readonly config: PageProcessorConfig;
    private readonly projectConfig: TartanConfig;
    private readonly context: PartialTartanContext;
    public static directoriesOutputed: string[] = [];
    private htmlInfo: {
        htmlContent?: string;
        rootNode?: HTMLElement;
        resolver?: Resolver;
    } = {};

    constructor(
        pageConfig: PageProcessorConfig,
        projectConfig: TartanConfig,
        resolver: Resolver,
    ) {
        this.config = pageConfig;
        this.resolver = resolver;
        this.context = this.config.context;
        this.projectConfig = projectConfig;
    }

    public async process(): Promise<PageMeta> {
        Logger.log(this.config, 2);
        // load and process the content
        const pageContent = await fs.readFile(this.config.sourcePath);
        Logger.log(pageContent.toString(), 2);
        const processorOutput: SourceProcessorOutput = this.context
            .sourceProcessor
            ? await this.context.sourceProcessor({
                  context: this.context,
                  sourceContents: pageContent.toString(),
                  depth: this.config.depth || 0,
                  subpageMeta: this.config.subpageMeta,
              })
            : { processedContents: pageContent.toString() };

        Logger.log(processorOutput, 2);

        const pageMeta: PageMeta = {
            sourcePath: this.config.sourcePath,
            outputDir: this.config.outputDir,
            context: this.context,
            extra: processorOutput.extraMeta,
        };

        // pass it into the handlebars template, if you need to
        let finished: string;
        if (!this.context.template) {
            finished = processorOutput.processedContents;
        } else {
            finished = this.context.template({
                pageContent: processorOutput.processedContents,
                extraContext: this.context.handlebarsParameters,
                pageMeta,
                subPageMeta: this.config.subpageMeta,
            } as HandlebarsContext);
        }
        Logger.log(finished, 2);

        /*
         * Process the HTML
         */
        const processor = new HTMLProcessor(
            finished,
            this.projectConfig,
            this.resolver,
            this.config.sourcePath,
        );
        const processedHTML = await processor.process();

        Logger.log(processedHTML, 2);
        Logger.log(`input from ${this.config.sourcePath}`);

        /*
         * Write to the output directory
         */
        let outputFilename = path.join(this.config.outputDir, "index.html");
        if (processorOutput.outputDir) {
            pageMeta.outputDir = path.join(
                path.dirname(this.config.outputDir),
                processorOutput.outputDir,
            );
            const relativeToOutput = path.relative(
                path.dirname(this.config.outputDir),
                pageMeta.outputDir,
            );
            if (relativeToOutput.startsWith("..") || relativeToOutput === "") {
                throw new InvalidOutputDirectoryError(
                    `output dir (modified by source processor) for page with source ${this.config.sourcePath} is invalid`,
                );
            }
            outputFilename = path.join(pageMeta.outputDir, "index.html");
        }
        if (PageProcessor.directoriesOutputed.includes(pageMeta.outputDir)) {
            Logger.log(PageProcessor.directoriesOutputed);
            throw new InvalidOutputDirectoryError(
                "duplicate output directory provided by a source processor",
            );
        }
        PageProcessor.directoriesOutputed.push(pageMeta.outputDir);
        await fs.mkdir(pageMeta.outputDir, { recursive: true });
        await fs.writeFile(outputFilename, processedHTML.content);

        await this.writeDependencies(processedHTML.dependencies);

        return pageMeta;
    }

    async writeDependencies(dependencies: DependencyMap[]) {
        for (const dependency of dependencies) {
            await fs.mkdir(path.dirname(dependency.output), {
                recursive: true,
            });
            await fs.copyFile(dependency.source, dependency.output);
        }
    }
}

export class InvalidOutputDirectoryError extends Error {
    constructor(message: string) {
        super(message);
    }
}
