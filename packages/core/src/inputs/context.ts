import { combineLatest, map, Observable, of, shareReplay } from "rxjs";
import {
    FullTartanContext,
    TartanContextFile,
} from "../types/tartan-context.js";
import { loadModule } from "./modules.js";
import { SourceProcessor } from "../types/source-processor.js";
import path from "node:path";
import { HandoffHandler } from "../types/handoff-handler.js";

export function initializeContextFile(
    contextFile: TartanContextFile,
    filePath: string,
    onlyWhile: Observable<boolean>,
): Observable<FullTartanContext> {
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
    return combineLatest([sourceProcessor, handoffHandler]).pipe(
        map(
            ([sourceProcessor, handoffHandler]) =>
                ({
                    ...contextFile,
                    ...(sourceProcessor ? { sourceProcessor } : {}),
                    ...(handoffHandler ? { handoffHandler } : {}),
                }) as FullTartanContext,
        ),
    );
}
