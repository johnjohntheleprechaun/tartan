import {
    combineLatest,
    exhaustMap,
    filter,
    map,
    Observable,
    of,
    OperatorFunction,
    startWith,
    Subject,
    tap,
} from "rxjs";

export function efficientConcatMap<F extends (...params: any) => any>(
    mapFunc: F | Observable<F>,
): OperatorFunction<Parameters<F>, Awaited<ReturnType<F>>>;
export function efficientConcatMap<
    F extends (...params: any) => any,
    P extends Parameters<F>,
    R extends Awaited<ReturnType<F>>,
>(mapFunc: F | Observable<F>): OperatorFunction<P, R> {
    return (params: Observable<P>) =>
        new Observable<R>((subscriber) => {
            // used to store param access in order to detect relevant changes.
            const usedParams: (string | symbol)[][][] = [];
            const propertyAccessCallback: (
                path: (string | symbol)[],
                index: number,
            ) => void = (path, index) => {
                if (!usedParams[index]) {
                    usedParams[index] = [];
                }
                usedParams[index].push(path);
            };
            const rerunSubject: Subject<void> = new Subject();
            let previousInput: [P, F] | undefined;

            combineLatest([
                params,
                mapFunc instanceof Observable ? mapFunc : of(mapFunc),
                rerunSubject.pipe(startWith(undefined)),
            ])
                .pipe(
                    // allow either params or the completion subject to trigger a re-execution.
                    // (or at least, an evaluation of whether it needs to be re-executed)
                    exhaustMap(async ([params, func]) => {
                        let shouldCallFunc: boolean =
                            // the function hasn't been called at all yet
                            previousInput === undefined ||
                            // a new function was provided
                            previousInput[1] !== func ||
                            // some params have changed
                            // executed once for each parameter
                            previousInput[0].some((param: any, i: any) => {
                                const [prev, curr] = [param, params[i]];

                                if (
                                    // We only check for property usage if the param is an object
                                    typeof prev === "object" &&
                                    typeof curr === "object" &&
                                    prev !== null &&
                                    curr !== null
                                ) {
                                    // which parts of this param were accessed on the last iteration
                                    const accessedPaths = usedParams[i];
                                    if (accessedPaths === undefined) {
                                        // The param wasn't used at all during the last execution
                                        // so we just pretend that it hasn't changed, no need to actually check
                                        return false;
                                    } else {
                                        // since it was used, go through each accessed path and see if the value has changed
                                        const anyPathHasChanged =
                                            accessedPaths.some((paramPath) => {
                                                return objectChangedAtPath(
                                                    prev,
                                                    curr,
                                                    paramPath,
                                                );
                                            });
                                        return anyPathHasChanged;
                                    }
                                } else {
                                    // the param wasn't an object, which means we have no way to tell whether it was used, so we just check whether it changed.
                                    return prev !== curr;
                                }
                            });

                        /*
                         * NOW WE START CALLING THE FUNCTION
                         * (maybe)
                         */

                        if (shouldCallFunc) {
                            previousInput = [params, func];
                            // watch all the parameters
                            const watchedParams: P = params.map((obj, i) =>
                                typeof obj === "object" && obj !== null
                                    ? watchObject(obj, (path) =>
                                          propertyAccessCallback(path, i),
                                      )
                                    : obj,
                            ) as P;

                            const result: R = await func(...watchedParams);

                            // if the function wasn't called at all, this exhaustMap just returns undefined, and the result is filtered out.
                            // that means we need to return an object with the result of the function, just in case it returned undefined
                            return {
                                result,
                            };
                        }
                    }),
                    filter((val) => val !== undefined),
                    map((val) => val.result),
                    tap(() => {
                        // JS event loop babyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
                        setTimeout(() => rerunSubject.next(undefined)); // I'm killing everyone if this works
                    }),
                )
                .subscribe(subscriber);
        });
}

export function getProperty(
    object: any,
    path: (string | symbol)[],
    asDescriptor?: true,
): undefined | PropertyDescriptor;
export function getProperty(
    object: any,
    path: (string | symbol)[],
    asDescriptor?: false,
): undefined | any;
export function getProperty(
    object: any,
    path: (string | symbol)[],
    asDescriptor = false,
): undefined | any {
    return path.reduce(
        (acc, key) =>
            acc && acc[key] !== undefined
                ? asDescriptor
                    ? Object.getOwnPropertyDescriptor(acc, key)
                    : acc[key]
                : undefined,
        object,
    );
}

/**
 * Appended to the end of access paths provided to the callback parameter of `watchObject`.
 * They specify what needs to be checked at that path to determine if a change was made.
 */
export const objectAccessSymbols = {
    /**
     * the value of this property
     */
    value: Symbol("value"),
    /**
     * the descriptor for this property
     */
    propertyDescriptor: Symbol("property descriptor"),
    /**
     * the existence of this property
     */
    exists: Symbol("has"),
    /**
     * the keys on this object
     */
    keys: Symbol("ownKeys"),
};
export function watchObject<T extends object>(
    obj: T,
    callback: (propPath: (string | symbol)[]) => void,
): T {
    const prototype = Object.getPrototypeOf(obj);
    /*
     * It turns out that things get really complicated and messy when you start screwing with buffers (and probably other native types).
     * Since my use case is pretty much exclusively basic objects that could've been created from JSON, there's no point in messing with anything more complex.
     */
    if (prototype === Object.prototype) {
        const root: T = Object.create(Object.prototype);
        for (const prop of Object.getOwnPropertyNames(obj)) {
            const descriptor = Object.getOwnPropertyDescriptor(
                obj,
                prop,
            ) as PropertyDescriptor; // it shouldn't be possible to be undefined since the prop is guaranteed to exist
            if (
                typeof descriptor.value === "object" &&
                descriptor.value !== null
            ) {
                Object.defineProperty(root, prop, {
                    ...descriptor,
                    value: watchObject(descriptor.value, (propPath) =>
                        callback([prop, ...propPath]),
                    ),
                });
            } else {
                Object.defineProperty(root, prop, descriptor);
            }
        }
        Object.freeze(root);

        // Some proxy methods aren't implemented, since the object is set to be read-only
        // every get operation on a property is considered to be rootDependency, *unless* the return value of the regular get is an object.
        return new Proxy(root, {
            // apply() not implemented
            // construct() not implemented
            // defineProperty() not implemented
            // deleteProperty() not implemented
            get(target, property, receiver) {
                const val = Reflect.get(target, property, receiver);
                if (
                    typeof val === "object" &&
                    val !== null &&
                    Object.getPrototypeOf(val) === Object.prototype
                ) {
                    // nothing
                    // just don't do anything unless it's a real dependency
                } else {
                    callback([property, objectAccessSymbols.value]);
                }
                return val;
            },
            getOwnPropertyDescriptor(target, property) {
                callback([property, objectAccessSymbols.propertyDescriptor]);
                return Reflect.getOwnPropertyDescriptor(target, property);
            },
            // getPrototypeOf() not implemented, since we're only proxing objects with no prototypes
            has(target, property) {
                callback([property, objectAccessSymbols.exists]);
                return Reflect.has(target, property);
            },
            // isExtensible() not implemented
            ownKeys(target) {
                callback([objectAccessSymbols.keys]);
                return Reflect.ownKeys(target);
            },
            // preventExtensions() not implemented
            // set() not implemented
            // setPrototypeOf() not implemented
        });
    } else {
        return obj;
    }
}

export function objectChangedAtPath(
    prev: any,
    curr: any,
    path: (string | symbol)[],
) {
    const symbol = path[path.length - 1];
    const trimmedPath = path.slice(0, -1);

    if (symbol === objectAccessSymbols.value) {
        return (
            getProperty(prev, trimmedPath) !== getProperty(curr, trimmedPath)
        );
    } else if (symbol === objectAccessSymbols.exists) {
        const extraTrimmed = trimmedPath.slice(0, -1);

        const prevParent = getProperty(prev, extraTrimmed);
        const currParent = getProperty(curr, extraTrimmed);

        const prevExists =
            typeof prevParent === "object" &&
            prevParent !== null &&
            Object.hasOwn(prevParent, trimmedPath[trimmedPath.length - 1]);

        const currExists =
            typeof currParent === "object" &&
            currParent !== null &&
            Object.hasOwn(currParent, trimmedPath[trimmedPath.length - 1]);

        return prevExists !== currExists;
    } else if (symbol === objectAccessSymbols.propertyDescriptor) {
        const prevDescriptor = getProperty(prev, trimmedPath, true);
        const currDescriptor = getProperty(curr, trimmedPath, true);

        if ((prevDescriptor === undefined) === (currDescriptor === undefined)) {
            return false;
        } else if (
            prevDescriptor === undefined &&
            currDescriptor === undefined
        ) {
            return false;
        } else {
            const prev = prevDescriptor as PropertyDescriptor;
            const curr = currDescriptor as PropertyDescriptor;

            return !(
                prev.value === curr.value &&
                prev.writable === curr.writable &&
                prev.enumerable === curr.enumerable &&
                prev.configurable === curr.configurable
            );
        }
    }
}
