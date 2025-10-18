import { createRequire } from "node:module";
import rxjs, {
    combineLatestWith,
    filter,
    Observable,
    of,
    startWith,
    Subject,
    switchMap,
} from "rxjs"; // we need to import the entire rxjs lib so that we can provide it in the vm (so that things like instanceof will work across the boundary)
import esbuild from "esbuild";
import { defaultFileOperationDebounce, FileWatcher } from "./files.js";
import { Script } from "node:vm";
import { Logger, LogLevel } from "../outputs/logger.js";

const require = createRequire(import.meta.url);
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
    const exportSubject: Subject<T> = new Subject<T>();
    const rebuildTrigger: Subject<void> = new Subject<void>();
    const fileWatcher = new FileWatcher(rebuildTrigger);

    // resolve specifier to a full path
    const modulePath: string = require.resolve(specifier, {
        paths: [relativeTo || process.cwd()],
    });
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
    let lastBuildHash: string = "";
    buildContext.then((ctx) => {
        rebuildTrigger
            .pipe(
                startWith(undefined), // initial build
                combineLatestWith(onlyWhile),
                filter(([_, shouldEmit]) => shouldEmit),
                defaultFileOperationDebounce(),
                switchMap(() =>
                    ctx
                        .cancel()
                        .then(() => ctx.rebuild())
                        .then((result) => {
                            if (result.warnings.length > 0) {
                                const formattedWarnings =
                                    esbuild.formatMessagesSync(
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
                            if (outputFile.hash === lastBuildHash) {
                                return undefined;
                            }
                            lastBuildHash = outputFile.hash;

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
                            const formattedWarnings =
                                esbuild.formatMessagesSync(reason.warnings, {
                                    kind: "warning",
                                    color: true,
                                });

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
            )
            .subscribe(exportSubject);
    });

    return exportSubject;
}
