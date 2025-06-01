- Decide whether to remove the spec testing the order of priority of files when using `loadObjectFromFile`
- Create a way to add processors for different file types
- Have some kind of prefix or something to let paths be relative to wherever the template you're using is located (but only for paths inside the template)
- Register handlebars partials
- the custom elements manifest is supposed to define elements in the exports section, but some things (like shoelace) have malformed manifests. This needs to be handled gracefully. Also, maybe I should make a pull request to shoelace.
- Put custom element classes in the global scope and mark those imports as external when processing javascript
- implement the `extraAssets` property, to handle assets that aren't explicitly referenced in HTML
- add a page mode or modes that allows the user to stop the tree search from going further down and do one of the following:

    - provide a simulated file tree to traverse (like the mock-fs input)
    - receive as input an output directory (and whatever context would usually be provided to a source processor, minus the obvious) and be left to it's own devices in regards to generating output
    - dynamically generate subdirectories on disk, to be processed as they usually would be (admittedly this is kind of a weird idea, but it would let me use `typedoc` to generate markdown files, and then just process them with the same theme as everything else)

- add comments goddamn bro
- investigate switching to Node v22 (LTS) and builtin `fs.glob`
