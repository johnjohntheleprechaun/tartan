import { FromSchema, JSONSchema } from "json-schema-to-ts";

/*
 * Template manifests are found via the `tartanTemplateManifest` property in package.json
 */

const templateRegistration = {
    type: "object",
    properties: {
        name: { type: "string" },
        path: { type: "string" },
        description: { type: "string" },
    },
    required: ["name", "path"],
} as const satisfies JSONSchema;

export const templateManifestSchema = {
    type: "object",
    properties: {
        schemaVersion: {
            const: "1.0.0",
        },
        templates: {
            type: "array",
            items: templateRegistration,
        },
        partials: {
            type: "array",
            items: templateRegistration,
        },
    },
    required: ["schemaVersion"],
} as const satisfies JSONSchema;

export type TemplateManifest = FromSchema<typeof templateManifestSchema>;
