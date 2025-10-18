import { ProcessedNode } from "../processors/index.js";

export type SourceProcessorInput = {
    /**
     * The distance from the root node.
     */
    depth: number;
    /**
     * Extra context provided by the node's context object.
     */
    extraContext: {
        [key: string]: any;
    };
    /**
     * The contents of the source file, as a Buffer.
     */
    sourceFile: Buffer;
    /**
     * The location of the source file, relative to the root directory.
     */
    sourcePath: string;
    /**
     * Processed children.
     */
    children: ProcessedNode[];
};
export type SourceProcessorOutput = {
    /**
     * The processed contents.
     */
    processedContents: Buffer;
    /**
     * Any extra information that you'd like to provide to the template or parent nodes
     */
    extraMetadata?: {
        [key: string]: any;
    };
    /**
     * A list of paths that should trigger a re-execution when changed.
     * (This should *not* include the source file, or any assets that would be automatically discovered)
     */
    dependencies?: string[];
    /**
     * Source processors are allowed to change the directory the page is outputted to.
     * This directory is relative to the parent, so effectively it's just *renaming* the page.
     */
    outputDirectory?: string;
};
export type SourceProcessor = (
    input: SourceProcessorInput,
) => SourceProcessorOutput | Promise<SourceProcessorOutput>;
