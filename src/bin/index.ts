#!/usr/bin/env node

import {HTMLProcessor} from "./process.js";
import fs from "fs/promises";
import {TagNameResolver} from "./resolve.js";

(async () => {
    const resolver: TagNameResolver = await TagNameResolver.create("./tartan.config.json");
    const processor: HTMLProcessor = await HTMLProcessor.create("./test.html", resolver);

    const result = await processor.process();
    await fs.writeFile("./out.html", result);
})();
