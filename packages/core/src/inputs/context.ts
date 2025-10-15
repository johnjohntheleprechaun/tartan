import {
    combineLatest,
    map,
    Observable,
    of,
    OperatorFunction,
    pipe,
    shareReplay,
    switchMap,
} from "rxjs";
import {
    FullTartanContext,
    TartanContextFile,
} from "../types/tartan-context.js";
import { loadModule } from "./modules.js";
import { SourceProcessor } from "../types/source-processor.js";
import path from "node:path";
import { HandoffHandler } from "../types/handoff-handler.js";
import { HandlebarsInput } from "../types/handlebars.js";
import { loadFile } from "./files.js";
import Handlebars from "handlebars";

export function initializeContext(
    filePath: string,
    onlyWhile: Observable<boolean>,
): OperatorFunction<TartanContextFile, FullTartanContext> {
    return pipe(
        switchMap((contextFile) => {
            const sourceProcessor: Observable<SourceProcessor | undefined> =
                contextFile.sourceProcessor
                    ? loadModule<SourceProcessor>(
                          contextFile.sourceProcessor,
                          onlyWhile,
                          path.dirname(filePath),
                      ).pipe(shareReplay(1))
                    : of(undefined);
            const handoffHandler: Observable<HandoffHandler | undefined> =
                contextFile.handoffHandler
                    ? loadModule<HandoffHandler>(
                          contextFile.handoffHandler,
                          onlyWhile,
                          path.dirname(filePath),
                      )
                    : of(undefined);
            const template: Observable<
                Handlebars.TemplateDelegate<HandlebarsInput> | undefined
            > = contextFile.template
                ? loadFile(
                      path.resolve(
                          path.dirname(filePath),
                          contextFile.template,
                      ),
                      onlyWhile,
                  ).pipe(
                      map((templateFile) => {
                          return Handlebars.compile<HandlebarsInput>(
                              templateFile.toString(),
                          );
                      }),
                  )
                : of(undefined);

            return combineLatest([
                sourceProcessor,
                handoffHandler,
                template,
            ]).pipe(
                map(
                    ([sourceProcessor, handoffHandler, template]) =>
                        ({
                            ...contextFile,
                            ...(sourceProcessor ? { sourceProcessor } : {}),
                            ...(handoffHandler ? { handoffHandler } : {}),
                            ...(template ? { template } : {}),
                        }) as FullTartanContext,
                ),
            );
        }),
    );
}
