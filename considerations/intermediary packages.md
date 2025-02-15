# Intermediary Packages

The purpose of an intermediary package is to translate between Tartan and more traditional component libraries (especially the ones built with Lit since those actually support web components natively).

All Tartan-compatible packages will export an object of type [`TartanExport`](../src/tartan-export.d.ts).


Things like LiveMark can just have a submodule for tartan support so instead of importing `livemark` you import `livemark/tartan`.
