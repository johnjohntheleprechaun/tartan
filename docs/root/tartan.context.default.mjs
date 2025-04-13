/**
 * @type import("tartan").TartanContext
 */
export default {
    pageMode: "file",
    pageSource: "index.md",
    pagePattern: "*.md",
    sourceProcessor: "./docs/root/processor.mjs",
    template: "./docs/templates/base.html",
}
