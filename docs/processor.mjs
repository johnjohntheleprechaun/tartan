import {Logger} from "@tartan/core";
import showdown from "showdown";

const converter = new showdown.Converter();

/**
 * @type {import("@tartan/core").SourceProcessor}
 */
export default (input) => {
    Logger.log(input.subpageMeta)
    return {
        processedContents: converter.makeHtml(input.sourceContents),
        extraMeta: "asdfasdfasdf"
    }
};
