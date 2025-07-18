import { TartanConfig } from "./tartan-config.js";
import { TartanModule } from "./tartan-module.js";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { Logger } from "./logger.js";
import { PartialTartanContext, TartanContextFile } from "./tartan-context.js";
import { SourceProcessor } from "./source-processor.js";
import Handlebars from "handlebars";
import {
    CustomElementDeclaration,
    Declaration,
    Package,
} from "custom-elements-manifest";
import { TemplateManifest } from "./template-manifest.js";
import { MockGenerator } from "./mock-generator.js";
import { IUnionFs, IFS, Union } from "unionfs";
import { HandoffHandler } from "./handoff-handler.js";

const require = createRequire(import.meta.url);

export class Resolver {
    private config: TartanConfig;
    public modules: TartanModule[] = [];

    /**
     * The aggregate component map.
     */
    public componentMap: { [key: string]: string } = {};
    /**
     * The aggregate template map.
     */
    public templateMap: {
        [key: string]: ReturnType<typeof Handlebars.compile>;
    } = {};

    /**
     * The merged filesystem to use
     */
    public static baseUfs: IUnionFs = new Union().use(fs);
    public static ufs: IUnionFs["promises"] = this.baseUfs.promises;
    private static fsStack: IFS[] = [fs];

    public static resetUfs() {
        this.baseUfs = new Union();
        this.ufs = this.baseUfs.promises;
        this.fsStack = [fs];
        this.baseUfs.use(fs);
    }

    public static async create(projectConfig: TartanConfig): Promise<Resolver> {
        return new Resolver(projectConfig).init();
    }

    constructor(projectConfig: TartanConfig) {
        this.config = projectConfig;
    }

    public async init(): Promise<Resolver> {
        const packageLockPath = await Resolver.findUp("package-lock.json");
        const packageLock = await Resolver.ufs
            .readFile(packageLockPath)
            .then((res) => JSON.parse(res.toString()))
            .catch(() => ({ packages: [] }));
        const packages = packageLock.packages as { [key: string]: any };
        /*
         * Search through every installed package (this will include dependencies since we're using package-lock.json)
         */
        for (const packagePath in packages) {
            let module: TartanModule = {};

            /*
             * Load this packages package.json
             */
            const packageDefinitionPath = path.join(
                packagePath,
                "package.json",
            );
            if (
                !(await Resolver.ufs
                    .access(packageDefinitionPath)
                    .then(() => true)
                    .catch(() => false))
            ) {
                continue;
            }
            const packageDefinitionFile: Buffer = await Resolver.ufs.readFile(
                packageDefinitionPath,
            );
            const packageDefinition = JSON.parse(
                packageDefinitionFile.toString(),
            );

            /*
             * Process the custom element manifest if it exists
             */
            if (packageDefinition.customElements) {
                // Load the manifest file
                const manifestPath: string = path.join(
                    packagePath,
                    packageDefinition.customElements,
                );
                const manifestFile: Buffer =
                    await Resolver.ufs.readFile(manifestPath);
                const manifest: Package = JSON.parse(manifestFile.toString());
                module.componentManifest = manifest;

                // Process all the modules defined by the manifest
                for (const module of manifest.modules) {
                    // Process all the declarations defined by this module
                    for (const declaration of module.declarations || []) {
                        // if this declaration is a custom element
                        if (
                            this.isCustomElementDeclaration(declaration) &&
                            typeof declaration.tagName === "string"
                        ) {
                            // add to the component map
                            this.componentMap[declaration.tagName] =
                                "./" +
                                // the path to directory containing the manifest, and relative to that, the path to the module.
                                path.join(
                                    path.dirname(manifestPath),
                                    module.path,
                                );
                        }
                    }
                }
            }

            /*
             * Process tartan templates if it exists
             */
            if (packageDefinition.tartanTemplateManifest) {
                // Load the manifest file
                const manifestPath: string = path.join(
                    packagePath,
                    packageDefinition.tartanTemplateManifest,
                );
                const manifestFile: Buffer =
                    await Resolver.ufs.readFile(manifestPath);
                const manifest: TemplateManifest = JSON.parse(
                    manifestFile.toString(),
                );
                module.templateManifest = manifest;

                // Load all the templates
                for (const template of manifest.templates || []) {
                    const templatePath: string = path.join(
                        path.dirname(manifestPath),
                        template.path,
                    );
                    const templateFile: string = await Resolver.ufs.readFile(
                        templatePath,
                        "utf8",
                    );
                    this.templateMap[template.name] =
                        Handlebars.compile(templateFile);
                }
                /*
                 * TODO: load partials
                 */
            }

            // if the module had anything relevant to Tartan
            if (Object.keys(module).length > 0) {
                this.modules.push(module);
            }
        }

        Logger.log(this.componentMap);
        return this;
    }
    public static async findUp(filename: string): Promise<string> {
        let currentDir: string = process.cwd();
        while (currentDir !== "/") {
            const testPath = path.join(currentDir, filename);
            if (
                await this.ufs
                    .access(testPath)
                    .then(() => true)
                    .catch(() => false)
            ) {
                return testPath;
            } else {
                currentDir = path.resolve(currentDir, "..");
            }
        }
        throw `file "${filename}" not found in any parent directories`;
    }
    private isCustomElementDeclaration(
        declaration: Declaration,
    ): declaration is CustomElementDeclaration {
        return (
            declaration.kind === "class" &&
            typeof (declaration as any).customElement === "boolean" &&
            typeof (declaration as any).tagName === "string"
        );
    }

    /**
     * Load an object from *either* a JSON file or a JS/TS module where the object is the default export.
     *
     * @param filename The path to the file (*without* any file extension).
     */
    public static async loadObjectFromFile<T>(
        filename: string,
    ): Promise<T | undefined> {
        Logger.log(`Trying to load an object from ${filename}`, 2);
        let extOrder: string[];
        if (
            // @ts-expect-error
            (process._preload_modules as string[]).some((el) =>
                el.includes("tsx"),
            )
        ) {
            Logger.log(
                "seems to be running inside tsx, you should be able to import .ts files",
                2,
            );
            extOrder = [".js", ".mjs", ".ts", ".json"];
        } else {
            extOrder = [".js", ".mjs", ".json"];
        }

        const extMap: Record<string, number> = extOrder.reduce(
            (prev, curr, i) => ({ ...prev, [curr]: i }),
            {},
        );

        const dirContents = await this.ufs.readdir(path.dirname(filename), {
            withFileTypes: true,
        });

        const possibleFiles = dirContents.filter(
            (a) =>
                path.parse(a.name).name === path.basename(filename) &&
                extMap[path.extname(a.name)] !== undefined,
        );
        if (possibleFiles.length > 1) {
            Logger.log(
                `${filename} is ambiguous (multiple possible extensions)`,
                2,
            );
        } else if (possibleFiles.length === 0) {
            Logger.log("no files found", 2);
            return undefined;
        }

        const dirent = possibleFiles.reduce((prev, curr) =>
            extMap[path.extname(prev.name)] >= extMap[path.extname(curr.name)]
                ? curr
                : prev,
        );
        const filepath =
            (path.isAbsolute(dirent.parentPath) ? "" : `.${path.sep}`) +
            path.join(dirent.parentPath, dirent.name);

        if (path.extname(filepath) === ".json") {
            return JSON.parse((await this.ufs.readFile(filepath)).toString());
        } else {
            return this.import(filepath);
        }
    }

    /**
     * Resolve a path, taking into account path prefixes. If a path starts with a prefix, relativeTo is ignored.
     *
     * @param target The target path (which may or may not start with a path prefix).
     * @param relativeTo The path that target is relative to (if that matters). Defaults to CWD. If the path provided doesn't end with `path.sep`, it's assumed that the path is a file, and the path is resolved relative to the directory (aka the result of `path.dirname()`).
     */
    public resolvePath(target: string, relativeTo?: string) {
        Logger.log(`resolving path ${target} relative to ${relativeTo}`);
        if (this.config.pathPrefixes) {
            for (const prefix in this.config.pathPrefixes) {
                let fixedPrefix = prefix.endsWith("/") ? prefix : prefix + "/";
                let fixedTarget = this.config.pathPrefixes[prefix].endsWith("/")
                    ? this.config.pathPrefixes[prefix]
                    : this.config.pathPrefixes[prefix] + "/";
                if (target.startsWith(fixedPrefix)) {
                    const resolvedPath = target.replace(
                        fixedPrefix,
                        fixedTarget,
                    );
                    return path.resolve(resolvedPath);
                }
            }
        }

        return path.resolve(
            relativeTo?.endsWith(path.sep)
                ? relativeTo
                : path.dirname(relativeTo || "") || "",
            target,
        );
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

    public resolveTemplateName(
        template: string,
    ): ReturnType<typeof Handlebars.compile> | undefined {
        if (Object.keys(this.templateMap).includes(template)) {
            return this.templateMap[template];
        }
        return undefined;
    }

    /**
     * Get the default export of an ESM module.
     *
     * @param moduleSpecifier The specifier of the ESM module.
     * @param relativeTo The ***directory*** the specifier is relative to. Must not be a file.
     *
     * @returns The default export of the module.
     */
    public static async import<T>(
        moduleSpecifier: string,
        relativeTo?: string,
    ): Promise<T> {
        Logger.log(
            `importing module ${moduleSpecifier} relative to ${relativeTo}`,
        );
        const modulePath = this.resolveImport(moduleSpecifier, relativeTo);
        Logger.log(`resolved path is ${modulePath}`);
        return import(modulePath).then((a) => a.default);
    }

    /**
     * Load the source processor and template file, assuming the contextFile is at path
     */
    public async initializeContext(
        contextFile: TartanContextFile,
        filePath: string = path.join(
            process.cwd(),
            "defaultvaluethisfileisignored",
        ),
    ): Promise<PartialTartanContext> {
        const context: PartialTartanContext = {
            ...contextFile,
            template: contextFile.template
                ? this.resolveTemplateName(contextFile.template) ||
                  Handlebars.compile(
                      (
                          await Resolver.ufs.readFile(
                              this.resolvePath(contextFile.template, filePath),
                          )
                      ).toString(),
                  )
                : undefined,
            sourceProcessor: contextFile.sourceProcessor
                ? ((await Resolver.import(
                      this.resolvePath(contextFile.sourceProcessor, filePath),
                  )) as SourceProcessor)
                : undefined,
            mockGenerator: contextFile.mockGenerator
                ? ((await Resolver.import(
                      this.resolvePath(contextFile.mockGenerator, filePath),
                  )) as MockGenerator)
                : undefined,
            handoffHandler: contextFile.handoffHandler
                ? ((await Resolver.import(
                      this.resolvePath(contextFile.handoffHandler, filePath),
                  )) as HandoffHandler)
                : undefined,
        };

        // Should prolly convert this to a for loop or smth
        if (context.template === undefined) {
            delete context.template;
        }
        if (context.sourceProcessor === undefined) {
            delete context.sourceProcessor;
        }
        if (context.mockGenerator === undefined) {
            delete context.mockGenerator;
        }
        if (context.handoffHandler === undefined) {
            delete context.handoffHandler;
        }

        return context;
    }

    /**
     * Resolve a module specifier relative to a directory.
     *
     * @param moduleSpecifier The specifier to resolve.
     * @param relativeTo The directory the specifier is relative to.
     *
     * @returns The fully resolved module specifier as an absolute path.
     */
    public static resolveImport(
        moduleSpecifier: string,
        relativeTo?: string,
    ): string {
        return require.resolve(moduleSpecifier, {
            paths: [relativeTo || process.cwd()],
        });
    }
}
