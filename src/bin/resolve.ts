import {HTMLElement} from "node-html-parser";
import fs from "fs";
import path from "path";

const tagRegex = /^x-([^-]+)-(.+)$/;

/**
 * A recursive tree search algorithm that's probably garbage slow, but it's fine.
 */
export function findCustomeTags(node: HTMLElement): Set<string> {
    const customTypes: Set<string> = new Set();
    if (node.rawTagName && node.rawTagName.startsWith("x-")) {
        customTypes.add(node.rawTagName);
    }

    for (const child of node.children) {
        findCustomeTags(child).forEach((type) => customTypes.add(type));
    }

    return customTypes;
}

/**
 * Convert a tag name into a class name and module
 */
export type ResolvedTag = {
    moduleName: string;
    className: string;
}
export function resolveCustomTag(tagName: string): ResolvedTag {
    const result = tagRegex.exec(tagName);
    if (result === null) {
        throw new InvalidTagNameError();
    }

    const moduleShorthand = result[1]; // first group
    const componentName = result[2]; // second group

    let moduleName: string = (() => {
        // check config file
        const configFile = fs.readFileSync("tartan.config.json");
        const config = JSON.parse(configFile.toString());
        let shorthands = config["moduleShorthands"];
        if (shorthands && shorthands[moduleShorthand]) {
            // yippee!
            return shorthands[moduleShorthand];
        }

        // TODO: check packages for shorthand
    })();

    if (!moduleName) {
        throw new ShorthandNotFoundError();
    }

    // check for the `tartan.components.json` file
    const moduleDir = path.join("node_modules", moduleName);
    const componentMapFile = fs.readFileSync(path.join(moduleDir, "tartan.components.json"));
    const componentMap = JSON.parse(componentMapFile.toString());
    const componentClass = componentMap[componentName];

    return {
        moduleName: moduleName,
        className: componentClass,
    };
}

class InvalidTagNameError extends Error {
    name: string = "InvalidTagNameError";
    message: string = "tag name is not formatted correctly";
}

class ShorthandNotFoundError extends Error {
    name: string = "ShorthandNotFoundError";
    message: string = "no mapping was found for the module shorthand";
}
