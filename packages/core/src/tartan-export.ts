export interface TartanExport {
    /**
     * An object mapping component names to module imports.
     */
    componentMap?: {[key: string]: string};
    /**
     * An object mapping component names to template files.
     */
    templateMap?: {[key: string]: string};
}
