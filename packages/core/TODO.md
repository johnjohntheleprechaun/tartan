- Decide whether to remove the spec testing the order of priority of files when using `loadObjectFromFile`
- Have some kind of prefix or something to let paths be relative to wherever the template you're using is located (but only for paths inside the template)
- Register handlebars partials
- the custom elements manifest is supposed to define elements in the exports section, but some things (like shoelace) have malformed manifests. This needs to be handled gracefully. Also, maybe I should make a pull request to shoelace.
- Put custom element classes in the global scope and mark those imports as external when processing javascript
- add a page mode or modes that allows the user to stop the tree search from going further down and do one of the following:

    - receive as input an output directory (and whatever context would usually be provided to a source processor, minus the obvious) and be left to it's own devices in regards to generating output

- add comments goddamn bro
- investigate switching to Node v22 (LTS) and builtin `fs.glob`
