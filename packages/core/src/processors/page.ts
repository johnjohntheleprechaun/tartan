import {Resolver} from "../resolve.js";
import fs from "fs/promises";
import path from "path";
import {TartanConfig} from "../tartan-config.js";
import {TartanContext} from "../tartan-context.js";
import {HTMLProcessor} from "./html.js";

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
        const processed: string = this.context.sourceProcessor ? await this.context.sourceProcessor(pageContent.toString()) : pageContent.toString();

        // pass it into the handlebars template, if you need to
        let finished: string;
        if (!this.context.template) {
            finished = processed;
        }
        else {
            finished = this.context.template({
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
