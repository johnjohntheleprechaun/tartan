import { TartanContextFile } from "@tartan/core";

export default {
    inherit: false,
    pageMode: "handoff",
    handoffHandler: "./render-ts-doc.ts",
} as TartanContextFile;
