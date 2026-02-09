import { TartanInput } from "../types/inputs.js";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import { Script } from "node:vm";
import { Logger, LogLevel } from "../outputs/logger.js";
import { URL } from "node:url";

/**
 * @argument moduleURL A fully resolved file url
 */
export async function loadModule<T>(moduleURL: URL): Promise<TartanInput<T>> {
    const result = await esbuild.build({
        entryPoints: [moduleURL.pathname],
        platform: "node",
        bundle: true,
        write: false,
        metafile: true,
        logLevel: "silent",
    });

    if (result.warnings.length > 0) {
        const formattedWarnings = esbuild.formatMessagesSync(result.warnings, {
            kind: "warning",
            color: true,
        });
        // print logs
        Logger.log(
            [
                "==================================================\n",
                `Warnings while building ${moduleURL}\n\n`,
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

    /*
     * Run the script and extract the output
     */
    const script = new Script(outputFile.text, {
        filename: moduleURL.pathname,
    });
    const context = {
        module: { exports: {} as { default: T } },
    };

    script.runInNewContext(context);
    return {
        url: moduleURL,
        value: context.module.exports.default,
    };
}
