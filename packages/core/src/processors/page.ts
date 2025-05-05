import {Resolver} from "../resolve.js";
import fs from "fs/promises";
import path from "path";
import {TartanConfig} from "../tartan-config.js";
import {TartanContext} from "../tartan-context.js";
import {HTMLProcessor} from "./html.js";
import {Logger} from "../logger.js";
import {PageMeta, SourceProcessorOutput, SubPageMeta} from "../source-processor.js";
import {HandlebarsContext} from "../handlebars.js";

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
    /**
     */
    subpageMeta: SubPageMeta[];
}
export class PageProcessor {
    private readonly resolver: Resolver;
    private readonly config: PageProcessorConfig;
    private readonly projectConfig: TartanConfig;
    private readonly context: TartanContext;

    constructor(pageConfig: PageProcessorConfig, projectConfig: TartanConfig, resolver: Resolver) {
        this.config = pageConfig;
        this.resolver = resolver;
        this.context = this.config.context;
        this.projectConfig = projectConfig;
    }

    public async process(): Promise<PageMeta> {
        Logger.log(this.config, 2);
        try {
            await fs.access(this.config.outputDir);
        }
        catch {
            await fs.mkdir(this.config.outputDir, {recursive: true});
        }
        // load and process the content
        const pageContent = await fs.readFile(this.config.sourcePath);
        Logger.log(pageContent.toString(), 2);
        const processorOutput: SourceProcessorOutput = this.context.sourceProcessor ?
            await this.context.sourceProcessor({
                context: this.context,
                sourceContents: pageContent.toString(),
                subpageMeta: this.config.subpageMeta,
            })
            : {processedContents: pageContent.toString()};

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
        }
        else {
            finished = this.context.template({
                pageContent: processorOutput.processedContents,
                extraContext: this.context.handlebarsParameters,
                pageMeta,
                subPageMeta: this.config.subpageMeta,
            } as HandlebarsContext);
        }
        Logger.log(finished, 2);

        // now run it through the HTMLProcessor
        const processor = new HTMLProcessor(finished, this.resolver, this.config.sourcePath);
        const processedHTML = await processor.process();

        Logger.log(processedHTML, 2)
        Logger.log(`input from ${this.config.sourcePath}`)

        // now write to the output directory
        const outputFilename = path.join(this.config.outputDir, "index.html");
        await fs.writeFile(outputFilename, processedHTML.content);

        await this.writeDependencies(processedHTML.dependencies);

        return pageMeta;
    }

    async writeDependencies(dependencies: string[]) {
        for (const dependency of dependencies) {
            const dependencyPath = this.resolver.resolvePath(dependency, this.config.sourcePath);
            Logger.log(`this is a dependency ${dependencyPath}`);

            await fs.copyFile(dependencyPath, path.join(
                this.projectConfig.outputDir,
                path.relative(this.projectConfig.rootDir, dependencyPath),
            ));
        }
    }
}
