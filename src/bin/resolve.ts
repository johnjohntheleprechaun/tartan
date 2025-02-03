import {HTMLElement} from "node-html-parser";

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
