import {TartanConfig} from "../../src/tartan-config";
import {PageProcessor} from "../../src/processors/page";
import {Resolver} from "../../src/resolve";
import mock from "mock-fs";
import {HTMLProcessor} from "../../src/processors/html";
import fs from "fs/promises";
import path from "path";


describe("The PageProcessor class", () => {
    afterEach(() => {
        mock.restore();
    });
    const projectConfig: TartanConfig = {
        rootDir: "src",
        outputDir: "dist",
    };
    let pageProcessor: PageProcessor;
    let resolver: Resolver;
    describe("(when using neither a source processor nor a template)", () => {
        beforeEach(async () => {
            resolver = await Resolver.create(projectConfig);
            pageProcessor = new PageProcessor({
                context: {},
                sourcePath: "src/index.html",
                outputDir: "dist/",
                subpageMeta: [],
            }, projectConfig, resolver);
        });
        it("should not modify the source content", async () => {
            const sourceContent = `
            <html>
            <body>
                <h1>Hello World</h1>
            </body>
            </html>`;
            const processedHTML = await new HTMLProcessor(sourceContent, resolver).process();
            mock({
                "src/index.html": sourceContent,
                "../../node_modules/": mock.load("../../node_modules/"),
            });

            const result = await pageProcessor.process();
            const outputted = await fs.readFile(path.join(result.outputDir, "index.html"));

            expect(outputted.toString()).toBe(processedHTML.content);
        });
    });
    describe("(when using a source processor)", () => {
        it("", async () => {

        });
    });
    describe("(when using a template)", () => {
        it("", async () => {

        });
    });
});
