"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.ExpressionErrors = void 0;

var _types = require("../tokenizer/types");

var _tokenizer = require("../tokenizer");

var _state = require("../tokenizer/state");

var _whitespace = require("../util/whitespace");

var _identifier = require("../util/identifier");

var _classScope = require("../util/class-scope");

var _expressionScope = require("../util/expression-scope");

var _scopeflags = require("../util/scopeflags");

var _productionParameter = require("../util/production-parameter");

var _error = require("./error");

class UtilParser extends _tokenizer.default {
  addExtra(node, key, val) {
    if (!node) return;
    const extra = node.extra = node.extra || {};
    extra[key] = val;
  }

  isContextual(token) {
    return this.state.type === token && !this.state.containsEsc;
  }

  isUnparsedContextual(nameStart, name) {
    const nameEnd = nameStart + name.length;

    if (this.input.slice(nameStart, nameEnd) === name) {
      const nextCh = this.input.charCodeAt(nameEnd);
      return !((0, _identifier.isIdentifierChar)(nextCh) || (nextCh & 0xfc00) === 0xd800);
    }

    return false;
  }

  isLookaheadContextual(name) {
    const next = this.nextTokenStart();
    return this.isUnparsedContextual(next, name);
  }

  eatContextual(token) {
    if (this.isContextual(token)) {
      this.next();
      return true;
    }

    return false;
  }

  expectContextual(token, template) {
    if (!this.eatContextual(token)) this.unexpected(null, template);
  }

  canInsertSemicolon() {
    return this.match(130) || this.match(8) || this.hasPrecedingLineBreak();
  }

  hasPrecedingLineBreak() {
    return _whitespace.lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start));
  }

  hasFollowingLineBreak() {
    _whitespace.skipWhiteSpaceToLineBreak.lastIndex = this.state.end;
    return _whitespace.skipWhiteSpaceToLineBreak.test(this.input);
  }

  isLineTerminator() {
    return this.eat(13) || this.canInsertSemicolon();
  }

  semicolon(allowAsi = true) {
    if (allowAsi ? this.isLineTerminator() : this.eat(13)) return;
    this.raise(this.state.lastTokEnd, _error.Errors.MissingSemicolon);
  }

  expect(type, pos) {
    this.eat(type) || this.unexpected(pos, type);
  }

  assertNoSpace(message = "Unexpected space.") {
    if (this.state.start > this.state.lastTokEnd) {
      this.raise(this.state.lastTokEnd, {
        code: _error.ErrorCodes.SyntaxError,
        reasonCode: "UnexpectedSpace",
        template: message
      });
    }
  }

  unexpected(pos, messageOrType = {
    code: _error.ErrorCodes.SyntaxError,
    reasonCode: "UnexpectedToken",
    template: "Unexpected token"
  }) {
    if ((0, _types.isTokenType)(messageOrType)) {
      messageOrType = {
        code: _error.ErrorCodes.SyntaxError,
        reasonCode: "UnexpectedToken",
        template: `Unexpected token, expected "${(0, _types.tokenLabelName)(messageOrType)}"`
      };
    }

    throw this.raise(pos != null ? pos : this.state.start, messageOrType);
  }

  getPluginNamesFromConfigs(pluginConfigs) {
    return pluginConfigs.map(c => {
      if (typeof c === "string") {
        return c;
      } else {
        return c[0];
      }
    });
  }

  expectPlugin(pluginConfig, pos) {
    if (!this.hasPlugin(pluginConfig)) {
      throw this.raiseWithData(pos != null ? pos : this.state.start, {
        missingPlugin: this.getPluginNamesFromConfigs([pluginConfig])
      }, `This experimental syntax requires enabling the parser plugin: ${JSON.stringify(pluginConfig)}.`);
    }

    return true;
  }

  expectOnePlugin(pluginConfigs, pos) {
    if (!pluginConfigs.some(c => this.hasPlugin(c))) {
      throw this.raiseWithData(pos != null ? pos : this.state.start, {
        missingPlugin: this.getPluginNamesFromConfigs(pluginConfigs)
      }, `This experimental syntax requires enabling one of the following parser plugin(s): ${pluginConfigs.map(c => JSON.stringify(c)).join(", ")}.`);
    }
  }

  tryParse(fn, oldState = this.state.clone()) {
    const abortSignal = {
      node: null
    };

    try {
      const node = fn((node = null) => {
        abortSignal.node = node;
        throw abortSignal;
      });

      if (this.state.errors.length > oldState.errors.length) {
        const failState = this.state;
        this.state = oldState;
        this.state.tokensLength = failState.tokensLength;
        return {
          node,
          error: failState.errors[oldState.errors.length],
          thrown: false,
          aborted: false,
          failState
        };
      }

      return {
        node,
        error: null,
        thrown: false,
        aborted: false,
        failState: null
      };
    } catch (error) {
      const failState = this.state;
      this.state = oldState;

      if (error instanceof SyntaxError) {
        return {
          node: null,
          error,
          thrown: true,
          aborted: false,
          failState
        };
      }

      if (error === abortSignal) {
        return {
          node: abortSignal.node,
          error: null,
          thrown: false,
          aborted: true,
          failState
        };
      }

      throw error;
    }
  }

  checkExpressionErrors(refExpressionErrors, andThrow) {
    if (!refExpressionErrors) return false;
    const {
      shorthandAssign,
      doubleProto,
      optionalParameters
    } = refExpressionErrors;
    const hasErrors = shorthandAssign + doubleProto + optionalParameters > -3;

    if (!andThrow) {
      return hasErrors;
    } else if (hasErrors) {
      if (shorthandAssign >= 0) {
        this.raise(shorthandAssign, _error.Errors.InvalidCoverInitializedName);
      }

      if (doubleProto >= 0) {
        this.raise(doubleProto, _error.Errors.DuplicateProto);
      }

      if (optionalParameters >= 0) {
        this.unexpected(optionalParameters);
      }
    }
  }

  isLiteralPropertyName() {
    return (0, _types.tokenIsLiteralPropertyName)(this.state.type);
  }

  isPrivateName(node) {
    return node.type === "PrivateName";
  }

  getPrivateNameSV(node) {
    return node.id.name;
  }

  hasPropertyAsPrivateName(node) {
    return (node.type === "MemberExpression" || node.type === "OptionalMemberExpression") && this.isPrivateName(node.property);
  }

  isOptionalChain(node) {
    return node.type === "OptionalMemberExpression" || node.type === "OptionalCallExpression";
  }

  isObjectProperty(node) {
    return node.type === "ObjectProperty";
  }

  isObjectMethod(node) {
    return node.type === "ObjectMethod";
  }

  initializeScopes(inModule = this.options.sourceType === "module") {
    const oldLabels = this.state.labels;
    this.state.labels = [];
    const oldExportedIdentifiers = this.exportedIdentifiers;
    this.exportedIdentifiers = new Set();
    const oldInModule = this.inModule;
    this.inModule = inModule;
    const oldScope = this.scope;
    const ScopeHandler = this.getScopeHandler();
    this.scope = new ScopeHandler(this.raise.bind(this), this.inModule);
    const oldProdParam = this.prodParam;
    this.prodParam = new _productionParameter.default();
    const oldClassScope = this.classScope;
    this.classScope = new _classScope.default(this.raise.bind(this));
    const oldExpressionScope = this.expressionScope;
    this.expressionScope = new _expressionScope.default(this.raise.bind(this));
    return () => {
      this.state.labels = oldLabels;
      this.exportedIdentifiers = oldExportedIdentifiers;
      this.inModule = oldInModule;
      this.scope = oldScope;
      this.prodParam = oldProdParam;
      this.classScope = oldClassScope;
      this.expressionScope = oldExpressionScope;
    };
  }

  enterInitialScopes() {
    let paramFlags = _productionParameter.PARAM;

    if (this.inModule) {
      paramFlags |= _productionParameter.PARAM_AWAIT;
    }

    this.scope.enter(_scopeflags.SCOPE_PROGRAM);
    this.prodParam.enter(paramFlags);
  }

}

exports.default = UtilParser;

class ExpressionErrors {
  shorthandAssign = -1;
  doubleProto = -1;
  optionalParameters = -1;
}

exports.ExpressionErrors = ExpressionErrors;