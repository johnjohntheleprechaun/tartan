import { catchError, MonoTypeOperatorFunction, pipe } from "rxjs";
import { Logger, LogLevel } from "./logger.js";

export function gracefulError<T>(
    /**
     * The UUID of the node that threw this error
     */
    nodeId: string,
    /**
     * The path of this node on disk
     */
    path: string,
    /**
     * What the node was doing (or trying to do) when the error was thrown
     */
    context: string,
): MonoTypeOperatorFunction<T> {
    return pipe(
        catchError((err, from) => {
            logErrorForNode(err, nodeId, context);
            return from;
        }),
    );
}
function logErrorForNode(err: Error, nodeId: string, context: string): void {
    Logger.log(
        `Node ${nodeId} encountered ${err.name} when ${context}:\n${err.message}`,
        LogLevel.Error,
    );
}
