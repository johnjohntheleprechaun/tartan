#!/usr/bin/env node

import parse from "node-html-parser";
import {readFileSync, writeFileSync} from "fs";
import {findCustomeTags, resolveCustomTag} from "./resolve";
import {generateWebComponentJS} from "./code-gen";

const textContent = readFileSync("test.html").toString();
const page = parse(textContent);

const tags = findCustomeTags(page);

(async () => {
    const code = await generateWebComponentJS(Array.from(tags));
    const body = page.querySelector("body");
    if (!body) {
        throw new Error("document doesn't have a body");
    }
    body.insertAdjacentHTML("afterbegin", `<script>${code}</script>`);

    writeFileSync("out.html", page.toString());
})();
