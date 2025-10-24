import { concatMap, OperatorFunction, pipe } from "rxjs";
import fs from "node:fs/promises";
import { dirname } from "node:path";

export type FileToBeWritten = {
    path: string;
    contents: Buffer;
};
export function writeFile(): OperatorFunction<FileToBeWritten, void> {
    return pipe(
        concatMap(async (file) => {
            await fs.mkdir(dirname(file.path), { recursive: true });
            await fs.writeFile(file.path, file.contents);
        }),
    );
}
