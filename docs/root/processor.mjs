import showdown from "showdown";

const converter = new showdown.Converter();

export default (text) => converter.makeHtml(text);
