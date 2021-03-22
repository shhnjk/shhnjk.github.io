// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Parses a very small subset of HTML. This ensures that insecure HTML /
 * javascript cannot be injected into WebUI.
 * @param {string} s The string to parse.
 * @throws {Error} In case of non supported markup.
 * @return {DocumentFragment} A document fragment containing the DOM tree.
 */
/* #export */ const parseHtmlSubset = (function() {
  'use strict';

  /** @typedef {function(!Node, string):boolean} */
  let AllowFunction;

  /** @type {!AllowFunction} */
  const allowAttribute = (node, value) => true;

  /**
   * Allow-list of attributes in parseHtmlSubset.
   * @type {!Map<string, !AllowFunction>}
   * @const
   */
  const allowedAttributes = new Map([
    [
      'href',
      (node, value) => {
        // Only allow a[href] starting with chrome:// and https://
        return node.tagName === 'A' &&
            (value.startsWith('chrome://') || value.startsWith('https://'));
      }
    ],
    [
      'target',
      (node, value) => {
        // Only allow a[target='_blank'].
        // TODO(dbeam): are there valid use cases for target !== '_blank'?
        return node.tagName === 'A' && value === '_blank';
      }
    ],
    ['class', allowAttribute],
    ['id', allowAttribute],
    ['is', (node, value) => value === 'action-link' || value === ''],
    ['role', (node, value) => value === 'link'],
    [
      'src',
      (node, value) => {
        // Only allow iframe[src] starting with https://
        return node.tagName === 'IFRAME' && value.startsWith('https://');
      }
    ],
    ['tabindex', allowAttribute],
  ]);

  /**
   * Allow-list of tag names in parseHtmlSubset.
   * @type {!Set<string>}
   * @const
   */

  // Let's allow all HTML tags supported in DOMPurify + iframe, but except style :)
  const allowedTags =
      new Set([ 'A',
                'ABBR',
                'ACRONYM',
                'ADDRESS',
                'AREA',
                'ARTICLE',
                'ASIDE',
                'AUDIO',
                'B',
                'BDI',
                'BDO',
                'BIG',
                'BLINK',
                'BLOCKQUOTE',
                'BODY',
                'BR',
                'BUTTON',
                'CANVAS',
                'CAPTION',
                'CENTER',
                'CITE',
                'CODE',
                'COL',
                'COLGROUP',
                'CONTENT',
                'DATA',
                'DATALIST',
                'DD',
                'DECORATOR',
                'DEL',
                'DETAILS',
                'DFN',
                'DIALOG',
                'DIR',
                'DIV',
                'DL',
                'DT',
                'ELEMENT',
                'EM',
                'FIELDSET',
                'FIGCAPTION',
                'FIGURE',
                'FONT',
                'FOOTER',
                'FORM',
                'H1',
                'H2',
                'H3',
                'H4',
                'H5',
                'H6',
                'HEAD',
                'HEADER',
                'HGROUP',
                'HR',
                'HTML',
                'I',
                'IFRAME',
                'IMG',
                'INPUT',
                'INS',
                'KBD',
                'LABEL',
                'LEGEND',
                'LI',
                'MAIN',
                'MAP',
                'MARK',
                'MARQUEE',
                'MENU',
                'MENUITEM',
                'METER',
                'NAV',
                'NOBR',
                'OL',
                'OPTGROUP',
                'OPTION',
                'OUTPUT',
                'P',
                'PICTURE',
                'PRE',
                'PROGRESS',
                'Q',
                'RP',
                'RT',
                'RUBY',
                'S',
                'SAMP',
                'SECTION',
                'SELECT',
                'SHADOW',
                'SMALL',
                'SOURCE',
                'SPACER',
                'SPAN',
                'STRIKE',
                'STRONG',
                'SUB',
                'SUMMARY',
                'SUP',
                'TABLE',
                'TBODY',
                'TD',
                'TEMPLATE',
                'TEXTAREA',
                'TFOOT',
                'TH',
                'THEAD',
                'TIME',
                'TR',
                'TRACK',
                'TT',
                'U',
                'UL',
                'VAR',
                'VIDEO',
                'WBR']);

  /**
   * This policy maps a given string to a `TrustedHTML` object
   * without performing any validation. Callsites must ensure
   * that the resulting object will only be used in inert
   * documents. Initialized lazily.
   * @type {!TrustedTypePolicy}
   */
  let unsanitizedPolicy;

  function walk(n, f) {
    f(n);
    for (let i = 0; i < n.childNodes.length; i++) {
      walk(n.childNodes[i], f);
    }
  }

  function assertElement(tags, node) {
    if (!tags.has(node.tagName)) {
      throw Error(node.tagName + ' is not supported');
    }
  }

  function assertAttribute(attrs, attrNode, node) {
    const n = attrNode.nodeName;
    const v = attrNode.nodeValue;
    if (!attrs.has(n) || !attrs.get(n)(node, v)) {
      throw Error(node.tagName + '[' + n + '="' + v + '"] is not supported');
    }
  }

  return function(s) {
    const tags = allowedTags;
    const attrs = allowedAttributes;

    const doc = document.implementation.createHTMLDocument('');
    const r = doc.createRange();
    r.selectNode(doc.body);

    if (window.trustedTypes) {
      if (!unsanitizedPolicy) {
        unsanitizedPolicy = trustedTypes.createPolicy(
            'parse-html-subset', {createHTML: untrustedHTML => untrustedHTML});
      }
      s = unsanitizedPolicy.createHTML(s);
    }

    // This does not execute any scripts because the document has no view.
    const df = r.createContextualFragment(s);
    walk(df, function(node) {
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          assertElement(tags, node);
          const nodeAttrs = node.attributes;
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
    });
    return df;
  };
})();
