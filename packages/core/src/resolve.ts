import {TartanConfig} from "./tartan-config.js";
import {TartanExport} from "./tartan-export.js";
import path from "path";
import fs from "fs/promises";
import {createRequire} from "module";

const require = createRequire(import.meta.url);

export class Resolver {
    private config: TartanConfig;
    public modules: TartanExport[] = [];

    public elementPrefixMap: {[key: string]: TartanExport} = {};

    public static async create(projectConfig: TartanConfig): Promise<Resolver> {
        return new Resolver(projectConfig).init();
    }

    constructor(projectConfig: TartanConfig) {
        this.config = projectConfig;
    }

    public async init(): Promise<Resolver> {
        // load the modules needed
        for (const moduleSpecifier of this.config.componentLibraries || []) {
            const module = await Resolver.import(moduleSpecifier) as TartanExport;
            this.modules.push(module);

            if (this.elementPrefixMap[module.defaultPrefix]) {
                throw new Error("element prefix conflict");
            }

            this.elementPrefixMap[module.defaultPrefix] = module;
        }


        return this;
    }

    /**
     * Load an object from *either* a JSON file or a JS module where the object is the default export.
     *
     * @param path The path to the file (*without* the file extension).
     */
    public static async loadObjectFromFile<T>(filename: string): Promise<T> {
        const json = `${filename}.json`;
        const module = `.${path.sep}${filename}.mjs`;
        const js = `.${path.sep}${filename}.js`;

        // check if JSON file exists
        if (await fs.access(json).then(() => true).catch(() => false)) {
            return JSON.parse((await fs.readFile(json)).toString());
        }
        else if (await fs.access(module).then(() => true).catch(() => false)) {
            return this.import(module)
        }
        else if (await fs.access(js).then(() => true).catch(() => false)) {
            return this.import(js)
        }

        throw new Error("No file exists");
    }

    /**
     * Resolve a path, taking into account path prefixes. If a path starts with a prefix, relativeTo is ignored.
     *
     * @argument target The target path (which may or may not start with a path prefix).
     * @param relativeTo The path that target is relative to (if that matters). Defaults to CWD.
     */
    public resolvePath(target: string, relativeTo?: string) {
        if (this.config.pathPrefixes) {
            for (const prefix in this.config.pathPrefixes) {
                let fixedPrefix = prefix.endsWith("/") ? prefix : prefix + "/";
                let fixedTarget = this.config.pathPrefixes[prefix].endsWith("/") ? this.config.pathPrefixes[prefix] : this.config.pathPrefixes[prefix] + "/";
                if (target.startsWith(fixedPrefix)) {
                    const resolvedPath = target.replace(fixedPrefix, fixedTarget);
                    return path.resolve(resolvedPath);
                }
            }
        }

        return path.resolve(path.join(relativeTo?.endsWith(path.sep) ? relativeTo : path.dirname(relativeTo || "") || "", target));
    }

    public resolveTagName(tagName: string): string {
        const result = /([^-]+)-(.+)/.exec(tagName);
        if (!result) {
            throw new InvalidTagNameError(tagName);
        }

        const module = this.elementPrefixMap[result[1]];
        let componentSpecifier: string | undefined = undefined;
        if (typeof module.componentMap === "object") {
            componentSpecifier = module.componentMap[result[2]];
        }
        else if (typeof module.componentMap === "function") {
            componentSpecifier = module.componentMap(result[2]);
        }

        if (componentSpecifier) {
            return componentSpecifier;
        }
        else {
            throw new TagNameNotFoundError(tagName);
        }
    }

    public static async import(moduleSpecifier: string): Promise<any> {
        const modulePath = require.resolve(moduleSpecifier, {paths: [process.cwd()]});
        return import(modulePath).then(a => a.default);
    }
}

export class InvalidTagNameError extends Error {
    name: string = "InvalidTagNameError";

    constructor(tagName: string) {
        super(`The tag name <${tagName}> isn't formatted correctly.`);
    }
}

export class TagNameNotFoundError extends Error {
    name: string = "TagNameNotFoundError";

    constructor(tagName: string) {
        super(`No mapping was found for <${tagName}>.`);
    }
}
