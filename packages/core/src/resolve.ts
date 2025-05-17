import {TartanConfig} from "./tartan-config.js";
import {TartanModule} from "./tartan-module.js";
import path from "path";
import fs from "fs/promises";
import {createRequire} from "module";
import {Logger} from "./logger.js";
import {PartialTartanContext, TartanContextFile} from "./tartan-context.js";
import {SourceProcessor} from "./source-processor.js";
import Handlebars from "handlebars";

const require = createRequire(import.meta.url);

export class Resolver {
    private config: TartanConfig;
    public modules: TartanModule[] = [];

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
            const module = await Resolver.import<TartanModule>(modulePath);
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
     * Load an object from *either* a JSON file or a JS/TS module where the object is the default export.
     *
     * @param filename The path to the file (*without* any file extension).
     */
    public static async loadObjectFromFile<T>(filename: string): Promise<T | undefined> {
        Logger.log(`Trying to load an object from ${filename}`, 2)
        let extOrder: string[];
        // @ts-expect-error
        if ((process._preload_modules as string[]).some(el => el.includes("tsx"))) {
            Logger.log("seems to be running inside tsx, you should be able to import .ts files", 2);
            extOrder = [
                ".js",
                ".mjs",
                ".ts",
                ".json",
            ];
        }
        else {
            extOrder = [
                ".js",
                ".mjs",
                ".json",
            ];
        }

        const extMap: Record<string, number> = extOrder.reduce((prev, curr, i) => ({...prev, [curr]: i}), {});

        const dirContents = await fs.readdir(path.dirname(filename), {withFileTypes: true});

        const possibleFiles = dirContents.filter(a => path.parse(a.name).name === path.basename(filename) && extMap[path.extname(a.name)] !== undefined);
        if (possibleFiles.length > 1) {
            Logger.log(`${filename} is ambiguous (multiple possible extensions)`, 2);
        }
        else if (possibleFiles.length === 0) {
            Logger.log("no files found", 2);
            return undefined;
        }

        const dirent = possibleFiles.reduce((prev, curr) => extMap[path.extname(prev.name)] >= extMap[path.extname(curr.name)] ? curr : prev);
        const filepath = `.${path.sep}` + path.join(dirent.parentPath, dirent.name);

        if (path.extname(filepath) === ".json") {
            return JSON.parse((await fs.readFile(filepath)).toString());
        }
        else {
            return this.import(filepath);
        }
    }

    /**
     * Resolve a path, taking into account path prefixes. If a path starts with a prefix, relativeTo is ignored.
     *
     * @argument target The target path (which may or may not start with a path prefix).
     * @param relativeTo The path that target is relative to (if that matters). Defaults to CWD.
     */
    public resolvePath(target: string, relativeTo?: string) {
        Logger.log(`resolving path ${target} relative to ${relativeTo}`);
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

        return path.resolve(relativeTo?.endsWith(path.sep) ? relativeTo : path.dirname(relativeTo || "") || "", target);
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
        Logger.log(`importing module ${moduleSpecifier} relative to ${relativeTo}`);
        const modulePath = this.resolveImport(moduleSpecifier, relativeTo);
        Logger.log(`resolved path is ${modulePath}`);
        return import(modulePath).then(a => a.default);
    };

    /**
     * Load the source processor and template file, assuming the contextFile is at path
     */
    public async initializeContext(contextFile: TartanContextFile, filePath: string = path.join(process.cwd(), "defaultvaluethisfileisignored")): Promise<PartialTartanContext> {
        const context: PartialTartanContext = {
            ...contextFile,
            template: contextFile.template ? Handlebars.compile(
                (await fs.readFile(this.resolveTemplateName(contextFile.template) || this.resolvePath(contextFile.template, filePath))).toString()
            ) : undefined,
            sourceProcessor: contextFile.sourceProcessor ? await Resolver.import(this.resolvePath(contextFile.sourceProcessor, filePath)) as SourceProcessor : undefined,
        }

        if (context.template === undefined) {
            delete context.template;
        }
        if (context.sourceProcessor === undefined) {
            delete context.sourceProcessor;
        }

        return context;
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
