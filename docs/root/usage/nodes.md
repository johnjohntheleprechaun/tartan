A context tree node holds the following information:

- The path of the node, which is either a directory or a file, depending on the node's type.
- A type, one of `page`, `page.file`, `asset`, `handoff`, `handoff.file`. The `.file` suffix represents a node being from a file, which affects how the tree is built and processed.
- A local context, which only affects this node.
- An inheritable context, which child nodes (and this node's local context) might inherit properties from.
- A list of child nodes
