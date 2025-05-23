/**
 * @format
 */
import { Resolver } from "../src/resolve";
import path from "path";
import mock from "mock-fs";
import { TartanConfig } from "../src/tartan-config";
import { Package } from "custom-elements-manifest";
import { TemplateManifest } from "../src/template-manifest";

type FakePackageInput = {
    elements: string[];
    templates: string[];
};
function createFakePackage(input: FakePackageInput) {
    return {
        "package.json": JSON.stringify({
            customElements: "manifest.json",
            tartanTemplateManifest: "templates.json",
        }),
        "manifest.json": JSON.stringify({
            schemaVersion: "",
            modules: input.elements.map((name) => ({
                kind: "javascript-module",
                path: `elements/${name}.js`,
                declarations: [
                    {
                        kind: "class",
                        customElement: true,
                        tagName: name,
                    },
                ],
            })),
        } as Package),
        "templates.json": JSON.stringify({
            schemaVersion: "1.0.0",
            templates: input.templates.map((item) => ({
                name: item,
                path: `${item}.hbs`,
            })),
        } as TemplateManifest),
        /*
         * Write the fake template files (literally just empty strings but it matters)
         */
        ...((templates: string[]) => {
            const object: Record<string, string> = {};
            for (const template of templates) {
                object[`${template}.hbs`] = "";
            }
            return object;
        })(input.templates),
    };
}

describe("The Resolver class", () => {
    describe("findUp function", () => {
        afterEach(() => {
            mock.restore();
        });
        it("should find the file if it's in the current dir", async () => {
            mock({
                file: "",
            });

            const result = await Resolver.findUp("file");
            expect(result).toBe(path.join(process.cwd(), "file"));
        });
        it("should find the file in a parent directory", async () => {
            mock({
                "/mock": {
                    file: "",
                    "sub-dir": {},
                },
            });

            spyOn(process, "cwd").and.callFake(() => "/mock/sub-dir");

            const result = await Resolver.findUp("file");
            expect(result).toBe("/mock/file");
        });
        it("should throw an error if there's no match", async () => {
            mock({
                "/mock": {
                    "sub-dir": {
                        "other-sub-dir": {},
                    },
                },
            });
            spyOn(process, "cwd").and.callFake(
                () => "/mock/sub-dir/other-sub-dir",
            );
            const promise: Promise<string> = Resolver.findUp("file");
            return expectAsync(promise).toBeRejected();
        });
    });
    describe("template resolver", () => {
        let resolver: Resolver;
        beforeAll(async () => {
            mock({
                "package-lock.json": JSON.stringify({
                    packages: {
                        "node_modules/a-package": {},
                        "node_modules/b-package": {},
                    },
                }),
                node_modules: {
                    "a-package": createFakePackage({
                        elements: [],
                        templates: ["a-template"],
                    }),
                    "b-package": createFakePackage({
                        elements: [],
                        templates: ["b-template"],
                    }),
                },
            });
            const config: TartanConfig = {
                rootDir: "src",
                outputDir: "dist",
            };

            resolver = await Resolver.create(config);
        });
        afterAll(() => {
            mock.restore();
        });

        it("should load the aggregate of all provided template maps", () => {
            expect(Object.keys(resolver.templateMap)).toEqual([
                "a-template",
                "b-template",
            ]);
        });
        it("should return from the map", () => {
            const templ = resolver.resolveTemplateName("b-template");
            expect(templ).toBeDefined();
        });
        it("should return undefined for a template that isn't provided", () => {
            const templ = resolver.resolveTemplateName("this-isn't-real");
            expect(templ).toBeUndefined();
        });
    });

    describe("tag name resolver", () => {
        let resolver: Resolver;
        beforeAll(async () => {
            const config: TartanConfig = {
                rootDir: "src",
                outputDir: "dist",
            };

            mock({
                "package-lock.json": JSON.stringify({
                    packages: {
                        "node_modules/a-package": {},
                        "node_modules/b-package": {},
                    },
                }),
                node_modules: {
                    "a-package": createFakePackage({
                        elements: ["pc-button"],
                        templates: [],
                    }),
                    "b-package": createFakePackage({
                        elements: ["other-button"],
                        templates: [],
                    }),
                },
            });

            resolver = await Resolver.create(config);
        });
        afterAll(() => {
            mock.restore();
        });

        it("should have loaded all the libs", async () => {
            expect(Object.keys(resolver.componentMap)).toEqual([
                "pc-button",
                "other-button",
            ]);
        });
        it("should return the correct module specifier", () => {
            const spec = resolver.resolveTagName("pc-button");
            expect(spec).toMatch(
                /\.\/node_modules\/.+\/elements\/pc-button\.js/,
            );
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

        it("should return undefined if there's no valid file", async () => {
            mock();
            const result = await Resolver.loadObjectFromFile("test");
            expect(result).toBeUndefined();
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

            const importSpy = spyOn(Resolver, "import").and.returnValue(
                Promise.resolve({}),
            );

            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalled();
        });
        it("should prioritize modules over JSON", async () => {
            mock({
                "test.json": "",
                "test.mjs": "",
            });

            const importSpy = spyOn(Resolver, "import").and.returnValue(
                Promise.resolve({}),
            );
            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalledWith("./test.mjs");
        });
        it("should support .js, .mjs, and .ts extensions", async () => {
            const importSpy = spyOn(Resolver, "import").and.returnValue(
                Promise.resolve({}),
            );
            mock({
                "test.js": "",
            });
            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalledWith("./test.js");

            importSpy.calls.reset();

            mock({
                "test.mjs": "",
            });
            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalledWith("./test.mjs");

            importSpy.calls.reset();

            mock({
                "test.ts": "",
            });
            await Resolver.loadObjectFromFile("test");
            expect(importSpy).toHaveBeenCalledWith("./test.ts");
        });
    });

    describe("path prefix handler/resolver", () => {
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
            const result = resolver.resolvePath(
                "./image.png",
                "src/page/index.html",
            );
            expect(result).toBe("/mock/src/page/image.png");
        });
        it("should handle `relativeTo` being a directory", () => {
            const result = resolver.resolvePath("./image.png", "src/page/");
            expect(result).toBe("/mock/src/page/image.png");
        });
        it("should ignore relativeTo when it matches a prefix", () => {
            const result = resolver.resolvePath(
                "~assets/asset.png",
                "aslkjdfnlasjf",
            );
            expect(result).toBe("/mock/src/assets/asset.png");
        });
        it("should treat path prefixes as literal strings, not regular expressions", () => {
            const result = resolver.resolvePath("regex/no.txt", "src/page");
            expect(result).not.toBe("/mock/src/other/no.txt");
        });
        it("should assume prefixes need to have a trailing slash", () => {
            const result = resolver.resolvePath(
                "src/~assetsandstuff/image.png",
            );
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
