# Context

Every directory/page processed by tartan is associated with a context object. Those context objects have to purposes:

1. Controlling [directory traversal](/usage/concepts/directory-traversal)
2. Setting specific options for [page processing](/usage/concepts/page-processing)

## How Context is Defined

There are two main ways a page's context is determined:

- Inheritance from a parent (you can read more about that [here](/usage/concepts/inheritance)).
- A context file

### Context File Formats

A context file can be provided by any of the following file types where the base name is `tartan.context`, `tartan.default.context`, or occasionally `(filename).context` (we'll talk more about that later).

- The default export of a typescript file, but only if running under `tsx` which will be true if you're using the default CLI (`.ts`)
- The default export of a javascript file (`.js` or `.mjs`)
- A JSON file (`.json`)

You can see the JSON schema for a context file [here](/typedoc/variables/tartanContextSchema)
