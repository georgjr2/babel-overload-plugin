"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ExportedTokenType = void 0;
exports.getExportedToken = getExportedToken;
exports.isTokenType = isTokenType;
exports.keywords = void 0;
exports.tokenCanStartExpression = tokenCanStartExpression;
exports.tokenComesBeforeExpression = tokenComesBeforeExpression;
exports.tokenIsAssignment = tokenIsAssignment;
exports.tokenIsFlowInterfaceOrTypeOrOpaque = tokenIsFlowInterfaceOrTypeOrOpaque;
exports.tokenIsIdentifier = tokenIsIdentifier;
exports.tokenIsKeyword = tokenIsKeyword;
exports.tokenIsKeywordOrIdentifier = tokenIsKeywordOrIdentifier;
exports.tokenIsLiteralPropertyName = tokenIsLiteralPropertyName;
exports.tokenIsLoop = tokenIsLoop;
exports.tokenIsOperator = tokenIsOperator;
exports.tokenIsPostfix = tokenIsPostfix;
exports.tokenIsPrefix = tokenIsPrefix;
exports.tokenIsRightAssociative = tokenIsRightAssociative;
exports.tokenIsTSDeclarationStart = tokenIsTSDeclarationStart;
exports.tokenIsTSTypeOperator = tokenIsTSTypeOperator;
exports.tokenKeywordOrIdentifierIsKeyword = tokenKeywordOrIdentifierIsKeyword;
exports.tokenLabelName = tokenLabelName;
exports.tokenOperatorPrecedence = tokenOperatorPrecedence;
exports.tt = exports.tokenTypes = void 0;

var _context = require("./context");

const beforeExpr = true;
const startsExpr = true;
const isLoop = true;
const isAssign = true;
const prefix = true;
const postfix = true;

class ExportedTokenType {
  label;
  keyword;
  beforeExpr;
  startsExpr;
  rightAssociative;
  isLoop;
  isAssign;
  prefix;
  postfix;
  binop;

  constructor(label, conf = {}) {
    this.label = label;
    this.keyword = conf.keyword;
    this.beforeExpr = !!conf.beforeExpr;
    this.startsExpr = !!conf.startsExpr;
    this.rightAssociative = !!conf.rightAssociative;
    this.isLoop = !!conf.isLoop;
    this.isAssign = !!conf.isAssign;
    this.prefix = !!conf.prefix;
    this.postfix = !!conf.postfix;
    this.binop = conf.binop != null ? conf.binop : null;

    if (!process.env.BABEL_8_BREAKING) {
      this.updateContext = null;
    }
  }

}

exports.ExportedTokenType = ExportedTokenType;
const keywords = new Map();
exports.keywords = keywords;

function createKeyword(name, options = {}) {
  options.keyword = name;
  const token = createToken(name, options);
  keywords.set(name, token);
  return token;
}

function createBinop(name, binop) {
  return createToken(name, {
    beforeExpr,
    binop
  });
}

let tokenTypeCounter = -1;
const tokenTypes = [];
exports.tokenTypes = tokenTypes;
const tokenLabels = [];
const tokenBinops = [];
const tokenBeforeExprs = [];
const tokenStartsExprs = [];
const tokenPrefixes = [];

function createToken(name, options = {}) {
  ++tokenTypeCounter;
  tokenLabels.push(name);
  tokenBinops.push(options.binop ?? -1);
  tokenBeforeExprs.push(options.beforeExpr ?? false);
  tokenStartsExprs.push(options.startsExpr ?? false);
  tokenPrefixes.push(options.prefix ?? false);
  tokenTypes.push(new ExportedTokenType(name, options));
  return tokenTypeCounter;
}

function createKeywordLike(name, options = {}) {
  ++tokenTypeCounter;
  keywords.set(name, tokenTypeCounter);
  tokenLabels.push(name);
  tokenBinops.push(options.binop ?? -1);
  tokenBeforeExprs.push(options.beforeExpr ?? false);
  tokenStartsExprs.push(options.startsExpr ?? false);
  tokenPrefixes.push(options.prefix ?? false);
  tokenTypes.push(new ExportedTokenType("name", options));
  return tokenTypeCounter;
}

const tt = {
  bracketL: createToken("[", {
    beforeExpr,
    startsExpr
  }),
  bracketHashL: createToken("#[", {
    beforeExpr,
    startsExpr
  }),
  bracketBarL: createToken("[|", {
    beforeExpr,
    startsExpr
  }),
  bracketR: createToken("]"),
  bracketBarR: createToken("|]"),
  braceL: createToken("{", {
    beforeExpr,
    startsExpr
  }),
  braceBarL: createToken("{|", {
    beforeExpr,
    startsExpr
  }),
  braceHashL: createToken("#{", {
    beforeExpr,
    startsExpr
  }),
  braceR: createToken("}", {
    beforeExpr
  }),
  braceBarR: createToken("|}"),
  parenL: createToken("(", {
    beforeExpr,
    startsExpr
  }),
  parenR: createToken(")"),
  comma: createToken(",", {
    beforeExpr
  }),
  semi: createToken(";", {
    beforeExpr
  }),
  colon: createToken(":", {
    beforeExpr
  }),
  doubleColon: createToken("::", {
    beforeExpr
  }),
  dot: createToken("."),
  question: createToken("?", {
    beforeExpr
  }),
  questionDot: createToken("?."),
  arrow: createToken("=>", {
    beforeExpr
  }),
  template: createToken("template"),
  ellipsis: createToken("...", {
    beforeExpr
  }),
  backQuote: createToken("`", {
    startsExpr
  }),
  dollarBraceL: createToken("${", {
    beforeExpr,
    startsExpr
  }),
  at: createToken("@"),
  hash: createToken("#", {
    startsExpr
  }),
  interpreterDirective: createToken("#!..."),
  eq: createToken("=", {
    beforeExpr,
    isAssign
  }),
  assign: createToken("_=", {
    beforeExpr,
    isAssign
  }),
  slashAssign: createToken("_=", {
    beforeExpr,
    isAssign
  }),
  xorAssign: createToken("_=", {
    beforeExpr,
    isAssign
  }),
  moduloAssign: createToken("_=", {
    beforeExpr,
    isAssign
  }),
  incDec: createToken("++/--", {
    prefix,
    postfix,
    startsExpr
  }),
  bang: createToken("!", {
    beforeExpr,
    prefix,
    startsExpr
  }),
  tilde: createToken("~", {
    beforeExpr,
    prefix,
    startsExpr
  }),
  pipeline: createBinop("|>", 0),
  nullishCoalescing: createBinop("??", 1),
  atOverload: createToken("@name", {
    beforeExpr,
    binop: 10,
    prefix,
    startsExpr
  }),
  logicalOR: createBinop("||", 1),
  logicalAND: createBinop("&&", 2),
  bitwiseOR: createBinop("|", 3),
  bitwiseXOR: createBinop("^", 4),
  bitwiseAND: createBinop("&", 5),
  equality: createBinop("==/!=/===/!==", 6),
  lt: createBinop("</>/<=/>=", 7),
  gt: createBinop("</>/<=/>=", 7),
  relational: createBinop("</>/<=/>=", 7),
  bitShift: createBinop("<</>>/>>>", 8),
  plusMin: createToken("+/-", {
    beforeExpr,
    binop: 9,
    prefix,
    startsExpr
  }),
  modulo: createToken("%", {
    binop: 10,
    startsExpr
  }),
  star: createToken("*", {
    binop: 10
  }),
  slash: createBinop("/", 10),
  exponent: createToken("**", {
    beforeExpr,
    binop: 11,
    rightAssociative: true
  }),
  _in: createKeyword("in", {
    beforeExpr,
    binop: 7
  }),
  _instanceof: createKeyword("instanceof", {
    beforeExpr,
    binop: 7
  }),
  _break: createKeyword("break"),
  _case: createKeyword("case", {
    beforeExpr
  }),
  _catch: createKeyword("catch"),
  _continue: createKeyword("continue"),
  _debugger: createKeyword("debugger"),
  _default: createKeyword("default", {
    beforeExpr
  }),
  _else: createKeyword("else", {
    beforeExpr
  }),
  _finally: createKeyword("finally"),
  _function: createKeyword("function", {
    startsExpr
  }),
  _if: createKeyword("if"),
  _return: createKeyword("return", {
    beforeExpr
  }),
  _switch: createKeyword("switch"),
  _throw: createKeyword("throw", {
    beforeExpr,
    prefix,
    startsExpr
  }),
  _try: createKeyword("try"),
  _var: createKeyword("var"),
  _const: createKeyword("const"),
  _with: createKeyword("with"),
  _new: createKeyword("new", {
    beforeExpr,
    startsExpr
  }),
  _this: createKeyword("this", {
    startsExpr
  }),
  _super: createKeyword("super", {
    startsExpr
  }),
  _class: createKeyword("class", {
    startsExpr
  }),
  _extends: createKeyword("extends", {
    beforeExpr
  }),
  _export: createKeyword("export"),
  _import: createKeyword("import", {
    startsExpr
  }),
  _null: createKeyword("null", {
    startsExpr
  }),
  _true: createKeyword("true", {
    startsExpr
  }),
  _false: createKeyword("false", {
    startsExpr
  }),
  _typeof: createKeyword("typeof", {
    beforeExpr,
    prefix,
    startsExpr
  }),
  _void: createKeyword("void", {
    beforeExpr,
    prefix,
    startsExpr
  }),
  _delete: createKeyword("delete", {
    beforeExpr,
    prefix,
    startsExpr
  }),
  _do: createKeyword("do", {
    isLoop,
    beforeExpr
  }),
  _for: createKeyword("for", {
    isLoop
  }),
  _while: createKeyword("while", {
    isLoop
  }),
  _as: createKeywordLike("as", {
    startsExpr
  }),
  _assert: createKeywordLike("assert", {
    startsExpr
  }),
  _async: createKeywordLike("async", {
    startsExpr
  }),
  _await: createKeywordLike("await", {
    startsExpr
  }),
  _from: createKeywordLike("from", {
    startsExpr
  }),
  _get: createKeywordLike("get", {
    startsExpr
  }),
  _let: createKeywordLike("let", {
    startsExpr
  }),
  _meta: createKeywordLike("meta", {
    startsExpr
  }),
  _of: createKeywordLike("of", {
    startsExpr
  }),
  _sent: createKeywordLike("sent", {
    startsExpr
  }),
  _set: createKeywordLike("set", {
    startsExpr
  }),
  _static: createKeywordLike("static", {
    startsExpr
  }),
  _yield: createKeywordLike("yield", {
    startsExpr
  }),
  _asserts: createKeywordLike("asserts", {
    startsExpr
  }),
  _checks: createKeywordLike("checks", {
    startsExpr
  }),
  _exports: createKeywordLike("exports", {
    startsExpr
  }),
  _global: createKeywordLike("global", {
    startsExpr
  }),
  _implements: createKeywordLike("implements", {
    startsExpr
  }),
  _intrinsic: createKeywordLike("intrinsic", {
    startsExpr
  }),
  _infer: createKeywordLike("infer", {
    startsExpr
  }),
  _is: createKeywordLike("is", {
    startsExpr
  }),
  _mixins: createKeywordLike("mixins", {
    startsExpr
  }),
  _proto: createKeywordLike("proto", {
    startsExpr
  }),
  _require: createKeywordLike("require", {
    startsExpr
  }),
  _keyof: createKeywordLike("keyof", {
    startsExpr
  }),
  _readonly: createKeywordLike("readonly", {
    startsExpr
  }),
  _unique: createKeywordLike("unique", {
    startsExpr
  }),
  _abstract: createKeywordLike("abstract", {
    startsExpr
  }),
  _declare: createKeywordLike("declare", {
    startsExpr
  }),
  _enum: createKeywordLike("enum", {
    startsExpr
  }),
  _module: createKeywordLike("module", {
    startsExpr
  }),
  _namespace: createKeywordLike("namespace", {
    startsExpr
  }),
  _interface: createKeywordLike("interface", {
    startsExpr
  }),
  _type: createKeywordLike("type", {
    startsExpr
  }),
  _opaque: createKeywordLike("opaque", {
    startsExpr
  }),
  name: createToken("name", {
    startsExpr
  }),
  string: createToken("string", {
    startsExpr
  }),
  num: createToken("num", {
    startsExpr
  }),
  bigint: createToken("bigint", {
    startsExpr
  }),
  decimal: createToken("decimal", {
    startsExpr
  }),
  regexp: createToken("regexp", {
    startsExpr
  }),
  privateName: createToken("#name", {
    startsExpr
  }),
  eof: createToken("eof"),
  jsxName: createToken("jsxName"),
  jsxText: createToken("jsxText", {
    beforeExpr: true
  }),
  jsxTagStart: createToken("jsxTagStart", {
    startsExpr: true
  }),
  jsxTagEnd: createToken("jsxTagEnd"),
  placeholder: createToken("%%", {
    startsExpr: true
  })
};
exports.tt = tt;

function tokenIsIdentifier(token) {
  return token >= 88 && token <= 123;
}

function tokenKeywordOrIdentifierIsKeyword(token) {
  return token <= 87;
}

function tokenIsKeywordOrIdentifier(token) {
  return token >= 53 && token <= 123;
}

function tokenIsLiteralPropertyName(token) {
  return token >= 53 && token <= 127;
}

function tokenComesBeforeExpression(token) {
  return tokenBeforeExprs[token];
}

function tokenCanStartExpression(token) {
  return tokenStartsExprs[token];
}

function tokenIsAssignment(token) {
  return token >= 27 && token <= 31;
}

function tokenIsFlowInterfaceOrTypeOrOpaque(token) {
  return token >= 120 && token <= 122;
}

function tokenIsLoop(token) {
  return token >= 85 && token <= 87;
}

function tokenIsKeyword(token) {
  return token >= 53 && token <= 87;
}

function tokenIsOperator(token) {
  return token >= 35 && token <= 54;
}

function tokenIsPostfix(token) {
  return token === 32;
}

function tokenIsPrefix(token) {
  return tokenPrefixes[token];
}

function tokenIsTSTypeOperator(token) {
  return token >= 112 && token <= 114;
}

function tokenIsTSDeclarationStart(token) {
  return token >= 115 && token <= 121;
}

function tokenLabelName(token) {
  return tokenLabels[token];
}

function tokenOperatorPrecedence(token) {
  return tokenBinops[token];
}

function tokenIsRightAssociative(token) {
  return token === 52;
}

function getExportedToken(token) {
  return tokenTypes[token];
}

function isTokenType(obj) {
  return typeof obj === "number";
}

if (!process.env.BABEL_8_BREAKING) {
  tokenTypes[8].updateContext = context => {
    context.pop();
  };

  tokenTypes[5].updateContext = tokenTypes[7].updateContext = tokenTypes[23].updateContext = context => {
    context.push(_context.types.brace);
  };

  tokenTypes[22].updateContext = context => {
    if (context[context.length - 1] === _context.types.template) {
      context.pop();
    } else {
      context.push(_context.types.template);
    }
  };

  tokenTypes[133].updateContext = context => {
    context.push(_context.types.j_expr, _context.types.j_oTag);
  };
}