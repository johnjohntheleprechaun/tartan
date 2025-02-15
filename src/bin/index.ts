#!/usr/bin/env node

import {HTMLProcessor} from "./process.js";
import fs from "fs/promises";
import {TagNameResolver} from "./resolve.js";
import {Command} from "@commander-js/extra-typings";

const program = new Command();

program.version("0.0.1")
program.command("build")
    .argument("<entry>", "The HTML file to process")
    .option("--config-file <path>", "The path to your tartan config file", "tartan.config.json")
    .option("-o, --ouput <path>", "The name of the file to output", "out.html")
    .action(async (entry, opts) => {
        const resolver: TagNameResolver = await TagNameResolver.create(opts.configFile);
        const processor: HTMLProcessor = await HTMLProcessor.create(entry, resolver);

        const result = await processor.process();
        await fs.writeFile(opts.ouput, result);
    });

program.parse();
