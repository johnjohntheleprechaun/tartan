import {TartanContext} from "./tartan-context.js";

/**
 * Information about a processed page.
 */
export type PageMeta = {
    /**
     * The source file used (relative to rootDir).
     */
    sourcePath: string;
    /**
     * The path this page was outputted to (relative to outputDir). This will be a directory, since all pages end up as an `index.html` within their own directory.
     */
    outputPath: string;
    /**
     * The full context object for this page.
     */
    context: TartanContext;
    /**
     * Any extra metadata provided by the sourceProcessor.
     */
    extra?: any;
}
/**
 * The meta for a page, in the context of being a sub-page.
 */
export type SubPageMeta = PageMeta & {
    /**
     * The number of levels away this page is from the one currently being processed.
     * This will never be 0, because meta from pages on the same level is not accessible.
     */
    distance: number;
}
/**
 * The data passed to a source processor.
 */
export type SourceProcessorInput = {
    /**
     * The contents of the source file, as a string.
     */
    sourceContents: string;
    /**
     * The fully processed context object for this page.
     */
    context: TartanContext;
    /**
     * Metadata from all subpages.
     * When pageMode is `file`, all pages matched by `pagePattern` are considered to be on the same level, and the page matched by `pageSource` is one level above them.
     */
    subpageMeta: SubPageMeta[];
}
export type SourceProcessorOutput = {
    processedContents: string;
    extraMeta?: any;
}
export type SourceProcessor = (input: SourceProcessorInput) => SourceProcessorOutput | Promise<SourceProcessorOutput>;
