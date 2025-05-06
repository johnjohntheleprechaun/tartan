import {JSONSchema, FromSchema} from "json-schema-to-ts";
import {ReplaceTypes} from "./util.js";

export const tartanConfigSchema = {
    type: "object",
    properties: {
        designLibraries: {
            type: "array",
            items: {
                type: "string",
            },
        },
        rootDir: {
            type: "string",
            description: ""
        },
        outputDir: {
            type: "string",
        },
        pathPrefixes: {
            type: "object",
            patternProperties: {
                "*": {
                    type: "string",
                },
            },
        },
    },
    required: [
        "rootDir",
        "outputDir",
    ],
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
