import {JSONSchema, FromSchema} from "json-schema-to-ts";
import {ReplaceTypes} from "./util.js";

export const tartanConfigSchema = {
    type: "object",
    properties: {
        componentLibraries: {
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
                    items: [
                        {
                            type: "string",
                            description: "source directory, relative to the project root",
                        },
                        {
                            type: "string",
                            description: "output sub-directory for items matching the prefix, relative to the project output directory."
                        },
                    ],
                    additionalItems: false,
                    description: "a tuple, mapping from the source location, to the output location (relative to )"
                },
            },
            examples: [
                {
                    "~images": ["./src/assets/images/", "assets/images"],
                },
                {
                    "~root": ["./src/", "."],
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

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
