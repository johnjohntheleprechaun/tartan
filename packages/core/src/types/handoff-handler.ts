export type HandoffHandlerInput = {
    /**
     * The distance from the root node.
     */
    depth: number;
    /**
     * Extra context provided by the associated node's context object.
     */
    extraContext: {
        [key: string]: any;
    };
    /**
     * The path of the node that triggered handoff.
     */
    sourcePath: string;
    /**
     * Whether the node that triggered handoff was attached to a file or a directory.
     */
    sourceWasFile: boolean;
    /**
     * The path that content should be outputted to. This will be a file/directory depending on what the source was.
     * Whether the type is respected however, is entirely up to the handler, so long as it doesn't write to anything above it's designated outputPath.
     */
    outputPath: string;
};
export type HandoffHandlerOutput = {
    /**
     * A list of paths/globs, either absolute or relative to the CWD, that should trigger a re-execution when changed
     */
    dependencies?: string[];
    /**
     * Any extra info that the handler is providing to the parent
     */
    extraMeta?: { [key: string]: any };
    outputWasFile?: boolean;
    outputPath?: string;
};
export type HandoffHandler = (
    input: HandoffHandlerInput,
) => void | HandoffHandlerOutput | Promise<HandoffHandlerOutput>;
