import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { bufferCount, concatMap, firstValueFrom, Observable } from "rxjs";

export async function makeTempFile(
    name: string,
    contents: string,
): Promise<string> {
    if (!globalThis.tmpDir) {
        fail("no temp dir was provided");
    }
    const filePath = resolve(join(globalThis.tmpDir, name));
    await fs.writeFile(filePath, contents);
    return filePath;
}

/**
 * useful to perform filesystem operations only after the full observable flow has been processed
 */
export async function performOperationAfterEachEmission<T>(
    observable: Observable<T>,
    operations: ((emission: T) => any)[],
): Promise<T[]> {
    let i = 0;
    const emissions: T[] = [];

    return firstValueFrom(
        observable.pipe(
            concatMap(async (emission) => {
                if (operations[i]) {
                    await operations[i](emission);
                    emissions.push(emission);
                    i++;
                }
                return emission;
            }),
            bufferCount(operations.length + 1),
        ),
    );
}
