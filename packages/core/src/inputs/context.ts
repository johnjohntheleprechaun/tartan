import { TartanInput } from "../types/inputs.js";
import {
    PartialTartanContext,
    TartanContextFile,
} from "../types/tartan-context.js";
import path from "node:path";
import { PrefixMap, resolvePath } from "./resolve.js";
import { SourceProcessor } from "../types/source-processor.js";
import { loadModule } from "./module.js";
import { HandoffHandler } from "../types/handoff-handler.js";
import { loadFile } from "./file.js";
import { HandlebarsInput, PageTemplate } from "../types/handlebars.js";
import Handlebars from "handlebars";

export async function initializeContext(
    rootDir: string,
    contextFile: TartanInput<TartanContextFile>,
): Promise<TartanInput<PartialTartanContext>> {
    const resolvedPathPrefixes = Object.fromEntries(
        Object.entries(contextFile.value.pathPrefixes ?? {}).map(
            ([key, val]) => [
                key,
                resolvePath(val, path.dirname(contextFile.path), {
                    "~root": rootDir,
                    "~template": undefined,
                    "~page-source": undefined,
                    "~source-processor": undefined,
                }),
            ],
        ),
    );

    const prefixMap: PrefixMap = {
        ...resolvedPathPrefixes,
        "~root": rootDir,
        "~template": undefined,
        "~page-source": undefined,
        "~source-processor": undefined,
    };

    const sourceProcessor: TartanInput<SourceProcessor> | undefined =
        contextFile.value.sourceProcessor
            ? await loadModule<SourceProcessor>(
                  resolvePath(
                      contextFile.value.sourceProcessor,
                      path.dirname(contextFile.path),
                      prefixMap,
                  ),
              )
            : undefined;
    const handoffHandler: TartanInput<HandoffHandler> | undefined = contextFile
        .value.handoffHandler
        ? await loadModule<HandoffHandler>(
              resolvePath(
                  contextFile.value.handoffHandler,
                  path.dirname(contextFile.path),
                  prefixMap,
              ),
          )
        : undefined;
    const template: TartanInput<PageTemplate> | undefined = contextFile.value
        .template
        ? await loadFile(
              resolvePath(
                  contextFile.value.template,
                  path.dirname(contextFile.path),
                  prefixMap,
              ),
          ).then((templateFile) => ({
              value: Handlebars.compile<HandlebarsInput>(
                  templateFile.value.toString(),
              ),
              path: templateFile.path,
          }))
        : undefined;
    const assetProcessors:
        | Record<string, TartanInput<SourceProcessor>>
        | undefined = contextFile.value.assetProcessors
        ? Object.fromEntries(
              await Promise.all(
                  Object.entries(contextFile.value.assetProcessors).map(
                      ([key, val]) =>
                          loadModule(
                              resolvePath(
                                  val,
                                  path.dirname(contextFile.path),
                                  prefixMap,
                              ),
                          ).then(
                              (module) =>
                                  [key, module] as [
                                      string,
                                      TartanInput<SourceProcessor>,
                                  ],
                          ),
                  ),
              ),
          )
        : undefined;

    return {
        value: {
            ...contextFile.value,
            ...(sourceProcessor ? { sourceProcessor } : {}),
            ...(handoffHandler ? { handoffHandler } : {}),
            ...(template ? { template } : {}),
            ...(assetProcessors ? { assetProcessors } : {}),
        } as PartialTartanContext,
        path: contextFile.path,
    };
}
