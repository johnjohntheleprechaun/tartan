import {Statement, callExpression, expressionStatement, identifier, importDeclaration, importSpecifier, memberExpression, program, stringLiteral} from "@babel/types";
import {resolveCustomTag} from "./resolve";
import generate from "@babel/generator";
import {build} from "esbuild";

export async function generateWebComponentJS(customTags: string[]): Promise<string> {
    // group by module
    const modules: Record<string, string[]> = {};
    const components: {tagName: string, className: string}[] = [];
    for (const tag of customTags) {
        const resolution = resolveCustomTag(tag);
        if (modules[resolution.moduleName]) {
            modules[resolution.moduleName].push(resolution.className);
        }
        else {
            modules[resolution.moduleName] = [resolution.className];
        }

        components.push({
            tagName: tag,
            className: resolution.className,
        });
    }

    const statements: Statement[] = [];

    for (const module in modules) {
        const specifiers = [];
        for (const className of modules[module]) {
            specifiers.push(importSpecifier(identifier(className), identifier(className)));
        }
        statements.push(importDeclaration(specifiers, stringLiteral(module)))
    }

    for (const component of components) {
        const callee = memberExpression(identifier("customElements"), identifier("define"));
        const call = callExpression(callee, [
            stringLiteral(component.tagName),
            identifier(component.className),
        ]);
        statements.push(expressionStatement(call));
    }

    // I know generating code, and then parsing code immediately after... isn't the best. But it's very little code, and very basic code, and idk how else to do this lol
    const elementRegisterAST = program(statements)
    const elementRegisterCode = generate(elementRegisterAST).code;
    const bundledCode = await build({
        stdin: {
            contents: elementRegisterCode,
            resolveDir: ".",
        },
        format: "iife",
        platform: "browser",
        bundle: true,
        write: false,
    });

    return bundledCode.outputFiles[0].text;
}
