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
    },
    required: [
        "componentLibraries",
    ],
} as const satisfies JSONSchema;

export type TartanConfig = FromSchema<typeof tartanConfigSchema>;
