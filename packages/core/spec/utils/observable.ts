import { bufferCount, concatMap, firstValueFrom, Observable } from "rxjs";

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
