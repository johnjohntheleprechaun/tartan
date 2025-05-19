/**
 * @format
 */
import { PageMeta, SubPageMeta } from "./source-processor.js";

export interface HandlebarsContext {
    /**
     * The fully processed page content, it's assumed that this is a safe string.
     */
    pageContent: string;
    /**
     * Extra context provided by the tartan page's context.
     */
    extraContext: any;
    /**
     * The current page's meta.
     */
    pageMeta: PageMeta;
    /**
     * Metadata from all the sub pages.
     */
    subPageMeta: SubPageMeta[];
}
