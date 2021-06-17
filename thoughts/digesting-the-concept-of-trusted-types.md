# Digesting the Concept of Trusted Types

This document describes how I interpreted the concept of Trusted Types, and why I think it's important. This is not the universal truth and is subject to change (because the API will likely extend in the future).

## What is [Trusted Types](https://web.dev/trusted-types/)

Trusted Types enforce developers to define a type for a string, when the string assigment to a sink will result in type conversion (by the browser).

## Insecure Defaults

[TypeScript](https://web.dev/trusted-types/) is a very popular choice for JS development these days. This is because when you have a strongly typed system, you can catch bugs before it occurs in the wild.

Similar thing can be said for security. Since the beginning of the Web, we use _Strings_ for almost everything.

We use _String_ for:

```
element.textContent = "<s>hello</s>";
```

AND

```
element.innerHTML = "<s>hello</s>";
```

However, the latter example will result in re-parse of the _String_, and will be treated as an _HTML_. 

This is the whole problem. 
A _String_ assignment to `textContent` and `innerHTML` should never be treated the same. The latter requires an _HTML_. Similarly, a _Sting_ shouldn't be assigned to `scriptElement.text`, it should be a _Script_ instead.

As explained above, Web development has been insecure by default. But Trusted Types provides _TrustedHTML_, _TrustedScript_, and _TrustedScriptURL_ types, and perform runtime checks against sinks where the browser applies type conversion to these types.

## Why isn't CSP's _script-src_ sufficient?

CSP's _script-src_ allows developers to specify scripts that are intentionally loaded by them, and blocks script execution of any other scripts. However, [Script Gadgets](https://github.com/google/security-research-pocs/tree/master/script-gadgets) showed that commonly used frameworks/libraries contains a code that could lead to a DOM-based XSS. So the believe of CSP's _script-src_ mitigating all XSS was gone.

## Why can Trusted Types solve this problem?

Trusted Types' type enforcement applies to all code running in the document. Therefore, if a third-party library loaded in the document has a DOM-based XSS, it will be blocked by the runtime type checks. This means, as long as [Trusted Type policies](https://web.dev/trusted-types/#create-a-trusted-type-policy) allowed in the document are reviewed and safe, there is mostly no chance of DOM-based XSS in the page.

## Will [Strict CSP](https://web.dev/strict-csp/) and Trusted Types mitigates all XSS?

There are few known issues.

### [Dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#dynamic_imports)

While Dynamic import should require a _TrustedScriptURL_, [TC39](https://tc39.es/) maintains Dynamic import (while Trusted Types applies in the DOM). Therefore, it needs a solution in the ECMAScript's spec. [Dynamic Import Host Adjustment](https://github.com/tc39/dynamic-import-host-adjustment) is being proposed for this problem. This can be mitigated by adding allow-list of script URLs in `script-src` on top of Strict CSP.

### [Template Gadget](https://github.com/shhnjk/shhnjk.github.io/blob/main/PoCs/template_gadget.html)

Strcit CSP allows `'strict-dynamic'`, which means if there is a gadget in libraries that tries to add scripts with URL obtained from the DOM, those scripts will be allowed to execute. However, a _String_ assignment to script element's `src` requires _TrustedScriptURL_. So normal script gadgets won't work under Strict CSP + Trusted Types enforcement.

But, because things inside a _template_ element (from the intial load of the document) is already parsed, there will be no _String_ to _HTML_ conversion using DOM API. And therefore, Trusted Types won't care about those (i.e. parsed HTML == Stored/Reflected XSS).

Finally, if there is a gadget that look for template element, and append content inside it to the DOM, that will also pass the check for `'strict-dynamic'`. Ta-da! XSS 😊
This issue can be mitigated by moving to Nonce-only CSP.

## Preventing Futuristic DOM-based XSS

Attacks like [Prototype Pollution](https://github.com/BlackFan/client-side-prototype-pollution) can introduce a DOM-based XSS in an application by changing the flow of a program.

Trusted Types will still be effective in many cases (assuming that the code in Trusted Type policies are secure).

This is because:
1. Migration to Trusted Types will remove a lot of code which calls dangerous sinks.
2. Type enforcement in Trusted Types is a runtime check. Therefore, it can still do type check against program modified by Prototype Pollution.

For example, exploit like [this](https://hackerone.com/reports/986386) will set a _String_ to `innerHTML`, so that will be blocked by Trusted Types.

However, [attacks against sanitizers](https://research.securitum.com/prototype-pollution-and-bypassing-client-side-html-sanitizers/) will be hard, as those sanitizers will be allowed to return _TrustedHTML_. We can still solve this problem with [Sanitizer API](https://sanitizer-api.dev/), because it's guaranteed to return XSS free output.

## Conclusion

Frameworks and libraries will keep increasing, and reviewing everything (including changes to those) isn't scalable. Instead, we should move to a world where many websites enforces Trusted Types, and new libraries are expected to be compatible with Trusted Types. That reduces the amout of audit required for JS code against DOM-based XSS.
