import watcher from "@parcel/watcher";
import path, { ParsedPath } from "node:path";
import {
    combineLatest,
    combineLatestWith,
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    MonoTypeOperatorFunction,
    Observable,
    of,
    shareReplay,
    startWith,
    Subject,
    switchMap,
} from "rxjs";
import fs from "fs/promises";
import { loadModule } from "./modules.js";
import { minimatch } from "minimatch";

export const DEBOUNCE_ENVIRONMENT_VARIABLE = "TARTAN_FILE_OPERATION_DEBOUNCE";
export function defaultFileOperationDebounce<T>(): MonoTypeOperatorFunction<T> {
    return debounceTime(
        parseInt(process.env[DEBOUNCE_ENVIRONMENT_VARIABLE] || "100"),
    );
}

const fileCache: Map<string, Observable<Buffer>> = new Map();
export function loadFile(
    filename: string,
    onlyWhile: Observable<boolean>,
): Observable<Buffer> {
    const resolvedPath = path.resolve(filename);

    const cachedObservable = fileCache.get(resolvedPath);
    if (cachedObservable) {
        return combineLatest([cachedObservable, onlyWhile]).pipe(
            filter(([, shouldEmit]) => shouldEmit),
            map(([a]) => a),
        );
    }
    const reloadSubject = new Subject<void>();
    const watcher = new FileWatcher(reloadSubject);
    watcher.setWatchedPaths([filename]);
    const fileObservable = reloadSubject.pipe(
        startWith(undefined),
        defaultFileOperationDebounce(),
        switchMap(() => fs.readFile(filename).catch(() => Buffer.from([]))),
        shareReplay({
            refCount: false,
            bufferSize: 1,
        }),
    );
    fileCache.set(resolvedPath, fileObservable);
    return combineLatest([fileObservable, onlyWhile]).pipe(
        filter(([, shouldEmit]) => shouldEmit),
        map(([a]) => a),
    );
}

const objectCache: Map<string, Observable<any>> = new Map();
const objectFileExtensionOrder = [".ts", ".mts", ".js", ".mjs", ".json"];
const objectFileExtensionSet = new Set(objectFileExtensionOrder);
const moduleFileExtensions = new Set(objectFileExtensionOrder.slice(0, -1));
/**
 * Mapping extension names into indexes so sorts are easily sortable
 */
const extensionIndexMap: { [key: string]: number } =
    objectFileExtensionOrder.reduce(
        (prev, curr, i) => ({ ...prev, [curr]: i }),
        {} as { [key: string]: number },
    );
export function loadObjectFromFile<T>(
    basename: string,
    onlyWhile: Observable<boolean>,
    defaultIfNoFileExists: T,
): Observable<T> {
    const resolvedBasename = path.resolve(basename);
    const cachedObject = objectCache.get(resolvedBasename);
    if (cachedObject) {
        return combineLatest([cachedObject, onlyWhile]).pipe(
            filter(([_, shouldEmit]) => shouldEmit),
            map(([a]) => a),
        );
    }

    const reloadSubject = new Subject<void>();
    const watcher = new FileWatcher(reloadSubject);
    watcher.setWatchedPaths(
        objectFileExtensionOrder.map((extension) => `${basename}${extension}`), // watch all relevant extensions
    );

    let lastPath: string | undefined = undefined;
    const objectObservable = reloadSubject.pipe(
        combineLatestWith(onlyWhile),
        filter(([_, shouldEmit]) => shouldEmit),
        map(([a]) => a),
        startWith(undefined),
        defaultFileOperationDebounce(),
        // considering it safe to use concatMap for Promises
        switchMap(async () => {
            const files = await fs.readdir(path.dirname(basename), {
                withFileTypes: true,
            });
            const matchingFiles = files
                .filter(
                    (val) =>
                        val.isFile() &&
                        objectFileExtensionSet.has(path.parse(val.name).ext) &&
                        path.parse(val.name).name === path.basename(basename),
                )
                .toSorted((a, b) => {
                    const aNum = extensionIndexMap[path.parse(a.name).ext];
                    const bNum = extensionIndexMap[path.parse(b.name).ext];

                    return aNum - bNum;
                });

            return matchingFiles[0]
                ? path.parse(
                      path.join(
                          matchingFiles[0].parentPath,
                          matchingFiles[0].name,
                      ),
                  )
                : undefined;
        }),
        distinctUntilChanged(
            (prev, curr) =>
                (prev === undefined ? prev : path.format(prev)) ===
                (curr === undefined ? curr : path.format(curr)),
        ),
        switchMap((pathToLoad: ParsedPath | undefined) => {
            if (pathToLoad === undefined) {
                return of(defaultIfNoFileExists);
            }
            lastPath = path.format(pathToLoad);

            if (moduleFileExtensions.has(pathToLoad.ext)) {
                return loadModule(path.format(pathToLoad), onlyWhile);
            } else {
                return loadFile(path.format(pathToLoad), onlyWhile).pipe(
                    map((buff) => JSON.parse(buff.toString())),
                );
            }
        }),
        shareReplay({
            refCount: false,
            bufferSize: 1,
        }),
    );
    objectCache.set(resolvedBasename, objectObservable);
    return combineLatest([objectObservable, onlyWhile]).pipe(
        filter(([_, shouldEmit]) => shouldEmit),
        map(([a]) => a),
    );
}

export class FileWatcher {
    /*
     * STATIC
     */
    private static subscription: watcher.AsyncSubscription; // I guess this isn't really used, but I'm keeping it in memory anyway idk
    private static callbacks: watcher.SubscribeCallback[] = [];
    public static addCallback(callback: watcher.SubscribeCallback): () => void {
        this.callbacks.push(callback);
        return () => this.callbacks.filter((val) => val !== callback);
    }
    private static callback(...params: Parameters<watcher.SubscribeCallback>) {
        this.callbacks.forEach((callback) => callback(...params));
    }
    public static async dispose(): Promise<void> {
        if (this.subscription) {
            await this.subscription.unsubscribe();
            this.callbacks.length = 0;
        }
    }
    public static async load() {
        this.subscription = await watcher.subscribe(
            ".",
            this.callback.bind(this),
            {
                ignore: ["./node_modules/*"],
            },
        );
    }
    public static async reload(): Promise<void> {
        await this.dispose();
        await this.load();
    }
    static {
        this.load();
    }

    /*
     * INSTANCE
     */

    private watchedPaths: readonly string[] = [];
    private subject: Subject<void>;
    public dispose: () => void;
    constructor(subscriber: Subject<void>) {
        this.subject = subscriber;
        this.dispose = FileWatcher.addCallback(this.localCallback.bind(this));
    }
    setWatchedPaths(paths: string[]) {
        this.watchedPaths = Object.freeze(paths.map((p) => path.resolve(p)));
    }
    getWatchedPaths(): readonly string[] {
        return this.watchedPaths;
    }
    localCallback(err: Error | null, events: watcher.Event[]) {
        /*
        console.log("events triggered", events);
        console.log("watched paths", this.watchedPaths);
        */
        for (const event of events) {
            if (this.watchedPaths.some((val) => minimatch(event.path, val))) {
                // just emit that something relevant happened
                this.subject.next();
                return;
            }
        }
    }
}
