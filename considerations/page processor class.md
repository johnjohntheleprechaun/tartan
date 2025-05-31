# PageProcessor

To be processed, a page might need:

- the source file path
- the context for the page

And would return:

- the processed file? (or would the content just be written to disk rather than returned?)
- in the future, when dependencies are a thing, it could return some kind of object to be stored globally and available to whoever comes next
- because multiple pages might depend on the same asset (an image for example), I need some way to avoid duplicate writes.

This brings up another problem: Path resolution and asset management. If I have a directory tree like:

```
src/
  pages/
    index.html
  assets/
    image.webp
```

And `tartan.config.json` has the root as `pages/` then where does assets go in the output directory? Or maybe it just... doesn't? And you have to use a tree like:

```
src/
  index.html
  assets/
    image.webp
```

Or perhaps go with structure one but in the config when you define path prefixes, you define a mapping between prefix and output directory? Something like:

```
{
    "pathPrefixes": {
        "~images": ["src/assets/images", "assets/images"]
    }
}
```
so the path `~images/chicken.webp` loads `src/assets/images/chicken.webp` and outputs to `dist/assets/images/chicken.webp`

Time to look at how parcel handles things like this.
