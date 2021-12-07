"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var N = require("../types");

var _lval = require("./lval");

var _identifier = require("../util/identifier");

var _location = require("../util/location");

var _scopeflags = require("../util/scopeflags");

var _util = require("./util");

var _productionParameter = require("../util/production-parameter");

var _expressionScope = require("../util/expression-scope");

var _error = require("./error");

var _comments = require("./comments");

var _node = require("./node");

const invalidHackPipeBodies = new Map([["ArrowFunctionExpression", "arrow function"], ["AssignmentExpression", "assignment"], ["ConditionalExpression", "conditional"], ["YieldExpression", "yield"]]);

class ExpressionParser extends _lval.default {
  checkProto(prop, isRecord, protoRef, refExpressionErrors) {
    if (prop.type === "SpreadElement" || this.isObjectMethod(prop) || prop.computed || prop.shorthand) {
      return;
    }

    const key = prop.key;
    const name = key.type === "Identifier" ? key.name : key.value;

    if (name === "__proto__") {
      if (isRecord) {
        this.raise(key.start, _error.Errors.RecordNoProto);
        return;
      }

      if (protoRef.used) {
        if (refExpressionErrors) {
          if (refExpressionErrors.doubleProto === -1) {
            refExpressionErrors.doubleProto = key.start;
          }
        } else {
          this.raise(key.start, _error.Errors.DuplicateProto);
        }
      }

      protoRef.used = true;
    }
  }

  shouldExitDescending(expr, potentialArrowAt) {
    return expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt;
  }

  getExpression() {
    this.enterInitialScopes();
    this.nextToken();
    const expr = this.parseExpression();

    if (!this.match(130)) {
      this.unexpected();
    }

    this.finalizeRemainingComments();
    expr.comments = this.state.comments;
    expr.errors = this.state.errors;

    if (this.options.tokens) {
      expr.tokens = this.tokens;
    }

    return expr;
  }

  parseExpression(disallowIn, refExpressionErrors) {
    if (disallowIn) {
      return this.disallowInAnd(() => this.parseExpressionBase(refExpressionErrors));
    }

    return this.allowInAnd(() => this.parseExpressionBase(refExpressionErrors));
  }

  parseExpressionBase(refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const expr = this.parseMaybeAssign(refExpressionErrors);

    if (this.match(12)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];

      while (this.eat(12)) {
        node.expressions.push(this.parseMaybeAssign(refExpressionErrors));
      }

      this.toReferencedList(node.expressions);
      return this.finishNode(node, "SequenceExpression");
    }

    return expr;
  }

  parseMaybeAssignDisallowIn(refExpressionErrors, afterLeftParse) {
    return this.disallowInAnd(() => this.parseMaybeAssign(refExpressionErrors, afterLeftParse));
  }

  parseMaybeAssignAllowIn(refExpressionErrors, afterLeftParse) {
    return this.allowInAnd(() => this.parseMaybeAssign(refExpressionErrors, afterLeftParse));
  }

  setOptionalParametersError(refExpressionErrors, resultError) {
    refExpressionErrors.optionalParameters = (resultError == null ? void 0 : resultError.pos) ?? this.state.start;
  }

  parseMaybeAssign(refExpressionErrors, afterLeftParse) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;

    if (this.isContextual(100)) {
      if (this.prodParam.hasYield) {
        let left = this.parseYield();

        if (afterLeftParse) {
          left = afterLeftParse.call(this, left, startPos, startLoc);
        }

        return left;
      }
    }

    let ownExpressionErrors;

    if (refExpressionErrors) {
      ownExpressionErrors = false;
    } else {
      refExpressionErrors = new _util.ExpressionErrors();
      ownExpressionErrors = true;
    }

    const {
      type
    } = this.state;

    if (type === 10 || (0, _types.tokenIsIdentifier)(type)) {
      this.state.potentialArrowAt = this.state.start;
    }

    let left = this.parseMaybeConditional(refExpressionErrors);

    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }

    if ((0, _types.tokenIsAssignment)(this.state.type)) {
      const node = this.startNodeAt(startPos, startLoc);
      const operator = this.state.value;
      node.operator = operator;

      if (this.match(27)) {
        node.left = this.toAssignable(left, true);

        if (refExpressionErrors.doubleProto >= startPos) {
          refExpressionErrors.doubleProto = -1;
        }

        if (refExpressionErrors.shorthandAssign >= startPos) {
          refExpressionErrors.shorthandAssign = -1;
        }
      } else {
        node.left = left;
      }

      this.checkLVal(left, "assignment expression");
      this.next();
      node.right = this.parseMaybeAssign();
      return this.finishNode(node, "AssignmentExpression");
    } else if (ownExpressionErrors) {
      this.checkExpressionErrors(refExpressionErrors, true);
    }

    return left;
  }

  parseMaybeConditional(refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprOps(refExpressionErrors);

    if (this.shouldExitDescending(expr, potentialArrowAt)) {
      return expr;
    }

    return this.parseConditional(expr, startPos, startLoc, refExpressionErrors);
  }

  parseConditional(expr, startPos, startLoc, refExpressionErrors) {
    if (this.eat(17)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.test = expr;
      node.consequent = this.parseMaybeAssignAllowIn();
      this.expect(14);
      node.alternate = this.parseMaybeAssign();
      return this.finishNode(node, "ConditionalExpression");
    }

    return expr;
  }

  parseMaybeUnaryOrPrivate(refExpressionErrors) {
    return this.match(129) ? this.parsePrivateName() : this.parseMaybeUnary(refExpressionErrors);
  }

  parseExprOps(refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseMaybeUnaryOrPrivate(refExpressionErrors);

    if (this.shouldExitDescending(expr, potentialArrowAt)) {
      return expr;
    }

    return this.parseExprOp(expr, startPos, startLoc, -1);
  }

  parseExprOp(left, leftStartPos, leftStartLoc, minPrec) {
    if (this.isPrivateName(left)) {
      const value = this.getPrivateNameSV(left);
      const {
        start
      } = left;

      if (minPrec >= (0, _types.tokenOperatorPrecedence)(53) || !this.prodParam.hasIn || !this.match(53)) {
        this.raise(start, _error.Errors.PrivateInExpectedIn, value);
      }

      this.classScope.usePrivateName(value, start);
    }

    const op = this.state.type;

    if ((0, _types.tokenIsOperator)(op) && (this.prodParam.hasIn || !this.match(53))) {
      let prec = (0, _types.tokenOperatorPrecedence)(op);

      if (prec > minPrec) {
        if (op === 35) {
          this.expectPlugin("pipelineOperator");

          if (this.state.inFSharpPipelineDirectBody) {
            return left;
          }

          this.checkPipelineAtInfixOperator(left, leftStartPos);
        }

        const node = this.startNodeAt(leftStartPos, leftStartLoc);
        node.overloaded = this.match(37);
        node.left = left;
        node.operator = this.state.value;
        const logical = op === 38 || op === 39;
        const coalesce = op === 36;

        if (coalesce) {
          prec = (0, _types.tokenOperatorPrecedence)(39);
        }

        this.next();

        if (op === 35 && this.hasPlugin(["pipelineOperator", {
          proposal: "minimal"
        }])) {
          if (this.state.type === 91 && this.prodParam.hasAwait) {
            throw this.raise(this.state.start, _error.Errors.UnexpectedAwaitAfterPipelineBody);
          }
        }

        node.right = this.parseExprOpRightExpr(op, prec);
        this.finishNode(node, logical || coalesce ? "LogicalExpression" : "BinaryExpression");
        const nextOp = this.state.type;

        if (coalesce && (nextOp === 38 || nextOp === 39) || logical && nextOp === 36) {
          throw this.raise(this.state.start, _error.Errors.MixingCoalesceWithLogical);
        }

        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec);
      }
    }

    return left;
  }

  parseExprOpRightExpr(op, prec) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;

    switch (op) {
      case 35:
        switch (this.getPluginOption("pipelineOperator", "proposal")) {
          case "hack":
            return this.withTopicBindingContext(() => {
              return this.parseHackPipeBody();
            });

          case "smart":
            return this.withTopicBindingContext(() => {
              if (this.prodParam.hasYield && this.isContextual(100)) {
                throw this.raise(this.state.start, _error.Errors.PipeBodyIsTighter, this.state.value);
              }

              return this.parseSmartPipelineBodyInStyle(this.parseExprOpBaseRightExpr(op, prec), startPos, startLoc);
            });

          case "fsharp":
            return this.withSoloAwaitPermittingContext(() => {
              return this.parseFSharpPipelineBody(prec);
            });
        }

      default:
        return this.parseExprOpBaseRightExpr(op, prec);
    }
  }

  parseExprOpBaseRightExpr(op, prec) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    return this.parseExprOp(this.parseMaybeUnaryOrPrivate(), startPos, startLoc, (0, _types.tokenIsRightAssociative)(op) ? prec - 1 : prec);
  }

  parseHackPipeBody() {
    var _body$extra;

    const {
      start
    } = this.state;
    const body = this.parseMaybeAssign();

    if (invalidHackPipeBodies.has(body.type) && !((_body$extra = body.extra) != null && _body$extra.parenthesized)) {
      this.raise(start, _error.Errors.PipeUnparenthesizedBody, invalidHackPipeBodies.get(body.type));
    }

    if (!this.topicReferenceWasUsedInCurrentContext()) {
      this.raise(start, _error.Errors.PipeTopicUnused);
    }

    return body;
  }

  checkExponentialAfterUnary(node) {
    if (this.match(52)) {
      this.raise(node.argument.start, _error.Errors.UnexpectedTokenUnaryExponentiation);
    }
  }

  parseMaybeUnary(refExpressionErrors, sawUnary) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const isAwait = this.isContextual(91);

    if (isAwait && this.isAwaitAllowed()) {
      this.next();
      const expr = this.parseAwait(startPos, startLoc);
      if (!sawUnary) this.checkExponentialAfterUnary(expr);
      return expr;
    }

    const update = this.match(32);
    const node = this.startNode();

    if ((0, _types.tokenIsPrefix)(this.state.type)) {
      node.operator = this.state.value;
      node.prefix = true;

      if (this.match(67)) {
        this.expectPlugin("throwExpressions");
      }

      const isDelete = this.match(84);
      this.next();
      node.argument = this.parseMaybeUnary(null, true);
      this.checkExpressionErrors(refExpressionErrors, true);

      if (this.state.strict && isDelete) {
        const arg = node.argument;

        if (arg.type === "Identifier") {
          this.raise(node.start, _error.Errors.StrictDelete);
        } else if (this.hasPropertyAsPrivateName(arg)) {
          this.raise(node.start, _error.Errors.DeletePrivateField);
        }
      }

      if (!update) {
        if (!sawUnary) this.checkExponentialAfterUnary(node);
        return this.finishNode(node, "UnaryExpression");
      }
    }

    const expr = this.parseUpdate(node, update, refExpressionErrors);

    if (isAwait) {
      const {
        type
      } = this.state;
      const startsExpr = this.hasPlugin("v8intrinsic") ? (0, _types.tokenCanStartExpression)(type) : (0, _types.tokenCanStartExpression)(type) && !this.match(49);

      if (startsExpr && !this.isAmbiguousAwait()) {
        this.raiseOverwrite(startPos, _error.Errors.AwaitNotInAsyncContext);
        return this.parseAwait(startPos, startLoc);
      }
    }

    return expr;
  }

  parseUpdate(node, update, refExpressionErrors) {
    if (update) {
      this.checkLVal(node.argument, "prefix operation");
      return this.finishNode(node, "UpdateExpression");
    }

    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let expr = this.parseExprSubscripts(refExpressionErrors);
    if (this.checkExpressionErrors(refExpressionErrors, false)) return expr;

    while ((0, _types.tokenIsPostfix)(this.state.type) && !this.canInsertSemicolon()) {
      const node = this.startNodeAt(startPos, startLoc);
      node.operator = this.state.value;
      node.prefix = false;
      node.argument = expr;
      this.checkLVal(expr, "postfix operation");
      this.next();
      expr = this.finishNode(node, "UpdateExpression");
    }

    return expr;
  }

  parseExprSubscripts(refExpressionErrors) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprAtom(refExpressionErrors);

    if (this.shouldExitDescending(expr, potentialArrowAt)) {
      return expr;
    }

    return this.parseSubscripts(expr, startPos, startLoc);
  }

  parseSubscripts(base, startPos, startLoc, noCalls) {
    const state = {
      optionalChainMember: false,
      maybeAsyncArrow: this.atPossibleAsyncArrow(base),
      stop: false
    };

    do {
      base = this.parseSubscript(base, startPos, startLoc, noCalls, state);
      state.maybeAsyncArrow = false;
    } while (!state.stop);

    return base;
  }

  parseSubscript(base, startPos, startLoc, noCalls, state) {
    if (!noCalls && this.eat(15)) {
      return this.parseBind(base, startPos, startLoc, noCalls, state);
    } else if (this.match(22)) {
      return this.parseTaggedTemplateExpression(base, startPos, startLoc, state);
    }

    let optional = false;

    if (this.match(18)) {
      if (noCalls && this.lookaheadCharCode() === 40) {
        state.stop = true;
        return base;
      }

      state.optionalChainMember = optional = true;
      this.next();
    }

    if (!noCalls && this.match(10)) {
      return this.parseCoverCallAndAsyncArrowHead(base, startPos, startLoc, state, optional);
    } else {
      const computed = this.eat(0);

      if (computed || optional || this.eat(16)) {
        return this.parseMember(base, startPos, startLoc, state, computed, optional);
      } else {
        state.stop = true;
        return base;
      }
    }
  }

  parseMember(base, startPos, startLoc, state, computed, optional) {
    const node = this.startNodeAt(startPos, startLoc);
    node.object = base;
    node.computed = computed;

    if (computed) {
      node.property = this.parseExpression();
      this.expect(3);
    } else if (this.match(129)) {
      if (base.type === "Super") {
        this.raise(startPos, _error.Errors.SuperPrivateField);
      }

      this.classScope.usePrivateName(this.state.value, this.state.start);
      node.property = this.parsePrivateName();
    } else {
      node.property = this.parseIdentifier(true);
    }

    if (state.optionalChainMember) {
      node.optional = optional;
      return this.finishNode(node, "OptionalMemberExpression");
    } else {
      return this.finishNode(node, "MemberExpression");
    }
  }

  parseBind(base, startPos, startLoc, noCalls, state) {
    const node = this.startNodeAt(startPos, startLoc);
    node.object = base;
    node.callee = this.parseNoCallExpr();
    state.stop = true;
    return this.parseSubscripts(this.finishNode(node, "BindExpression"), startPos, startLoc, noCalls);
  }

  parseCoverCallAndAsyncArrowHead(base, startPos, startLoc, state, optional) {
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    let refExpressionErrors = null;
    this.state.maybeInArrowParameters = true;
    this.next();
    let node = this.startNodeAt(startPos, startLoc);
    node.callee = base;

    if (state.maybeAsyncArrow) {
      this.expressionScope.enter((0, _expressionScope.newAsyncArrowScope)());
      refExpressionErrors = new _util.ExpressionErrors();
    }

    if (state.optionalChainMember) {
      node.optional = optional;
    }

    if (optional) {
      node.arguments = this.parseCallExpressionArguments(11);
    } else {
      node.arguments = this.parseCallExpressionArguments(11, base.type === "Import", base.type !== "Super", node, refExpressionErrors);
    }

    this.finishCallExpression(node, state.optionalChainMember);

    if (state.maybeAsyncArrow && this.shouldParseAsyncArrow() && !optional) {
      state.stop = true;
      this.expressionScope.validateAsPattern();
      this.expressionScope.exit();
      node = this.parseAsyncArrowFromCallExpression(this.startNodeAt(startPos, startLoc), node);
    } else {
      if (state.maybeAsyncArrow) {
        this.checkExpressionErrors(refExpressionErrors, true);
        this.expressionScope.exit();
      }

      this.toReferencedArguments(node);
    }

    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    return node;
  }

  toReferencedArguments(node, isParenthesizedExpr) {
    this.toReferencedListDeep(node.arguments, isParenthesizedExpr);
  }

  parseTaggedTemplateExpression(base, startPos, startLoc, state) {
    const node = this.startNodeAt(startPos, startLoc);
    node.tag = base;
    node.quasi = this.parseTemplate(true);

    if (state.optionalChainMember) {
      this.raise(startPos, _error.Errors.OptionalChainingNoTemplate);
    }

    return this.finishNode(node, "TaggedTemplateExpression");
  }

  atPossibleAsyncArrow(base) {
    return base.type === "Identifier" && base.name === "async" && this.state.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 && base.start === this.state.potentialArrowAt;
  }

  finishCallExpression(node, optional) {
    if (node.callee.type === "Import") {
      if (node.arguments.length === 2) {
        if (process.env.BABEL_8_BREAKING) {
          this.expectPlugin("importAssertions");
        } else {
          if (!this.hasPlugin("moduleAttributes")) {
            this.expectPlugin("importAssertions");
          }
        }
      }

      if (node.arguments.length === 0 || node.arguments.length > 2) {
        this.raise(node.start, _error.Errors.ImportCallArity, this.hasPlugin("importAssertions") || this.hasPlugin("moduleAttributes") ? "one or two arguments" : "one argument");
      } else {
        for (const arg of node.arguments) {
          if (arg.type === "SpreadElement") {
            this.raise(arg.start, _error.Errors.ImportCallSpreadArgument);
          }
        }
      }
    }

    return this.finishNode(node, optional ? "OptionalCallExpression" : "CallExpression");
  }

  parseCallExpressionArguments(close, dynamicImport, allowPlaceholder, nodeForExtra, refExpressionErrors) {
    const elts = [];
    let first = true;
    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.inFSharpPipelineDirectBody = false;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(12);

        if (this.match(close)) {
          if (dynamicImport && !this.hasPlugin("importAssertions") && !this.hasPlugin("moduleAttributes")) {
            this.raise(this.state.lastTokStart, _error.Errors.ImportCallArgumentTrailingComma);
          }

          if (nodeForExtra) {
            this.addExtra(nodeForExtra, "trailingComma", this.state.lastTokStart);
          }

          this.next();
          break;
        }
      }

      elts.push(this.parseExprListItem(false, refExpressionErrors, allowPlaceholder));
    }

    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    return elts;
  }

  shouldParseAsyncArrow() {
    return this.match(19) && !this.canInsertSemicolon();
  }

  parseAsyncArrowFromCallExpression(node, call) {
    var _call$extra;

    this.resetPreviousNodeTrailingComments(call);
    this.expect(19);
    this.parseArrowExpression(node, call.arguments, true, (_call$extra = call.extra) == null ? void 0 : _call$extra.trailingComma);

    if (call.innerComments) {
      (0, _comments.setInnerComments)(node, call.innerComments);
    }

    if (call.callee.trailingComments) {
      (0, _comments.setInnerComments)(node, call.callee.trailingComments);
    }

    return node;
  }

  parseNoCallExpr() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    return this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  }

  parseExprAtom(refExpressionErrors) {
    let node;
    const {
      type
    } = this.state;

    switch (type) {
      case 74:
        return this.parseSuper();

      case 78:
        node = this.startNode();
        this.next();

        if (this.match(16)) {
          return this.parseImportMetaProperty(node);
        }

        if (!this.match(10)) {
          this.raise(this.state.lastTokStart, _error.Errors.UnsupportedImport);
        }

        return this.finishNode(node, "Import");

      case 73:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "ThisExpression");

      case 85:
        {
          return this.parseDo(this.startNode(), false);
        }

      case 51:
      case 29:
        {
          this.readRegexp();
          return this.parseRegExpLiteral(this.state.value);
        }

      case 125:
        return this.parseNumericLiteral(this.state.value);

      case 126:
        return this.parseBigIntLiteral(this.state.value);

      case 127:
        return this.parseDecimalLiteral(this.state.value);

      case 124:
        return this.parseStringLiteral(this.state.value);

      case 79:
        return this.parseNullLiteral();

      case 80:
        return this.parseBooleanLiteral(true);

      case 81:
        return this.parseBooleanLiteral(false);

      case 10:
        {
          const canBeArrow = this.state.potentialArrowAt === this.state.start;
          return this.parseParenAndDistinguishExpression(canBeArrow);
        }

      case 2:
      case 1:
        {
          return this.parseArrayLike(this.state.type === 2 ? 4 : 3, false, true);
        }

      case 0:
        {
          return this.parseArrayLike(3, true, false, refExpressionErrors);
        }

      case 6:
      case 7:
        {
          return this.parseObjectLike(this.state.type === 6 ? 9 : 8, false, true);
        }

      case 5:
        {
          return this.parseObjectLike(8, false, false, refExpressionErrors);
        }

      case 63:
        return this.parseFunctionOrFunctionSent();

      case 24:
        this.parseDecorators();

      case 75:
        node = this.startNode();
        this.takeDecorators(node);
        return this.parseClass(node, false);

      case 72:
        return this.parseNewOrNewTarget();

      case 22:
        return this.parseTemplate(false);

      case 15:
        {
          node = this.startNode();
          this.next();
          node.object = null;
          const callee = node.callee = this.parseNoCallExpr();

          if (callee.type === "MemberExpression") {
            return this.finishNode(node, "BindExpression");
          } else {
            throw this.raise(callee.start, _error.Errors.UnsupportedBind);
          }
        }

      case 129:
        {
          this.raise(this.state.start, _error.Errors.PrivateInExpectedIn, this.state.value);
          return this.parsePrivateName();
        }

      case 31:
        {
          return this.parseTopicReferenceThenEqualsSign(49, "%");
        }

      case 30:
        {
          return this.parseTopicReferenceThenEqualsSign(41, "^");
        }

      case 41:
      case 49:
      case 25:
        {
          const pipeProposal = this.getPluginOption("pipelineOperator", "proposal");

          if (pipeProposal) {
            return this.parseTopicReference(pipeProposal);
          } else {
            throw this.unexpected();
          }
        }

      case 44:
        {
          const lookaheadCh = this.input.codePointAt(this.nextTokenStart());

          if ((0, _identifier.isIdentifierStart)(lookaheadCh) || lookaheadCh === 62) {
            this.expectOnePlugin(["jsx", "flow", "typescript"]);
            break;
          } else {
            throw this.unexpected();
          }
        }

      default:
        if ((0, _types.tokenIsIdentifier)(type)) {
          if (this.isContextual(118) && this.lookaheadCharCode() === 123 && !this.hasFollowingLineBreak()) {
            return this.parseModuleExpression();
          }

          const canBeArrow = this.state.potentialArrowAt === this.state.start;
          const containsEsc = this.state.containsEsc;
          const id = this.parseIdentifier();

          if (!containsEsc && id.name === "async" && !this.canInsertSemicolon()) {
            const {
              type
            } = this.state;

            if (type === 63) {
              this.resetPreviousNodeTrailingComments(id);
              this.next();
              return this.parseFunction(this.startNodeAtNode(id), undefined, true);
            } else if ((0, _types.tokenIsIdentifier)(type)) {
              if (this.lookaheadCharCode() === 61) {
                return this.parseAsyncArrowUnaryFunction(this.startNodeAtNode(id));
              } else {
                return id;
              }
            } else if (type === 85) {
              this.resetPreviousNodeTrailingComments(id);
              return this.parseDo(this.startNodeAtNode(id), true);
            }
          }

          if (canBeArrow && this.match(19) && !this.canInsertSemicolon()) {
            this.next();
            return this.parseArrowExpression(this.startNodeAtNode(id), [id], false);
          }

          return id;
        } else {
          throw this.unexpected();
        }

    }
  }

  parseTopicReferenceThenEqualsSign(topicTokenType, topicTokenValue) {
    const pipeProposal = this.getPluginOption("pipelineOperator", "proposal");

    if (pipeProposal) {
      this.state.type = topicTokenType;
      this.state.value = topicTokenValue;
      this.state.pos--;
      this.state.end--;
      this.state.endLoc.column--;
      return this.parseTopicReference(pipeProposal);
    } else {
      throw this.unexpected();
    }
  }

  parseTopicReference(pipeProposal) {
    const node = this.startNode();
    const start = this.state.start;
    const tokenType = this.state.type;
    this.next();
    return this.finishTopicReference(node, start, pipeProposal, tokenType);
  }

  finishTopicReference(node, start, pipeProposal, tokenType) {
    if (this.testTopicReferenceConfiguration(pipeProposal, start, tokenType)) {
      let nodeType;

      if (pipeProposal === "smart") {
        nodeType = "PipelinePrimaryTopicReference";
      } else {
        nodeType = "TopicReference";
      }

      if (!this.topicReferenceIsAllowedInCurrentContext()) {
        if (pipeProposal === "smart") {
          this.raise(start, _error.Errors.PrimaryTopicNotAllowed);
        } else {
          this.raise(start, _error.Errors.PipeTopicUnbound);
        }
      }

      this.registerTopicReference();
      return this.finishNode(node, nodeType);
    } else {
      throw this.raise(start, _error.Errors.PipeTopicUnconfiguredToken, (0, _types.tokenLabelName)(tokenType));
    }
  }

  testTopicReferenceConfiguration(pipeProposal, start, tokenType) {
    switch (pipeProposal) {
      case "hack":
        {
          return this.hasPlugin(["pipelineOperator", {
            topicToken: (0, _types.tokenLabelName)(tokenType)
          }]);
        }

      case "smart":
        return tokenType === 25;

      default:
        throw this.raise(start, _error.Errors.PipeTopicRequiresHackPipes);
    }
  }

  parseAsyncArrowUnaryFunction(node) {
    this.prodParam.enter((0, _productionParameter.functionFlags)(true, this.prodParam.hasYield));
    const params = [this.parseIdentifier()];
    this.prodParam.exit();

    if (this.hasPrecedingLineBreak()) {
      this.raise(this.state.pos, _error.Errors.LineTerminatorBeforeArrow);
    }

    this.expect(19);
    this.parseArrowExpression(node, params, true);
    return node;
  }

  parseDo(node, isAsync) {
    this.expectPlugin("doExpressions");

    if (isAsync) {
      this.expectPlugin("asyncDoExpressions");
    }

    node.async = isAsync;
    this.next();
    const oldLabels = this.state.labels;
    this.state.labels = [];

    if (isAsync) {
      this.prodParam.enter(_productionParameter.PARAM_AWAIT);
      node.body = this.parseBlock();
      this.prodParam.exit();
    } else {
      node.body = this.parseBlock();
    }

    this.state.labels = oldLabels;
    return this.finishNode(node, "DoExpression");
  }

  parseSuper() {
    const node = this.startNode();
    this.next();

    if (this.match(10) && !this.scope.allowDirectSuper && !this.options.allowSuperOutsideMethod) {
      this.raise(node.start, _error.Errors.SuperNotAllowed);
    } else if (!this.scope.allowSuper && !this.options.allowSuperOutsideMethod) {
      this.raise(node.start, _error.Errors.UnexpectedSuper);
    }

    if (!this.match(10) && !this.match(0) && !this.match(16)) {
      this.raise(node.start, _error.Errors.UnsupportedSuper);
    }

    return this.finishNode(node, "Super");
  }

  parsePrivateName() {
    const node = this.startNode();
    const id = this.startNodeAt(this.state.start + 1, new _location.Position(this.state.curLine, this.state.start + 1 - this.state.lineStart));
    const name = this.state.value;
    this.next();
    node.id = this.createIdentifier(id, name);
    return this.finishNode(node, "PrivateName");
  }

  parseFunctionOrFunctionSent() {
    const node = this.startNode();
    this.next();

    if (this.prodParam.hasYield && this.match(16)) {
      const meta = this.createIdentifier(this.startNodeAtNode(node), "function");
      this.next();

      if (this.match(97)) {
        this.expectPlugin("functionSent");
      } else if (!this.hasPlugin("functionSent")) {
        this.unexpected();
      }

      return this.parseMetaProperty(node, meta, "sent");
    }

    return this.parseFunction(node);
  }

  parseMetaProperty(node, meta, propertyName) {
    node.meta = meta;
    const containsEsc = this.state.containsEsc;
    node.property = this.parseIdentifier(true);

    if (node.property.name !== propertyName || containsEsc) {
      this.raise(node.property.start, _error.Errors.UnsupportedMetaProperty, meta.name, propertyName);
    }

    return this.finishNode(node, "MetaProperty");
  }

  parseImportMetaProperty(node) {
    const id = this.createIdentifier(this.startNodeAtNode(node), "import");
    this.next();

    if (this.isContextual(95)) {
      if (!this.inModule) {
        this.raise(id.start, _error.SourceTypeModuleErrors.ImportMetaOutsideModule);
      }

      this.sawUnambiguousESM = true;
    }

    return this.parseMetaProperty(node, id, "meta");
  }

  parseLiteralAtNode(value, type, node) {
    this.addExtra(node, "rawValue", value);
    this.addExtra(node, "raw", this.input.slice(node.start, this.state.end));
    node.value = value;
    this.next();
    return this.finishNode(node, type);
  }

  parseLiteral(value, type) {
    const node = this.startNode();
    return this.parseLiteralAtNode(value, type, node);
  }

  parseStringLiteral(value) {
    return this.parseLiteral(value, "StringLiteral");
  }

  parseNumericLiteral(value) {
    return this.parseLiteral(value, "NumericLiteral");
  }

  parseBigIntLiteral(value) {
    return this.parseLiteral(value, "BigIntLiteral");
  }

  parseDecimalLiteral(value) {
    return this.parseLiteral(value, "DecimalLiteral");
  }

  parseRegExpLiteral(value) {
    const node = this.parseLiteral(value.value, "RegExpLiteral");
    node.pattern = value.pattern;
    node.flags = value.flags;
    return node;
  }

  parseBooleanLiteral(value) {
    const node = this.startNode();
    node.value = value;
    this.next();
    return this.finishNode(node, "BooleanLiteral");
  }

  parseNullLiteral() {
    const node = this.startNode();
    this.next();
    return this.finishNode(node, "NullLiteral");
  }

  parseParenAndDistinguishExpression(canBeArrow) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let val;
    this.next();
    this.expressionScope.enter((0, _expressionScope.newArrowHeadScope)());
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.maybeInArrowParameters = true;
    this.state.inFSharpPipelineDirectBody = false;
    const innerStartPos = this.state.start;
    const innerStartLoc = this.state.startLoc;
    const exprList = [];
    const refExpressionErrors = new _util.ExpressionErrors();
    let first = true;
    let spreadStart;
    let optionalCommaStart;

    while (!this.match(11)) {
      if (first) {
        first = false;
      } else {
        this.expect(12, refExpressionErrors.optionalParameters === -1 ? null : refExpressionErrors.optionalParameters);

        if (this.match(11)) {
          optionalCommaStart = this.state.start;
          break;
        }
      }

      if (this.match(21)) {
        const spreadNodeStartPos = this.state.start;
        const spreadNodeStartLoc = this.state.startLoc;
        spreadStart = this.state.start;
        exprList.push(this.parseParenItem(this.parseRestBinding(), spreadNodeStartPos, spreadNodeStartLoc));
        this.checkCommaAfterRest(41);
        break;
      } else {
        exprList.push(this.parseMaybeAssignAllowIn(refExpressionErrors, this.parseParenItem));
      }
    }

    const innerEndPos = this.state.lastTokEnd;
    const innerEndLoc = this.state.lastTokEndLoc;
    this.expect(11);
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    let arrowNode = this.startNodeAt(startPos, startLoc);

    if (canBeArrow && this.shouldParseArrow(exprList) && (arrowNode = this.parseArrow(arrowNode))) {
      this.expressionScope.validateAsPattern();
      this.expressionScope.exit();
      this.parseArrowExpression(arrowNode, exprList, false);
      return arrowNode;
    }

    this.expressionScope.exit();

    if (!exprList.length) {
      this.unexpected(this.state.lastTokStart);
    }

    if (optionalCommaStart) this.unexpected(optionalCommaStart);
    if (spreadStart) this.unexpected(spreadStart);
    this.checkExpressionErrors(refExpressionErrors, true);
    this.toReferencedListDeep(exprList, true);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNode(val, "SequenceExpression");
      this.resetEndLocation(val, innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }

    if (!this.options.createParenthesizedExpressions) {
      this.addExtra(val, "parenthesized", true);
      this.addExtra(val, "parenStart", startPos);
      this.takeSurroundingComments(val, startPos, this.state.lastTokEnd);
      return val;
    }

    const parenExpression = this.startNodeAt(startPos, startLoc);
    parenExpression.expression = val;
    this.finishNode(parenExpression, "ParenthesizedExpression");
    return parenExpression;
  }

  shouldParseArrow(params) {
    return !this.canInsertSemicolon();
  }

  parseArrow(node) {
    if (this.eat(19)) {
      return node;
    }
  }

  parseParenItem(node, startPos, startLoc) {
    return node;
  }

  parseNewOrNewTarget() {
    const node = this.startNode();
    this.next();

    if (this.match(16)) {
      const meta = this.createIdentifier(this.startNodeAtNode(node), "new");
      this.next();
      const metaProp = this.parseMetaProperty(node, meta, "target");

      if (!this.scope.inNonArrowFunction && !this.scope.inClass) {
        this.raise(metaProp.start, _error.Errors.UnexpectedNewTarget);
      }

      return metaProp;
    }

    return this.parseNew(node);
  }

  parseNew(node) {
    node.callee = this.parseNoCallExpr();

    if (node.callee.type === "Import") {
      this.raise(node.callee.start, _error.Errors.ImportCallNotNewExpression);
    } else if (this.isOptionalChain(node.callee)) {
      this.raise(this.state.lastTokEnd, _error.Errors.OptionalChainingNoNew);
    } else if (this.eat(18)) {
      this.raise(this.state.start, _error.Errors.OptionalChainingNoNew);
    }

    this.parseNewArguments(node);
    return this.finishNode(node, "NewExpression");
  }

  parseNewArguments(node) {
    if (this.eat(10)) {
      const args = this.parseExprList(11);
      this.toReferencedList(args);
      node.arguments = args;
    } else {
      node.arguments = [];
    }
  }

  parseTemplateElement(isTagged) {
    const elem = this.startNode();

    if (this.state.value === null) {
      if (!isTagged) {
        this.raise(this.state.start + 1, _error.Errors.InvalidEscapeSequenceTemplate);
      }
    }

    elem.value = {
      raw: this.input.slice(this.state.start, this.state.end).replace(/\r\n?/g, "\n"),
      cooked: this.state.value
    };
    this.next();
    elem.tail = this.match(22);
    return this.finishNode(elem, "TemplateElement");
  }

  parseTemplate(isTagged) {
    const node = this.startNode();
    this.next();
    node.expressions = [];
    let curElt = this.parseTemplateElement(isTagged);
    node.quasis = [curElt];

    while (!curElt.tail) {
      this.expect(23);
      node.expressions.push(this.parseTemplateSubstitution());
      this.expect(8);
      node.quasis.push(curElt = this.parseTemplateElement(isTagged));
    }

    this.next();
    return this.finishNode(node, "TemplateLiteral");
  }

  parseTemplateSubstitution() {
    return this.parseExpression();
  }

  parseObjectLike(close, isPattern, isRecord, refExpressionErrors) {
    if (isRecord) {
      this.expectPlugin("recordAndTuple");
    }

    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.inFSharpPipelineDirectBody = false;
    const propHash = Object.create(null);
    let first = true;
    const node = this.startNode();
    node.properties = [];
    this.next();

    while (!this.match(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(12);

        if (this.match(close)) {
          this.addExtra(node, "trailingComma", this.state.lastTokStart);
          break;
        }
      }

      let prop;

      if (isPattern) {
        prop = this.parseBindingProperty();
      } else {
        prop = this.parsePropertyDefinition(refExpressionErrors);
        this.checkProto(prop, isRecord, propHash, refExpressionErrors);
      }

      if (isRecord && !this.isObjectProperty(prop) && prop.type !== "SpreadElement") {
        this.raise(prop.start, _error.Errors.InvalidRecordProperty);
      }

      if (prop.shorthand) {
        this.addExtra(prop, "shorthand", true);
      }

      node.properties.push(prop);
    }

    this.next();
    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    let type = "ObjectExpression";

    if (isPattern) {
      type = "ObjectPattern";
    } else if (isRecord) {
      type = "RecordExpression";
    }

    return this.finishNode(node, type);
  }

  maybeAsyncOrAccessorProp(prop) {
    return !prop.computed && prop.key.type === "Identifier" && (this.isLiteralPropertyName() || this.match(0) || this.match(50));
  }

  parsePropertyDefinition(refExpressionErrors) {
    let decorators = [];

    if (this.match(24)) {
      if (this.hasPlugin("decorators")) {
        this.raise(this.state.start, _error.Errors.UnsupportedPropertyDecorator);
      }

      while (this.match(24)) {
        decorators.push(this.parseDecorator());
      }
    }

    const prop = this.startNode();
    let isAsync = false;
    let isAccessor = false;
    let startPos;
    let startLoc;

    if (this.match(21)) {
      if (decorators.length) this.unexpected();
      return this.parseSpread();
    }

    if (decorators.length) {
      prop.decorators = decorators;
      decorators = [];
    }

    prop.method = false;

    if (refExpressionErrors) {
      startPos = this.state.start;
      startLoc = this.state.startLoc;
    }

    let isGenerator = this.eat(50);
    this.parsePropertyNamePrefixOperator(prop);
    const containsEsc = this.state.containsEsc;
    const key = this.parsePropertyName(prop);

    if (!isGenerator && !containsEsc && this.maybeAsyncOrAccessorProp(prop)) {
      const keyName = key.name;

      if (keyName === "async" && !this.hasPrecedingLineBreak()) {
        isAsync = true;
        this.resetPreviousNodeTrailingComments(key);
        isGenerator = this.eat(50);
        this.parsePropertyName(prop);
      }

      if (keyName === "get" || keyName === "set") {
        isAccessor = true;
        this.resetPreviousNodeTrailingComments(key);
        prop.kind = keyName;

        if (this.match(50)) {
          isGenerator = true;
          this.raise(this.state.pos, _error.Errors.AccessorIsGenerator, keyName);
          this.next();
        }

        this.parsePropertyName(prop);
      }
    }

    this.parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, false, isAccessor, refExpressionErrors);
    return prop;
  }

  getGetterSetterExpectedParamCount(method) {
    return method.kind === "get" ? 0 : 1;
  }

  getObjectOrClassMethodParams(method) {
    return method.params;
  }

  checkGetterSetterParams(method) {
    var _params;

    const paramCount = this.getGetterSetterExpectedParamCount(method);
    const params = this.getObjectOrClassMethodParams(method);
    const start = method.start;

    if (params.length !== paramCount) {
      if (method.kind === "get") {
        this.raise(start, _error.Errors.BadGetterArity);
      } else {
        this.raise(start, _error.Errors.BadSetterArity);
      }
    }

    if (method.kind === "set" && ((_params = params[params.length - 1]) == null ? void 0 : _params.type) === "RestElement") {
      this.raise(start, _error.Errors.BadSetterRestParameter);
    }
  }

  parseObjectMethod(prop, isGenerator, isAsync, isPattern, isAccessor) {
    if (isAccessor) {
      this.parseMethod(prop, isGenerator, false, false, false, "ObjectMethod");
      this.checkGetterSetterParams(prop);
      return prop;
    }

    if (isAsync || isGenerator || this.match(10)) {
      if (isPattern) this.unexpected();
      prop.kind = "method";
      prop.method = true;
      return this.parseMethod(prop, isGenerator, isAsync, false, false, "ObjectMethod");
    }
  }

  parseObjectProperty(prop, startPos, startLoc, isPattern, refExpressionErrors) {
    prop.shorthand = false;

    if (this.eat(14)) {
      prop.value = isPattern ? this.parseMaybeDefault(this.state.start, this.state.startLoc) : this.parseMaybeAssignAllowIn(refExpressionErrors);
      return this.finishNode(prop, "ObjectProperty");
    }

    if (!prop.computed && prop.key.type === "Identifier") {
      this.checkReservedWord(prop.key.name, prop.key.start, true, false);

      if (isPattern) {
        prop.value = this.parseMaybeDefault(startPos, startLoc, (0, _node.cloneIdentifier)(prop.key));
      } else if (this.match(27)) {
        const shorthandAssign = this.state.start;

        if (refExpressionErrors != null) {
          if (refExpressionErrors.shorthandAssign === -1) {
            refExpressionErrors.shorthandAssign = shorthandAssign;
          }
        } else {
          this.raise(shorthandAssign, _error.Errors.InvalidCoverInitializedName);
        }

        prop.value = this.parseMaybeDefault(startPos, startLoc, (0, _node.cloneIdentifier)(prop.key));
      } else {
        prop.value = (0, _node.cloneIdentifier)(prop.key);
      }

      prop.shorthand = true;
      return this.finishNode(prop, "ObjectProperty");
    }
  }

  parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, isAccessor, refExpressionErrors) {
    const node = this.parseObjectMethod(prop, isGenerator, isAsync, isPattern, isAccessor) || this.parseObjectProperty(prop, startPos, startLoc, isPattern, refExpressionErrors);
    if (!node) this.unexpected();
    return node;
  }

  parsePropertyName(prop) {
    if (this.eat(0)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssignAllowIn();
      this.expect(3);
    } else {
      const {
        type,
        value
      } = this.state;
      let key;

      if ((0, _types.tokenIsKeywordOrIdentifier)(type)) {
        key = this.parseIdentifier(true);
      } else {
        switch (type) {
          case 125:
            key = this.parseNumericLiteral(value);
            break;

          case 124:
            key = this.parseStringLiteral(value);
            break;

          case 126:
            key = this.parseBigIntLiteral(value);
            break;

          case 127:
            key = this.parseDecimalLiteral(value);
            break;

          case 129:
            {
              const privateKeyPos = this.state.start + 1;
              this.raise(privateKeyPos, _error.Errors.UnexpectedPrivateField);
              key = this.parsePrivateName();
              break;
            }

          default:
            throw this.unexpected();
        }
      }

      prop.key = key;

      if (type !== 129) {
        prop.computed = false;
      }
    }

    return prop.key;
  }

  initFunction(node, isAsync) {
    node.id = null;
    node.generator = false;
    node.async = !!isAsync;
  }

  parseMethod(node, isGenerator, isAsync, isConstructor, allowDirectSuper, type, inClassScope = false) {
    this.initFunction(node, isAsync);
    node.generator = !!isGenerator;
    const allowModifiers = isConstructor;
    this.scope.enter(_scopeflags.SCOPE_FUNCTION | _scopeflags.SCOPE_SUPER | (inClassScope ? _scopeflags.SCOPE_CLASS : 0) | (allowDirectSuper ? _scopeflags.SCOPE_DIRECT_SUPER : 0));
    this.prodParam.enter((0, _productionParameter.functionFlags)(isAsync, node.generator));
    this.parseFunctionParams(node, allowModifiers);
    this.parseFunctionBodyAndFinish(node, type, true);
    this.prodParam.exit();
    this.scope.exit();
    return node;
  }

  parseArrayLike(close, canBePattern, isTuple, refExpressionErrors) {
    if (isTuple) {
      this.expectPlugin("recordAndTuple");
    }

    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.inFSharpPipelineDirectBody = false;
    const node = this.startNode();
    this.next();
    node.elements = this.parseExprList(close, !isTuple, refExpressionErrors, node);
    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    return this.finishNode(node, isTuple ? "TupleExpression" : "ArrayExpression");
  }

  parseArrowExpression(node, params, isAsync, trailingCommaPos) {
    this.scope.enter(_scopeflags.SCOPE_FUNCTION | _scopeflags.SCOPE_ARROW);
    let flags = (0, _productionParameter.functionFlags)(isAsync, false);

    if (!this.match(0) && this.prodParam.hasIn) {
      flags |= _productionParameter.PARAM_IN;
    }

    this.prodParam.enter(flags);
    this.initFunction(node, isAsync);
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;

    if (params) {
      this.state.maybeInArrowParameters = true;
      this.setArrowFunctionParameters(node, params, trailingCommaPos);
    }

    this.state.maybeInArrowParameters = false;
    this.parseFunctionBody(node, true);
    this.prodParam.exit();
    this.scope.exit();
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    return this.finishNode(node, "ArrowFunctionExpression");
  }

  setArrowFunctionParameters(node, params, trailingCommaPos) {
    node.params = this.toAssignableList(params, trailingCommaPos, false);
  }

  parseFunctionBodyAndFinish(node, type, isMethod = false) {
    this.parseFunctionBody(node, false, isMethod);
    this.finishNode(node, type);
  }

  parseFunctionBody(node, allowExpression, isMethod = false) {
    const isExpression = allowExpression && !this.match(5);
    this.expressionScope.enter((0, _expressionScope.newExpressionScope)());

    if (isExpression) {
      node.body = this.parseMaybeAssign();
      this.checkParams(node, false, allowExpression, false);
    } else {
      const oldStrict = this.state.strict;
      const oldLabels = this.state.labels;
      this.state.labels = [];
      this.prodParam.enter(this.prodParam.currentFlags() | _productionParameter.PARAM_RETURN);
      node.body = this.parseBlock(true, false, hasStrictModeDirective => {
        const nonSimple = !this.isSimpleParamList(node.params);

        if (hasStrictModeDirective && nonSimple) {
          const errorPos = (node.kind === "method" || node.kind === "constructor") && !!node.key ? node.key.end : node.start;
          this.raise(errorPos, _error.Errors.IllegalLanguageModeDirective);
        }

        const strictModeChanged = !oldStrict && this.state.strict;
        this.checkParams(node, !this.state.strict && !allowExpression && !isMethod && !nonSimple, allowExpression, strictModeChanged);

        if (this.state.strict && node.id) {
          this.checkLVal(node.id, "function name", _scopeflags.BIND_OUTSIDE, undefined, undefined, strictModeChanged);
        }
      });
      this.prodParam.exit();
      this.state.labels = oldLabels;
    }

    this.expressionScope.exit();
  }

  isSimpleParamList(params) {
    for (let i = 0, len = params.length; i < len; i++) {
      if (params[i].type !== "Identifier") return false;
    }

    return true;
  }

  checkParams(node, allowDuplicates, isArrowFunction, strictModeChanged = true) {
    const checkClashes = new Set();

    for (const param of node.params) {
      this.checkLVal(param, "function parameter list", _scopeflags.BIND_VAR, allowDuplicates ? null : checkClashes, undefined, strictModeChanged);
    }
  }

  parseExprList(close, allowEmpty, refExpressionErrors, nodeForExtra) {
    const elts = [];
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(12);

        if (this.match(close)) {
          if (nodeForExtra) {
            this.addExtra(nodeForExtra, "trailingComma", this.state.lastTokStart);
          }

          this.next();
          break;
        }
      }

      elts.push(this.parseExprListItem(allowEmpty, refExpressionErrors));
    }

    return elts;
  }

  parseExprListItem(allowEmpty, refExpressionErrors, allowPlaceholder) {
    let elt;

    if (this.match(12)) {
      if (!allowEmpty) {
        this.raise(this.state.pos, _error.Errors.UnexpectedToken, ",");
      }

      elt = null;
    } else if (this.match(21)) {
      const spreadNodeStartPos = this.state.start;
      const spreadNodeStartLoc = this.state.startLoc;
      elt = this.parseParenItem(this.parseSpread(refExpressionErrors), spreadNodeStartPos, spreadNodeStartLoc);
    } else if (this.match(17)) {
      this.expectPlugin("partialApplication");

      if (!allowPlaceholder) {
        this.raise(this.state.start, _error.Errors.UnexpectedArgumentPlaceholder);
      }

      const node = this.startNode();
      this.next();
      elt = this.finishNode(node, "ArgumentPlaceholder");
    } else {
      elt = this.parseMaybeAssignAllowIn(refExpressionErrors, this.parseParenItem);
    }

    return elt;
  }

  parseIdentifier(liberal) {
    const node = this.startNode();
    const name = this.parseIdentifierName(node.start, liberal);
    return this.createIdentifier(node, name);
  }

  createIdentifier(node, name) {
    node.name = name;
    node.loc.identifierName = name;
    return this.finishNode(node, "Identifier");
  }

  parseIdentifierName(pos, liberal) {
    let name;
    const {
      start,
      type
    } = this.state;

    if ((0, _types.tokenIsKeywordOrIdentifier)(type)) {
      name = this.state.value;
    } else {
      throw this.unexpected();
    }

    const tokenIsKeyword = (0, _types.tokenKeywordOrIdentifierIsKeyword)(type);

    if (liberal) {
      if (tokenIsKeyword) {
        this.replaceToken(123);
      }
    } else {
      this.checkReservedWord(name, start, tokenIsKeyword, false);
    }

    this.next();
    return name;
  }

  checkReservedWord(word, startLoc, checkKeywords, isBinding) {
    if (word.length > 10) {
      return;
    }

    if (!(0, _identifier.canBeReservedWord)(word)) {
      return;
    }

    if (word === "yield") {
      if (this.prodParam.hasYield) {
        this.raise(startLoc, _error.Errors.YieldBindingIdentifier);
        return;
      }
    } else if (word === "await") {
      if (this.prodParam.hasAwait) {
        this.raise(startLoc, _error.Errors.AwaitBindingIdentifier);
        return;
      } else if (this.scope.inStaticBlock) {
        this.raise(startLoc, _error.Errors.AwaitBindingIdentifierInStaticBlock);
        return;
      } else {
        this.expressionScope.recordAsyncArrowParametersError(startLoc, _error.Errors.AwaitBindingIdentifier);
      }
    } else if (word === "arguments") {
      if (this.scope.inClassAndNotInNonArrowFunction) {
        this.raise(startLoc, _error.Errors.ArgumentsInClass);
        return;
      }
    }

    if (checkKeywords && (0, _identifier.isKeyword)(word)) {
      this.raise(startLoc, _error.Errors.UnexpectedKeyword, word);
      return;
    }

    const reservedTest = !this.state.strict ? _identifier.isReservedWord : isBinding ? _identifier.isStrictBindReservedWord : _identifier.isStrictReservedWord;

    if (reservedTest(word, this.inModule)) {
      this.raise(startLoc, _error.Errors.UnexpectedReservedWord, word);
    }
  }

  isAwaitAllowed() {
    if (this.prodParam.hasAwait) return true;

    if (this.options.allowAwaitOutsideFunction && !this.scope.inFunction) {
      return true;
    }

    return false;
  }

  parseAwait(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);
    this.expressionScope.recordParameterInitializerError(node.start, _error.Errors.AwaitExpressionFormalParameter);

    if (this.eat(50)) {
      this.raise(node.start, _error.Errors.ObsoleteAwaitStar);
    }

    if (!this.scope.inFunction && !this.options.allowAwaitOutsideFunction) {
      if (this.isAmbiguousAwait()) {
        this.ambiguousScriptDifferentAst = true;
      } else {
        this.sawUnambiguousESM = true;
      }
    }

    if (!this.state.soloAwait) {
      node.argument = this.parseMaybeUnary(null, true);
    }

    return this.finishNode(node, "AwaitExpression");
  }

  isAmbiguousAwait() {
    return this.hasPrecedingLineBreak() || this.match(48) || this.match(10) || this.match(0) || this.match(22) || this.match(128) || this.match(51) || this.hasPlugin("v8intrinsic") && this.match(49);
  }

  parseYield() {
    const node = this.startNode();
    this.expressionScope.recordParameterInitializerError(node.start, _error.Errors.YieldInParameter);
    this.next();
    let delegating = false;
    let argument = null;

    if (!this.hasPrecedingLineBreak()) {
      delegating = this.eat(50);

      switch (this.state.type) {
        case 13:
        case 130:
        case 8:
        case 11:
        case 3:
        case 9:
        case 14:
        case 12:
          if (!delegating) break;

        default:
          argument = this.parseMaybeAssign();
      }
    }

    node.delegate = delegating;
    node.argument = argument;
    return this.finishNode(node, "YieldExpression");
  }

  checkPipelineAtInfixOperator(left, leftStartPos) {
    if (this.hasPlugin(["pipelineOperator", {
      proposal: "smart"
    }])) {
      if (left.type === "SequenceExpression") {
        this.raise(leftStartPos, _error.Errors.PipelineHeadSequenceExpression);
      }
    }
  }

  checkHackPipeBodyEarlyErrors(startPos) {
    if (!this.topicReferenceWasUsedInCurrentContext()) {
      this.raise(startPos, _error.Errors.PipeTopicUnused);
    }
  }

  parseSmartPipelineBodyInStyle(childExpr, startPos, startLoc) {
    const bodyNode = this.startNodeAt(startPos, startLoc);

    if (this.isSimpleReference(childExpr)) {
      bodyNode.callee = childExpr;
      return this.finishNode(bodyNode, "PipelineBareFunction");
    } else {
      this.checkSmartPipeTopicBodyEarlyErrors(startPos);
      bodyNode.expression = childExpr;
      return this.finishNode(bodyNode, "PipelineTopicExpression");
    }
  }

  isSimpleReference(expression) {
    switch (expression.type) {
      case "MemberExpression":
        return !expression.computed && this.isSimpleReference(expression.object);

      case "Identifier":
        return true;

      default:
        return false;
    }
  }

  checkSmartPipeTopicBodyEarlyErrors(startPos) {
    if (this.match(19)) {
      throw this.raise(this.state.start, _error.Errors.PipelineBodyNoArrow);
    } else if (!this.topicReferenceWasUsedInCurrentContext()) {
      this.raise(startPos, _error.Errors.PipelineTopicUnused);
    }
  }

  withTopicBindingContext(callback) {
    const outerContextTopicState = this.state.topicContext;
    this.state.topicContext = {
      maxNumOfResolvableTopics: 1,
      maxTopicIndex: null
    };

    try {
      return callback();
    } finally {
      this.state.topicContext = outerContextTopicState;
    }
  }

  withSmartMixTopicForbiddingContext(callback) {
    if (this.hasPlugin(["pipelineOperator", {
      proposal: "smart"
    }])) {
      const outerContextTopicState = this.state.topicContext;
      this.state.topicContext = {
        maxNumOfResolvableTopics: 0,
        maxTopicIndex: null
      };

      try {
        return callback();
      } finally {
        this.state.topicContext = outerContextTopicState;
      }
    } else {
      return callback();
    }
  }

  withSoloAwaitPermittingContext(callback) {
    const outerContextSoloAwaitState = this.state.soloAwait;
    this.state.soloAwait = true;

    try {
      return callback();
    } finally {
      this.state.soloAwait = outerContextSoloAwaitState;
    }
  }

  allowInAnd(callback) {
    const flags = this.prodParam.currentFlags();
    const prodParamToSet = _productionParameter.PARAM_IN & ~flags;

    if (prodParamToSet) {
      this.prodParam.enter(flags | _productionParameter.PARAM_IN);

      try {
        return callback();
      } finally {
        this.prodParam.exit();
      }
    }

    return callback();
  }

  disallowInAnd(callback) {
    const flags = this.prodParam.currentFlags();
    const prodParamToClear = _productionParameter.PARAM_IN & flags;

    if (prodParamToClear) {
      this.prodParam.enter(flags & ~_productionParameter.PARAM_IN);

      try {
        return callback();
      } finally {
        this.prodParam.exit();
      }
    }

    return callback();
  }

  registerTopicReference() {
    this.state.topicContext.maxTopicIndex = 0;
  }

  topicReferenceIsAllowedInCurrentContext() {
    return this.state.topicContext.maxNumOfResolvableTopics >= 1;
  }

  topicReferenceWasUsedInCurrentContext() {
    return this.state.topicContext.maxTopicIndex != null && this.state.topicContext.maxTopicIndex >= 0;
  }

  parseFSharpPipelineBody(prec) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    this.state.potentialArrowAt = this.state.start;
    const oldInFSharpPipelineDirectBody = this.state.inFSharpPipelineDirectBody;
    this.state.inFSharpPipelineDirectBody = true;
    const ret = this.parseExprOp(this.parseMaybeUnaryOrPrivate(), startPos, startLoc, prec);
    this.state.inFSharpPipelineDirectBody = oldInFSharpPipelineDirectBody;
    return ret;
  }

  parseModuleExpression() {
    this.expectPlugin("moduleBlocks");
    const node = this.startNode();
    this.next();
    this.eat(5);
    const revertScopes = this.initializeScopes(true);
    this.enterInitialScopes();
    const program = this.startNode();

    try {
      node.body = this.parseProgram(program, 8, "module");
    } finally {
      revertScopes();
    }

    this.eat(8);
    return this.finishNode(node, "ModuleExpression");
  }

  parsePropertyNamePrefixOperator(prop) {}

}

exports.default = ExpressionParser;