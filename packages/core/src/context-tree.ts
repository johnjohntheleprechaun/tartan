import { FullTartanContext } from "./types/tartan-context.js";

export type NodeType =
    | "page"
    | "page.file"
    | "asset"
    | "handoff"
    | "handoff.file";

export type BuildState = {
    dirty: boolean;
    cache: BuildCache;
};
export type BuildCache = Map<
    BuildStep,
    { params: object; accessedPaths: string[]; lastOutput: any }
>;
enum BuildStep {
    LoadContext = "LOAD_CONTEXT",
    LoadChildren = "LOAD_CHILDREN",
    SourceProcessor = "SOURCE_PROCESSOR",
}

export type ContextTreeNode<T extends NodeType = NodeType> = {
    id: string;
    path: string;
    type: T;
    context: FullTartanContext;
    inheritableContext: FullTartanContext;
    children: ContextTreeNode[];

    // node state vars
    state: BuildState;
};
