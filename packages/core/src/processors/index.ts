import { Observable } from "rxjs";
import { ContextTreeNode, NodeType } from "../context-tree.js";
import { FullTartanContext } from "../types/tartan-context.js";

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
    extraMetadata: { [key: string]: any };
    /*
     * Child nodes that existed before processing
     */
    baseChildren: ProcessedNode[];
    /*
     * Child nodes that were created during processing
     */
    derivedChildren: ProcessedNode[];
};

export type NodeProcessorInput = {
    node: ContextTreeNode;
    depth: number;
    outputDirectory: string;
    rootContext: FullTartanContext | Observable<FullTartanContext>;
    children: Observable<ProcessedNode[]>;
};
export type NodeProcessorOutput = {
    nodeInfo: Observable<ProcessedNode>;
    change: Observable<void>;
};
export type NodeProcessor = (params: NodeProcessorInput) => NodeProcessorOutput;
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
