import { firstValueFrom } from "rxjs";
import fs from "fs/promises";
import { loadFile, loadObjectFromFile } from "../../src/inputs/files";
import { makeTempFile, performOperationAfterEachEmission } from "../utils";
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
            [async () => await fs.writeFile(filename, "2")],
        );
        expect(results.map((val) => val.toString())).toEqual(["1", "2"]);
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
            [async () => await fs.rm(tsFilename)],
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
