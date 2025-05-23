import { Logger, SourceProcessor } from "@tartan/core";
import showdown from "showdown";

const converter = new showdown.Converter();
export default ((input) => {
    Logger.log(input.subpageMeta);
    return {
        processedContents: converter.makeHtml(input.sourceContents),
        extraMeta: "asdfasdfasdf",
    };
}) as SourceProcessor;
