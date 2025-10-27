import { createRequire } from "node:module";
import rxjs, {
    catchError,
    combineLatest,
    combineLatestWith,
    filter,
    from,
    map,
    Observable,
    of,
    ReplaySubject,
    shareReplay,
    startWith,
    Subject,
    switchMap,
} from "rxjs"; // we need to import the entire rxjs lib so that we can provide it in the vm (so that things like instanceof will work across the boundary)
import esbuild from "esbuild";
import { defaultFileOperationDebounce, FileWatcher } from "./files.js";
import { Script } from "node:vm";
import { Logger, LogLevel } from "../outputs/logger.js";

const require = createRequire(import.meta.url);
const moduleCache: Map<string, Observable<any>> = new Map();
/**
 * Get the default export of a module by building it with esbuild
 * @param specifier The module to build
 * @param relativeTo The path that specifier is relative to
 */
export function loadModule<T>(
    specifier: string,
    onlyWhile: Observable<boolean>,
    relativeTo?: string,
): Observable<T> {
    const rebuildTrigger: Subject<void> = new Subject<void>();
    const fileWatcher = new FileWatcher(rebuildTrigger);

    // resolve specifier to a full path
    const modulePath: string = require.resolve(specifier, {
        paths: [relativeTo || process.cwd()],
    });

    const cachedModule = moduleCache.get(modulePath);
    if (cachedModule) {
        return combineLatest([cachedModule, onlyWhile]).pipe(
            filter(([, shouldEmit]) => shouldEmit),
            map(([a]) => a),
        );
    }

    // yes, this is a promise. it's supposed to be.
    const buildContext = esbuild.context({
        entryPoints: [modulePath],
        format: "cjs",
        platform: "node",
        bundle: true,
        write: false,
        external: ["rxjs"],
        metafile: true,
        logLevel: "silent",
    });

    // The hash of the last outputted file, provided by esbuild
    const exportObservable = combineLatest([
        rebuildTrigger.pipe(startWith(undefined)),
        from(buildContext),
    ]).pipe(
        map(([, ctx]) => ctx),
        defaultFileOperationDebounce(),
        switchMap((ctx) =>
            ctx
                .cancel()
                .then(() => ctx.rebuild())
                .then((result) => {
                    if (result.warnings.length > 0) {
                        const formattedWarnings = esbuild.formatMessagesSync(
                            result.warnings,
                            {
                                kind: "warning",
                                color: true,
                            },
                        );
                        // print logs
                        Logger.log(
                            [
                                "==================================================\n",
                                `Warnings while building ${modulePath}\n\n`,
                                formattedWarnings.join("\n"),
                                "==================================================",
                            ].join("\n"),
                            LogLevel.Warning,
                        );
                    }
                    if (result.outputFiles.length !== 1) {
                        throw `wrong number of output files. should be 1, was ${result.outputFiles.length}`;
                    }

                    const outputFile = result.outputFiles[0];

                    // set up file watching for the module and it's dependencies
                    fileWatcher.setWatchedPaths(
                        Object.keys(result.metafile.inputs),
                    );

                    /*
                     * Run the script and extract the output
                     */
                    const script = new Script(outputFile.text, {
                        filename: modulePath,
                    });
                    const context = {
                        module: { exports: {} as any },
                        require(path: string) {
                            return path === "rxjs" ? rxjs : null;
                        },
                    };

                    script.runInNewContext(context);
                    return context.module.exports.default;
                })
                .catch((reason) => {
                    // if the build failed on the first go, make sure to watch the module path
                    if (fileWatcher.getWatchedPaths().length === 0) {
                        fileWatcher.setWatchedPaths([modulePath]);
                    }
                    // format logs
                    const formattedErrors = esbuild.formatMessagesSync(
                        reason.errors,
                        {
                            kind: "error",
                            color: true,
                        },
                    );
                    const formattedWarnings = esbuild.formatMessagesSync(
                        reason.warnings,
                        {
                            kind: "warning",
                            color: true,
                        },
                    );

                    // throw the formatted error
                    const formattedMessage = [
                        "==================================================\n",
                        `Failed while building ${modulePath}\n\n`,
                        formattedErrors.join("\n"),
                        ...(formattedWarnings.length > 0
                            ? [formattedWarnings.join("\n")]
                            : []),
                        "==================================================",
                    ].join("\n");

                    throw formattedMessage;
                }),
        ),
        filter((val) => val !== undefined),
        shareReplay({
            refCount: false,
            bufferSize: 1,
        }),
    );

    moduleCache.set(modulePath, exportObservable);
    return combineLatest([exportObservable, onlyWhile]).pipe(
        filter(([, shouldEmit]) => shouldEmit),
        map(([a]) => a),
    );
}
