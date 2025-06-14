# Page Modes

So we're gonna have a couple modes, `file` and `directory`.

## `file` Mode

File mode will have each file in a directory be a page. This is useful if, for example, you've got a bunch of markdown files that make up your blog.

I think that to implement this I'll need to do a major rewrite of the context tree generator, which is gonna be a pain.

### Sub-directories in File Mode

Dunno... Do I just disallow it? That might be totally ok tbh.

### Pattern Matching?

Only include files that match a blob? So like, when in file mode, `pageSource` is a matching string?

## `directory` Mode

Directory mode is just what I've already implemented, so it's really not a big deal.
