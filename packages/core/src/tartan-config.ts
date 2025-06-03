import { TartanContextFile } from "./tartan-context.js";
import { ReplaceTypes } from "./util.js";

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
    rootContext?:
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
          >; // because it's full context, but not initialized context
};
