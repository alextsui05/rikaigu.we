var TextHelper = function() { };

TextHelper.prototype = {

  getRange: function(evt) {
    var r;
    if (document.caretRangeFromPoint) { // standard (WebKit)
      r = document.caretRangeFromPoint(evt.pageX, evt.pageY);
    } else if (evt.rangeParent) { // Mozilla
      r = document.createRange();
      r.setStart(evt.rangeParent, evt.rangeOffset);
    }
    return r;
  },

  extractTextNode: function(evt) {
    var r = this.getRange(evt);
    var rp = r.startContainer;
    var ro = r.startOffset;
    if (!this.isValidTextNode(rp, ro))
      return "";

    let text = rp.data;
    var nextNode = rp;
    while (((nextNode = this.getNext(nextNode)) != null) &&
        (this.inlineNames[nextNode.nodeName])) {
      text += this.getInlineText(nextNode, null, 1000000);
    }
    var head = '';
    var prevNode = rp;
    while (((prevNode = this.getPrev(prevNode)) != null) &&
        (this.inlineNames[prevNode.nodeName])) {
      head = this.getInlineText(prevNode, null, 1000000) + head;
    }

    return {
      str: head + text,
      off: head.length + ro
    };
  },

  extractSentence: function(text, offset) {
    var begin, end;
    begin = offset;
    while (begin > 0 && !this.isSentenceDelimiter(text[begin])) {
      --begin;
    }
    if (begin != 0) {
      ++begin;
    }
    end = offset;
    while (end < text.length && !this.isSentenceDelimiter(text[end])) {
      ++end;
    }
    if (end < text.length) {
      ++end;
    }
    return text.substring(begin, end).trim();
  },

  isSentenceDelimiter : function(ch) {
    return (ch == '.' || ch == '?' || ch == '。' || ch == "\n");
  },

  isValidTextNode: function(rangeParent, offset) {
    if (rangeParent.ownerDocument.evaluate('boolean(parent::rp or ancestor::rt)',
                rangeParent, // contextNode: Node
                null, // namespaceResolver: function
                XPathResult.BOOLEAN_TYPE, // resultType
                null // result: null to generate new result
            ).booleanValue)
      return false;

    if (rangeParent.nodeType != Node.TEXT_NODE)
      return false;

    return true;
  },

  // Gets text from a node and returns it
  // node: a node
  // selEnd: the selection end object will be changed as a side effect
  // maxLength: the maximum length of returned string
  getInlineText: function (node, selEndList, maxLength) {
    if ((node.nodeType == Node.TEXT_NODE) && (node.data.length == 0)) return ''

    let text = '';
    let result = node.ownerDocument.evaluate('descendant-or-self::text()[not(parent::rp) and not(ancestor::rt)]',
            node, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    while ((maxLength > 0) && (node = result.iterateNext())) {
      text += node.data.substr(0, maxLength);
      maxLength -= node.data.length;
            if (selEndList != null)
                selEndList.push(node);
    }
    return text;
  },

  // Given a node which must not be null, returns either the next sibling or
  // the next sibling of the father or the next sibling of the fathers father
  // and so on or null
  getNext: function(node) {
    do {
      if (node.nextSibling) return node.nextSibling;
      node = node.parentNode;
    } while ((node) && (this.inlineNames[node.nodeName]));
    return null;
  },

  getPrev: function(node) {
    do {
      if (node.previousSibling) return node.previousSibling;
      node = node.parentNode;
    } while ((node) && (this.inlineNames[node.nodeName]));
    return null;
  },

  inlineNames: {
    // text node
    '#text': true,

    // font style
    'FONT': true,
    'TT': true,
    'I' : true,
    'B' : true,
    'BIG' : true,
    'SMALL' : true,
    //deprecated
    'STRIKE': true,
    'S': true,
    'U': true,

    // phrase
    'EM': true,
    'STRONG': true,
    'DFN': true,
    'CODE': true,
    'SAMP': true,
    'KBD': true,
    'VAR': true,
    'CITE': true,
    'ABBR': true,
    'ACRONYM': true,

    // special, not included IMG, OBJECT, BR, SCRIPT, MAP, BDO
    'A': true,
    'Q': true,
    'SUB': true,
    'SUP': true,
    'SPAN': true,
    'WBR': true,

    // ruby
    'RUBY': true,
    'RBC': true,
    'RTC': true,
    'RB': true,
    'RT': true,
    'RP': true
  }
};

