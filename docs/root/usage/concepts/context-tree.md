# The Context Tree

The context tree is created mainly by traversing the source directory, with some specific traversal behaviors controlled by the contexts attached to various nodes.
Every node has a context, whether it's inherited or explicitly declared, which controls how a node is processed and how children of that node are discovered.
First, we'll cover traversal (how children are discovered), and then we'll get into the various options to control processing later.

## Node Types

Each node can be either a `page`, `asset`, or `handoff` type.
A `page` node, as you'd expect, represents a webpage. Similarly, `asset` nodes represent assets (a real shocker, I know).

However, `handoff` nodes aren't processed by Tartan at all. Instead, relevant information is passed on to the handoff handler specified in the node's context, and the handler is expected to deal with page or asset generation itself

## Tree Creation

There's only a few context properties that control tree creation. The main one is the "Page Mode" (all the others are specific to certain page modes).
We'll go over each one now.

| Page Mode   | Behavior                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `directory` | This is the simplest page mode. Child nodes are created from sub-directories, and nothing else.                                                                                |
| `file`      | In this mode, children are created from any files that match the `pagePattern` context property (except for the one provided by `pageSource`), as well as any sub-directories. |
| `asset`     | This mode acts the same as the file mode, the only difference being that matched files are created as an `asset` node type.                                                    |
| `handoff`   | When a node has this type, it will have no children.                                                                                                                           |
