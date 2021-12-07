"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var N = require("../types");

var _types2 = require("../tokenizer/types");

var _expression = require("./expression");

var _error = require("./error");

var _identifier = require("../util/identifier");

var _whitespace = require("../util/whitespace");

var _scopeflags = require("../util/scopeflags");

var _util = require("./util");

var _productionParameter = require("../util/production-parameter");

var _expressionScope = require("../util/expression-scope");

var _tokenizer = require("../tokenizer");

var _location = require("../util/location");

var _node = require("./node");

const loopLabel = {
  kind: "loop"
},
      switchLabel = {
  kind: "switch"
};
const FUNC_NO_FLAGS = 0b000,
      FUNC_STATEMENT = 0b001,
      FUNC_HANGING_STATEMENT = 0b010,
      FUNC_NULLABLE_ID = 0b100;
const loneSurrogate = /[\uD800-\uDFFF]/u;
const keywordRelationalOperator = /in(?:stanceof)?/y;

function babel7CompatTokens(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const {
      type
    } = token;

    if (type === 129) {
      if (!process.env.BABEL_8_BREAKING) {
        const {
          loc,
          start,
          value,
          end
        } = token;
        const hashEndPos = start + 1;
        const hashEndLoc = new _location.Position(loc.start.line, loc.start.column + 1);
        tokens.splice(i, 1, new _tokenizer.Token({
          type: (0, _types2.getExportedToken)(25),
          value: "#",
          start: start,
          end: hashEndPos,
          startLoc: loc.start,
          endLoc: hashEndLoc
        }), new _tokenizer.Token({
          type: (0, _types2.getExportedToken)(123),
          value: value,
          start: hashEndPos,
          end: end,
          startLoc: hashEndLoc,
          endLoc: loc.end
        }));
        i++;
        continue;
      }
    }

    if (typeof type === "number") {
      token.type = (0, _types2.getExportedToken)(type);
    }
  }

  return tokens;
}

class StatementParser extends _expression.default {
  parseTopLevel(file, program) {
    file.program = this.parseProgram(program);
    file.comments = this.state.comments;
    if (this.options.tokens) file.tokens = babel7CompatTokens(this.tokens);
    return this.finishNode(file, "File");
  }

  parseProgram(program, end = 130, sourceType = this.options.sourceType) {
    program.sourceType = sourceType;
    program.interpreter = this.parseInterpreterDirective();
    this.parseBlockBody(program, true, true, end);

    if (this.inModule && !this.options.allowUndeclaredExports && this.scope.undefinedExports.size > 0) {
      for (const [name] of Array.from(this.scope.undefinedExports)) {
        const pos = this.scope.undefinedExports.get(name);
        this.raise(pos, _error.Errors.ModuleExportUndefined, name);
      }
    }

    return this.finishNode(program, "Program");
  }

  stmtToDirective(stmt) {
    const directive = stmt;
    directive.type = "Directive";
    directive.value = directive.expression;
    delete directive.expression;
    const directiveLiteral = directive.value;
    const expressionValue = directiveLiteral.value;
    const raw = this.input.slice(directiveLiteral.start, directiveLiteral.end);
    const val = directiveLiteral.value = raw.slice(1, -1);
    this.addExtra(directiveLiteral, "raw", raw);
    this.addExtra(directiveLiteral, "rawValue", val);
    this.addExtra(directiveLiteral, "expressionValue", expressionValue);
    directiveLiteral.type = "DirectiveLiteral";
    return directive;
  }

  parseInterpreterDirective() {
    if (!this.match(26)) {
      return null;
    }

    const node = this.startNode();
    node.value = this.state.value;
    this.next();
    return this.finishNode(node, "InterpreterDirective");
  }

  isLet(context) {
    if (!this.isContextual(94)) {
      return false;
    }

    return this.isLetKeyword(context);
  }

  isLetKeyword(context) {
    const next = this.nextTokenStart();
    const nextCh = this.codePointAtPos(next);

    if (nextCh === 92 || nextCh === 91) {
      return true;
    }

    if (context) return false;
    if (nextCh === 123) return true;

    if ((0, _identifier.isIdentifierStart)(nextCh)) {
      keywordRelationalOperator.lastIndex = next;

      if (keywordRelationalOperator.test(this.input)) {
        const endCh = this.codePointAtPos(keywordRelationalOperator.lastIndex);

        if (!(0, _identifier.isIdentifierChar)(endCh) && endCh !== 92) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  parseStatement(context, topLevel) {
    if (this.match(24)) {
      this.parseDecorators(true);
    }

    return this.parseStatementContent(context, topLevel);
  }

  parseStatementContent(context, topLevel) {
    let starttype = this.state.type;
    const node = this.startNode();
    let kind;

    if (this.isLet(context)) {
      starttype = 69;
      kind = "let";
    }

    switch (starttype) {
      case 55:
        return this.parseBreakContinueStatement(node, true);

      case 58:
        return this.parseBreakContinueStatement(node, false);

      case 59:
        return this.parseDebuggerStatement(node);

      case 85:
        return this.parseDoStatement(node);

      case 86:
        return this.parseForStatement(node);

      case 63:
        if (this.lookaheadCharCode() === 46) break;

        if (context) {
          if (this.state.strict) {
            this.raise(this.state.start, _error.Errors.StrictFunction);
          } else if (context !== "if" && context !== "label") {
            this.raise(this.state.start, _error.Errors.SloppyFunction);
          }
        }

        return this.parseFunctionStatement(node, false, !context);

      case 75:
        if (context) this.unexpected();
        return this.parseClass(node, true);

      case 64:
        return this.parseIfStatement(node);

      case 65:
        return this.parseReturnStatement(node);

      case 66:
        return this.parseSwitchStatement(node);

      case 67:
        return this.parseThrowStatement(node);

      case 68:
        return this.parseTryStatement(node);

      case 70:
      case 69:
        kind = kind || this.state.value;

        if (context && kind !== "var") {
          this.raise(this.state.start, _error.Errors.UnexpectedLexicalDeclaration);
        }

        return this.parseVarStatement(node, kind);

      case 87:
        return this.parseWhileStatement(node);

      case 71:
        return this.parseWithStatement(node);

      case 5:
        return this.parseBlock();

      case 13:
        return this.parseEmptyStatement(node);

      case 78:
        {
          const nextTokenCharCode = this.lookaheadCharCode();

          if (nextTokenCharCode === 40 || nextTokenCharCode === 46) {
            break;
          }
        }

      case 77:
        {
          if (!this.options.allowImportExportEverywhere && !topLevel) {
            this.raise(this.state.start, _error.Errors.UnexpectedImportExport);
          }

          this.next();
          let result;

          if (starttype === 78) {
            result = this.parseImport(node);

            if (result.type === "ImportDeclaration" && (!result.importKind || result.importKind === "value")) {
              this.sawUnambiguousESM = true;
            }
          } else {
            result = this.parseExport(node);

            if (result.type === "ExportNamedDeclaration" && (!result.exportKind || result.exportKind === "value") || result.type === "ExportAllDeclaration" && (!result.exportKind || result.exportKind === "value") || result.type === "ExportDefaultDeclaration") {
              this.sawUnambiguousESM = true;
            }
          }

          this.assertModuleNodeAllowed(node);
          return result;
        }

      default:
        {
          if (this.isAsyncFunction()) {
            if (context) {
              this.raise(this.state.start, _error.Errors.AsyncFunctionInSingleStatementContext);
            }

            this.next();
            return this.parseFunctionStatement(node, true, !context);
          }
        }
    }

    const maybeName = this.state.value;
    const expr = this.parseExpression();

    if ((0, _types2.tokenIsIdentifier)(starttype) && expr.type === "Identifier" && this.eat(14)) {
      return this.parseLabeledStatement(node, maybeName, expr, context);
    } else {
      return this.parseExpressionStatement(node, expr);
    }
  }

  assertModuleNodeAllowed(node) {
    if (!this.options.allowImportExportEverywhere && !this.inModule) {
      this.raise(node.start, _error.SourceTypeModuleErrors.ImportOutsideModule);
    }
  }

  takeDecorators(node) {
    const decorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    if (decorators.length) {
      node.decorators = decorators;
      this.resetStartLocationFromNode(node, decorators[0]);
      this.state.decoratorStack[this.state.decoratorStack.length - 1] = [];
    }
  }

  canHaveLeadingDecorator() {
    return this.match(75);
  }

  parseDecorators(allowExport) {
    const currentContextDecorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    while (this.match(24)) {
      const decorator = this.parseDecorator();
      currentContextDecorators.push(decorator);
    }

    if (this.match(77)) {
      if (!allowExport) {
        this.unexpected();
      }

      if (this.hasPlugin("decorators") && !this.getPluginOption("decorators", "decoratorsBeforeExport")) {
        this.raise(this.state.start, _error.Errors.DecoratorExportClass);
      }
    } else if (!this.canHaveLeadingDecorator()) {
      throw this.raise(this.state.start, _error.Errors.UnexpectedLeadingDecorator);
    }
  }

  parseDecorator() {
    this.expectOnePlugin(["decorators-legacy", "decorators"]);
    const node = this.startNode();
    this.next();

    if (this.hasPlugin("decorators")) {
      this.state.decoratorStack.push([]);
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      let expr;

      if (this.eat(10)) {
        expr = this.parseExpression();
        this.expect(11);
      } else {
        expr = this.parseIdentifier(false);

        while (this.eat(16)) {
          const node = this.startNodeAt(startPos, startLoc);
          node.object = expr;
          node.property = this.parseIdentifier(true);
          node.computed = false;
          expr = this.finishNode(node, "MemberExpression");
        }
      }

      node.expression = this.parseMaybeDecoratorArguments(expr);
      this.state.decoratorStack.pop();
    } else {
      node.expression = this.parseExprSubscripts();
    }

    return this.finishNode(node, "Decorator");
  }

  parseMaybeDecoratorArguments(expr) {
    if (this.eat(10)) {
      const node = this.startNodeAtNode(expr);
      node.callee = expr;
      node.arguments = this.parseCallExpressionArguments(11, false);
      this.toReferencedList(node.arguments);
      return this.finishNode(node, "CallExpression");
    }

    return expr;
  }

  parseBreakContinueStatement(node, isBreak) {
    this.next();

    if (this.isLineTerminator()) {
      node.label = null;
    } else {
      node.label = this.parseIdentifier();
      this.semicolon();
    }

    this.verifyBreakContinue(node, isBreak);
    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
  }

  verifyBreakContinue(node, isBreak) {
    let i;

    for (i = 0; i < this.state.labels.length; ++i) {
      const lab = this.state.labels[i];

      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
        if (node.label && isBreak) break;
      }
    }

    if (i === this.state.labels.length) {
      this.raise(node.start, _error.Errors.IllegalBreakContinue, isBreak ? "break" : "continue");
    }
  }

  parseDebuggerStatement(node) {
    this.next();
    this.semicolon();
    return this.finishNode(node, "DebuggerStatement");
  }

  parseHeaderExpression() {
    this.expect(10);
    const val = this.parseExpression();
    this.expect(11);
    return val;
  }

  parseDoStatement(node) {
    this.next();
    this.state.labels.push(loopLabel);
    node.body = this.withSmartMixTopicForbiddingContext(() => this.parseStatement("do"));
    this.state.labels.pop();
    this.expect(87);
    node.test = this.parseHeaderExpression();
    this.eat(13);
    return this.finishNode(node, "DoWhileStatement");
  }

  parseForStatement(node) {
    this.next();
    this.state.labels.push(loopLabel);
    let awaitAt = -1;

    if (this.isAwaitAllowed() && this.eatContextual(91)) {
      awaitAt = this.state.lastTokStart;
    }

    this.scope.enter(_scopeflags.SCOPE_OTHER);
    this.expect(10);

    if (this.match(13)) {
      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }

      return this.parseFor(node, null);
    }

    const startsWithLet = this.isContextual(94);
    const isLet = startsWithLet && this.isLetKeyword();

    if (this.match(69) || this.match(70) || isLet) {
      const init = this.startNode();
      const kind = isLet ? "let" : this.state.value;
      this.next();
      this.parseVar(init, true, kind);
      this.finishNode(init, "VariableDeclaration");

      if ((this.match(53) || this.isContextual(96)) && init.declarations.length === 1) {
        return this.parseForIn(node, init, awaitAt);
      }

      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }

      return this.parseFor(node, init);
    }

    const startsWithAsync = this.isContextual(90);
    const refExpressionErrors = new _util.ExpressionErrors();
    const init = this.parseExpression(true, refExpressionErrors);
    const isForOf = this.isContextual(96);

    if (isForOf) {
      if (startsWithLet) {
        this.raise(init.start, _error.Errors.ForOfLet);
      } else if (awaitAt === -1 && startsWithAsync && init.type === "Identifier") {
        this.raise(init.start, _error.Errors.ForOfAsync);
      }
    }

    if (isForOf || this.match(53)) {
      this.toAssignable(init, true);
      const description = isForOf ? "for-of statement" : "for-in statement";
      this.checkLVal(init, description);
      return this.parseForIn(node, init, awaitAt);
    } else {
      this.checkExpressionErrors(refExpressionErrors, true);
    }

    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }

    return this.parseFor(node, init);
  }

  parseFunctionStatement(node, isAsync, declarationPosition) {
    this.next();
    return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), isAsync);
  }

  parseIfStatement(node) {
    this.next();
    node.test = this.parseHeaderExpression();
    node.consequent = this.parseStatement("if");
    node.alternate = this.eat(61) ? this.parseStatement("if") : null;
    return this.finishNode(node, "IfStatement");
  }

  parseReturnStatement(node) {
    if (!this.prodParam.hasReturn && !this.options.allowReturnOutsideFunction) {
      this.raise(this.state.start, _error.Errors.IllegalReturn);
    }

    this.next();

    if (this.isLineTerminator()) {
      node.argument = null;
    } else {
      node.argument = this.parseExpression();
      this.semicolon();
    }

    return this.finishNode(node, "ReturnStatement");
  }

  parseSwitchStatement(node) {
    this.next();
    node.discriminant = this.parseHeaderExpression();
    const cases = node.cases = [];
    this.expect(5);
    this.state.labels.push(switchLabel);
    this.scope.enter(_scopeflags.SCOPE_OTHER);
    let cur;

    for (let sawDefault; !this.match(8);) {
      if (this.match(56) || this.match(60)) {
        const isCase = this.match(56);
        if (cur) this.finishNode(cur, "SwitchCase");
        cases.push(cur = this.startNode());
        cur.consequent = [];
        this.next();

        if (isCase) {
          cur.test = this.parseExpression();
        } else {
          if (sawDefault) {
            this.raise(this.state.lastTokStart, _error.Errors.MultipleDefaultsInSwitch);
          }

          sawDefault = true;
          cur.test = null;
        }

        this.expect(14);
      } else {
        if (cur) {
          cur.consequent.push(this.parseStatement(null));
        } else {
          this.unexpected();
        }
      }
    }

    this.scope.exit();
    if (cur) this.finishNode(cur, "SwitchCase");
    this.next();
    this.state.labels.pop();
    return this.finishNode(node, "SwitchStatement");
  }

  parseThrowStatement(node) {
    this.next();

    if (this.hasPrecedingLineBreak()) {
      this.raise(this.state.lastTokEnd, _error.Errors.NewlineAfterThrow);
    }

    node.argument = this.parseExpression();
    this.semicolon();
    return this.finishNode(node, "ThrowStatement");
  }

  parseCatchClauseParam() {
    const param = this.parseBindingAtom();
    const simple = param.type === "Identifier";
    this.scope.enter(simple ? _scopeflags.SCOPE_SIMPLE_CATCH : 0);
    this.checkLVal(param, "catch clause", _scopeflags.BIND_LEXICAL);
    return param;
  }

  parseTryStatement(node) {
    this.next();
    node.block = this.parseBlock();
    node.handler = null;

    if (this.match(57)) {
      const clause = this.startNode();
      this.next();

      if (this.match(10)) {
        this.expect(10);
        clause.param = this.parseCatchClauseParam();
        this.expect(11);
      } else {
        clause.param = null;
        this.scope.enter(_scopeflags.SCOPE_OTHER);
      }

      clause.body = this.withSmartMixTopicForbiddingContext(() => this.parseBlock(false, false));
      this.scope.exit();
      node.handler = this.finishNode(clause, "CatchClause");
    }

    node.finalizer = this.eat(62) ? this.parseBlock() : null;

    if (!node.handler && !node.finalizer) {
      this.raise(node.start, _error.Errors.NoCatchOrFinally);
    }

    return this.finishNode(node, "TryStatement");
  }

  parseVarStatement(node, kind) {
    this.next();
    this.parseVar(node, false, kind);
    this.semicolon();
    return this.finishNode(node, "VariableDeclaration");
  }

  parseWhileStatement(node) {
    this.next();
    node.test = this.parseHeaderExpression();
    this.state.labels.push(loopLabel);
    node.body = this.withSmartMixTopicForbiddingContext(() => this.parseStatement("while"));
    this.state.labels.pop();
    return this.finishNode(node, "WhileStatement");
  }

  parseWithStatement(node) {
    if (this.state.strict) {
      this.raise(this.state.start, _error.Errors.StrictWith);
    }

    this.next();
    node.object = this.parseHeaderExpression();
    node.body = this.withSmartMixTopicForbiddingContext(() => this.parseStatement("with"));
    return this.finishNode(node, "WithStatement");
  }

  parseEmptyStatement(node) {
    this.next();
    return this.finishNode(node, "EmptyStatement");
  }

  parseLabeledStatement(node, maybeName, expr, context) {
    for (const label of this.state.labels) {
      if (label.name === maybeName) {
        this.raise(expr.start, _error.Errors.LabelRedeclaration, maybeName);
      }
    }

    const kind = (0, _types2.tokenIsLoop)(this.state.type) ? "loop" : this.match(66) ? "switch" : null;

    for (let i = this.state.labels.length - 1; i >= 0; i--) {
      const label = this.state.labels[i];

      if (label.statementStart === node.start) {
        label.statementStart = this.state.start;
        label.kind = kind;
      } else {
        break;
      }
    }

    this.state.labels.push({
      name: maybeName,
      kind: kind,
      statementStart: this.state.start
    });
    node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
    this.state.labels.pop();
    node.label = expr;
    return this.finishNode(node, "LabeledStatement");
  }

  parseExpressionStatement(node, expr) {
    node.expression = expr;
    this.semicolon();
    return this.finishNode(node, "ExpressionStatement");
  }

  parseBlock(allowDirectives = false, createNewLexicalScope = true, afterBlockParse) {
    const node = this.startNode();

    if (allowDirectives) {
      this.state.strictErrors.clear();
    }

    this.expect(5);

    if (createNewLexicalScope) {
      this.scope.enter(_scopeflags.SCOPE_OTHER);
    }

    this.parseBlockBody(node, allowDirectives, false, 8, afterBlockParse);

    if (createNewLexicalScope) {
      this.scope.exit();
    }

    return this.finishNode(node, "BlockStatement");
  }

  isValidDirective(stmt) {
    return stmt.type === "ExpressionStatement" && stmt.expression.type === "StringLiteral" && !stmt.expression.extra.parenthesized;
  }

  parseBlockBody(node, allowDirectives, topLevel, end, afterBlockParse) {
    const body = node.body = [];
    const directives = node.directives = [];
    this.parseBlockOrModuleBlockBody(body, allowDirectives ? directives : undefined, topLevel, end, afterBlockParse);
  }

  parseBlockOrModuleBlockBody(body, directives, topLevel, end, afterBlockParse) {
    const oldStrict = this.state.strict;
    let hasStrictModeDirective = false;
    let parsedNonDirective = false;

    while (!this.match(end)) {
      const stmt = this.parseStatement(null, topLevel);

      if (directives && !parsedNonDirective) {
        if (this.isValidDirective(stmt)) {
          const directive = this.stmtToDirective(stmt);
          directives.push(directive);

          if (!hasStrictModeDirective && directive.value.value === "use strict") {
            hasStrictModeDirective = true;
            this.setStrict(true);
          }

          continue;
        }

        parsedNonDirective = true;
        this.state.strictErrors.clear();
      }

      body.push(stmt);
    }

    if (afterBlockParse) {
      afterBlockParse.call(this, hasStrictModeDirective);
    }

    if (!oldStrict) {
      this.setStrict(false);
    }

    this.next();
  }

  parseFor(node, init) {
    node.init = init;
    this.semicolon(false);
    node.test = this.match(13) ? null : this.parseExpression();
    this.semicolon(false);
    node.update = this.match(11) ? null : this.parseExpression();
    this.expect(11);
    node.body = this.withSmartMixTopicForbiddingContext(() => this.parseStatement("for"));
    this.scope.exit();
    this.state.labels.pop();
    return this.finishNode(node, "ForStatement");
  }

  parseForIn(node, init, awaitAt) {
    const isForIn = this.match(53);
    this.next();

    if (isForIn) {
      if (awaitAt > -1) this.unexpected(awaitAt);
    } else {
      node.await = awaitAt > -1;
    }

    if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.state.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
      this.raise(init.start, _error.Errors.ForInOfLoopInitializer, isForIn ? "for-in" : "for-of");
    } else if (init.type === "AssignmentPattern") {
      this.raise(init.start, _error.Errors.InvalidLhs, "for-loop");
    }

    node.left = init;
    node.right = isForIn ? this.parseExpression() : this.parseMaybeAssignAllowIn();
    this.expect(11);
    node.body = this.withSmartMixTopicForbiddingContext(() => this.parseStatement("for"));
    this.scope.exit();
    this.state.labels.pop();
    return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
  }

  parseVar(node, isFor, kind) {
    const declarations = node.declarations = [];
    const isTypescript = this.hasPlugin("typescript");
    node.kind = kind;

    for (;;) {
      const decl = this.startNode();
      this.parseVarId(decl, kind);

      if (this.eat(27)) {
        decl.init = isFor ? this.parseMaybeAssignDisallowIn() : this.parseMaybeAssignAllowIn();
      } else {
        if (kind === "const" && !(this.match(53) || this.isContextual(96))) {
          if (!isTypescript) {
            this.raise(this.state.lastTokEnd, _error.Errors.DeclarationMissingInitializer, "Const declarations");
          }
        } else if (decl.id.type !== "Identifier" && !(isFor && (this.match(53) || this.isContextual(96)))) {
          this.raise(this.state.lastTokEnd, _error.Errors.DeclarationMissingInitializer, "Complex binding patterns");
        }

        decl.init = null;
      }

      declarations.push(this.finishNode(decl, "VariableDeclarator"));
      if (!this.eat(12)) break;
    }

    return node;
  }

  parseVarId(decl, kind) {
    decl.id = this.parseBindingAtom();
    this.checkLVal(decl.id, "variable declaration", kind === "var" ? _scopeflags.BIND_VAR : _scopeflags.BIND_LEXICAL, undefined, kind !== "var");
  }

  parseFunction(node, statement = FUNC_NO_FLAGS, isAsync = false) {
    const isStatement = statement & FUNC_STATEMENT;
    const isHangingStatement = statement & FUNC_HANGING_STATEMENT;
    const requireId = !!isStatement && !(statement & FUNC_NULLABLE_ID);
    this.initFunction(node, isAsync);

    if (this.match(50) && isHangingStatement) {
      this.raise(this.state.start, _error.Errors.GeneratorInSingleStatementContext);
    }

    node.generator = this.eat(50);

    if (isStatement) {
      node.id = this.parseFunctionId(requireId);
    }

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    this.state.maybeInArrowParameters = false;
    this.scope.enter(_scopeflags.SCOPE_FUNCTION);
    this.prodParam.enter((0, _productionParameter.functionFlags)(isAsync, node.generator));

    if (!isStatement) {
      node.id = this.parseFunctionId();
    }

    this.parseFunctionParams(node, false);
    this.withSmartMixTopicForbiddingContext(() => {
      this.parseFunctionBodyAndFinish(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
    });
    this.prodParam.exit();
    this.scope.exit();

    if (isStatement && !isHangingStatement) {
      this.registerFunctionStatementId(node);
    }

    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    return node;
  }

  parseFunctionId(requireId) {
    return requireId || (0, _types2.tokenIsIdentifier)(this.state.type) ? this.parseIdentifier() : null;
  }

  parseFunctionParams(node, allowModifiers) {
    this.expect(10);
    this.expressionScope.enter((0, _expressionScope.newParameterDeclarationScope)());
    node.params = this.parseBindingList(11, 41, false, allowModifiers);
    this.expressionScope.exit();
  }

  registerFunctionStatementId(node) {
    if (!node.id) return;
    this.scope.declareName(node.id.name, this.state.strict || node.generator || node.async ? this.scope.treatFunctionsAsVar ? _scopeflags.BIND_VAR : _scopeflags.BIND_LEXICAL : _scopeflags.BIND_FUNCTION, node.id.start);
  }

  parseClass(node, isStatement, optionalId) {
    this.next();
    this.takeDecorators(node);
    const oldStrict = this.state.strict;
    this.state.strict = true;
    this.parseClassId(node, isStatement, optionalId);
    this.parseClassSuper(node);
    node.body = this.parseClassBody(!!node.superClass, oldStrict);
    return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
  }

  isClassProperty() {
    return this.match(27) || this.match(13) || this.match(8);
  }

  isClassMethod() {
    return this.match(10);
  }

  isNonstaticConstructor(method) {
    return !method.computed && !method.static && (method.key.name === "constructor" || method.key.value === "constructor");
  }

  parseClassBody(hadSuperClass, oldStrict) {
    this.classScope.enter();
    const state = {
      hadConstructor: false,
      hadSuperClass
    };
    let decorators = [];
    const classBody = this.startNode();
    classBody.body = [];
    this.expect(5);
    this.withSmartMixTopicForbiddingContext(() => {
      while (!this.match(8)) {
        if (this.eat(13)) {
          if (decorators.length > 0) {
            throw this.raise(this.state.lastTokEnd, _error.Errors.DecoratorSemicolon);
          }

          continue;
        }

        if (this.match(24)) {
          decorators.push(this.parseDecorator());
          continue;
        }

        const member = this.startNode();

        if (decorators.length) {
          member.decorators = decorators;
          this.resetStartLocationFromNode(member, decorators[0]);
          decorators = [];
        }

        this.parseClassMember(classBody, member, state);

        if (member.kind === "constructor" && member.decorators && member.decorators.length > 0) {
          this.raise(member.start, _error.Errors.DecoratorConstructor);
        }
      }
    });
    this.state.strict = oldStrict;
    this.next();

    if (decorators.length) {
      throw this.raise(this.state.start, _error.Errors.TrailingDecorator);
    }

    this.classScope.exit();
    return this.finishNode(classBody, "ClassBody");
  }

  parseClassMemberFromModifier(classBody, member) {
    const key = this.parseIdentifier(true);

    if (this.isClassMethod()) {
      const method = member;
      method.kind = "method";
      method.computed = false;
      method.key = key;
      method.static = false;
      this.pushClassMethod(classBody, method, false, false, false, false);
      return true;
    } else if (this.isClassProperty()) {
      const prop = member;
      prop.computed = false;
      prop.key = key;
      prop.static = false;
      classBody.body.push(this.parseClassProperty(prop));
      return true;
    }

    this.resetPreviousNodeTrailingComments(key);
    return false;
  }

  parseClassMember(classBody, member, state) {
    const isStatic = this.isContextual(99);

    if (isStatic) {
      if (this.parseClassMemberFromModifier(classBody, member)) {
        return;
      }

      if (this.eat(5)) {
        this.parseClassStaticBlock(classBody, member);
        return;
      }
    }

    this.parseClassMemberWithIsStatic(classBody, member, state, isStatic);
  }

  parseClassMemberWithIsStatic(classBody, member, state, isStatic) {
    const publicMethod = member;
    const privateMethod = member;
    const publicProp = member;
    const privateProp = member;
    const method = publicMethod;
    const publicMember = publicMethod;
    member.static = isStatic;
    this.parsePropertyNamePrefixOperator(member);

    if (this.eat(50)) {
      method.kind = "method";
      const isPrivateName = this.match(129);
      this.parseClassElementName(method);

      if (isPrivateName) {
        this.pushClassPrivateMethod(classBody, privateMethod, true, false);
        return;
      }

      if (this.isNonstaticConstructor(publicMethod)) {
        this.raise(publicMethod.key.start, _error.Errors.ConstructorIsGenerator);
      }

      this.pushClassMethod(classBody, publicMethod, true, false, false, false);
      return;
    }

    const isContextual = (0, _types2.tokenIsIdentifier)(this.state.type) && !this.state.containsEsc;
    const isPrivate = this.match(129);
    const key = this.parseClassElementName(member);
    const maybeQuestionTokenStart = this.state.start;
    this.parsePostMemberNameModifiers(publicMember);

    if (this.isClassMethod()) {
      method.kind = "method";

      if (isPrivate) {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
        return;
      }

      const isConstructor = this.isNonstaticConstructor(publicMethod);
      let allowsDirectSuper = false;

      if (isConstructor) {
        publicMethod.kind = "constructor";

        if (state.hadConstructor && !this.hasPlugin("typescript")) {
          this.raise(key.start, _error.Errors.DuplicateConstructor);
        }

        if (isConstructor && this.hasPlugin("typescript") && member.override) {
          this.raise(key.start, _error.Errors.OverrideOnConstructor);
        }

        state.hadConstructor = true;
        allowsDirectSuper = state.hadSuperClass;
      }

      this.pushClassMethod(classBody, publicMethod, false, false, isConstructor, allowsDirectSuper);
    } else if (this.isClassProperty()) {
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else if (isContextual && key.name === "async" && !this.isLineTerminator()) {
      this.resetPreviousNodeTrailingComments(key);
      const isGenerator = this.eat(50);

      if (publicMember.optional) {
        this.unexpected(maybeQuestionTokenStart);
      }

      method.kind = "method";
      const isPrivate = this.match(129);
      this.parseClassElementName(method);
      this.parsePostMemberNameModifiers(publicMember);

      if (isPrivate) {
        this.pushClassPrivateMethod(classBody, privateMethod, isGenerator, true);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, _error.Errors.ConstructorIsAsync);
        }

        this.pushClassMethod(classBody, publicMethod, isGenerator, true, false, false);
      }
    } else if (isContextual && (key.name === "get" || key.name === "set") && !(this.match(50) && this.isLineTerminator())) {
      this.resetPreviousNodeTrailingComments(key);
      method.kind = key.name;
      const isPrivate = this.match(129);
      this.parseClassElementName(publicMethod);

      if (isPrivate) {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, _error.Errors.ConstructorIsAccessor);
        }

        this.pushClassMethod(classBody, publicMethod, false, false, false, false);
      }

      this.checkGetterSetterParams(publicMethod);
    } else if (this.isLineTerminator()) {
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else {
      this.unexpected();
    }
  }

  parseClassElementName(member) {
    const {
      type,
      value,
      start
    } = this.state;

    if ((type === 123 || type === 124) && member.static && value === "prototype") {
      this.raise(start, _error.Errors.StaticPrototype);
    }

    if (type === 129) {
      if (value === "constructor") {
        this.raise(start, _error.Errors.ConstructorClassPrivateField);
      }

      const key = this.parsePrivateName();
      member.key = key;
      return key;
    }

    return this.parsePropertyName(member);
  }

  parseClassStaticBlock(classBody, member) {
    var _member$decorators;

    this.scope.enter(_scopeflags.SCOPE_CLASS | _scopeflags.SCOPE_STATIC_BLOCK | _scopeflags.SCOPE_SUPER);
    const oldLabels = this.state.labels;
    this.state.labels = [];
    this.prodParam.enter(_productionParameter.PARAM);
    const body = member.body = [];
    this.parseBlockOrModuleBlockBody(body, undefined, false, 8);
    this.prodParam.exit();
    this.scope.exit();
    this.state.labels = oldLabels;
    classBody.body.push(this.finishNode(member, "StaticBlock"));

    if ((_member$decorators = member.decorators) != null && _member$decorators.length) {
      this.raise(member.start, _error.Errors.DecoratorStaticBlock);
    }
  }

  pushClassProperty(classBody, prop) {
    if (!prop.computed && (prop.key.name === "constructor" || prop.key.value === "constructor")) {
      this.raise(prop.key.start, _error.Errors.ConstructorClassField);
    }

    classBody.body.push(this.parseClassProperty(prop));
  }

  pushClassPrivateProperty(classBody, prop) {
    const node = this.parseClassPrivateProperty(prop);
    classBody.body.push(node);
    this.classScope.declarePrivateName(this.getPrivateNameSV(node.key), _scopeflags.CLASS_ELEMENT_OTHER, node.key.start);
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper) {
    classBody.body.push(this.parseMethod(method, isGenerator, isAsync, isConstructor, allowsDirectSuper, "ClassMethod", true));
  }

  pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
    const node = this.parseMethod(method, isGenerator, isAsync, false, false, "ClassPrivateMethod", true);
    classBody.body.push(node);
    const kind = node.kind === "get" ? node.static ? _scopeflags.CLASS_ELEMENT_STATIC_GETTER : _scopeflags.CLASS_ELEMENT_INSTANCE_GETTER : node.kind === "set" ? node.static ? _scopeflags.CLASS_ELEMENT_STATIC_SETTER : _scopeflags.CLASS_ELEMENT_INSTANCE_SETTER : _scopeflags.CLASS_ELEMENT_OTHER;
    this.declareClassPrivateMethodInScope(node, kind);
  }

  declareClassPrivateMethodInScope(node, kind) {
    this.classScope.declarePrivateName(this.getPrivateNameSV(node.key), kind, node.key.start);
  }

  parsePostMemberNameModifiers(methodOrProp) {}

  parseClassPrivateProperty(node) {
    this.parseInitializer(node);
    this.semicolon();
    return this.finishNode(node, "ClassPrivateProperty");
  }

  parseClassProperty(node) {
    this.parseInitializer(node);
    this.semicolon();
    return this.finishNode(node, "ClassProperty");
  }

  parseInitializer(node) {
    this.scope.enter(_scopeflags.SCOPE_CLASS | _scopeflags.SCOPE_SUPER);
    this.expressionScope.enter((0, _expressionScope.newExpressionScope)());
    this.prodParam.enter(_productionParameter.PARAM);
    node.value = this.eat(27) ? this.parseMaybeAssignAllowIn() : null;
    this.expressionScope.exit();
    this.prodParam.exit();
    this.scope.exit();
  }

  parseClassId(node, isStatement, optionalId, bindingType = _scopeflags.BIND_CLASS) {
    if ((0, _types2.tokenIsIdentifier)(this.state.type)) {
      node.id = this.parseIdentifier();

      if (isStatement) {
        this.checkLVal(node.id, "class name", bindingType);
      }
    } else {
      if (optionalId || !isStatement) {
        node.id = null;
      } else {
        this.unexpected(null, _error.Errors.MissingClassName);
      }
    }
  }

  parseClassSuper(node) {
    node.superClass = this.eat(76) ? this.parseExprSubscripts() : null;
  }

  parseExport(node) {
    const hasDefault = this.maybeParseExportDefaultSpecifier(node);
    const parseAfterDefault = !hasDefault || this.eat(12);
    const hasStar = parseAfterDefault && this.eatExportStar(node);
    const hasNamespace = hasStar && this.maybeParseExportNamespaceSpecifier(node);
    const parseAfterNamespace = parseAfterDefault && (!hasNamespace || this.eat(12));
    const isFromRequired = hasDefault || hasStar;

    if (hasStar && !hasNamespace) {
      if (hasDefault) this.unexpected();
      this.parseExportFrom(node, true);
      return this.finishNode(node, "ExportAllDeclaration");
    }

    const hasSpecifiers = this.maybeParseExportNamedSpecifiers(node);

    if (hasDefault && parseAfterDefault && !hasStar && !hasSpecifiers || hasNamespace && parseAfterNamespace && !hasSpecifiers) {
      throw this.unexpected(null, 5);
    }

    let hasDeclaration;

    if (isFromRequired || hasSpecifiers) {
      hasDeclaration = false;
      this.parseExportFrom(node, isFromRequired);
    } else {
      hasDeclaration = this.maybeParseExportDeclaration(node);
    }

    if (isFromRequired || hasSpecifiers || hasDeclaration) {
      this.checkExport(node, true, false, !!node.source);
      return this.finishNode(node, "ExportNamedDeclaration");
    }

    if (this.eat(60)) {
      node.declaration = this.parseExportDefaultExpression();
      this.checkExport(node, true, true);
      return this.finishNode(node, "ExportDefaultDeclaration");
    }

    throw this.unexpected(null, 5);
  }

  eatExportStar(node) {
    return this.eat(50);
  }

  maybeParseExportDefaultSpecifier(node) {
    if (this.isExportDefaultSpecifier()) {
      this.expectPlugin("exportDefaultFrom");
      const specifier = this.startNode();
      specifier.exported = this.parseIdentifier(true);
      node.specifiers = [this.finishNode(specifier, "ExportDefaultSpecifier")];
      return true;
    }

    return false;
  }

  maybeParseExportNamespaceSpecifier(node) {
    if (this.isContextual(88)) {
      if (!node.specifiers) node.specifiers = [];
      const specifier = this.startNodeAt(this.state.lastTokStart, this.state.lastTokStartLoc);
      this.next();
      specifier.exported = this.parseModuleExportName();
      node.specifiers.push(this.finishNode(specifier, "ExportNamespaceSpecifier"));
      return true;
    }

    return false;
  }

  maybeParseExportNamedSpecifiers(node) {
    if (this.match(5)) {
      if (!node.specifiers) node.specifiers = [];
      const isTypeExport = node.exportKind === "type";
      node.specifiers.push(...this.parseExportSpecifiers(isTypeExport));
      node.source = null;
      node.declaration = null;

      if (this.hasPlugin("importAssertions")) {
        node.assertions = [];
      }

      return true;
    }

    return false;
  }

  maybeParseExportDeclaration(node) {
    if (this.shouldParseExportDeclaration()) {
      node.specifiers = [];
      node.source = null;

      if (this.hasPlugin("importAssertions")) {
        node.assertions = [];
      }

      node.declaration = this.parseExportDeclaration(node);
      return true;
    }

    return false;
  }

  isAsyncFunction() {
    if (!this.isContextual(90)) return false;
    const next = this.nextTokenStart();
    return !_whitespace.lineBreak.test(this.input.slice(this.state.pos, next)) && this.isUnparsedContextual(next, "function");
  }

  parseExportDefaultExpression() {
    const expr = this.startNode();
    const isAsync = this.isAsyncFunction();

    if (this.match(63) || isAsync) {
      this.next();

      if (isAsync) {
        this.next();
      }

      return this.parseFunction(expr, FUNC_STATEMENT | FUNC_NULLABLE_ID, isAsync);
    } else if (this.match(75)) {
      return this.parseClass(expr, true, true);
    } else if (this.match(24)) {
      if (this.hasPlugin("decorators") && this.getPluginOption("decorators", "decoratorsBeforeExport")) {
        this.raise(this.state.start, _error.Errors.DecoratorBeforeExport);
      }

      this.parseDecorators(false);
      return this.parseClass(expr, true, true);
    } else if (this.match(70) || this.match(69) || this.isLet()) {
      throw this.raise(this.state.start, _error.Errors.UnsupportedDefaultExport);
    } else {
      const res = this.parseMaybeAssignAllowIn();
      this.semicolon();
      return res;
    }
  }

  parseExportDeclaration(node) {
    return this.parseStatement(null);
  }

  isExportDefaultSpecifier() {
    const {
      type
    } = this.state;

    if ((0, _types2.tokenIsIdentifier)(type)) {
      if (type === 90 && !this.state.containsEsc || type === 94) {
        return false;
      }

      if ((type === 121 || type === 120) && !this.state.containsEsc) {
        const {
          type: nextType
        } = this.lookahead();

        if ((0, _types2.tokenIsIdentifier)(nextType) && nextType !== 92 || nextType === 5) {
          this.expectOnePlugin(["flow", "typescript"]);
          return false;
        }
      }
    } else if (!this.match(60)) {
      return false;
    }

    const next = this.nextTokenStart();
    const hasFrom = this.isUnparsedContextual(next, "from");

    if (this.input.charCodeAt(next) === 44 || (0, _types2.tokenIsIdentifier)(this.state.type) && hasFrom) {
      return true;
    }

    if (this.match(60) && hasFrom) {
      const nextAfterFrom = this.input.charCodeAt(this.nextTokenStartSince(next + 4));
      return nextAfterFrom === 34 || nextAfterFrom === 39;
    }

    return false;
  }

  parseExportFrom(node, expect) {
    if (this.eatContextual(92)) {
      node.source = this.parseImportSource();
      this.checkExport(node);
      const assertions = this.maybeParseImportAssertions();

      if (assertions) {
        node.assertions = assertions;
      }
    } else if (expect) {
      this.unexpected();
    }

    this.semicolon();
  }

  shouldParseExportDeclaration() {
    const {
      type
    } = this.state;

    if (type === 24) {
      this.expectOnePlugin(["decorators", "decorators-legacy"]);

      if (this.hasPlugin("decorators")) {
        if (this.getPluginOption("decorators", "decoratorsBeforeExport")) {
          this.unexpected(this.state.start, _error.Errors.DecoratorBeforeExport);
        } else {
          return true;
        }
      }
    }

    return type === 69 || type === 70 || type === 63 || type === 75 || this.isLet() || this.isAsyncFunction();
  }

  checkExport(node, checkNames, isDefault, isFrom) {
    if (checkNames) {
      if (isDefault) {
        this.checkDuplicateExports(node, "default");

        if (this.hasPlugin("exportDefaultFrom")) {
          var _declaration$extra;

          const declaration = node.declaration;

          if (declaration.type === "Identifier" && declaration.name === "from" && declaration.end - declaration.start === 4 && !((_declaration$extra = declaration.extra) != null && _declaration$extra.parenthesized)) {
            this.raise(declaration.start, _error.Errors.ExportDefaultFromAsIdentifier);
          }
        }
      } else if (node.specifiers && node.specifiers.length) {
        for (const specifier of node.specifiers) {
          const {
            exported
          } = specifier;
          const exportedName = exported.type === "Identifier" ? exported.name : exported.value;
          this.checkDuplicateExports(specifier, exportedName);

          if (!isFrom && specifier.local) {
            const {
              local
            } = specifier;

            if (local.type !== "Identifier") {
              this.raise(specifier.start, _error.Errors.ExportBindingIsString, local.value, exportedName);
            } else {
              this.checkReservedWord(local.name, local.start, true, false);
              this.scope.checkLocalExport(local);
            }
          }
        }
      } else if (node.declaration) {
        if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
          const id = node.declaration.id;
          if (!id) throw new Error("Assertion failure");
          this.checkDuplicateExports(node, id.name);
        } else if (node.declaration.type === "VariableDeclaration") {
          for (const declaration of node.declaration.declarations) {
            this.checkDeclaration(declaration.id);
          }
        }
      }
    }

    const currentContextDecorators = this.state.decoratorStack[this.state.decoratorStack.length - 1];

    if (currentContextDecorators.length) {
      throw this.raise(node.start, _error.Errors.UnsupportedDecoratorExport);
    }
  }

  checkDeclaration(node) {
    if (node.type === "Identifier") {
      this.checkDuplicateExports(node, node.name);
    } else if (node.type === "ObjectPattern") {
      for (const prop of node.properties) {
        this.checkDeclaration(prop);
      }
    } else if (node.type === "ArrayPattern") {
      for (const elem of node.elements) {
        if (elem) {
          this.checkDeclaration(elem);
        }
      }
    } else if (node.type === "ObjectProperty") {
      this.checkDeclaration(node.value);
    } else if (node.type === "RestElement") {
      this.checkDeclaration(node.argument);
    } else if (node.type === "AssignmentPattern") {
      this.checkDeclaration(node.left);
    }
  }

  checkDuplicateExports(node, name) {
    if (this.exportedIdentifiers.has(name)) {
      this.raise(node.start, name === "default" ? _error.Errors.DuplicateDefaultExport : _error.Errors.DuplicateExport, name);
    }

    this.exportedIdentifiers.add(name);
  }

  parseExportSpecifiers(isInTypeExport) {
    const nodes = [];
    let first = true;
    this.expect(5);

    while (!this.eat(8)) {
      if (first) {
        first = false;
      } else {
        this.expect(12);
        if (this.eat(8)) break;
      }

      const isMaybeTypeOnly = this.isContextual(121);
      const isString = this.match(124);
      const node = this.startNode();
      node.local = this.parseModuleExportName();
      nodes.push(this.parseExportSpecifier(node, isString, isInTypeExport, isMaybeTypeOnly));
    }

    return nodes;
  }

  parseExportSpecifier(node, isString, isInTypeExport, isMaybeTypeOnly) {
    if (this.eatContextual(88)) {
      node.exported = this.parseModuleExportName();
    } else if (isString) {
      node.exported = (0, _node.cloneStringLiteral)(node.local);
    } else if (!node.exported) {
      node.exported = (0, _node.cloneIdentifier)(node.local);
    }

    return this.finishNode(node, "ExportSpecifier");
  }

  parseModuleExportName() {
    if (this.match(124)) {
      const result = this.parseStringLiteral(this.state.value);
      const surrogate = result.value.match(loneSurrogate);

      if (surrogate) {
        this.raise(result.start, _error.Errors.ModuleExportNameHasLoneSurrogate, surrogate[0].charCodeAt(0).toString(16));
      }

      return result;
    }

    return this.parseIdentifier(true);
  }

  parseImport(node) {
    node.specifiers = [];

    if (!this.match(124)) {
      const hasDefault = this.maybeParseDefaultImportSpecifier(node);
      const parseNext = !hasDefault || this.eat(12);
      const hasStar = parseNext && this.maybeParseStarImportSpecifier(node);
      if (parseNext && !hasStar) this.parseNamedImportSpecifiers(node);
      this.expectContextual(92);
    }

    node.source = this.parseImportSource();
    const assertions = this.maybeParseImportAssertions();

    if (assertions) {
      node.assertions = assertions;
    } else if (!process.env.BABEL_8_BREAKING) {
      const attributes = this.maybeParseModuleAttributes();

      if (attributes) {
        node.attributes = attributes;
      }
    }

    this.semicolon();
    return this.finishNode(node, "ImportDeclaration");
  }

  parseImportSource() {
    if (!this.match(124)) this.unexpected();
    return this.parseExprAtom();
  }

  shouldParseDefaultImport(node) {
    return (0, _types2.tokenIsIdentifier)(this.state.type);
  }

  parseImportSpecifierLocal(node, specifier, type, contextDescription) {
    specifier.local = this.parseIdentifier();
    this.checkLVal(specifier.local, contextDescription, _scopeflags.BIND_LEXICAL);
    node.specifiers.push(this.finishNode(specifier, type));
  }

  parseAssertEntries() {
    const attrs = [];
    const attrNames = new Set();

    do {
      if (this.match(8)) {
        break;
      }

      const node = this.startNode();
      const keyName = this.state.value;

      if (attrNames.has(keyName)) {
        this.raise(this.state.start, _error.Errors.ModuleAttributesWithDuplicateKeys, keyName);
      }

      attrNames.add(keyName);

      if (this.match(124)) {
        node.key = this.parseStringLiteral(keyName);
      } else {
        node.key = this.parseIdentifier(true);
      }

      this.expect(14);

      if (!this.match(124)) {
        throw this.unexpected(this.state.start, _error.Errors.ModuleAttributeInvalidValue);
      }

      node.value = this.parseStringLiteral(this.state.value);
      this.finishNode(node, "ImportAttribute");
      attrs.push(node);
    } while (this.eat(12));

    return attrs;
  }

  maybeParseModuleAttributes() {
    if (this.match(71) && !this.hasPrecedingLineBreak()) {
      this.expectPlugin("moduleAttributes");
      this.next();
    } else {
      if (this.hasPlugin("moduleAttributes")) return [];
      return null;
    }

    const attrs = [];
    const attributes = new Set();

    do {
      const node = this.startNode();
      node.key = this.parseIdentifier(true);

      if (node.key.name !== "type") {
        this.raise(node.key.start, _error.Errors.ModuleAttributeDifferentFromType, node.key.name);
      }

      if (attributes.has(node.key.name)) {
        this.raise(node.key.start, _error.Errors.ModuleAttributesWithDuplicateKeys, node.key.name);
      }

      attributes.add(node.key.name);
      this.expect(14);

      if (!this.match(124)) {
        throw this.unexpected(this.state.start, _error.Errors.ModuleAttributeInvalidValue);
      }

      node.value = this.parseStringLiteral(this.state.value);
      this.finishNode(node, "ImportAttribute");
      attrs.push(node);
    } while (this.eat(12));

    return attrs;
  }

  maybeParseImportAssertions() {
    if (this.isContextual(89) && !this.hasPrecedingLineBreak()) {
      this.expectPlugin("importAssertions");
      this.next();
    } else {
      if (this.hasPlugin("importAssertions")) return [];
      return null;
    }

    this.eat(5);
    const attrs = this.parseAssertEntries();
    this.eat(8);
    return attrs;
  }

  maybeParseDefaultImportSpecifier(node) {
    if (this.shouldParseDefaultImport(node)) {
      this.parseImportSpecifierLocal(node, this.startNode(), "ImportDefaultSpecifier", "default import specifier");
      return true;
    }

    return false;
  }

  maybeParseStarImportSpecifier(node) {
    if (this.match(50)) {
      const specifier = this.startNode();
      this.next();
      this.expectContextual(88);
      this.parseImportSpecifierLocal(node, specifier, "ImportNamespaceSpecifier", "import namespace specifier");
      return true;
    }

    return false;
  }

  parseNamedImportSpecifiers(node) {
    let first = true;
    this.expect(5);

    while (!this.eat(8)) {
      if (first) {
        first = false;
      } else {
        if (this.eat(14)) {
          throw this.raise(this.state.start, _error.Errors.DestructureNamedImport);
        }

        this.expect(12);
        if (this.eat(8)) break;
      }

      const specifier = this.startNode();
      const importedIsString = this.match(124);
      const isMaybeTypeOnly = this.isContextual(121);
      specifier.imported = this.parseModuleExportName();
      const importSpecifier = this.parseImportSpecifier(specifier, importedIsString, node.importKind === "type" || node.importKind === "typeof", isMaybeTypeOnly);
      node.specifiers.push(importSpecifier);
    }
  }

  parseImportSpecifier(specifier, importedIsString, isInTypeOnlyImport, isMaybeTypeOnly) {
    if (this.eatContextual(88)) {
      specifier.local = this.parseIdentifier();
    } else {
      const {
        imported
      } = specifier;

      if (importedIsString) {
        throw this.raise(specifier.start, _error.Errors.ImportBindingIsString, imported.value);
      }

      this.checkReservedWord(imported.name, specifier.start, true, true);

      if (!specifier.local) {
        specifier.local = (0, _node.cloneIdentifier)(imported);
      }
    }

    this.checkLVal(specifier.local, "import specifier", _scopeflags.BIND_LEXICAL);
    return this.finishNode(specifier, "ImportSpecifier");
  }

  isThisParam(param) {
    return param.type === "Identifier" && param.name === "this";
  }

}

exports.default = StatementParser;