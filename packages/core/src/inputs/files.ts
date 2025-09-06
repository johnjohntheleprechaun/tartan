import watcher from "@parcel/watcher";
import path from "node:path";
import { debounceTime, Observable, startWith, Subject, switchMap } from "rxjs";
import fs from "fs/promises";

export const DEBOUNCE_ENVIRONMENT_VARIABLE = "TARTAN_FILE_OPERATION_DEBOUNCE";
export const defaultFileOperationDebounce = () =>
    debounceTime(parseInt(process.env[DEBOUNCE_ENVIRONMENT_VARIABLE] || "100"));


export class FileWatcher {
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
        }
    }
    static {
        watcher
            .subscribe(".", this.callback.bind(this), {
                ignore: ["./node_modules/*"],
            })
            .then((sub) => (this.subscription = sub));
    }

    public watchedPaths: Set<string> = new Set<string>();
    private subject: Subject<void>;
    constructor(subscriber: Subject<void>) {
        this.subject = subscriber;
        FileWatcher.addCallback(this.localCallback.bind(this));
    }
    setWatchedPaths(paths: string[]) {
        this.watchedPaths = new Set<string>(paths.map((a) => path.resolve(a)));
    }
    localCallback(err: Error | null, events: watcher.Event[]) {
        /*
        console.log("events triggered", events);
        console.log("watched paths", this.watchedPaths);
        */
        for (const event of events) {
            if (this.watchedPaths.has(event.path)) {
                // just emit that something relevant happened
                this.subject.next();
                return;
            }
        }
    }
}
