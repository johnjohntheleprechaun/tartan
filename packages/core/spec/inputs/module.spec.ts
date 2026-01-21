import { makeTempFile } from "../utils/filesystem.js";
import { loadModule } from "../../src/inputs/module.js";

describe("The module loader", () => {
    it("should load a module, once", async () => {
        const testFile: string = await makeTempFile(
            "test.ts",
            "export default 10",
        );
        const module = await loadModule<number>(testFile);

        expect(module.value).toBe(10);
    });
    it("should bundle dependencies", async () => {
        const dep: string = await makeTempFile("dep.ts", "export default 50");
        const main: string = await makeTempFile(
            "main.ts",
            `import num from "${dep}"; export default num;`,
        );

        const result = await loadModule<number>(main).then((val) => val.value);

        expect(result).toBe(50);
    });
    it("shouldn't hang when it's an async function", async () => {
        const file = await makeTempFile(
            "test.js",
            "export default () => Promise.resolve()",
        );
        const func = await loadModule<() => Promise<void>>(file).then(
            (val) => val.value,
        );

        return expectAsync(func()).toBeResolved();
    });
});
