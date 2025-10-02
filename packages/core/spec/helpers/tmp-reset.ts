import ParcelWatcher, { EventType } from "@parcel/watcher";
import fs from "fs/promises";

let callbacks: ParcelWatcher.SubscribeCallback[] = [];
export function fileChanged(path: string, type: EventType) {
    callbacks.forEach((callback) => {
        callback(null, [
            {
                path,
                type,
            },
        ]);
    });
}

beforeAll(async () => {
    await fs.rm(".tmp", {
        force: true,
        recursive: true,
    });
    await fs.mkdir(".tmp");
    // mocking parcel watcher
    spyOn(ParcelWatcher, "subscribe").and.callFake(
        async (dir, callback, opts) => {
            if (dir !== ".") {
                throw "jank code alert";
            }
            callbacks.push(callback);

            return {
                async unsubscribe() {
                    callbacks = callbacks.filter((val) => val !== callback);
                },
            };
        },
    );
});

beforeEach(async () => {
    const tmpDir = await fs.mkdtemp(".tmp/tartan-test-");
    globalThis.tmpDir = tmpDir;
});
