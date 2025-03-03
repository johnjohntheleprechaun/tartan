export interface TartanExport {
    defaultPrefix: string;

    /**
     * A string mapping component names *without the prefix* to module imports.
     */
    componentMap: {[key: string]: string} | ((key: string) => string);
}
