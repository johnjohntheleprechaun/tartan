import {TartanConfig} from "./tartan-config.js";
import {TartanExport} from "./tartan-export.js";
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
            const module = await this.import(moduleSpecifier) as TartanExport;
            this.modules.push(module);

            if (this.elementPrefixMap[module.defaultPrefix]) {
                throw new Error("element prefix conflict");
            }

            this.elementPrefixMap[module.defaultPrefix] = module;
        }


        return this;
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

    async import(moduleSpecifier: string): Promise<any> {
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
