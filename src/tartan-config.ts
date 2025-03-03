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
    },
    required: [
        "componentLibraries",
    ],
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
