import { JSONSchema, FromSchema } from "json-schema-to-ts";
import { ReplaceTypes } from "./util.js";
import { SourceProcessor } from "./source-processor.js";
import { HandoffHandler } from "./handoff-handler.js";
import { PageTemplate } from "./handlebars.js";
import { TartanInput } from "./inputs.js";

export const tartanContextSchema = {
    type: "object",
    properties: {
        inherit: {
            type: "boolean",
            description:
                "Whether or not to inherit values from parent nodes and default context files.",
        },
        pageMode: {
            enum: ["directory", "file", "asset", "handoff"],
        },
        pagePattern: {
            type: "string",
            description:
                "A blob pattern to match files when `pageMode` is `file` or `asset`.",
        },
        extraContext: {
            type: "object",
            additionalProperties: true,
            description:
                "A JSON object that contains arbitrary information to be passed to source processors and templates.",
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
        assetProcessors: {
            description:
                "A map of globs that match filenames to a module specifier that exports a source processor to be used for files that match the glob.",
            additionalProperties: {
                type: "string",
            },
        },
        extraAssets: {
            type: "array",
            items: {
                type: "string",
            },
            description:
                "A list of glob patterns to search for in the current directory, and add any files that match as assets",
        },
        pathPrefixes: {
            type: "object",
            description:
                "A map of prefixes to path parts. The path parts will be resolved using only the reserved path prefixes, and treated as relative to the context file they're from.",
            additionalProperties: {
                type: "string",
            },
        },
    },
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanContextFile = FromSchema<typeof tartanContextSchema>;
export type PartialTartanContext = ReplaceTypes<
    TartanContextFile,
    {
        sourceProcessor?: TartanInput<SourceProcessor>;
        template?: TartanInput<PageTemplate>;
        handoffHandler?: TartanInput<HandoffHandler>;
        assetProcessors?: Record<string, TartanInput<SourceProcessor>>;
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
          { pageMode: "handoff"; handoffHandler: HandoffHandler }
      >;
