"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var _identifier = require("../util/identifier");

var _node = require("./node");

var _scopeflags = require("../util/scopeflags");

var _util = require("./util");

var _error = require("./error");

const unwrapParenthesizedExpression = node => {
  return node.type === "ParenthesizedExpression" ? unwrapParenthesizedExpression(node.expression) : node;
};

class LValParser extends _node.NodeUtils {
  toAssignable(node, isLHS = false) {
    var _node$extra, _node$extra3;

    let parenthesized = undefined;

    if (node.type === "ParenthesizedExpression" || (_node$extra = node.extra) != null && _node$extra.parenthesized) {
      parenthesized = unwrapParenthesizedExpression(node);

      if (isLHS) {
        if (parenthesized.type === "Identifier") {
          this.expressionScope.recordParenthesizedIdentifierError(node.start, _error.Errors.InvalidParenthesizedAssignment);
        } else if (parenthesized.type !== "MemberExpression") {
          this.raise(node.start, _error.Errors.InvalidParenthesizedAssignment);
        }
      } else {
        this.raise(node.start, _error.Errors.InvalidParenthesizedAssignment);
      }
    }

    switch (node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        break;

      case "ObjectExpression":
        node.type = "ObjectPattern";

        for (let i = 0, length = node.properties.length, last = length - 1; i < length; i++) {
          var _node$extra2;

          const prop = node.properties[i];
          const isLast = i === last;
          this.toAssignableObjectExpressionProp(prop, isLast, isLHS);

          if (isLast && prop.type === "RestElement" && (_node$extra2 = node.extra) != null && _node$extra2.trailingComma) {
            this.raiseRestNotLast(node.extra.trailingComma);
          }
        }

        break;

      case "ObjectProperty":
        this.toAssignable(node.value, isLHS);
        break;

      case "SpreadElement":
        {
          this.checkToRestConversion(node);
          node.type = "RestElement";
          const arg = node.argument;
          this.toAssignable(arg, isLHS);
          break;
        }

      case "ArrayExpression":
        node.type = "ArrayPattern";
        this.toAssignableList(node.elements, (_node$extra3 = node.extra) == null ? void 0 : _node$extra3.trailingComma, isLHS);
        break;

      case "AssignmentExpression":
        if (node.operator !== "=") {
          this.raise(node.left.end, _error.Errors.MissingEqInAssignment);
        }

        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left, isLHS);
        break;

      case "ParenthesizedExpression":
        this.toAssignable(parenthesized, isLHS);
        break;

      default:
    }

    return node;
  }

  toAssignableObjectExpressionProp(prop, isLast, isLHS) {
    if (prop.type === "ObjectMethod") {
      const error = prop.kind === "get" || prop.kind === "set" ? _error.Errors.PatternHasAccessor : _error.Errors.PatternHasMethod;
      this.raise(prop.key.start, error);
    } else if (prop.type === "SpreadElement" && !isLast) {
      this.raiseRestNotLast(prop.start);
    } else {
      this.toAssignable(prop, isLHS);
    }
  }

  toAssignableList(exprList, trailingCommaPos, isLHS) {
    let end = exprList.length;

    if (end) {
      const last = exprList[end - 1];

      if ((last == null ? void 0 : last.type) === "RestElement") {
        --end;
      } else if ((last == null ? void 0 : last.type) === "SpreadElement") {
        last.type = "RestElement";
        let arg = last.argument;
        this.toAssignable(arg, isLHS);
        arg = unwrapParenthesizedExpression(arg);

        if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern" && arg.type !== "ObjectPattern") {
          this.unexpected(arg.start);
        }

        if (trailingCommaPos) {
          this.raiseTrailingCommaAfterRest(trailingCommaPos);
        }

        --end;
      }
    }

    for (let i = 0; i < end; i++) {
      const elt = exprList[i];

      if (elt) {
        this.toAssignable(elt, isLHS);

        if (elt.type === "RestElement") {
          this.raiseRestNotLast(elt.start);
        }
      }
    }

    return exprList;
  }

  isAssignable(node, isBinding) {
    switch (node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        return true;

      case "ObjectExpression":
        {
          const last = node.properties.length - 1;
          return node.properties.every((prop, i) => {
            return prop.type !== "ObjectMethod" && (i === last || prop.type !== "SpreadElement") && this.isAssignable(prop);
          });
        }

      case "ObjectProperty":
        return this.isAssignable(node.value);

      case "SpreadElement":
        return this.isAssignable(node.argument);

      case "ArrayExpression":
        return node.elements.every(element => element === null || this.isAssignable(element));

      case "AssignmentExpression":
        return node.operator === "=";

      case "ParenthesizedExpression":
        return this.isAssignable(node.expression);

      case "MemberExpression":
      case "OptionalMemberExpression":
        return !isBinding;

      default:
        return false;
    }
  }

  toReferencedList(exprList, isParenthesizedExpr) {
    return exprList;
  }

  toReferencedListDeep(exprList, isParenthesizedExpr) {
    this.toReferencedList(exprList, isParenthesizedExpr);

    for (const expr of exprList) {
      if ((expr == null ? void 0 : expr.type) === "ArrayExpression") {
        this.toReferencedListDeep(expr.elements);
      }
    }
  }

  parseSpread(refExpressionErrors, refNeedsArrowPos) {
    const node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssignAllowIn(refExpressionErrors, undefined, refNeedsArrowPos);
    return this.finishNode(node, "SpreadElement");
  }

  parseRestBinding() {
    const node = this.startNode();
    this.next();
    node.argument = this.parseBindingAtom();
    return this.finishNode(node, "RestElement");
  }

  parseBindingAtom() {
    switch (this.state.type) {
      case 0:
        {
          const node = this.startNode();
          this.next();
          node.elements = this.parseBindingList(3, 93, true);
          return this.finishNode(node, "ArrayPattern");
        }

      case 5:
        return this.parseObjectLike(8, true);
    }

    return this.parseIdentifier();
  }

  parseBindingList(close, closeCharCode, allowEmpty, allowModifiers) {
    const elts = [];
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(12);
      }

      if (allowEmpty && this.match(12)) {
        elts.push(null);
      } else if (this.eat(close)) {
        break;
      } else if (this.match(21)) {
        elts.push(this.parseAssignableListItemTypes(this.parseRestBinding()));
        this.checkCommaAfterRest(closeCharCode);
        this.expect(close);
        break;
      } else {
        const decorators = [];

        if (this.match(24) && this.hasPlugin("decorators")) {
          this.raise(this.state.start, _error.Errors.UnsupportedParameterDecorator);
        }

        while (this.match(24)) {
          decorators.push(this.parseDecorator());
        }

        elts.push(this.parseAssignableListItem(allowModifiers, decorators));
      }
    }

    return elts;
  }

  parseBindingRestProperty(prop) {
    this.next();
    prop.argument = this.parseIdentifier();
    this.checkCommaAfterRest(125);
    return this.finishNode(prop, "RestElement");
  }

  parseBindingProperty() {
    const prop = this.startNode();
    const {
      type,
      start: startPos,
      startLoc
    } = this.state;

    if (type === 21) {
      return this.parseBindingRestProperty(prop);
    } else {
      this.parsePropertyName(prop);
    }

    prop.method = false;
    this.parseObjPropValue(prop, startPos, startLoc, false, false, true, false);
    return prop;
  }

  parseAssignableListItem(allowModifiers, decorators) {
    const left = this.parseMaybeDefault();
    this.parseAssignableListItemTypes(left);
    const elt = this.parseMaybeDefault(left.start, left.loc.start, left);

    if (decorators.length) {
      left.decorators = decorators;
    }

    return elt;
  }

  parseAssignableListItemTypes(param) {
    return param;
  }

  parseMaybeDefault(startPos, startLoc, left) {
    startLoc = startLoc ?? this.state.startLoc;
    startPos = startPos ?? this.state.start;
    left = left ?? this.parseBindingAtom();
    if (!this.eat(27)) return left;
    const node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssignAllowIn();
    return this.finishNode(node, "AssignmentPattern");
  }

  checkLVal(expr, contextDescription, bindingType = _scopeflags.BIND_NONE, checkClashes, disallowLetBinding, strictModeChanged = false) {
    switch (expr.type) {
      case "Identifier":
        {
          const {
            name
          } = expr;

          if (this.state.strict && (strictModeChanged ? (0, _identifier.isStrictBindReservedWord)(name, this.inModule) : (0, _identifier.isStrictBindOnlyReservedWord)(name))) {
            this.raise(expr.start, bindingType === _scopeflags.BIND_NONE ? _error.Errors.StrictEvalArguments : _error.Errors.StrictEvalArgumentsBinding, name);
          }

          if (checkClashes) {
            if (checkClashes.has(name)) {
              this.raise(expr.start, _error.Errors.ParamDupe);
            } else {
              checkClashes.add(name);
            }
          }

          if (disallowLetBinding && name === "let") {
            this.raise(expr.start, _error.Errors.LetInLexicalBinding);
          }

          if (!(bindingType & _scopeflags.BIND_NONE)) {
            this.scope.declareName(name, bindingType, expr.start);
          }

          break;
        }

      case "MemberExpression":
        if (bindingType !== _scopeflags.BIND_NONE) {
          this.raise(expr.start, _error.Errors.InvalidPropertyBindingPattern);
        }

        break;

      case "ObjectPattern":
        for (let prop of expr.properties) {
          if (this.isObjectProperty(prop)) prop = prop.value;else if (this.isObjectMethod(prop)) continue;
          this.checkLVal(prop, "object destructuring pattern", bindingType, checkClashes, disallowLetBinding);
        }

        break;

      case "ArrayPattern":
        for (const elem of expr.elements) {
          if (elem) {
            this.checkLVal(elem, "array destructuring pattern", bindingType, checkClashes, disallowLetBinding);
          }
        }

        break;

      case "AssignmentPattern":
        this.checkLVal(expr.left, "assignment pattern", bindingType, checkClashes);
        break;

      case "RestElement":
        this.checkLVal(expr.argument, "rest element", bindingType, checkClashes);
        break;

      case "ParenthesizedExpression":
        this.checkLVal(expr.expression, "parenthesized expression", bindingType, checkClashes);
        break;

      default:
        {
          this.raise(expr.start, bindingType === _scopeflags.BIND_NONE ? _error.Errors.InvalidLhs : _error.Errors.InvalidLhsBinding, contextDescription);
        }
    }
  }

  checkToRestConversion(node) {
    if (node.argument.type !== "Identifier" && node.argument.type !== "MemberExpression") {
      this.raise(node.argument.start, _error.Errors.InvalidRestAssignmentPattern);
    }
  }

  checkCommaAfterRest(close) {
    if (this.match(12)) {
      if (this.lookaheadCharCode() === close) {
        this.raiseTrailingCommaAfterRest(this.state.start);
      } else {
        this.raiseRestNotLast(this.state.start);
      }
    }
  }

  raiseRestNotLast(pos) {
    throw this.raise(pos, _error.Errors.ElementAfterRest);
  }

  raiseTrailingCommaAfterRest(pos) {
    this.raise(pos, _error.Errors.RestTrailingComma);
  }

}

exports.default = LValParser;