"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var N = require("../types");

var _error = require("../parser/error");

const PlaceHolderErrors = (0, _error.makeErrorTemplates)({
  ClassNameIsRequired: "A class name is required."
}, _error.ErrorCodes.SyntaxError);

var _default = superClass => class extends superClass {
  parsePlaceholder(expectedNode) {
    if (this.match(135)) {
      const node = this.startNode();
      this.next();
      this.assertNoSpace("Unexpected space in placeholder.");
      node.name = super.parseIdentifier(true);
      this.assertNoSpace("Unexpected space in placeholder.");
      this.expect(135);
      return this.finishPlaceholder(node, expectedNode);
    }
  }

  finishPlaceholder(node, expectedNode) {
    const isFinished = !!(node.expectedNode && node.type === "Placeholder");
    node.expectedNode = expectedNode;
    return isFinished ? node : this.finishNode(node, "Placeholder");
  }

  getTokenFromCode(code) {
    if (code === 37 && this.input.charCodeAt(this.state.pos + 1) === 37) {
      return this.finishOp(135, 2);
    }

    return super.getTokenFromCode(...arguments);
  }

  parseExprAtom() {
    return this.parsePlaceholder("Expression") || super.parseExprAtom(...arguments);
  }

  parseIdentifier() {
    return this.parsePlaceholder("Identifier") || super.parseIdentifier(...arguments);
  }

  checkReservedWord(word) {
    if (word !== undefined) super.checkReservedWord(...arguments);
  }

  parseBindingAtom() {
    return this.parsePlaceholder("Pattern") || super.parseBindingAtom(...arguments);
  }

  checkLVal(expr) {
    if (expr.type !== "Placeholder") super.checkLVal(...arguments);
  }

  toAssignable(node) {
    if (node && node.type === "Placeholder" && node.expectedNode === "Expression") {
      node.expectedNode = "Pattern";
      return node;
    }

    return super.toAssignable(...arguments);
  }

  isLet(context) {
    if (super.isLet(context)) {
      return true;
    }

    if (!this.isContextual(94)) {
      return false;
    }

    if (context) return false;
    const nextToken = this.lookahead();

    if (nextToken.type === 135) {
      return true;
    }

    return false;
  }

  verifyBreakContinue(node) {
    if (node.label && node.label.type === "Placeholder") return;
    super.verifyBreakContinue(...arguments);
  }

  parseExpressionStatement(node, expr) {
    if (expr.type !== "Placeholder" || expr.extra && expr.extra.parenthesized) {
      return super.parseExpressionStatement(...arguments);
    }

    if (this.match(14)) {
      const stmt = node;
      stmt.label = this.finishPlaceholder(expr, "Identifier");
      this.next();
      stmt.body = this.parseStatement("label");
      return this.finishNode(stmt, "LabeledStatement");
    }

    this.semicolon();
    node.name = expr.name;
    return this.finishPlaceholder(node, "Statement");
  }

  parseBlock() {
    return this.parsePlaceholder("BlockStatement") || super.parseBlock(...arguments);
  }

  parseFunctionId() {
    return this.parsePlaceholder("Identifier") || super.parseFunctionId(...arguments);
  }

  parseClass(node, isStatement, optionalId) {
    const type = isStatement ? "ClassDeclaration" : "ClassExpression";
    this.next();
    this.takeDecorators(node);
    const oldStrict = this.state.strict;
    const placeholder = this.parsePlaceholder("Identifier");

    if (placeholder) {
      if (this.match(76) || this.match(135) || this.match(5)) {
        node.id = placeholder;
      } else if (optionalId || !isStatement) {
        node.id = null;
        node.body = this.finishPlaceholder(placeholder, "ClassBody");
        return this.finishNode(node, type);
      } else {
        this.unexpected(null, PlaceHolderErrors.ClassNameIsRequired);
      }
    } else {
      this.parseClassId(node, isStatement, optionalId);
    }

    this.parseClassSuper(node);
    node.body = this.parsePlaceholder("ClassBody") || this.parseClassBody(!!node.superClass, oldStrict);
    return this.finishNode(node, type);
  }

  parseExport(node) {
    const placeholder = this.parsePlaceholder("Identifier");
    if (!placeholder) return super.parseExport(...arguments);

    if (!this.isContextual(92) && !this.match(12)) {
      node.specifiers = [];
      node.source = null;
      node.declaration = this.finishPlaceholder(placeholder, "Declaration");
      return this.finishNode(node, "ExportNamedDeclaration");
    }

    this.expectPlugin("exportDefaultFrom");
    const specifier = this.startNode();
    specifier.exported = placeholder;
    node.specifiers = [this.finishNode(specifier, "ExportDefaultSpecifier")];
    return super.parseExport(node);
  }

  isExportDefaultSpecifier() {
    if (this.match(60)) {
      const next = this.nextTokenStart();

      if (this.isUnparsedContextual(next, "from")) {
        if (this.input.startsWith((0, _types.tokenLabelName)(135), this.nextTokenStartSince(next + 4))) {
          return true;
        }
      }
    }

    return super.isExportDefaultSpecifier();
  }

  maybeParseExportDefaultSpecifier(node) {
    if (node.specifiers && node.specifiers.length > 0) {
      return true;
    }

    return super.maybeParseExportDefaultSpecifier(...arguments);
  }

  checkExport(node) {
    const {
      specifiers
    } = node;

    if (specifiers != null && specifiers.length) {
      node.specifiers = specifiers.filter(node => node.exported.type === "Placeholder");
    }

    super.checkExport(node);
    node.specifiers = specifiers;
  }

  parseImport(node) {
    const placeholder = this.parsePlaceholder("Identifier");
    if (!placeholder) return super.parseImport(...arguments);
    node.specifiers = [];

    if (!this.isContextual(92) && !this.match(12)) {
      node.source = this.finishPlaceholder(placeholder, "StringLiteral");
      this.semicolon();
      return this.finishNode(node, "ImportDeclaration");
    }

    const specifier = this.startNodeAtNode(placeholder);
    specifier.local = placeholder;
    this.finishNode(specifier, "ImportDefaultSpecifier");
    node.specifiers.push(specifier);

    if (this.eat(12)) {
      const hasStarImport = this.maybeParseStarImportSpecifier(node);
      if (!hasStarImport) this.parseNamedImportSpecifiers(node);
    }

    this.expectContextual(92);
    node.source = this.parseImportSource();
    this.semicolon();
    return this.finishNode(node, "ImportDeclaration");
  }

  parseImportSource() {
    return this.parsePlaceholder("StringLiteral") || super.parseImportSource(...arguments);
  }

};

exports.default = _default;