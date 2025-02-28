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
        defaultTemplate: {
            type: "string",
            description: "A path pointing to a handlebars template to insert page content into",
        },
    },
    required: [
        "componentLibraries",
    ],
} as const satisfies JSONSchema;

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
