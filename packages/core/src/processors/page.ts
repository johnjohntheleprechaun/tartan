import {
    combineLatest,
    distinctUntilChanged,
    map,
    Observable,
    of,
    share,
    shareReplay,
    Subject,
    switchMap,
    tap,
} from "rxjs";
import { ContextTreeNode } from "../context-tree.js";
import { loadFile } from "../inputs/files.js";
import { ProcessedAsset, ProcessedNode } from "./index.js";
import {
    SourceProcessor,
    SourceProcessorInput,
    SourceProcessorOutput,
} from "../types/source-processor.js";
import path from "node:path";
import { efficientConcatMap } from "./operators.js";
import { FullTartanContext } from "../types/tartan-context.js";
import { TemplateDelegate } from "handlebars";
import { HandlebarsInput } from "../types/handlebars.js";
import { gracefulError } from "../outputs/error.js";

export type PageProcessorInput = {
    node: ContextTreeNode;
    depth: number;
    children: Observable<ProcessedNode[]>;
};

const noopSourceProcessor: SourceProcessor = (input: SourceProcessorInput) =>
    ({ processedContents: input.sourceFile }) as SourceProcessorOutput;
const noopHandlebarsTemplate: TemplateDelegate<HandlebarsInput> = (
    input: HandlebarsInput,
) => input.sourceContents;

export type ProcessedPage = {
    outputDirectory: string;
    extraMetadata: { [key: string]: any };
    assets: ProcessedAsset[];
};

type FileToBeWritten = {
    path: string;
    contents: Buffer;
};
export function processPage(
    /**
     * The node being processed
     */
    node: ContextTreeNode,
    /**
     * Distance from the root node
     */
    depth: number,
    /**
     * Fully processed child nodes
     */
    children: Observable<ProcessedNode[]>,
    /**
     * The fully resolved directory that everything should be outputted to
     */
    outputDirectory: string,
): Observable<ProcessedPage> {
    const fileOutputSubject: Subject<FileToBeWritten> = new Subject();

    // create an observable for the resolved source file path
    const sourceFilePath = combineLatest([node.type, node.context]).pipe(
        map(([type, context]) =>
            type === "page.file"
                ? node.path
                : path.join(node.path, context.pageSource || ""),
        ),
        distinctUntilChanged(),
    );

    // load the page itself
    const sourceFile = sourceFilePath.pipe(
        switchMap((filepath) => loadFile(filepath, node.attached)),
        shareReplay(1),
    );

    // run it through the source processor
    const sourceProcessor: Observable<SourceProcessor> = node.context.pipe(
        map((ctx) => ctx.sourceProcessor || noopSourceProcessor),
    );
    const sourceProcessorOutput: Observable<SourceProcessorOutput> =
        combineLatest([
            sourceFile,
            sourceFilePath,
            children,
            node.context,
        ]).pipe(
            share({ resetOnRefCountZero: false }),
            // create the source processor input object
            map<
                [Buffer, string, ProcessedNode[], FullTartanContext],
                SourceProcessorInput
            >(([sourceFile, sourcePath, processedChildren, context]) => ({
                extraContext: context.extraContext || {},
                children: processedChildren,
                sourceFile: sourceFile,
                sourcePath,
                depth,
            })),
            // map it to a list of params (even tho there's just one param)
            map((param) => [param] as [SourceProcessorInput]),
            // execute the source processor
            efficientConcatMap<SourceProcessor>(sourceProcessor),
            // check for errors
            tap((output) => {
                if (output.outputDirectory) {
                    const relativeToOutput = path.relative(
                        path.dirname(outputDirectory),
                        path.join(
                            path.dirname(outputDirectory),
                            output.outputDirectory,
                        ),
                    );
                    if (relativeToOutput.startsWith("..")) {
                        throw new InvalidOutputDirectoryError(
                            "Invalid modification to output directory. The modified path must reolve to *below* the original",
                        );
                    }
                }
            }),
            gracefulError(node.id, node.path, "running the source processor"),
        );

    // run it through the template
    const templateFunction: Observable<TemplateDelegate<HandlebarsInput>> =
        node.context.pipe(map((ctx) => ctx.template || noopHandlebarsTemplate));
    const templatedPage: Observable<string> = combineLatest([
        sourceProcessorOutput,
        sourceFilePath,
        children,
        node.context,
    ]).pipe(
        map<
            [SourceProcessorOutput, string, ProcessedNode[], FullTartanContext],
            HandlebarsInput
        >(([processorOutput, sourcePath, children, context]) => ({
            sourceContents: processorOutput.processedContents.toString("utf8"),
            extraContext: context.extraContext || {},
            extraMetadata: processorOutput.extraMetadata || {},
            children,
            sourcePath,
            depth,
        })),
        map<HandlebarsInput, Parameters<TemplateDelegate<HandlebarsInput>>>(
            (input) => [input],
        ),
        efficientConcatMap(templateFunction),
    );

    // check for assets
    const assets = of([]); // we'll do this in a bit

    // write files

    // return info
    return combineLatest([sourceProcessorOutput, assets]).pipe(
        map(([sourceProcessorOutput, assets]) => ({
            outputDirectory: sourceProcessorOutput.outputDirectory
                ? path.join(
                      path.dirname(outputDirectory),
                      sourceProcessorOutput.outputDirectory,
                  )
                : outputDirectory,
            assets: assets,
            extraMetadata: sourceProcessorOutput.extraMetadata || {},
        })),
    );
}

/*
 * ERROR TYPES
 */

export class ProcessingError extends Error {}
export class InvalidOutputDirectoryError extends ProcessingError {}
