/**
 * @type import("@tartan/core").TartanConfig
 */
export default {
    rootDir: "docs/root/",
    outputDir: "docs/dist",
    rootContext: {
        pageMode: "file",
        pageSource: "index.md",
        pagePattern: "*.md",
        sourceProcessor: "docs/processor.mjs",
        template: "docs/base-template.html",
    },
};
