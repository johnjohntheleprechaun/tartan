import {Resolver} from "../src/resolve";
import mock from "mock-fs";

beforeAll(() => {
    mock();
});

describe("The Resolver class", () => {
    afterEach(() => {
        mock.restore();
    });

    describe("path prefix handler", () => {
        let resolver: Resolver;
        beforeAll(async () => {
            resolver = await Resolver.create({
                rootDir: "src",
                outputDir: "dist",
                // yes I know this is only linux paths but windows is fucking stupid so idc
                pathPrefixes: {
                    "/": "src/",
                    "~assets": "src/assets",
                },
            });
        });

        it("should resolve relative to cwd by default");
        it("should properly use the `relativeTo` param to resolve relative paths");
        it("should treat path prefixes as literal strings, not regular expressions");
        it("should *not* modify a path where the prefix isn't at the beginning");
        it("should properly resolve paths that start with /");
        it("should resolve to a full path, not a relative path");
    });
});
