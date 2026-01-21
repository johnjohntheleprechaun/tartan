import path from "node:path";

export type ReservedPrefix =
    /**
     * The root directory of the tartan project.
     * In other words, the path of the root node.
     */
    | "~root"
    /**
     * The directory that the handlebars template that was used for the current page is in.
     * This prefix will only be used when discovering assets that need to be processed for a page, and only if that page used a template.
     * If the prefix was used in a bad context (or the page didn't use a template), an error will be thrown.
     */
    | "~template"
    /**
     * The directory that the page source is in. This is derived from either the path specified by `pageSource` for a directory node, or the node path for a file node.
     */
    | "~page-source"
    /**
     * The directory that the source processor that was used for the current page is in.
     * This prefix will only be used when discovering assets that need to be processed for a page, and only if that page used a source processor.
     * If the prefix was used in a bad context (or the page didn't use a source processor), an error will be thrown.
     */
    | "~source-processor";

export type PrefixMap = {
    [K in ReservedPrefix]: string | undefined; // the intention is that reserved prefixes must be explicitely defined, although they may not always be used
} & { [key: string]: string | undefined };

export function resolvePath(
    /**
     * The path to resolve.
     */
    pathToResolve: string,
    /**
     * The directory to resolve the path relative to.
     */
    relativeTo: string,
    /**
     * A map of prefixes to path parts.
     */
    prefixMap: PrefixMap,
): string {
    for (const prefix of Object.keys(prefixMap)) {
        if (pathToResolve.startsWith(prefix)) {
            if (prefixMap[prefix] === undefined) {
                throw `Prefix ${prefix} is not available`;
            }
            return path.resolve(
                relativeTo,
                prefixMap[prefix] + pathToResolve.slice(prefix.length),
            );
        }
    }
    return path.resolve(relativeTo, pathToResolve);
}
