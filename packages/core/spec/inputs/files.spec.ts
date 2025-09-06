import { firstValueFrom } from "rxjs";
import fs from "fs/promises";
import { loadFile } from "../../src/inputs/files";
import { makeTempFile, performOperationAfterEachEmission } from "../utils";

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
