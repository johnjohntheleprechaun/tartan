#!/usr/bin/env node

import parse from "node-html-parser";
import {readFileSync} from "fs";
import {findCustomeTags, resolveCustomTag} from "./resolve";

const textContent = readFileSync("test.html").toString();
const page = parse(textContent);

const types = findCustomeTags(page);

for (const name of Array.from(types.values())) {
    console.log(name);
    console.log(resolveCustomTag(name));
}
