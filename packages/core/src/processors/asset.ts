import { map, of } from "rxjs";
import { NodeProcessor, ProcessedNode } from "./index.js";

export const processAsset: NodeProcessor = (params) => {
    return {
        nodeInfo: params.children.pipe(
            map<ProcessedNode[], ProcessedNode>((children) => ({
                depth: params.depth,
                type: "asset",
                baseChildren: children,
                outputPath: "dummy",
                extraMetadata: {},
                derivedChildren: [],
            })),
        ),
        change: of(undefined),
    };
};
