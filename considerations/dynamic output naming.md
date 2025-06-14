## The Problem

A blog, like my dad's, has a simple file structure but non-simple behaviors.

It has headers at the top of the file that define the title and the date it was written. That data is used for two things:

- Naming the output path for the blog post
- Aggregated and used on the home page


## Aggregated Data

This is actually a major problem. It makes sense that you would want (for example) your homepage to dynamically list sub-pages. What's an easy way to do this?

A very *dynamic* but *bad* way to do it, is to allow handlebars templates and do a module export. The problem with that of course is that it'll take re-processing every blog post.

I can set it up so when a page is processed, it returns a string (the processed content) and some data about the page. That causes... problems with processing order. It'll get pretty damn complex pretty damn fast (for me, as the tartan's dev)
