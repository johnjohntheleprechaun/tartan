import {Resolver} from "../src/resolve";

beforeAll(() => {
});

describe("Test the Resolver class", () => {
    afterEach(() => {
    });

    describe("resolve path prefixes into full paths", () => {
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

        xit("should resolve relative to cwd by default");
        xit("should properly use the `relativeTo` param to resolve relative paths");
        xit("should treat path prefixes as literal strings, not regular expressions");
        xit("should *not* modify a path where the prefix isn't at the beginning");
        xit("should properly resolve paths that start with /");
        xit("should resolve to a full path, not a relative path");
    });
});
