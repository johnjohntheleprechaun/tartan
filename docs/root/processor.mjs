import showdown from "showdown";

const converter = new showdown.Converter();

/**
 * @type {import("@tartan/core").SourceProcessor}
 */
export default (input) => ({
    processedContents: converter.makeHtml(input.sourceContents),
});
