import { minimatch } from "minimatch";
import path from "path";
import { Resolver } from "../resolve.js";

export type AssetProcessorOutput = {
    processedContents: Buffer;
    filename?: string;
};
export type AssetProcessor = (
    asset: Buffer,
    filename: string,
) => Promise<AssetProcessorOutput> | AssetProcessorOutput;

export type ProcessorRegistryEntry = {
    glob: string;
    processor: AssetProcessor;
};
export type AssetHandlerConfig = {
    /**
     * The path to the source file.
     */
    sourcePath: string;
    /**
     * The fully resolved output directory (as an absolute path), *unless it's modified by the processor*
     */
    outputDir: string;
    /**
     * The fully processed context for this asset.
     */
    //context: FullTartanContext;
};
export class AssetHandler {
    private static processorRegistry: ProcessorRegistryEntry[] = [];

    /**
     * Register an asset processor. The most recently registered processor has the highest precedence.
     */
    public static async registerProcessor(
        /**
         * A glob to match assets by their filenames.
         */
        glob: string,
        /**
         * The path to a processor to use for assets that match the glob.
         */
        moduleReference: string,
    ): Promise<ProcessorRegistryEntry> {
        const processor: AssetProcessor =
            await Resolver.import(moduleReference);
        const entry: ProcessorRegistryEntry = {
            glob,
            processor,
        };
        this.processorRegistry = [entry].concat(this.processorRegistry);
        return entry;
    }
    public static resetRegistry() {
        this.processorRegistry = [];
    }

    private sourcePath: string;
    private outputDir: string;
    private basename: string;
    //private context: FullTartanContext;

    constructor(config: AssetHandlerConfig) {
        this.sourcePath = config.sourcePath;
        this.outputDir = config.outputDir;
        //this.context = config.context;
        this.basename = path.basename(this.sourcePath);
    }

    /**
     * @returns The filename of the outputed asset
     */
    public async process(): Promise<string> {
        for (const entry of AssetHandler.processorRegistry) {
            if (minimatch(this.sourcePath, entry.glob)) {
                const fileContents = await Resolver.ufs.readFile(
                    this.sourcePath,
                );
                const result = await entry.processor(
                    fileContents,
                    this.basename,
                );

                // write the file
                await Resolver.ufs.writeFile(
                    path.join(this.outputDir, result.filename || this.basename),
                    result.processedContents,
                );

                return result.filename || this.basename;
            }
        }

        // no matching processors
        await Resolver.ufs.copyFile(
            this.sourcePath,
            path.join(this.outputDir, this.basename),
        );
        return this.basename;
    }
}
