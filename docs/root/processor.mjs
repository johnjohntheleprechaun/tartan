import showdown from "showdown";

const converter = new showdown.Converter();

/**
 * @type {import("@tartan/core").SourceProcessor}
 */
export default (input) => {
    console.log(input.subpageMeta)
    return {
        processedContents: converter.makeHtml(input.sourceContents),
        extraMeta: "asdfasdfasdf"
    }
};
