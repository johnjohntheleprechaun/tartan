#!/usr/bin/env node

import {Command} from "@commander-js/extra-typings";
import {Resolver, TartanConfig, TartanProject} from "@tartan/core";

const program = new Command();

program.version("0.0.1")
program.command("build")
    .option("--config-file <path>", "The path to your tartan config file, WITHOUT the file extension", "tartan.config")
    .option("-o, --ouput <path>", "The name of the file to output", "out.html")
    .action(async (opts) => {
        const config = await Resolver.loadObjectFromFile<TartanConfig>(opts.configFile);

        const project = new TartanProject(config);
        await project.init().then(() => project.process());
    });

program.parse();
