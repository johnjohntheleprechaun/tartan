import { combineLatestWith, map, Observable, of, Subject } from "rxjs";
import { FullTartanContext, PartialTartanContext } from "./tartan-context.js";
import { SourceType } from "./source-processor.js";
import { loadObjectFromFile } from "./inputs/files.js";
import path from "node:path";

export type ContextTreeNode = {
    inheritableContext: Observable<FullTartanContext>;
    context: Observable<FullTartanContext>;
    type: Observable<SourceType>;
    children: Observable<Set<ContextTreeNode>>; // this is a set so that it's trivial to tell if a node is attached to the tree
    skip: Observable<boolean>;
    attached: Observable<boolean>;
};

type Subjectify<T> = {
    [Property in keyof T]: T[Property] extends Observable<infer P>
        ? Subject<P>
        : T[Property];
};
export function loadContextTreeNode(
    params: {
        directory: string;
        filename?: string;
    } & ( // one must exist
        | {
              rootContext?: FullTartanContext | Observable<FullTartanContext>;
              parent: ContextTreeNode;
          }
        | {
              rootContext: FullTartanContext | Observable<FullTartanContext>;
              parent?: ContextTreeNode;
          }
    ),
): ContextTreeNode {
    const { directory, parent, filename } = params;
    const thisNode: Subjectify<ContextTreeNode> = {
        inheritableContext: new Subject(),
        context: new Subject(),
        type: new Subject(),
        skip: new Subject(),
        attached: new Subject(),
        children: new Subject(),
    };

    /*
     * Load context objects
     */
    const defaultContextFilename: string = path.join(
        directory,
        `${filename || "tartan"}.context.default`,
    );
    const localContextFilename = path.join(
        directory,
        `${filename || "tartan"}.context`,
    );

    const defaultContextObservable: Observable<PartialTartanContext> =
        loadObjectFromFile<PartialTartanContext>(defaultContextFilename, {});
    const localContextObservable: Observable<PartialTartanContext> =
        loadObjectFromFile<PartialTartanContext>(localContextFilename, {});

    // inheritable context
    const inheritableContext: Observable<FullTartanContext> = (
        (parent
            ? parent.inheritableContext
            : params.rootContext instanceof Observable
              ? params.rootContext
              : of(params.rootContext)) as Observable<FullTartanContext>
    ).pipe(
        combineLatestWith(defaultContextObservable),
        map(
            ([parentInheritable, localInheritable]) =>
                ({
                    ...parentInheritable,
                    ...localInheritable,
                }) as FullTartanContext,
        ),
    );
    inheritableContext.subscribe((val) =>
        thisNode.inheritableContext.next(val),
    );

    // local context
    const context = inheritableContext.pipe(
        combineLatestWith(localContextObservable),
        map(
            ([inheritable, local]) =>
                ({
                    ...inheritable,
                    ...local,
                }) as FullTartanContext,
        ),
    );
    context.subscribe((val) => thisNode.context.next(val));

    return thisNode;
}
