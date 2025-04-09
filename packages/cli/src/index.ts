#!/usr/bin/env node

import {Command} from "@commander-js/extra-typings";
import {TartanProject} from "@tartan/core";
import fs from "fs/promises";

const program = new Command();

program.version("0.0.1")
program.command("build")
    .option("--config-file <path>", "The path to your tartan config file", "tartan.config.json")
    .option("-o, --ouput <path>", "The name of the file to output", "out.html")
    .action(async (opts) => {
        const configFile = await fs.readFile(opts.configFile);
        const config = JSON.parse(configFile.toString());

        const project = new TartanProject(config);
        await project.init().then(() => project.process());
    });

program.parse();
