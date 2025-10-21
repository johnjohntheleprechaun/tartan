import {
    combineLatest,
    distinctUntilChanged,
    map,
    Observable,
    of,
    share,
    shareReplay,
    switchMap,
    tap,
} from "rxjs";
import { ContextTreeNode, loadContextTreeNode } from "../context-tree.js";
import { loadFile } from "../inputs/files.js";
import { NodeProcessor, ProcessedNode } from "./index.js";
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
import {
    parse,
    defaultTreeAdapter as adapter,
    DefaultTreeAdapterTypes as TreeTypes,
    Token,
    serialize,
} from "parse5";
import { processAsset } from "./asset.js";

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

export const processPage: NodeProcessor = (params) => {
    const { node, depth, children, outputDirectory } = params;

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
    const renderedTemplate: Observable<string> = combineLatest([
        sourceProcessorOutput,
        sourceFilePath,
        children,
        node.context,
    ]).pipe(
        share({
            resetOnRefCountZero: false,
        }),
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
        gracefulError(node.id, node.path, "rendering the template"),
    );

    // check for assets
    const documentAndAssets = renderedTemplate.pipe(
        share({ resetOnRefCountZero: false }),
        map((rendered) => parse(rendered)),
        switchMap(
            (
                parsedDocument: TreeTypes.Document,
            ): Observable<[TreeTypes.Document, ProcessedNode[]]> => {
                const queue: TreeTypes.Node[] = [
                    ...adapter.getChildNodes(parsedDocument),
                ];
                let i: number = 0;
                const derivedNodes: Observable<ProcessedNode>[] = [];

                // Go through all the nodes in the document
                while (i < queue.length) {
                    const node = queue[i];
                    // only element nodes would have dependencies
                    if (adapter.isElementNode(node)) {
                        /*
                         * discover referenced assets
                         */
                        const attrList: Token.Attribute[] =
                            adapter.getAttrList(node);
                        attrList.forEach((attr) => {
                            /*
                             * Right now we're just checking the standard attributes that define dependencies
                             * Eventually I'll figure out how to get information on web components that might use different attributes
                             */
                            if (attr.name === "src" || attr.name === "href") {
                                /*
                                 * load an asset node for the dependency
                                 */
                                const assetNode = loadContextTreeNode({
                                    rootContext: params.rootContext,
                                    directory: params.node.path, // the node path should be a directory because we're processing a page
                                    filename: attr.value,
                                    type: "asset",
                                    parent: params.node,
                                });
                                derivedNodes.push(
                                    processAsset({
                                        node: assetNode,
                                        depth: params.depth + 1,
                                        rootContext: params.rootContext,
                                        children: of([]),
                                        outputDirectory: params.outputDirectory,
                                    }).pipe(
                                        tap(
                                            (result) =>
                                                (attr.value =
                                                    result.outputPath),
                                        ),
                                    ),
                                );
                            }
                            // TODO: srcset support
                        });
                    }

                    // add children to the queue
                    if (adapter.isElementNode(node)) {
                        queue.push(...adapter.getChildNodes(node));
                    }
                    if (nodeIsTemplate(node)) {
                        queue.push(...adapter.getChildNodes(node.content));
                    }

                    i++;
                }

                return (
                    derivedNodes.length > 0
                        ? combineLatest(derivedNodes)
                        : of([])
                ).pipe(
                    map<ProcessedNode[], [TreeTypes.Document, ProcessedNode[]]>(
                        (assets: ProcessedNode[]) => [parsedDocument, assets],
                    ),
                );
            },
        ),
        gracefulError(node.id, node.path, "scanning for assets"),
    );
    const assets = documentAndAssets.pipe(map(([, assets]) => assets));
    const fullProcesseDocument: Observable<string> = documentAndAssets.pipe(
        map(([document]) => serialize(document)),
    );

    // TODO: write files

    // return info
    return combineLatest([sourceProcessorOutput, assets, children]).pipe(
        map<
            [SourceProcessorOutput, ProcessedNode[], ProcessedNode[]],
            ProcessedNode
        >(([sourceProcessorOutput, assets, baseChildren]) => ({
            type: "page",
            depth,
            outputPath: sourceProcessorOutput.outputDirectory
                ? path.join(
                      path.dirname(outputDirectory),
                      sourceProcessorOutput.outputDirectory,
                  )
                : outputDirectory,
            extraMetadata: sourceProcessorOutput.extraMetadata || {},
            baseChildren: baseChildren,
            derivedChildren: assets,
        })),
    );
};

function nodeIsTemplate(node: TreeTypes.Node): node is TreeTypes.Template {
    return adapter.isElementNode(node) && node.nodeName === "template";
}

/*
 * ERROR TYPES
 */

export class ProcessingError extends Error {}
export class InvalidOutputDirectoryError extends ProcessingError {}
