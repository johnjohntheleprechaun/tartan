# Tag Name Resolution

Rules defining how custom tag names should be resolved into package references

## Tag Name Format

`{prefix}-{element name}`

### Step 1: Loading the modules

`tartan.config.json` should contain a list of module names in the `componentLibraries` property. Modules are loaded in the order they appear in the list, and each one's default export is checked for required properties (a module missing a required property is a fatal error).

### Step 2: Scanning for custom elements

In this step we simply scan through all the elements in the document in order to generate a list of all the ones that match a prefix defined by any of the component libraries.

### Step 3: Resolving custom elements

The modules should export either an explicit mapping of component names to module specifiers, or a function that takes in a component name and returns a module specifier. Those mappings are used to create a list of module specifiers that need to be imported for the specific web component to work properly.
