/**
 * @type import("@tartan/core").TartanConfig
 */
export default {
    rootDir: "docs/root/",
    outputDir: "docs/dist",
    pathPrefixes: {
        "~templates/": "docs/templates/",
    },
    designLibraries: [
        "./fake-lib/index.mjs",
    ]
};
