"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _xhtml = require("./xhtml");

var _types = require("../../tokenizer/types");

var _context = require("../../tokenizer/context");

var N = require("../../types");

var _identifier = require("../../util/identifier");

var _whitespace = require("../../util/whitespace");

var _error = require("../../parser/error");

const HEX_NUMBER = /^[\da-fA-F]+$/;
const DECIMAL_NUMBER = /^\d+$/;
const JsxErrors = (0, _error.makeErrorTemplates)({
  AttributeIsEmpty: "JSX attributes must only be assigned a non-empty expression.",
  MissingClosingTagElement: "Expected corresponding JSX closing tag for <%0>.",
  MissingClosingTagFragment: "Expected corresponding JSX closing tag for <>.",
  UnexpectedSequenceExpression: "Sequence expressions cannot be directly nested inside JSX. Did you mean to wrap it in parentheses (...)?",
  UnsupportedJsxValue: "JSX value should be either an expression or a quoted JSX text.",
  UnterminatedJsxContent: "Unterminated JSX contents.",
  UnwrappedAdjacentJSXElements: "Adjacent JSX elements must be wrapped in an enclosing tag. Did you want a JSX fragment <>...</>?"
}, _error.ErrorCodes.SyntaxError, "jsx");
_context.types.j_oTag = new _context.TokContext("<tag");
_context.types.j_cTag = new _context.TokContext("</tag");
_context.types.j_expr = new _context.TokContext("<tag>...</tag>", true);

function isFragment(object) {
  return object ? object.type === "JSXOpeningFragment" || object.type === "JSXClosingFragment" : false;
}

function getQualifiedJSXName(object) {
  if (object.type === "JSXIdentifier") {
    return object.name;
  }

  if (object.type === "JSXNamespacedName") {
    return object.namespace.name + ":" + object.name.name;
  }

  if (object.type === "JSXMemberExpression") {
    return getQualifiedJSXName(object.object) + "." + getQualifiedJSXName(object.property);
  }

  throw new Error("Node had unexpected type: " + object.type);
}

var _default = superClass => class extends superClass {
  jsxReadToken() {
    let out = "";
    let chunkStart = this.state.pos;

    for (;;) {
      if (this.state.pos >= this.length) {
        throw this.raise(this.state.start, JsxErrors.UnterminatedJsxContent);
      }

      const ch = this.input.charCodeAt(this.state.pos);

      switch (ch) {
        case 60:
        case 123:
          if (this.state.pos === this.state.start) {
            if (ch === 60 && this.state.canStartJSXElement) {
              ++this.state.pos;
              return this.finishToken(133);
            }

            return super.getTokenFromCode(ch);
          }

          out += this.input.slice(chunkStart, this.state.pos);
          return this.finishToken(132, out);

        case 38:
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadEntity();
          chunkStart = this.state.pos;
          break;

        case 62:
        case 125:
          if (process.env.BABEL_8_BREAKING) {
            const htmlEntity = ch === 125 ? "&rbrace;" : "&gt;";
            const char = this.input[this.state.pos];
            this.raise(this.state.pos, {
              code: _error.ErrorCodes.SyntaxError,
              reasonCode: "UnexpectedToken",
              template: `Unexpected token \`${char}\`. Did you mean \`${htmlEntity}\` or \`{'${char}'}\`?`
            });
          }

        default:
          if ((0, _whitespace.isNewLine)(ch)) {
            out += this.input.slice(chunkStart, this.state.pos);
            out += this.jsxReadNewLine(true);
            chunkStart = this.state.pos;
          } else {
            ++this.state.pos;
          }

      }
    }
  }

  jsxReadNewLine(normalizeCRLF) {
    const ch = this.input.charCodeAt(this.state.pos);
    let out;
    ++this.state.pos;

    if (ch === 13 && this.input.charCodeAt(this.state.pos) === 10) {
      ++this.state.pos;
      out = normalizeCRLF ? "\n" : "\r\n";
    } else {
      out = String.fromCharCode(ch);
    }

    ++this.state.curLine;
    this.state.lineStart = this.state.pos;
    return out;
  }

  jsxReadString(quote) {
    let out = "";
    let chunkStart = ++this.state.pos;

    for (;;) {
      if (this.state.pos >= this.length) {
        throw this.raise(this.state.start, _error.Errors.UnterminatedString);
      }

      const ch = this.input.charCodeAt(this.state.pos);
      if (ch === quote) break;

      if (ch === 38) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.jsxReadEntity();
        chunkStart = this.state.pos;
      } else if ((0, _whitespace.isNewLine)(ch)) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.jsxReadNewLine(false);
        chunkStart = this.state.pos;
      } else {
        ++this.state.pos;
      }
    }

    out += this.input.slice(chunkStart, this.state.pos++);
    return this.finishToken(124, out);
  }

  jsxReadEntity() {
    let str = "";
    let count = 0;
    let entity;
    let ch = this.input[this.state.pos];
    const startPos = ++this.state.pos;

    while (this.state.pos < this.length && count++ < 10) {
      ch = this.input[this.state.pos++];

      if (ch === ";") {
        if (str[0] === "#") {
          if (str[1] === "x") {
            str = str.substr(2);

            if (HEX_NUMBER.test(str)) {
              entity = String.fromCodePoint(parseInt(str, 16));
            }
          } else {
            str = str.substr(1);

            if (DECIMAL_NUMBER.test(str)) {
              entity = String.fromCodePoint(parseInt(str, 10));
            }
          }
        } else {
          entity = _xhtml.default[str];
        }

        break;
      }

      str += ch;
    }

    if (!entity) {
      this.state.pos = startPos;
      return "&";
    }

    return entity;
  }

  jsxReadWord() {
    let ch;
    const start = this.state.pos;

    do {
      ch = this.input.charCodeAt(++this.state.pos);
    } while ((0, _identifier.isIdentifierChar)(ch) || ch === 45);

    return this.finishToken(131, this.input.slice(start, this.state.pos));
  }

  jsxParseIdentifier() {
    const node = this.startNode();

    if (this.match(131)) {
      node.name = this.state.value;
    } else if ((0, _types.tokenIsKeyword)(this.state.type)) {
      node.name = (0, _types.tokenLabelName)(this.state.type);
    } else {
      this.unexpected();
    }

    this.next();
    return this.finishNode(node, "JSXIdentifier");
  }

  jsxParseNamespacedName() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const name = this.jsxParseIdentifier();
    if (!this.eat(14)) return name;
    const node = this.startNodeAt(startPos, startLoc);
    node.namespace = name;
    node.name = this.jsxParseIdentifier();
    return this.finishNode(node, "JSXNamespacedName");
  }

  jsxParseElementName() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let node = this.jsxParseNamespacedName();

    if (node.type === "JSXNamespacedName") {
      return node;
    }

    while (this.eat(16)) {
      const newNode = this.startNodeAt(startPos, startLoc);
      newNode.object = node;
      newNode.property = this.jsxParseIdentifier();
      node = this.finishNode(newNode, "JSXMemberExpression");
    }

    return node;
  }

  jsxParseAttributeValue() {
    let node;

    switch (this.state.type) {
      case 5:
        node = this.startNode();
        this.next();
        node = this.jsxParseExpressionContainer(node);

        if (node.expression.type === "JSXEmptyExpression") {
          this.raise(node.start, JsxErrors.AttributeIsEmpty);
        }

        return node;

      case 133:
      case 124:
        return this.parseExprAtom();

      default:
        throw this.raise(this.state.start, JsxErrors.UnsupportedJsxValue);
    }
  }

  jsxParseEmptyExpression() {
    const node = this.startNodeAt(this.state.lastTokEnd, this.state.lastTokEndLoc);
    return this.finishNodeAt(node, "JSXEmptyExpression", this.state.start, this.state.startLoc);
  }

  jsxParseSpreadChild(node) {
    this.next();
    node.expression = this.parseExpression();
    this.expect(8);
    return this.finishNode(node, "JSXSpreadChild");
  }

  jsxParseExpressionContainer(node) {
    if (this.match(8)) {
      node.expression = this.jsxParseEmptyExpression();
    } else {
      const expression = this.parseExpression();

      if (process.env.BABEL_8_BREAKING) {
        var _expression$extra;

        if (expression.type === "SequenceExpression" && !((_expression$extra = expression.extra) != null && _expression$extra.parenthesized)) {
          this.raise(expression.expressions[1].start, JsxErrors.UnexpectedSequenceExpression);
        }
      }

      node.expression = expression;
    }

    this.expect(8);
    return this.finishNode(node, "JSXExpressionContainer");
  }

  jsxParseAttribute() {
    const node = this.startNode();

    if (this.eat(5)) {
      this.expect(21);
      node.argument = this.parseMaybeAssignAllowIn();
      this.expect(8);
      return this.finishNode(node, "JSXSpreadAttribute");
    }

    node.name = this.jsxParseNamespacedName();
    node.value = this.eat(27) ? this.jsxParseAttributeValue() : null;
    return this.finishNode(node, "JSXAttribute");
  }

  jsxParseOpeningElementAt(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);

    if (this.match(134)) {
      this.expect(134);
      return this.finishNode(node, "JSXOpeningFragment");
    }

    node.name = this.jsxParseElementName();
    return this.jsxParseOpeningElementAfterName(node);
  }

  jsxParseOpeningElementAfterName(node) {
    const attributes = [];

    while (!this.match(51) && !this.match(134)) {
      attributes.push(this.jsxParseAttribute());
    }

    node.attributes = attributes;
    node.selfClosing = this.eat(51);
    this.expect(134);
    return this.finishNode(node, "JSXOpeningElement");
  }

  jsxParseClosingElementAt(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);

    if (this.match(134)) {
      this.expect(134);
      return this.finishNode(node, "JSXClosingFragment");
    }

    node.name = this.jsxParseElementName();
    this.expect(134);
    return this.finishNode(node, "JSXClosingElement");
  }

  jsxParseElementAt(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);
    const children = [];
    const openingElement = this.jsxParseOpeningElementAt(startPos, startLoc);
    let closingElement = null;

    if (!openingElement.selfClosing) {
      contents: for (;;) {
        switch (this.state.type) {
          case 133:
            startPos = this.state.start;
            startLoc = this.state.startLoc;
            this.next();

            if (this.eat(51)) {
              closingElement = this.jsxParseClosingElementAt(startPos, startLoc);
              break contents;
            }

            children.push(this.jsxParseElementAt(startPos, startLoc));
            break;

          case 132:
            children.push(this.parseExprAtom());
            break;

          case 5:
            {
              const node = this.startNode();
              this.next();

              if (this.match(21)) {
                children.push(this.jsxParseSpreadChild(node));
              } else {
                children.push(this.jsxParseExpressionContainer(node));
              }

              break;
            }

          default:
            throw this.unexpected();
        }
      }

      if (isFragment(openingElement) && !isFragment(closingElement)) {
        this.raise(closingElement.start, JsxErrors.MissingClosingTagFragment);
      } else if (!isFragment(openingElement) && isFragment(closingElement)) {
        this.raise(closingElement.start, JsxErrors.MissingClosingTagElement, getQualifiedJSXName(openingElement.name));
      } else if (!isFragment(openingElement) && !isFragment(closingElement)) {
        if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
          this.raise(closingElement.start, JsxErrors.MissingClosingTagElement, getQualifiedJSXName(openingElement.name));
        }
      }
    }

    if (isFragment(openingElement)) {
      node.openingFragment = openingElement;
      node.closingFragment = closingElement;
    } else {
      node.openingElement = openingElement;
      node.closingElement = closingElement;
    }

    node.children = children;

    if (this.match(44)) {
      throw this.raise(this.state.start, JsxErrors.UnwrappedAdjacentJSXElements);
    }

    return isFragment(openingElement) ? this.finishNode(node, "JSXFragment") : this.finishNode(node, "JSXElement");
  }

  jsxParseElement() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    this.next();
    return this.jsxParseElementAt(startPos, startLoc);
  }

  parseExprAtom(refExpressionErrors) {
    if (this.match(132)) {
      return this.parseLiteral(this.state.value, "JSXText");
    } else if (this.match(133)) {
      return this.jsxParseElement();
    } else if (this.match(44) && this.input.charCodeAt(this.state.pos) !== 33) {
      this.replaceToken(133);
      return this.jsxParseElement();
    } else {
      return super.parseExprAtom(refExpressionErrors);
    }
  }

  getTokenFromCode(code) {
    const context = this.curContext();

    if (context === _context.types.j_expr) {
      return this.jsxReadToken();
    }

    if (context === _context.types.j_oTag || context === _context.types.j_cTag) {
      if ((0, _identifier.isIdentifierStart)(code)) {
        return this.jsxReadWord();
      }

      if (code === 62) {
        ++this.state.pos;
        return this.finishToken(134);
      }

      if ((code === 34 || code === 39) && context === _context.types.j_oTag) {
        return this.jsxReadString(code);
      }
    }

    if (code === 60 && this.state.canStartJSXElement && this.input.charCodeAt(this.state.pos + 1) !== 33) {
      ++this.state.pos;
      return this.finishToken(133);
    }

    return super.getTokenFromCode(code);
  }

  updateContext(prevType) {
    super.updateContext(prevType);
    const {
      context,
      type
    } = this.state;

    if (type === 51 && prevType === 133) {
      context.splice(-2, 2, _context.types.j_cTag);
      this.state.canStartJSXElement = false;
    } else if (type === 133) {
      context.push(_context.types.j_expr, _context.types.j_oTag);
    } else if (type === 134) {
      const out = context.pop();

      if (out === _context.types.j_oTag && prevType === 51 || out === _context.types.j_cTag) {
        context.pop();
        this.state.canStartJSXElement = context[context.length - 1] === _context.types.j_expr;
      } else {
        this.state.canStartJSXElement = true;
      }
    } else {
      this.state.canStartJSXElement = (0, _types.tokenComesBeforeExpression)(type);
    }
  }

};

exports.default = _default;