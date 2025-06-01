import { PartialTartanContext } from "./tartan-context.js";

export type SourceType = "page" | "asset";
/**
 * Information about a processed page.
 */
export type SourceMeta = {
    sourceType: SourceType;
    /**
     * The source file used (relative to rootDir).
     */
    sourcePath: string;
    /**
     * The path this page was outputted to (relative to outputDir). This will be a directory, since all pages end up as an `index.html` within their own directory.
     */
    outputDir: string;
    /**
     * The full context object for this page.
     */
    context: PartialTartanContext;
    /**
     * Any extra metadata provided by the sourceProcessor.
     */
    extra?: any;
};
/**
 * The meta for a page, in the context of being a sub-page.
 */
export type SubSourceMeta = SourceMeta & {
    /**
     * The number of levels away this page is from the one currently being processed.
     * This will never be 0, because meta from pages on the same level is not accessible.
     */
    distance: number;
    /**
     * The depth of the page (effectively the distance from root).
     */
    depth: number;
};
/**
 * The data passed to a source processor.
 */
export type SourceProcessorInput = {
    /**
     * The contents of the source file, as a string.
     */
    sourceContents: Buffer;
    /**
     * The fully processed context object for this page.
     */
    context: PartialTartanContext;
    /**
     * Metadata from all subpages.
     * When pageMode is `file`, all pages matched by `pagePattern` are considered to be on the same level, and the page matched by `pageSource` is one level above them.
     */
    subpageMeta: SubSourceMeta[];
    /**
     * The depth of this page within the root dir.
     */
    depth: number;
};
export type SourceProcessorOutput = {
    processedContents: string;
    /**
     * Source processors are allowed to change the directory the page is outputted to.
     * This directory is relative to the parent, so effectively it's just *renaming* the page.
     */
    outputDir?: string;
    extraMeta?: any;
};
export type SourceProcessor = (
    input: SourceProcessorInput,
) => SourceProcessorOutput | Promise<SourceProcessorOutput>;
