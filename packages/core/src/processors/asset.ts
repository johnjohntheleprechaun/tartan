import { map } from "rxjs";
import { NodeProcessor, ProcessedNode } from "./index.js";

export const processAsset: NodeProcessor = (params) => {
    return params.children.pipe(
        map<ProcessedNode[], ProcessedNode>((children) => ({
            depth: params.depth,
            type: "asset",
            baseChildren: children,
            outputPath: "dummy",
            extraMetadata: {},
            derivedChildren: [],
        })),
    );
};
