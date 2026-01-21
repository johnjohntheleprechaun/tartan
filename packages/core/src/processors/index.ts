import { NodeType } from "../context-tree.js";

export type ProcessedNode = {
    /**
     * The distance this node is from the root node.
     */
    depth: number;
    /**
     * The type of the node.
     */
    type: NodeType;
    /**
     * The path that the result of this node was outputted to, relative to the defined `outputDir`.
     * For all node types except `asset`, this will be a directory
     */
    outputPath: string;
    /**
     * Any extra metadata provided by the source processors.
     */
    extraMetadata: { [key: string]: any };
    /**
     * Child nodes that existed before processing.
     */
    baseChildren: ProcessedNode[];
    /**
     * Child nodes that were created during processing.
     */
    derivedChildren: ProcessedNode[];
};
