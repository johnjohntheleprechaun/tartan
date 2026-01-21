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
    sourceContents: Buffer;
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
     * Source processors are allowed to change file or directory that the thing they're processing is outputted to.
     * If it's processing a page, this will be treated as a directory, and if it's processing an asset it'll be treated as a file.
     *
     * The outputted path is relative to the parent directory, meaning that outputPath is just renaming the page/asset
     * (although it can be renamed to be multiple directories *below* the original)
     */
    outputPath?: string;
};
export type SourceProcessor = (
    input: SourceProcessorInput,
) => SourceProcessorOutput | Promise<SourceProcessorOutput>;
