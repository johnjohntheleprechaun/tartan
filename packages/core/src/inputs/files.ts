import watcher from "@parcel/watcher";
import path from "node:path";
import {
    debounceTime,
    filter,
    map,
    Observable,
    of,
    startWith,
    Subject,
    switchMap,
} from "rxjs";
import fs from "fs/promises";
import { loadModule } from "./modules.js";
import { minimatch } from "minimatch";

export const DEBOUNCE_ENVIRONMENT_VARIABLE = "TARTAN_FILE_OPERATION_DEBOUNCE";
export const defaultFileOperationDebounce = () =>
    debounceTime(parseInt(process.env[DEBOUNCE_ENVIRONMENT_VARIABLE] || "100"));

export function loadFile(filename: string): Observable<Buffer> {
    const reloadSubject = new Subject<void>();
    const watcher = new FileWatcher(reloadSubject);
    watcher.setWatchedPaths([filename]);
    return reloadSubject.pipe(
        startWith(undefined),
        defaultFileOperationDebounce(),
        switchMap((_) => fs.readFile(filename).catch((_) => Buffer.from([]))),
    );
}

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
    defaultIfNoFileExists?: T,
): Observable<T> {
    const reloadSubject = new Subject<void>();
    const watcher = new FileWatcher(reloadSubject);
    watcher.setWatchedPaths(
        objectFileExtensionOrder.map((extension) => `${basename}${extension}`), // watch all relevant extensions
    );

    return reloadSubject.pipe(
        startWith(undefined),
        defaultFileOperationDebounce(),
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

            // parse the file
            if (!matchingFiles[0]) {
                // No available matched files, return the default if none existed
                return defaultIfNoFileExists
                    ? of(defaultIfNoFileExists)
                    : undefined;
            }

            const pathToLoad = path.parse(
                path.join(matchingFiles[0].parentPath, matchingFiles[0].name),
            );
            if (moduleFileExtensions.has(pathToLoad.ext)) {
                return loadModule(path.format(pathToLoad));
            } else {
                return loadFile(path.format(pathToLoad)).pipe(
                    map((contents) => JSON.parse(contents.toString())),
                );
            }
        }),
        // just don't emit if there's no matching files (and no default object was set)
        // I'll add an error warning eventually
        filter((val) => val !== undefined),
        switchMap((val) => val),
    );
}

export class FileWatcher {
    /*
     * STATIC
     */
    private static subscription: watcher.AsyncSubscription; // I guess this isn't really used, but I'm keeping it in memory anyway idk
    private static callbacks: watcher.SubscribeCallback[] = [];
    public static addCallback(callback: watcher.SubscribeCallback) {
        this.callbacks.push(callback);
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
    constructor(subscriber: Subject<void>) {
        this.subject = subscriber;
        FileWatcher.addCallback(this.localCallback.bind(this));
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
