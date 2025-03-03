import {JSONSchema, FromSchema} from "json-schema-to-ts";

export const tartanContextSchema = {
    type: "object",
    properties: {
        inherit: {
            type: "boolean",
            description: "Whether or not to inherit values from `tartan.context.default` files.",
        },
        handlebarsParameters: {
            type: "object",
            additionalProperties: true,
        },
        template: {
            type: "string",
            description: "A path pointing to the handlebars template to use (overrides the project-level `defaultTemplate`)",
        },
        pageSource: {
            type: "string",
            description: "The file to use for the `pageContent` parameter passed into your template",
        },
        sourceProcessor: {
            type: "string",
            description: "A module specifier for a module who's default export is a string to string mapping function. So that you can (for example) pre-process markdown, and translate it into HTML",
        },
        assets: {
            type: "array",
            items: {
                type: "string",
            },
            description: "A list of paths to include in the output directory. Usually asset dependencies are inferred from HTML content, but this is necessary for any instances where that might not be possible",
        },
    },
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanContext = FromSchema<typeof tartanContextSchema>;
