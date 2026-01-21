import { TemplateDelegate } from "handlebars";
import { ProcessedNode } from "../processors/index.js";

export type HandlebarsInput = {
    /**
     * The processed file contents as a string.
     */
    sourceContents: string;
    /**
     * The distance from the root node.
     */
    depth: number;
    /**
     *  Extra context provided by the node's context.
     */
    extraContext: {
        [key: string]: any;
    };
    /**
     * Extra metadata provided by source processors.
     */
    extraMetadata: {
        [key: string]: any;
    };
    /**
     * The file path of the source file, relative to the root directory.
     */
    sourcePath: string;
    /**
     * Results from processed children.
     */
    children: ProcessedNode[];
};
export type PageTemplate = TemplateDelegate<HandlebarsInput>;
