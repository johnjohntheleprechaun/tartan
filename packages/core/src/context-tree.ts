import {
    combineLatestWith,
    identity,
    map,
    Observable,
    of,
    ReplaySubject,
    startWith,
    Subject,
    switchMap,
} from "rxjs";
import { FullTartanContext, PartialTartanContext } from "./tartan-context.js";
import {
    FileWatcher,
    loadObjectFromFile,
    skipFirstFileChange,
} from "./inputs/files.js";
import path from "node:path";
import fs from "fs/promises";

export type NodeType = "page" | "asset" | "handoff";
export type ContextTreeNode = {
    inheritableContext: Observable<FullTartanContext>;
    context: Observable<FullTartanContext>;
    type: Observable<NodeType>;
    children: Observable<Set<ContextTreeNode>>; // this is a set so that it's trivial to tell if a node is attached to the tree
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
        inheritableContext: new ReplaySubject(),
        context: new ReplaySubject(),
        type: new ReplaySubject(),
        attached: new ReplaySubject(),
        children: new ReplaySubject(),
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

    /*
     * Load children
     */
    const fileChangeSubject: Subject<void> = new Subject();
    const watcher = new FileWatcher(fileChangeSubject);
    const childCache: Map<string, ContextTreeNode> = new Map();
    const children: Observable<Set<ContextTreeNode>> = filename
        ? of(new Set<ContextTreeNode>()) // if it's a file then it can't have children, so just emit an empty set
        : fileChangeSubject.pipe(
              startWith(undefined),
              combineLatestWith(context),
              switchMap(async ([, context]) => {
                  switch (context.pageMode) {
                      case "directory":
                          // watch all subDirectories
                          watcher.setWatchedPaths([path.join(directory, "*")]);
                          const subDirs = await fs
                              .readdir(directory, { withFileTypes: true })
                              .then((entries) =>
                                  entries.filter((entry) =>
                                      entry.isDirectory(),
                                  ),
                              );
                          return new Set(
                              subDirs.map((dir) => {
                                  const childDir = path.join(
                                      dir.parentPath,
                                      dir.name,
                                  );
                                  const cacheKey = JSON.stringify({
                                      entry: childDir,
                                      pageMode: context.pageMode,
                                  });

                                  return (
                                      childCache.get(cacheKey) ||
                                      loadContextTreeNode({
                                          directory: childDir,
                                          parent: thisNode,
                                      })
                                  );
                              }),
                          );
                      case "file":
                          return new Set<ContextTreeNode>();
                      case "asset":
                          return new Set<ContextTreeNode>();
                      case "mock":
                          return new Set<ContextTreeNode>();
                      case "handoff":
                          return new Set<ContextTreeNode>();
                  }
              }),
          );
    children.subscribe((val) => thisNode.children.next(val));

    return thisNode;
}
