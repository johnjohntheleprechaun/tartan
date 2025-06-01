import { Logger, SourceProcessor } from "@tartan/core";
import showdown from "showdown";

const converter = new showdown.Converter();
export default ((input) => {
    Logger.log(input.subpageMeta);
    return {
        processedContents: Buffer.from(
            converter.makeHtml(input.sourceContents.toString()),
            "utf8",
        ),
        extraMeta: "asdfasdfasdf",
    };
}) as SourceProcessor;
