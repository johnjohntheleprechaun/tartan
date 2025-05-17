#!/usr/bin/env -S npx tsx

import {Command} from "@commander-js/extra-typings";
import {Resolver, TartanConfig, TartanProject} from "@tartan/core";

const program = new Command();

program.version("0.0.1")
program.command("build")
    .option("--config-file <path>", "The path to your tartan config file, WITHOUT the file extension", "tartan.config")
    .option("-o, --ouput <path>", "The name of the file to output", "out.html")
    .option("-v, --verbose", "Whether (and to what level) debug logs should be printed", (_: string, prev: number) => prev + 1, 0)
    .action(async (opts) => {
        const config = await Resolver.loadObjectFromFile<TartanConfig>(opts.configFile);
        if (config === undefined) {
            throw new Error("no config file provided");
        }

        // opts.verbose shouldn't have to be typecast, this is almost certainly a bug with @commander-js/extra-typings, but it turns out reading complex types is a pain in the ass so I'll let someone else make a bug report (or figure out whether it's actually an error or just me being a fucking fumbass)
        const project = new TartanProject(config, opts.verbose as number);
        await project.init().then(() => project.process());
    });

program.parse();
