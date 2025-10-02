import { firstValueFrom, of, skip, Subject, take, timeout } from "rxjs";
import {
    FileWatcher,
    loadFile,
    loadObjectFromFile,
} from "../../src/inputs/files";
import {
    makeTempFile,
    performOperationAfterEachEmission,
    removeTempFile,
    updateTempFile,
} from "../utils";
import path from "path";

describe("The file loader", () => {
    it("should load a file", async () => {
        const filename: string = await makeTempFile(
            "filename.txt",
            "hello world",
        );
        const fileObservable = loadFile(filename);
        const contents = await firstValueFrom(fileObservable);
        expect(contents.toString()).toBe("hello world");
    });
    it("should re-emit on file change", async () => {
        const filename: string = await makeTempFile("changed-file.txt", "1");
        const fileObservable = loadFile(filename);
        const results = await performOperationAfterEachEmission(
            fileObservable,
            [async () => await updateTempFile("changed-file.txt", "2")],
        );
        expect(results.map((val) => val.toString())).toEqual(["1", "2"]);
    });
    it("should not emit when other file changes", async () => {
        const f1: string = await makeTempFile("f1.txt", "1");
        const f2: string = await makeTempFile("f2.txt", "2");

        const f1Observable = loadFile(f1);

        const results = await performOperationAfterEachEmission(
            f1Observable.pipe(
                timeout({
                    each: 500,
                    with: () => of(Buffer.from("nothing changed")),
                }),
            ),
            [async () => updateTempFile("f2.txt", "asdf")],
        );

        expect(results.map((buf) => buf.toString())).toEqual([
            "1",
            "nothing changed",
        ]);
    });
});

describe("The file watcher", () => {
    it("should watch multiple files for changes", async () => {
        const f1 = await makeTempFile("file1.txt", "hello world");
        const f2 = await makeTempFile("file2.txt", "hello other world");
        const changeSubject: Subject<void> = new Subject();
        const watcher = new FileWatcher(changeSubject);
        watcher.setWatchedPaths([f1, f2]);

        const results = performOperationAfterEachEmission(changeSubject, [
            async () => await updateTempFile("file2.txt", "asldkfjnlkjn"),
        ]);
        await updateTempFile("file1.txt", "asnlkjnclkjnas");

        expect(await results).toHaveSize(2);
    });
    it("should watch a glob pattern", async () => {
        const changeSubject: Subject<void> = new Subject();
        const watcher = new FileWatcher(changeSubject);
        watcher.setWatchedPaths([path.join(globalThis.tmpDir, "*.txt")]);
        const res = performOperationAfterEachEmission(changeSubject, []);
        await makeTempFile("poopshit.txt", "asdlfkjansldfjn");

        await makeTempFile("poopshit.not-txt", "asdlfkjansldfjn");
        expect(await res).toHaveSize(1);
    });
    it("should not emit when unwatched file changes", async () => {
        const f1: string = await makeTempFile("f1.txt", "1");
        const f2: string = await makeTempFile("f2.txt", "2");

        const changeSubject: Subject<void> = new Subject();
        const watcher = new FileWatcher(changeSubject);
        watcher.setWatchedPaths([f1]);

        const results = await performOperationAfterEachEmission(
            changeSubject.pipe(
                timeout({
                    each: 100,
                    with: () => of("hehe"),
                }),
            ),
            [async () => updateTempFile("f2.txt", "asdf")],
        );

        expect(results).toEqual(["hehe"]);
    });
    it("should not emit when a file from another watcher instance changes", async () => {
        const f1: string = await makeTempFile("f1.txt", "1");
        const f2: string = await makeTempFile("f2.txt", "2");

        const changeSubject: Subject<void> = new Subject();
        const watcher = new FileWatcher(changeSubject);
        watcher.setWatchedPaths([f1]);

        const otherWatcher = new FileWatcher(new Subject<void>());
        otherWatcher.setWatchedPaths([f2]);

        const results = await performOperationAfterEachEmission(
            changeSubject.pipe(
                timeout({
                    each: 100,
                    with: () => of("hehe"),
                }),
            ),
            [async () => updateTempFile("f2.txt", "asdf")],
        );

        expect(results).toEqual(["hehe"]);
    });
});

describe("The object loader", () => {
    it("should load from a JSON file", async () => {
        const object = {
            key: "value",
        };
        const filename = await makeTempFile(
            "file.json",
            JSON.stringify(object),
        );
        const parsedFilename = path.parse(filename);

        const fileObservable = loadObjectFromFile(
            path.join(parsedFilename.dir, parsedFilename.name),
        );
        const result = await firstValueFrom(fileObservable);
        expect(result).toEqual(object);
    });
    it("should load from a TS file", async () => {
        const object = {
            key: "value",
        };
        const filename = await makeTempFile(
            "object.ts",
            `export default ${JSON.stringify(object)}`,
        );
        const parsedFilename = path.parse(filename);

        const fileObservable = loadObjectFromFile(
            path.join(parsedFilename.dir, parsedFilename.name),
        );

        const result = await firstValueFrom(fileObservable);
        expect(result).toEqual(object);
    });
    it("should prioritize TS over JSON", async () => {
        const object = {
            key: "value",
        };
        const ignoredJSON = await makeTempFile(
            "object.json",
            JSON.stringify({}),
        );
        const filename = await makeTempFile(
            "object.ts",
            `export default ${JSON.stringify(object)}`,
        );
        const parsedFilename = path.parse(filename);

        const fileObservable = loadObjectFromFile(
            path.join(parsedFilename.dir, parsedFilename.name),
        );

        const result = await firstValueFrom(fileObservable);
        expect(result).toEqual(object);
    });
    it("should load JSON, then switch to TS after the TS file is created", async () => {
        const jsonObject = {
            key: "JSON value",
        };
        const tsObject = {
            key: "TS value",
        };

        const jsonFilename = await makeTempFile(
            "object.json",
            JSON.stringify(jsonObject),
        );
        const parsedFilename = path.parse(jsonFilename);
        const fileObservable = loadObjectFromFile(
            path.join(parsedFilename.dir, parsedFilename.name),
        );

        const results = await performOperationAfterEachEmission(
            fileObservable,
            [
                async () =>
                    await makeTempFile(
                        "object.ts",
                        `export default ${JSON.stringify(tsObject)}`,
                    ),
            ],
        );

        expect(results).toEqual([jsonObject, tsObject]);
    });
    it("should load TS, then switch to existing JSON after TS is deleted", async () => {
        const tsObject = {
            key: "TS Object",
        };
        const jsonObject = {
            key: "JSON Object",
        };

        const jsonFilename = await makeTempFile(
            "object.json",
            JSON.stringify(jsonObject),
        );
        const tsFilename = await makeTempFile(
            "object.ts",
            `export default ${JSON.stringify(tsObject)}`,
        );
        const parsedFilename = path.parse(jsonFilename);

        const objectObservable = loadObjectFromFile(
            path.join(parsedFilename.dir, parsedFilename.name),
        );

        const results = await performOperationAfterEachEmission(
            objectObservable,
            [async () => await removeTempFile("object.ts")],
        );
        expect(results).toEqual([tsObject, jsonObject]);
    });
    it("should emit the default when provided", async () => {
        const defaultObject = {
            key: "value",
        };

        if (!globalThis.tmpDir) {
            fail("no tmpDir was provided, but it definitely should've been");
            return;
        }
        const objectObservable = loadObjectFromFile(
            path.join(globalThis.tmpDir, "not-a-real-basename"),
            defaultObject,
        );

        const result = await firstValueFrom(objectObservable);
        expect(result).toEqual(defaultObject);
    });
    it("should emit the default, then emit from a file when one becomes available", async () => {
        const defaultObject = {
            key: "default object",
        };
        const fileObject = {
            key: "JSON object",
        };

        if (!globalThis.tmpDir) {
            fail("no tmpDir was provided, but it definitely should've been");
            return;
        }
        const objectObservable = loadObjectFromFile(
            path.join(globalThis.tmpDir, "object"),
            defaultObject,
        );

        const results = await performOperationAfterEachEmission(
            objectObservable,
            [
                async () =>
                    makeTempFile("object.json", JSON.stringify(fileObject)),
            ],
        );
        expect(results).toEqual([defaultObject, fileObject]);
    });
});
