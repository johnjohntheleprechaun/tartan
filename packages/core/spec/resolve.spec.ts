import {Resolver} from "../src/resolve";
import path from "path";
import mock from "mock-fs";

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
                    "re.ex": "src/other",
                },
            });
        });
        beforeEach(() => {
            spyOn(process, "cwd").and.returnValue("/mock");
        });

        it("should resolve relative to cwd by default", () => {
            const pathToResolve = "./test";
            const result = resolver.resolvePath(pathToResolve);
            expect(result).toBe(path.join("/mock", pathToResolve));
        });
        it("should handle `relativeTo` being a file", () => {
            const result = resolver.resolvePath("./image.png", "src/page/index.html");
            expect(result).toBe("/mock/src/page/image.png");
        });
        it("should handle `relativeTo` being a directory", () => {
            const result = resolver.resolvePath("./image.png", "src/page/");
            expect(result).toBe("/mock/src/page/image.png");
        });
        it("should ignore relativeTo when it matches a prefix", () => {
            const result = resolver.resolvePath("~assets/asset.png", "aslkjdfnlasjf");
            expect(result).toBe("/mock/src/assets/asset.png");
        });
        it("should treat path prefixes as literal strings, not regular expressions", () => {
            const result = resolver.resolvePath("regex/no.txt", "src/page");
            expect(result).not.toBe("/mock/src/other/no.txt");
        });
        it("should assume prefixes need to have a trailing slash", () => {
            const result = resolver.resolvePath("src/~assetsandstuff/image.png");
            expect(result).toBe("/mock/src/~assetsandstuff/image.png");
        });
        it("should properly resolve paths that start with /", () => {
            const result = resolver.resolvePath("/assets/image.png");
            expect(result).toBe("/mock/src/assets/image.png");
        });
        it("should resolve to a full path, not a relative path", () => {
            const spy = spyOn(path, "resolve");
            resolver.resolvePath("asdf");
            expect(spy).toHaveBeenCalled();
        });
    });
});
