#!/usr/bin/env node

import {DirectoryProcessor} from "@tartan/core";
import {ModuleResolver} from "@tartan/core";
import {Command} from "@commander-js/extra-typings";
import fs from "fs/promises";

const program = new Command();

program.version("0.0.1")
program.command("build")
    .option("--config-file <path>", "The path to your tartan config file", "tartan.config.json")
    .option("-o, --ouput <path>", "The name of the file to output", "out.html")
    .action(async (opts) => {
        const configFile = await fs.readFile(opts.configFile);
        const config = JSON.parse(configFile.toString());
        const resolver: ModuleResolver = await ModuleResolver.create(config);
        const processor = await DirectoryProcessor.create(config, resolver);

        await processor.process();
    });

program.parse();
