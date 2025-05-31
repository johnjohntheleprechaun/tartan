import { TartanContextFile } from "./tartan-context.js";
import { ReplaceTypes } from "./util.js";

/**
 * Requiring pagemode and the relevant properties to be set (but we don't need to export this)
 */
type FullTartanContext =
    | ReplaceTypes<
          TartanContextFile,
          { pageMode: "file"; pageSource?: string; pagePattern: string }
      >
    | ReplaceTypes<
          TartanContextFile,
          { pageMode: "directory"; pageSource: string }
      >
    | ReplaceTypes<
          TartanContextFile,
          { pageMode: "asset"; pagePattern: string }
      >;

export type TartanConfig = {
    rootDir: string;
    outputDir: string;
    /**
     * A map of path prefixes to paths that are relative to the CWD.
     */
    pathPrefixes?: Record<string, string>;
    /**
     * A list of regular expressions that match paths that'll be ignored.
     */
    ignoredPaths?: string[];
    rootContext?: FullTartanContext;
};
