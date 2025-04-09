#!/usr/bin/env node

import {DirectoryProcessor} from "@tartan/core";
import {ModuleResolver} from "@tartan/core";
import {Command} from "@commander-js/extra-typings";

const program = new Command();

program.version("0.0.1")
program.command("build")
    .argument("<entry>", "The directory to process")
    .option("--config-file <path>", "The path to your tartan config file", "tartan.config.json")
    .option("-o, --ouput <path>", "The name of the file to output", "out.html")
    .action(async (entry, opts) => {
        const resolver: ModuleResolver = await ModuleResolver.create(opts.configFile);
        const processor = await DirectoryProcessor.create(entry, resolver);

        await processor.process();
    });

program.parse();
