import {JSONSchema, FromSchema} from "json-schema-to-ts";
import {tartanContextSchema} from "./tartan-context.js";
import {ReplaceTypes} from "./util.js";

export const tartanConfigSchema = {
    type: "object",
    properties: {
        rootDir: {
            type: "string",
            description: ""
        },
        outputDir: {
            type: "string",
        },
        designLibraries: {
            type: "array",
            items: {
                type: "string",
            },
        },
        pathPrefixes: {
            type: "object",
            patternProperties: {
                "*": {
                    type: "string",
                },
            },
        },
        rootContext: {
            ...tartanContextSchema,
        },
    },
    required: [
        "rootDir",
        "outputDir",
    ],
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
