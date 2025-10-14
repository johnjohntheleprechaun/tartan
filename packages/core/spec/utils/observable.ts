import {
    bufferCount,
    concatMap,
    firstValueFrom,
    Observable,
    Subject,
} from "rxjs";

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

/**
 * Just like rxjs.from, except that it uses setTimout to break out of the regular event loop.
 */
export function asyncFrom<T>(input: T[]): Observable<T> {
    const subj: Subject<T> = new Subject();

    const func = (i: number) => {
        subj.next(input[i]);
        if (i + 1 < input.length) setTimeout(func, 0, i + 1);
    };
    setTimeout(func, 0, 0);

    return subj;
}
