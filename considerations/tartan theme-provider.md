# Tartan Theme Provider

I need some kind of standard context for tartan, and then for every package I map into being tartan compatible I need to have intermediary context providers to translate between the two.

## Context Dependencies of Component Libraries

- Colors
- Icon size info
- Sometimes icons (although I think this is a bad practice)
- Language context

## Notes

For one, they need theme info. Colors and icons for sure, probably other stuff too. Time to inspect the various `theme-provider` elements.

I agree with Spectrum that having providers for icons is a bad idea, because then all icon data has to be included in the bundle.

Somehow, I need to inform the default `<tartan-theme-provider>` element of all the dependencies the web component compatibility libraries might have, so that I can nest themes (basically it needs to be dynamic). Would it be possible to kind of... inherit those classes? Like, maybe have a list of all the classes that are providers? Then for the event listeners that they register, I just... also register those? And pass through the values?

It's prolly not safe to try and replace the `this` for a class, especially if there's multiple on one element. Don't want those interacting badly.

So, I can do a shadow DOM with all the providers I need nested together, and a nice little slot underneath them. Only potential problem is that custom events don't cross the shadow boundary by default. Not sure yet if that really affects me? It... Might not? _All_ of my content is under the same shadow, so anything that needed to cross a boundary would've already needed to, which means that functionality isn't my responsibility.

The one other thing I need to do is write up a standard for the Tartan `theme-provider`, so that custom translator providers can use it. Oh... And also need to figure out if libraries usually use a custom event or the more standard `request-context` event.

Registering Icon Libraries is... A thing. At least in Shoelace, and I'd like it to work for Tartan as well.
