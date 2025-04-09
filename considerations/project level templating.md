# Templates!

There's a few things that could be templated.

## HTML

This would be pretty straightforward. Have an HTML file in your project root, with a slot, or maybe a custom tag like `<tartan-content>` where any other HTML content is inserted.

This would allow you to reduce code duplication, since let's be honest, most of the base HTML on a website is exactly the same, especially tags inside `<head>`.

## Markdown?

It would be nice to be able to do fancy shit like have a directory tree of markdown files instead of HTML files, and let the HTML template just figure that out for you.

Could do something like `<tartan-template-slot src="relative path to a file" optional></tartan-template-slot>`? It feels wrong to use custom tag names as templating. Maybe I use something like EJS or handlebars instead?

Could use handlebars and have a standard object structure for the input into handlebars. Also it's true that handlebars is better for non-programmers, which is the general goal for tartan (to make basic web development easier for the regular peeps and also myself cause I'm a lazy fucker).

## Per-Page Context

I think it would make a lot of sense to allow (but NOT require) some kind of context definition for each page. Just a regular old JSON object that's passed as a parameter in the handlebars template. Or actually, the context object should include more than just handlebars stuff.

What kind of context might somebody want? Obviously handlebars params can just be whatever the dev wants. Other things?

- The template to use. As a path? Relative to where the file is, but use the prefix thingies that like webpack does.
- Template parameters to pass to the handlebars template
- What kind of general option could I use to allow markdown content? Maybe like, `pageSource`, and default to `index.html`?
- `sourceType` to define what kind of thing `pageSource` is. Options like `plaintext`, `html`, `markdown`, etc (and of course default to `html`).
    - Should I define the source type, or the source behavior? Like, should I say this is markdown, or should I say this file needs to be HTML-escaped or added as a source file

## Source/Context Generators

JS functions (or modules?) that generate source files or handlebars parameter objects. I think to do this it makes sense to have context be provided by *either* `tartan.context.json` or `tartan.context.js` with a default export.

## Processing Steps

1. Traverse whatever file tree
2. For each directory, first check for default context values in `tartan.context.default.js(on)` (inherited down the directory tree), then check for page-specific context in `tartan.context.js(on)`.
3. Load default values for tartan context, and then override those values with the content of the context file
4. load the page source into memory and process it with the defined processor (and await it, cause things should be async lol)
5. render the handlebars template, passing in the context variables as `context` and the content as `pageContent`
