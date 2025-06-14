# Lit Integration

Lit is a super cool library. The problem is that it's designed to have web components imported with JS. It is therefore not _directly_ compatible with Tartan.

A few different possibilities are gonna be explored here.

## Intermediary Packages

Write simple packages that do include the `tartan.components.json` file, and map names to classes. This approach would give the most flexibility, but it would mean that extra code needs to be written for every Lit component library that gets support. It does have some extra benefits though. Mainly simplicity (of the code within Tartan).

## Scanning Module Exports

I _really_ don't like this idea. First of all it would be ridiculously slow. Plus, most (if not all major) Lit libraries use the decorators that automatically register the elements which is gonna really fuck with my code. I also don't wanna force users to manually import, for obvious reasons.

What if I import everything, look at the custom element names that were registered, scan the document for the ones that were used, and only import those?

I actually really really like that idea...

Big problem: you can't really import Lit libraries in a nodejs environment, cause they usually (always?) depend on browser-specific APIs.

Also... Different libraries work very differently in terms of how they export classes. An mostly components are individual modules, not all exported in one central place...

Some component libraries have really weird usage requirements, like Momentum needs it's elements nested within an `mdc-themeprovider` which is just kinda weird. Makes me think I probably do need intermediary packages that act as plugins.
