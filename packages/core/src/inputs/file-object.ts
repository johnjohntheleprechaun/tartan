import path, { ParsedPath } from "node:path";
import fs from "fs/promises";
import { loadModule } from "./module.js";
import { Dirent } from "node:fs";
import { TartanInput } from "../types/inputs.js";
import { loadFile } from "./file.js";

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
export async function loadObject<T>(
    basename: string,
    defaultIfNoFileExists: T,
): Promise<TartanInput<T>> {
    const resolvedBasename = path.resolve(basename);
    const files = await fs.readdir(path.dirname(basename), {
        withFileTypes: true,
    });
    const matchingFiles: Dirent<string>[] = files
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

    const pathToLoad: ParsedPath | undefined =
        matchingFiles.length > 0
            ? path.parse(
                  path.join(matchingFiles[0].parentPath, matchingFiles[0].name),
              )
            : undefined;

    if (pathToLoad === undefined) {
        return {
            value: defaultIfNoFileExists,
            path: resolvedBasename,
        };
    }

    if (moduleFileExtensions.has(pathToLoad.ext)) {
        return {
            value: await loadModule<T>(path.format(pathToLoad)).then(
                (val) => val.value as T, // ignore the module path, instead setting it to resolvedBasename
            ),
            path: resolvedBasename,
        };
    } else {
        return {
            value: await loadJSON(path.format(pathToLoad)),
            path: resolvedBasename,
        };
    }
}

export async function loadJSON<T>(filepath: string): Promise<T> {
    // TODO: object cacheing to reduce disk io
    return loadFile(filepath).then((val) => JSON.parse(val.value.toString()));
}
