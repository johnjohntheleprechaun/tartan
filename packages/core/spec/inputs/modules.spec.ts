import { firstValueFrom, of } from "rxjs";
import {
    makeTempFile,
    performOperationAfterEachEmission,
    updateTempFile,
} from "../utils";
import { loadModule } from "../../src/inputs/modules.ts";

describe("The module loader", () => {
    it("should load a module, once", async () => {
        const testFile: string = await makeTempFile(
            "test.ts",
            "export default 10",
        );
        const observable = loadModule<number>(testFile, of(true));
        const result: number = await firstValueFrom(observable);

        expect(result).toBe(10);
    });
    it("should reload a module on file change", async () => {
        const testFile: string = await makeTempFile(
            "test.ts",
            "export default 10",
        );
        const observable = loadModule<number>(testFile, of(true));
        const results: number[] = await performOperationAfterEachEmission(
            observable,
            [
                () => updateTempFile("test.ts", "export default 20"),
                () => updateTempFile("test.ts", "export default 30"),
            ],
        );

        // the full emission
        expect(results).toEqual([10, 20, 30]);
    });
    it("should bundle dependencies", async () => {
        const dep: string = await makeTempFile("dep.ts", "export default 50");
        const main: string = await makeTempFile(
            "main.ts",
            `import num from "${dep}"; export default num;`,
        );

        const observable = loadModule<number>(main, of(true));

        const result: number = await firstValueFrom(observable);

        expect(result).toBe(50);
    });
    it("should watch dependencies for changes", async () => {
        const dep: string = await makeTempFile("dep.ts", "export default 50");
        const main: string = await makeTempFile(
            "main.ts",
            `import num from "${dep}"; export default num;`,
        );

        const observable = loadModule<number>(main, of(true));

        const results: number[] = await performOperationAfterEachEmission(
            observable,
            [() => updateTempFile("dep.ts", "export default 20")],
        );

        expect(results).toEqual([50, 20]);
    });
});
