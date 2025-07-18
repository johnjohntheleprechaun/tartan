import { JSONSchema, FromSchema } from "json-schema-to-ts";
import { ReplaceTypes } from "./util.js";
import { SourceProcessor } from "./source-processor.js";
import { MockGenerator } from "./mock-generator.js";
import { HandoffHandler } from "./handoff-handler.js";

export const tartanContextSchema = {
    type: "object",
    properties: {
        inherit: {
            type: "boolean",
            description:
                "Whether or not to inherit values from `tartan.context.default` files.",
        },
        pageMode: {
            enum: ["directory", "file", "asset", "mock", "handoff"],
        },
        pagePattern: {
            type: "string",
            description:
                "A blob pattern to match files when `pageMode` is `file` or `asset`.",
        },
        handlebarsParameters: {
            type: "object",
            additionalProperties: true,
        },
        template: {
            type: "string",
            description:
                "A path pointing to the handlebars template to use. If none is provided it's assumed that no template is used.",
        },
        pageSource: {
            type: "string",
            description:
                "The file to use for the index of the current directory, *regardless of `pageMode`*.",
        },
        mockGenerator: {
            type: "string",
            description:
                "A module specifier for a module who's default export is a function that returns an object matching `DirectoryJSON`",
        },
        handoffHandler: {
            type: "string",
            description:
                "A module specifier for a module who's default export is a function that simply takes an output directory and handles the rest.",
        },
        sourceProcessor: {
            type: "string",
            description:
                "A module specifier for a module who's default export is a string to string mapping function. So that you can (for example) pre-process markdown, and translate it into HTML",
        },
        extraAssets: {
            type: "array",
            items: {
                type: "string",
            },
            description:
                "A list of glob patterns to search for in the current directory, and add any files that match as assets",
        },
    },
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanContextFile = FromSchema<typeof tartanContextSchema>;
export type PartialTartanContext = ReplaceTypes<
    TartanContextFile,
    {
        sourceProcessor?: SourceProcessor;
        template?: ReturnType<typeof Handlebars.compile>;
        mockGenerator?: MockGenerator;
        handoffHandler?: HandoffHandler;
    }
>;
export type FullTartanContext =
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "file"; pageSource?: string; pagePattern: string }
      >
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "directory"; pageSource: string }
      >
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "asset"; pagePattern: string }
      >
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "mock"; mockGenerator: MockGenerator }
      >
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "handoff"; handoffHandler: HandoffHandler }
      >;
