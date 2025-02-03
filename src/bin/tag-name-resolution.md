# Tag Name Resolution

Rules defining how custom tag names should be resolved into package references

## Tag Name Format

`x-{package shorthand}-{element name}`

## Resolving Package Shorthand

Ideally I want this to be usable with no config... But that would require (I think) searching through all packages, which I definitely don't wanna do. I guess though, if I just did it once and had a cache? 

### Resolve Steps:

#### Step 1: Finding the Package

Tartan will search the following places for shorthand definitions (in order):

- User defined shorthand in the `shorthandMap` property of `tartan.config.json`.
- Cached package defined shorthand in `.tartan/shorthand`. (not implemented yet)
- Search through installed NPM packages, rebuilding the shorthand cache along the way. (not implemented yet)

If a result was found in either `tartan.json` or the shorthand cache file, Tartan will check to see if the package is actually installed before returning a result, and fail if it isn't.

#### Step 2: Resolving the Element Definition

Element (not package) resolution is left up to individual component packages. Any valid Tartan package should be published with a `tartan.components.json` file that maps element names to a module who's only export is a class that extends `HTMLElement` (NOT built-ins like `HTMLImageElement`, since Safari doesn't support that)
