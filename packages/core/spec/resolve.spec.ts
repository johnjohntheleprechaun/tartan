import {Resolver} from "../src/resolve";
import path from "path";
import mock from "mock-fs";
import {TartanExport} from "../src/tartan-export";
import {TartanConfig} from "@tartan/core";

describe("The Resolver class", () => {
    describe("template resolver", () => {
        let resolver: Resolver;
        let fakeLibs: {[key: string]: TartanExport};
        beforeAll(async () => {
            fakeLibs = {
                "fakeOne": {
                    templateMap: {
                        "blog-template": "some/path/temp.html",
                    },
                },
                "fakeTwo": {
                    templateMap: {
                        "doc-template": "some/other/path/temp.html",
                    },
                },
            };

            const config: TartanConfig = {
                rootDir: "src",
                outputDir: "dist",
                designLibraries: Object.keys(fakeLibs),
            };
            spyOn(Resolver, "import").and.callFake(async <T>(module: string): Promise<T> => {
                return fakeLibs[module] as T;
            });
            spyOn(Resolver, "resolveImport").and.callFake((spec: string): string => {
                return spec;
            });

            resolver = await Resolver.create(config);
        });

        it("should load the aggregate of all provided template maps", () => {
            expect(resolver.templateMap).toEqual({
                "blog-template": "some/path/temp.html",
                "doc-template": "some/other/path/temp.html",
            });
        });
        it("should return from the map", () => {
            const templ = resolver.resolveTemplateName("blog-template");
            expect(templ).toBe("some/path/temp.html");
        })
        it("should return undefined for a template that isn't provided", () => {
            const templ = resolver.resolveTemplateName("this-isn't-real");
            expect(templ).toBeUndefined();
        })
    });

    describe("tag name resolver", () => {
        let resolver: Resolver;
        let fakeLibs: {[key: string]: TartanExport};
        beforeAll(async () => {
            fakeLibs = {
                "pc": {
                    componentMap: {
                        "pc-button": "fakeModule",
                    },
                },
                "bbb": {
                    componentMap: {
                        "other-button": "otherFakeModule",
                    },
                },
            };
            const config: TartanConfig = {
                rootDir: "src",
                outputDir: "dist",
                designLibraries: Object.keys(fakeLibs),
            };
            spyOn(Resolver, "import").and.callFake(async <T>(module: string): Promise<T> => {
                return fakeLibs[module] as T;
            });
            spyOn(Resolver, "resolveImport").and.callFake((spec: string): string => {
                return spec;
            });

            resolver = await Resolver.create(config);
        });

        it("should have loaded all the libs", async () => {
            expect(resolver.componentMap).toEqual({
                "pc-button": "fakeModule",
                "other-button": "otherFakeModule",
            });
        });
        it("should return the correct module specifier", () => {
            const spec = resolver.resolveTagName("pc-button");
            expect(spec).toBe("fakeModule");
        });
        it("should return undefined if there is no component registered", () => {
            const spec = resolver.resolveTagName("not-a-real-tag");
            expect(spec).toBeUndefined();
        });
    });
    describe("file object loader", () => {
        afterEach(() => {
            mock.restore();
        });

        it("should error if there's no valid file", async () => {
            mock();
            let failed = false;
            await Resolver.loadObjectFromFile("test").catch(() => {failed = true});
            expect(failed).toBeTrue();
        });
        it("should correctly load JSON", async () => {
            const testObject = {
                chicken: "jockey",
            };
            mock({
                "test.json": JSON.stringify(testObject),
            });

            const result = await Resolver.loadObjectFromFile("test");
            expect(result).toEqual(testObject);
        });
        it("should try to load a module if it exists", async () => {
            mock({
                "test.mjs": "",
            });

            const importSpy = spyOn(Resolver, "import").and.returnValue(Promise.resolve({}));

            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalled();
        });
        it("should prioritize JSON over JS modules", async () => {
            const testObject = {
                chicken: "jockey",
            };
            mock({
                "test.json": JSON.stringify(testObject),
                "test.mjs": "",
            });

            const importSpy = spyOn(Resolver, "import").and.returnValue(Promise.resolve({}));
            const result = await Resolver.loadObjectFromFile("test");
            expect(importSpy).not.toHaveBeenCalled();
            expect(result).toEqual(testObject);
        });
        it("should support both .js and .mjs extensions", async () => {
            mock({
                "test.js": "",
            });
            const importSpy = spyOn(Resolver, "import").and.returnValue(Promise.resolve({}));
            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalled();

            importSpy.calls.reset();

            mock({
                "test.mjs": "",
            });
            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalled();
        });
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
