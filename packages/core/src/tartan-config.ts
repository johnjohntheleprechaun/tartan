import {TartanContextFile} from "./tartan-context.js";
import {ReplaceTypes} from "./util.js";

/**
 * Requiring pagemode and the relevant properties to be set (but we don't need to export this)
 */
type FullTartanContext = ReplaceTypes<TartanContextFile, {pageMode: "file", pageSource?: string, pagePattern: string}>
    | ReplaceTypes<TartanContextFile, {pageMode: "directory", pageSource: string}>;

export type TartanConfig = {
    rootDir: string;
    outputDir: string;
    pathPrefixes?: {[key: string]: string};
    rootContext?: FullTartanContext
};
