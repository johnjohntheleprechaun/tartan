#!/usr/bin/env node

import parse from "node-html-parser";
import {readFileSync} from "fs";
import {findCustomeTags, resolveCustomTag} from "./resolve";
import {generateWebComponentJS} from "./code-gen";

const textContent = readFileSync("test.html").toString();
const page = parse(textContent);

const tags = findCustomeTags(page);

(async () => {console.log(await generateWebComponentJS(Array.from(tags)));})();
