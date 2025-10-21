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
                            previousInput === undefined ||
                            previousInput[1] !== func ||
                            previousInput[0].some((param: any, i: any) => {
                                const [prev, curr] = [param, params[i]];

                                if (
                                    // We only check for property usage if the param is an object
                                    typeof prev === "object" &&
                                    typeof curr === "object" &&
                                    prev !== null &&
                                    curr !== null
                                ) {
                                    const accessedPaths = usedParams[i]; // the accessed properties for this object on the last iteration
                                    if (accessedPaths === undefined) {
                                        // The param wasn't used at all during the last execution
                                        // so we just pretend that it hasn't changed, no need to actually check
                                        return false;
                                    } else {
                                        // go through each accessed path and see if the value has changed
                                        const anyHasChanged =
                                            accessedPaths.some((paramPath) => {
                                                paramPath = paramPath.slice(
                                                    0,
                                                    -1,
                                                ); // hack off the root symbol. this is... not necessary anymore...
                                                const propertyHasChanged =
                                                    getProperty(
                                                        prev,
                                                        paramPath,
                                                    ) !==
                                                    getProperty(
                                                        curr,
                                                        paramPath,
                                                    );
                                                return propertyHasChanged; // we want to return true when any element *fails* the equality check
                                            });
                                        return anyHasChanged;
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

                            // we return an object so that the operator will emit undefined if the function itself returned undefined
                            return {
                                result,
                            };
                        }
                    }),
                    filter((val) => val !== undefined),
                    map((val) => val.result),
                    tap(() => {
                        setTimeout(() => rerunSubject.next(undefined)); // I'm killing everyone if this works
                    }),
                )
                .subscribe(subscriber);
        });
}

export function getProperty(object: any, path: (string | symbol)[]): any {
    return path.reduce(
        (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
        object,
    );
}

export const rootDependencySymbol = Symbol("root");
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
        const root: T = Object.create(Object.getPrototypeOf(obj));
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
            apply(target, thisArg, argArray) {
                callback([rootDependencySymbol]);
                return Reflect.apply(target as Function, thisArg, argArray);
            },
            construct(target, argArray, newTarget) {
                callback([rootDependencySymbol]);
                return Reflect.construct(
                    target as (this: any, ...args: any) => any, // fuckin trust me bro
                    argArray,
                    newTarget,
                );
            },
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
                    callback([property, rootDependencySymbol]);
                }
                return val;
            },
            getOwnPropertyDescriptor(target, property) {
                callback([property, rootDependencySymbol]);
                return Reflect.getOwnPropertyDescriptor(target, property);
            },
            getPrototypeOf(target) {
                callback([rootDependencySymbol]);
                return Reflect.getPrototypeOf(target);
            },
            has(target, property) {
                callback([property, rootDependencySymbol]);
                return Reflect.has(target, property);
            },
            // isExtensible() not implemented
            ownKeys(target) {
                callback([rootDependencySymbol]);
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
