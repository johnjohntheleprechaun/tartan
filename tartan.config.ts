import { TartanConfig } from "@tartan/core";

export default {
    rootDir: "docs/root/",
    outputDir: "docs/dist",
    rootContext: {
        pageMode: "file",
        pageSource: "index.md",
        pagePattern: "*.md",
        sourceProcessor: "./docs/processor.ts",
        template: "docs/base-template.html",
    },
} as TartanConfig;
