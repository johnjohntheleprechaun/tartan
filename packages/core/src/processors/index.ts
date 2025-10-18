import {
    combineLatest,
    distinctUntilChanged,
    filter,
    map,
    Observable,
    of,
    switchMap,
} from "rxjs";
import { ContextTreeNode, NodeType } from "../context-tree.js";
import { processPage } from "./page.js";

export type ProcessedNode = {
    /*
     * The distance this node is from the root node.
     */
    depth: number;
    /*
     * The type of the node.
     */
    type: NodeType;
    /*
     * The path that the result of this node was outputted to, relative to the defined `outputDir`.
     * For all node types except `asset`, this will be a directory
     */
    outputPath: string;
    /*
     * Any extra metadata provided by the source processors.
     */
    extraMeta: { [key: string]: any };
    /*
     * Any assets attached to this node
     */
    assets: ProcessedAsset[];
    /*
     * Child nodes.
     */
    processedChildren: ProcessedNode[];
};
export type ProcessedAsset = {
    /*
     * The filepath this asset was outputted to.
     */
    outputPath: string;
    /*
     * Metadata provided by asset processors.
     */
    extraMeta: { [key: string]: any };
};
/*
export function processTreeNode(
    node: ContextTreeNode,
    depth: number,
): Observable<ProcessedNode> {
    const processedChildren: Observable<ProcessedNode[]> = combineLatest([
        node.children,
        node.attached,
    ]).pipe(
        filter(([, attached]) => attached),
        map(([children]) => {
            const cache: Map<
                ContextTreeNode,
                Observable<ProcessedNode>
            > = new Map();
            return Array.from(children).map(
                (child) =>
                    cache.get(child) || processTreeNode(child, depth + 1),
            ) as Observable<ProcessedNode>[];
        }),
        switchMap(
            (processedChildren) =>
                processedChildren.length > 0
                    ? combineLatest(processedChildren)
                    : of([]), // combineLatest with an empty list returns an observable that never emits, I think
        ),
    );

    const processedSelf: Observable<ProcessedNode> = node.type.pipe(
        distinctUntilChanged(),
        switchMap((type): Observable<ProcessedNode> => {
            if (type === "page" || type === "page.file") {
                return processPage(node, depth, processedChildren);
            } else if (type === "asset") {
            } else if (type === "handoff") {
            }
            return of();
        }),
    );
    return processedSelf;
}
*/
