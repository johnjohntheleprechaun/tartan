export interface TartanExport {
    defaultPrefix: string;
    dynamicPrefixSupport: boolean;

    /**
     * A string mapping component names *without the prefix* to module imports.
     */
    componentMap: {[key: string]: string} | ((key: string) => string);

    providerElements: ProviderElementDefinition[];
}

export interface ProviderElementDefinition {
    elementName: string;

    // other things like a list of events it listens for so that I can try to dyanmically avoid interference?
}
