import {JSONSchema, FromSchema} from "json-schema-to-ts";
import {TartanContextFile, tartanContextSchema} from "./tartan-context.js";
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
            allOf: [
                {
                    if: {
                        properties: {pageMode: {const: "file"}},
                    },
                    then: {
                        required: ["pageSource"],
                    },
                },
                {
                    if: {
                        properties: {pageMode: {const: "directory"}},
                    },
                    then: {
                        required: ["pagePattern"],
                    },
                },
            ],
        },
    },
    required: [
        "rootDir",
        "outputDir",
    ],
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanConfig = ReplaceTypes<FromSchema<typeof tartanConfigSchema>, {
    rootContext?: ReplaceTypes<TartanContextFile, {pageMode: "file", pagePattern: string}>
    | ReplaceTypes<TartanContextFile, {pageMode: "directory", pageSource: string}>
}>;
