import {TartanConfig} from "./tartan-config.js";
import {TartanExport} from "./tartan-export.js";
import path from "path";
import fs from "fs/promises";
import {createRequire} from "module";

const require = createRequire(import.meta.url);

export class Resolver {
    private config: TartanConfig;
    public modules: TartanExport[] = [];

    /**
     * The aggregate component map.
     */
    public componentMap: {[key: string]: string} = {};
    /**
     * The aggregate template map.
     */
    public templateMap: {[key: string]: string} = {};

    public static async create(projectConfig: TartanConfig): Promise<Resolver> {
        return new Resolver(projectConfig).init();
    }

    constructor(projectConfig: TartanConfig) {
        this.config = projectConfig;
    }

    public async init(): Promise<Resolver> {
        // load the modules needed
        for (const moduleSpecifier of this.config.designLibraries || []) {
            const modulePath = Resolver.resolveImport(moduleSpecifier);
            const module = await Resolver.import<TartanExport>(modulePath);
            this.modules.push(module);

            for (const key in module.componentMap) {
                if (this.componentMap[key]) {
                    throw new Error("Duplicate component name");
                }
                else {
                    this.componentMap[key] = Resolver.resolveImport(module.componentMap[key], path.dirname(modulePath));
                }
            }

            for (const key in module.templateMap) {
                if (this.templateMap[key]) {
                    throw new Error("Duplicate template name");
                }
                else {
                    this.templateMap[key] = Resolver.resolveImport(module.templateMap[key], path.dirname(modulePath));
                }
            }
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

    /**
     * Attempt to resolve a tag name to a module import that registers the web component (if one exists)
     *
     * @returns The module specifier that this element needs, or undefined if none was found
     */
    public resolveTagName(tagName: string): string | undefined {
        if (Object.keys(this.componentMap).includes(tagName)) {
            return this.componentMap[tagName];
        }
        return undefined;
    }

    public resolveTemplateName(template: string): string | undefined {
        if (Object.keys(this.templateMap).includes(template)) {
            return this.templateMap[template];
        }
        return undefined
    }

    /**
     * Get the default export of an ESM module.
     *
     * @argument moduleSpecifier The specifier of the ESM module.
     * @argument relativeTo The ***directory*** the specifier is relative to. Must not be a file.
     *
     * @returns The default export of the module.
     */
    public static async import<T>(moduleSpecifier: string, relativeTo?: string): Promise<T> {
        const modulePath = this.resolveImport(moduleSpecifier, relativeTo);
        return import(modulePath).then(a => a.default);
    }

    /**
     * Resolve a module specifier relative to a directory.
     *
     * @argument moduleSpecifier The specifier to resolve.
     * @argument relativeTo The directory the specifier is relative to.
     *
     * @returns The fully resolved module specifier as an absolute path.
     */
    public static resolveImport(moduleSpecifier: string, relativeTo?: string): string {
        return require.resolve(moduleSpecifier, {paths: [relativeTo || process.cwd()]});
    }
}
