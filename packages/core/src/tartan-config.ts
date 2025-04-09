import {JSONSchema, FromSchema} from "json-schema-to-ts";

export const tartanConfigSchema = {
    type: "object",
    properties: {
        componentLibraries: {
            type: "array",
            items: {
                type: "string",
            },
        },
        templates: {
            type: "object",
            patternProperties: {
                "*": {
                    type: "string",
                },
            },
            description: "a mapping of template names to template paths",
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
                    type: "array",
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
        "componentLibraries",
    ],
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
