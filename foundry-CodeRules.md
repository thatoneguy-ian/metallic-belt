# Foundry Code Guidelines

## Annotations

### @public
Methods and properties marked @public may be called both externally and internally. They may only be modified within the class that defines them or a subclass of that parent class.

### @protected
Methods and properties marked @protected may only be used or modified within the class that defines them or a subclass of that parent class. We do intend for API users to override @protected properties when they are defining a subclass which replaces or extends the behavior of its parent class.

### @private
Methods and properties marked @private should not be used or modified except by the class which defined them. For API users, this means that you should not reference or override this property. We may make breaking changes to the code for @private attributes without warning or advance notice, even in software versions which are marked "Stable". Now that JavaScript offers true private methods like #privateMethod we are moving our codebase away from use of the @private annotation entirely. Methods which were previously @private will be, at some point, migrated to become true private methods.

### @internal
Methods and properties marked @internal should only be used by the core Foundry VTT codebase and should not be referenced or overridden by external code. This is effectively similar to @private except that @internal methods may be called outside of the context of the class which defines them.

## Naming Conventions
_ naming
Methods and properties which begin with an underscore _ and are not otherwise documented with one of the above tags should be treated as @private.

# naming
Methods and properties which begin with a # are truly private, and cannot be accessed outside their declaring class. This is enforced by Javascript itself - any attempt to read or write these will cause a syntax error. MDN reference

## Reading the Source Code
One fundamental limitation of these online docs is they don't provide the internals on function implementations. If you need more info on anything in the API, you can open up your local foundry installation to view the client-side code. If you have an electron based install, go into resources/app, otherwise this is the root folder.

- client and common are the primary code of Foundry broken up into a 1 file == 1 class setup.
- client is code that's only for end users, such as applications and the canvas. It was fully migrated to use ESM in version 13.338. The actual root file that imports everything is client/client.mjs, where everything is assigned to a spot in the foundry namespace.
- common is code that's shared with the server, and is also available under the foundry namespace.
- dist and node_modules are for the server and are not for community developers.
- public is the actual files that are served up to clients. All of the code that's in client and common gets rolled up into scripts/foundry.mjs. There's also plenty of other material here, like the core icons and css. The lang/en.json file can be particularly useful.
- templates is all the hbs templates used by core.

## FAQ
### What is a breaking change?
A breaking change is one that makes existing calls to the API incompatible with the new version.

Periodically it is necessary to make breaking changes to Public API functions in order to introduce new features or correct bugs in existing ones. These breaking changes can make an existing call to the Public API invalid, such as change in return type, removing a parameter, or renaming a method without providing an alias.

Adding a new optional parameter or updating TypeDocs are not considered to be "Breaking" changes. Interior implementation or behavioral changes are also not considered to be "Breaking" changes, such as changing the order elements in a list are returned in, or refactoring a large method to have smaller interior methods.

### How can I request changes and expansions to the Public API?
If something you would like to do can only be done via the Private API, please reach out to us via our Discord channels such as #dev-support and/or create an Issue on our Github outlining what you're trying to do and what issues you're facing, and we will try our best to help or scope future work to better enable what you're doing.