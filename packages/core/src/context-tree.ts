import {
    combineLatestWith,
    distinctUntilChanged,
    map,
    Observable,
    of,
    ReplaySubject,
    startWith,
    Subject,
    switchMap,
} from "rxjs";
import {
    FullTartanContext,
    PartialTartanContext,
} from "./types/tartan-context.js";
import { FileWatcher, loadObjectFromFile } from "./inputs/files.js";
import path from "node:path";
import fs from "fs/promises";
import { minimatch } from "minimatch";

export type NodeType = "page" | "page.file" | "asset" | "handoff";
export type ContextTreeNode = {
    inheritableContext: Observable<FullTartanContext>;
    context: Observable<FullTartanContext>;
    type: Observable<NodeType>;
    path: string;
    children: Observable<Set<ContextTreeNode>>; // this is a set so that it's trivial to tell if a node is attached to the tree
    attached: Observable<boolean>;
};

type Subjectify<T> = {
    [Property in keyof T]: T[Property] extends Observable<infer P>
        ? Subject<P>
        : T[Property];
};
export function loadContextTreeNode(params: {
    directory: string;
    filename?: string;
    rootContext: FullTartanContext | Observable<FullTartanContext>;
    parent?: ContextTreeNode;
    type?: NodeType;
}): ContextTreeNode {
    const { directory, parent, filename, rootContext, type = "page" } = params;
    const thisNode: Subjectify<ContextTreeNode> = {
        inheritableContext: new ReplaySubject(),
        context: new ReplaySubject(),
        type: new ReplaySubject(),
        path: path.join(directory, filename || ""),
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
            : rootContext instanceof Observable
              ? rootContext
              : of(rootContext)) as Observable<FullTartanContext>
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

    context
        .pipe(
            map(
                (ctx): NodeType =>
                    ctx.pageMode === "handoff" ? "handoff" : type,
            ),
            distinctUntilChanged(),
        )
        .subscribe((val) => thisNode.type.next(val));

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
                  const { pageMode } = context;
                  if (pageMode === "directory") {
                      // watch all subDirectories
                      watcher.setWatchedPaths([path.join(directory, "*")]);
                      const subDirs = await fs
                          .readdir(directory, { withFileTypes: true })
                          .then((entries) =>
                              entries.filter((entry) => entry.isDirectory()),
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
                                      rootContext,
                                      type: "page",
                                  })
                              );
                          }),
                      );
                  } else if (pageMode === "file") {
                      watcher.setWatchedPaths([path.join(directory, "*")]);
                      const entries = await fs.readdir(directory, {
                          withFileTypes: true,
                      });
                      const matchedFiles = entries.filter(
                          (val) =>
                              val.isFile() &&
                              minimatch(val.name, context.pagePattern),
                      );
                      const subDirs = entries.filter((val) =>
                          val.isDirectory(),
                      );

                      const childSet: Set<ContextTreeNode> = new Set();

                      // add files to set
                      matchedFiles.forEach((val) => {
                          const cacheKey = JSON.stringify({
                              entry: path.join(val.parentPath, val.name),
                              pageMode,
                          });

                          childSet.add(
                              childCache.get(cacheKey) ||
                                  loadContextTreeNode({
                                      directory: val.parentPath,
                                      filename: val.name,
                                      parent: thisNode,
                                      rootContext,
                                      type: "page.file",
                                  }),
                          );
                      });
                      subDirs.forEach((val) => {
                          const cacheKey = JSON.stringify({
                              entry: path.join(val.parentPath, val.name),
                              pageMode: "directory", // any subdirectory is gonna be treated exactly the same, so it should be cached the same.
                              // basically if you changed from directory pageMode to file pageMode, only on the local context, the sub directories wouldn't be affected.
                              // any changes that would happen would happen because of inherited context attributes.
                          });

                          childSet.add(
                              childCache.get(cacheKey) ||
                                  loadContextTreeNode({
                                      directory: path.join(
                                          val.parentPath,
                                          val.name,
                                      ),
                                      rootContext,
                                      parent: thisNode,
                                      type: "page",
                                  }),
                          );
                      });

                      return childSet;
                  } else if (pageMode === "asset") {
                      watcher.setWatchedPaths([path.join(directory, "*")]);
                      const children = await fs.readdir(directory, {
                          withFileTypes: true,
                      });
                      const assetFiles = children.filter(
                          (child) =>
                              child.isFile() &&
                              minimatch(child.name, context.pagePattern),
                      );
                      const subDirs = children.filter((child) =>
                          child.isDirectory(),
                      );
                      const childSet: Set<ContextTreeNode> = new Set();

                      assetFiles.forEach((asset) => {
                          const cacheKey = JSON.stringify({
                              entry: path.join(asset.parentPath, asset.name),
                              pageMode: "asset",
                          });
                          childSet.add(
                              childCache.get(cacheKey) ||
                                  loadContextTreeNode({
                                      parent: thisNode,
                                      directory: asset.parentPath,
                                      rootContext,
                                      filename: asset.name,
                                      type: "asset",
                                  }),
                          );
                      });
                      subDirs.forEach((val) => {
                          const cacheKey = JSON.stringify({
                              entry: path.join(val.parentPath, val.name),
                              pageMode: "directory", // any subdirectory is gonna be treated exactly the same, so it should be cached the same.
                              // basically if you changed from directory pageMode to file pageMode, only on the local context, the sub directories wouldn't be affected.
                              // any changes that would happen would happen because of inherited context attributes.
                          });

                          childSet.add(
                              childCache.get(cacheKey) ||
                                  loadContextTreeNode({
                                      directory: path.join(
                                          val.parentPath,
                                          val.name,
                                      ),
                                      rootContext,
                                      parent: thisNode,
                                      type: "page",
                                  }),
                          );
                      });
                      return childSet;
                  } else if (pageMode === "handoff") {
                      // you just can't have children lol
                      // I don't even think I need to write tests for this
                      return new Set<ContextTreeNode>();
                  } else {
                      return new Set<ContextTreeNode>();
                  }
              }),
          );
    children.subscribe((val) => thisNode.children.next(val));

    return thisNode;
}
