"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Token = void 0;

var N = require("../types");

var _identifier = require("../util/identifier");

var _types2 = require("./types");

var _context = require("./context");

var _error = require("../parser/error");

var _location = require("../util/location");

var _whitespace = require("../util/whitespace");

var _state = require("./state");

var _isDigit = function isDigit(code) {
  return code >= 48 && code <= 57;
};

const VALID_REGEX_FLAGS = new Set([103, 109, 115, 105, 121, 117, 100]);
const forbiddenNumericSeparatorSiblings = {
  decBinOct: [46, 66, 69, 79, 95, 98, 101, 111],
  hex: [46, 88, 95, 120]
};
const allowedNumericSeparatorSiblings = {};
allowedNumericSeparatorSiblings.bin = [48, 49];
allowedNumericSeparatorSiblings.oct = [...allowedNumericSeparatorSiblings.bin, 50, 51, 52, 53, 54, 55];
allowedNumericSeparatorSiblings.dec = [...allowedNumericSeparatorSiblings.oct, 56, 57];
allowedNumericSeparatorSiblings.hex = [...allowedNumericSeparatorSiblings.dec, 65, 66, 67, 68, 69, 70, 97, 98, 99, 100, 101, 102];

class Token {
  constructor(state) {
    this.type = state.type;
    this.value = state.value;
    this.start = state.start;
    this.end = state.end;
    this.loc = new _location.SourceLocation(state.startLoc, state.endLoc);
  }

}

exports.Token = Token;

class Tokenizer extends _error.default {
  isLookahead;
  tokens = [];

  constructor(options, input) {
    super();
    this.state = new _state.default();
    this.state.init(options);
    this.input = input;
    this.length = input.length;
    this.isLookahead = false;
  }

  pushToken(token) {
    this.tokens.length = this.state.tokensLength;
    this.tokens.push(token);
    ++this.state.tokensLength;
  }

  next() {
    this.checkKeywordEscapes();

    if (this.options.tokens) {
      this.pushToken(new Token(this.state));
    }

    this.state.lastTokEnd = this.state.end;
    this.state.lastTokStart = this.state.start;
    this.state.lastTokEndLoc = this.state.endLoc;
    this.state.lastTokStartLoc = this.state.startLoc;
    this.nextToken();
  }

  eat(type) {
    if (this.match(type)) {
      this.next();
      return true;
    } else {
      return false;
    }
  }

  match(type) {
    return this.state.type === type;
  }

  createLookaheadState(state) {
    return {
      pos: state.pos,
      value: null,
      type: state.type,
      start: state.start,
      end: state.end,
      lastTokEnd: state.end,
      context: [this.curContext()],
      inType: state.inType
    };
  }

  lookahead() {
    const old = this.state;
    this.state = this.createLookaheadState(old);
    this.isLookahead = true;
    this.nextToken();
    this.isLookahead = false;
    const curr = this.state;
    this.state = old;
    return curr;
  }

  nextTokenStart() {
    return this.nextTokenStartSince(this.state.pos);
  }

  nextTokenStartSince(pos) {
    _whitespace.skipWhiteSpace.lastIndex = pos;
    return _whitespace.skipWhiteSpace.test(this.input) ? _whitespace.skipWhiteSpace.lastIndex : pos;
  }

  lookaheadCharCode() {
    return this.input.charCodeAt(this.nextTokenStart());
  }

  codePointAtPos(pos) {
    let cp = this.input.charCodeAt(pos);

    if ((cp & 0xfc00) === 0xd800 && ++pos < this.input.length) {
      const trail = this.input.charCodeAt(pos);

      if ((trail & 0xfc00) === 0xdc00) {
        cp = 0x10000 + ((cp & 0x3ff) << 10) + (trail & 0x3ff);
      }
    }

    return cp;
  }

  setStrict(strict) {
    this.state.strict = strict;

    if (strict) {
      this.state.strictErrors.forEach((message, pos) => this.raise(pos, message));
      this.state.strictErrors.clear();
    }
  }

  curContext() {
    return this.state.context[this.state.context.length - 1];
  }

  nextToken() {
    const curContext = this.curContext();
    if (!curContext.preserveSpace) this.skipSpace();
    this.state.start = this.state.pos;
    if (!this.isLookahead) this.state.startLoc = this.state.curPosition();

    if (this.state.pos >= this.length) {
      this.finishToken(130);
      return;
    }

    if (curContext === _context.types.template) {
      this.readTmplToken();
    } else {
      this.getTokenFromCode(this.codePointAtPos(this.state.pos));
    }
  }

  skipBlockComment() {
    let startLoc;
    if (!this.isLookahead) startLoc = this.state.curPosition();
    const start = this.state.pos;
    const end = this.input.indexOf("*/", start + 2);
    if (end === -1) throw this.raise(start, _error.Errors.UnterminatedComment);
    this.state.pos = end + 2;
    _whitespace.lineBreakG.lastIndex = start + 2;

    while (_whitespace.lineBreakG.test(this.input) && _whitespace.lineBreakG.lastIndex <= end) {
      ++this.state.curLine;
      this.state.lineStart = _whitespace.lineBreakG.lastIndex;
    }

    if (this.isLookahead) return;
    const comment = {
      type: "CommentBlock",
      value: this.input.slice(start + 2, end),
      start,
      end: end + 2,
      loc: new _location.SourceLocation(startLoc, this.state.curPosition())
    };
    if (this.options.tokens) this.pushToken(comment);
    return comment;
  }

  skipLineComment(startSkip) {
    const start = this.state.pos;
    let startLoc;
    if (!this.isLookahead) startLoc = this.state.curPosition();
    let ch = this.input.charCodeAt(this.state.pos += startSkip);

    if (this.state.pos < this.length) {
      while (!(0, _whitespace.isNewLine)(ch) && ++this.state.pos < this.length) {
        ch = this.input.charCodeAt(this.state.pos);
      }
    }

    if (this.isLookahead) return;
    const end = this.state.pos;
    const value = this.input.slice(start + startSkip, end);
    const comment = {
      type: "CommentLine",
      value,
      start,
      end,
      loc: new _location.SourceLocation(startLoc, this.state.curPosition())
    };
    if (this.options.tokens) this.pushToken(comment);
    return comment;
  }

  skipSpace() {
    const spaceStart = this.state.pos;
    const comments = [];

    loop: while (this.state.pos < this.length) {
      const ch = this.input.charCodeAt(this.state.pos);

      switch (ch) {
        case 32:
        case 160:
        case 9:
          ++this.state.pos;
          break;

        case 13:
          if (this.input.charCodeAt(this.state.pos + 1) === 10) {
            ++this.state.pos;
          }

        case 10:
        case 8232:
        case 8233:
          ++this.state.pos;
          ++this.state.curLine;
          this.state.lineStart = this.state.pos;
          break;

        case 47:
          switch (this.input.charCodeAt(this.state.pos + 1)) {
            case 42:
              {
                const comment = this.skipBlockComment();

                if (comment !== undefined) {
                  this.addComment(comment);
                  if (this.options.attachComment) comments.push(comment);
                }

                break;
              }

            case 47:
              {
                const comment = this.skipLineComment(2);

                if (comment !== undefined) {
                  this.addComment(comment);
                  if (this.options.attachComment) comments.push(comment);
                }

                break;
              }

            default:
              break loop;
          }

          break;

        default:
          if ((0, _whitespace.isWhitespace)(ch)) {
            ++this.state.pos;
          } else if (ch === 45 && !this.inModule) {
            const pos = this.state.pos;

            if (this.input.charCodeAt(pos + 1) === 45 && this.input.charCodeAt(pos + 2) === 62 && (spaceStart === 0 || this.state.lineStart > spaceStart)) {
              const comment = this.skipLineComment(3);

              if (comment !== undefined) {
                this.addComment(comment);
                if (this.options.attachComment) comments.push(comment);
              }
            } else {
              break loop;
            }
          } else if (ch === 60 && !this.inModule) {
            const pos = this.state.pos;

            if (this.input.charCodeAt(pos + 1) === 33 && this.input.charCodeAt(pos + 2) === 45 && this.input.charCodeAt(pos + 3) === 45) {
              const comment = this.skipLineComment(4);

              if (comment !== undefined) {
                this.addComment(comment);
                if (this.options.attachComment) comments.push(comment);
              }
            } else {
              break loop;
            }
          } else {
            break loop;
          }

      }
    }

    if (comments.length > 0) {
      const end = this.state.pos;
      const CommentWhitespace = {
        start: spaceStart,
        end,
        comments,
        leadingNode: null,
        trailingNode: null,
        containingNode: null
      };
      this.state.commentStack.push(CommentWhitespace);
    }
  }

  finishToken(type, val) {
    this.state.end = this.state.pos;
    const prevType = this.state.type;
    this.state.type = type;
    this.state.value = val;

    if (!this.isLookahead) {
      this.state.endLoc = this.state.curPosition();
      this.updateContext(prevType);
    }
  }

  replaceToken(type) {
    this.state.type = type;
    this.updateContext();
  }

  readToken_numberSign() {
    if (this.state.pos === 0 && this.readToken_interpreter()) {
      return;
    }

    const nextPos = this.state.pos + 1;
    const next = this.codePointAtPos(nextPos);

    if (next >= 48 && next <= 57) {
      throw this.raise(this.state.pos, _error.Errors.UnexpectedDigitAfterHash);
    }

    if (next === 123 || next === 91 && this.hasPlugin("recordAndTuple")) {
      this.expectPlugin("recordAndTuple");

      if (this.getPluginOption("recordAndTuple", "syntaxType") !== "hash") {
        throw this.raise(this.state.pos, next === 123 ? _error.Errors.RecordExpressionHashIncorrectStartSyntaxType : _error.Errors.TupleExpressionHashIncorrectStartSyntaxType);
      }

      this.state.pos += 2;

      if (next === 123) {
        this.finishToken(7);
      } else {
        this.finishToken(1);
      }
    } else if ((0, _identifier.isIdentifierStart)(next)) {
      ++this.state.pos;
      this.finishToken(129, this.readWord1(next));
    } else if (next === 92) {
      ++this.state.pos;
      this.finishToken(129, this.readWord1());
    } else {
      this.finishOp(25, 1);
    }
  }

  readToken_dot() {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next >= 48 && next <= 57) {
      this.readNumber(true);
      return;
    }

    if (next === 46 && this.input.charCodeAt(this.state.pos + 2) === 46) {
      this.state.pos += 3;
      this.finishToken(21);
    } else {
      ++this.state.pos;
      this.finishToken(16);
    }
  }

  readToken_slash() {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === 61) {
      this.finishOp(29, 2);
    } else {
      this.finishOp(51, 1);
    }
  }

  readToken_interpreter() {
    if (this.state.pos !== 0 || this.length < 2) return false;
    let ch = this.input.charCodeAt(this.state.pos + 1);
    if (ch !== 33) return false;
    const start = this.state.pos;
    this.state.pos += 1;

    while (!(0, _whitespace.isNewLine)(ch) && ++this.state.pos < this.length) {
      ch = this.input.charCodeAt(this.state.pos);
    }

    const value = this.input.slice(start + 2, this.state.pos);
    this.finishToken(26, value);
    return true;
  }

  readToken_mult_modulo(code) {
    let type = code === 42 ? 50 : 49;
    let width = 1;
    let next = this.input.charCodeAt(this.state.pos + 1);

    if (code === 42 && next === 42) {
      width++;
      next = this.input.charCodeAt(this.state.pos + 2);
      type = 52;
    }

    if (next === 61 && !this.state.inType) {
      width++;
      type = code === 37 ? 31 : 28;
    }

    this.finishOp(type, width);
  }

  readToken_pipe_amp(code) {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      if (this.input.charCodeAt(this.state.pos + 2) === 61) {
        this.finishOp(28, 3);
      } else {
        this.finishOp(code === 124 ? 38 : 39, 2);
      }

      return;
    }

    if (code === 124) {
      if (next === 62) {
        this.finishOp(35, 2);
        return;
      }

      if (this.hasPlugin("recordAndTuple") && next === 125) {
        if (this.getPluginOption("recordAndTuple", "syntaxType") !== "bar") {
          throw this.raise(this.state.pos, _error.Errors.RecordExpressionBarIncorrectEndSyntaxType);
        }

        this.state.pos += 2;
        this.finishToken(9);
        return;
      }

      if (this.hasPlugin("recordAndTuple") && next === 93) {
        if (this.getPluginOption("recordAndTuple", "syntaxType") !== "bar") {
          throw this.raise(this.state.pos, _error.Errors.TupleExpressionBarIncorrectEndSyntaxType);
        }

        this.state.pos += 2;
        this.finishToken(4);
        return;
      }
    }

    if (next === 61) {
      this.finishOp(28, 2);
      return;
    }

    this.finishOp(code === 124 ? 40 : 42, 1);
  }

  readToken_caret() {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === 61 && !this.state.inType) {
      this.finishOp(30, 2);
    } else {
      this.finishOp(41, 1);
    }
  }

  readToken_plus_min(code) {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      this.finishOp(32, 2);
      return;
    }

    if (next === 61) {
      this.finishOp(28, 2);
    } else {
      this.finishOp(48, 1);
    }
  }

  readToken_lt() {
    const {
      pos
    } = this.state;
    const next = this.input.charCodeAt(pos + 1);

    if (next === 60) {
      if (this.input.charCodeAt(pos + 2) === 61) {
        this.finishOp(28, 3);
        return;
      }

      this.finishOp(47, 2);
      return;
    }

    if (next === 61) {
      this.finishOp(46, 2);
      return;
    }

    this.finishOp(44, 1);
  }

  readToken_gt() {
    const {
      pos
    } = this.state;
    const next = this.input.charCodeAt(pos + 1);

    if (next === 62) {
      const size = this.input.charCodeAt(pos + 2) === 62 ? 3 : 2;

      if (this.input.charCodeAt(pos + size) === 61) {
        this.finishOp(28, size + 1);
        return;
      }

      this.finishOp(47, size);
      return;
    }

    if (next === 61) {
      this.finishOp(46, 2);
      return;
    }

    this.finishOp(45, 1);
  }

  readToken_eq_excl(code) {
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === 61) {
      this.finishOp(43, this.input.charCodeAt(this.state.pos + 2) === 61 ? 3 : 2);
      return;
    }

    if (code === 61 && next === 62) {
      this.state.pos += 2;
      this.finishToken(19);
      return;
    }

    this.finishOp(code === 61 ? 27 : 33, 1);
  }

  readToken_question() {
    const next = this.input.charCodeAt(this.state.pos + 1);
    const next2 = this.input.charCodeAt(this.state.pos + 2);

    if (next === 63) {
      if (next2 === 61) {
        this.finishOp(28, 3);
      } else {
        this.finishOp(36, 2);
      }
    } else if (next === 46 && !(next2 >= 48 && next2 <= 57)) {
      this.state.pos += 2;
      this.finishToken(18);
    } else {
      ++this.state.pos;
      this.finishToken(17);
    }
  }

  getTokenFromCode(code) {
    switch (code) {
      case 46:
        this.readToken_dot();
        return;

      case 40:
        ++this.state.pos;
        this.finishToken(10);
        return;

      case 41:
        ++this.state.pos;
        this.finishToken(11);
        return;

      case 59:
        ++this.state.pos;
        this.finishToken(13);
        return;

      case 44:
        ++this.state.pos;
        this.finishToken(12);
        return;

      case 91:
        if (this.hasPlugin("recordAndTuple") && this.input.charCodeAt(this.state.pos + 1) === 124) {
          if (this.getPluginOption("recordAndTuple", "syntaxType") !== "bar") {
            throw this.raise(this.state.pos, _error.Errors.TupleExpressionBarIncorrectStartSyntaxType);
          }

          this.state.pos += 2;
          this.finishToken(2);
        } else {
          ++this.state.pos;
          this.finishToken(0);
        }

        return;

      case 93:
        ++this.state.pos;
        this.finishToken(3);
        return;

      case 123:
        if (this.hasPlugin("recordAndTuple") && this.input.charCodeAt(this.state.pos + 1) === 124) {
          if (this.getPluginOption("recordAndTuple", "syntaxType") !== "bar") {
            throw this.raise(this.state.pos, _error.Errors.RecordExpressionBarIncorrectStartSyntaxType);
          }

          this.state.pos += 2;
          this.finishToken(6);
        } else {
          ++this.state.pos;
          this.finishToken(5);
        }

        return;

      case 125:
        ++this.state.pos;
        this.finishToken(8);
        return;

      case 58:
        if (this.hasPlugin("functionBind") && this.input.charCodeAt(this.state.pos + 1) === 58) {
          this.finishOp(15, 2);
        } else {
          ++this.state.pos;
          this.finishToken(14);
        }

        return;

      case 63:
        this.readToken_question();
        return;

      case 96:
        ++this.state.pos;
        this.finishToken(22);
        return;

      case 48:
        {
          const next = this.input.charCodeAt(this.state.pos + 1);

          if (next === 120 || next === 88) {
            this.readRadixNumber(16);
            return;
          }

          if (next === 111 || next === 79) {
            this.readRadixNumber(8);
            return;
          }

          if (next === 98 || next === 66) {
            this.readRadixNumber(2);
            return;
          }
        }

      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        this.readNumber(false);
        return;

      case 34:
      case 39:
        this.readString(code);
        return;

      case 47:
        this.readToken_slash();
        return;

      case 37:
      case 42:
        this.readToken_mult_modulo(code);
        return;

      case 124:
      case 38:
        this.readToken_pipe_amp(code);
        return;

      case 94:
        this.readToken_caret();
        return;

      case 43:
      case 45:
        this.readToken_plus_min(code);
        return;

      case 60:
        this.readToken_lt();
        return;

      case 62:
        this.readToken_gt();
        return;

      case 61:
      case 33:
        this.readToken_eq_excl(code);
        return;

      case 126:
        this.finishOp(34, 1);
        return;

      case 64:
        ++this.state.pos;
        const word = this.readWord1();

        if (word && word.length > 0) {
          this.finishToken(37, word);
          return;
        }

        this.finishToken(24);
        return;

      case 35:
        this.readToken_numberSign();
        return;

      case 92:
        this.readWord();
        return;

      default:
        if ((0, _identifier.isIdentifierStart)(code)) {
          this.readWord(code);
          return;
        }

    }

    throw this.raise(this.state.pos, _error.Errors.InvalidOrUnexpectedToken, String.fromCodePoint(code));
  }

  finishOp(type, size) {
    const str = this.input.slice(this.state.pos, this.state.pos + size);
    this.state.pos += size;
    this.finishToken(type, str);
  }

  readRegexp() {
    const start = this.state.start + 1;
    let escaped, inClass;
    let {
      pos
    } = this.state;

    for (;; ++pos) {
      if (pos >= this.length) {
        throw this.raise(start, _error.Errors.UnterminatedRegExp);
      }

      const ch = this.input.charCodeAt(pos);

      if ((0, _whitespace.isNewLine)(ch)) {
        throw this.raise(start, _error.Errors.UnterminatedRegExp);
      }

      if (escaped) {
        escaped = false;
      } else {
        if (ch === 91) {
          inClass = true;
        } else if (ch === 93 && inClass) {
          inClass = false;
        } else if (ch === 47 && !inClass) {
          break;
        }

        escaped = ch === 92;
      }
    }

    const content = this.input.slice(start, pos);
    ++pos;
    let mods = "";

    while (pos < this.length) {
      const cp = this.codePointAtPos(pos);
      const char = String.fromCharCode(cp);

      if (VALID_REGEX_FLAGS.has(cp)) {
        if (mods.includes(char)) {
          this.raise(pos + 1, _error.Errors.DuplicateRegExpFlags);
        }
      } else if ((0, _identifier.isIdentifierChar)(cp) || cp === 92) {
        this.raise(pos + 1, _error.Errors.MalformedRegExpFlags);
      } else {
        break;
      }

      ++pos;
      mods += char;
    }

    this.state.pos = pos;
    this.finishToken(128, {
      pattern: content,
      flags: mods
    });
  }

  readInt(radix, len, forceLen, allowNumSeparator = true) {
    const start = this.state.pos;
    const forbiddenSiblings = radix === 16 ? forbiddenNumericSeparatorSiblings.hex : forbiddenNumericSeparatorSiblings.decBinOct;
    const allowedSiblings = radix === 16 ? allowedNumericSeparatorSiblings.hex : radix === 10 ? allowedNumericSeparatorSiblings.dec : radix === 8 ? allowedNumericSeparatorSiblings.oct : allowedNumericSeparatorSiblings.bin;
    let invalid = false;
    let total = 0;

    for (let i = 0, e = len == null ? Infinity : len; i < e; ++i) {
      const code = this.input.charCodeAt(this.state.pos);
      let val;

      if (code === 95) {
        const prev = this.input.charCodeAt(this.state.pos - 1);
        const next = this.input.charCodeAt(this.state.pos + 1);

        if (allowedSiblings.indexOf(next) === -1) {
          this.raise(this.state.pos, _error.Errors.UnexpectedNumericSeparator);
        } else if (forbiddenSiblings.indexOf(prev) > -1 || forbiddenSiblings.indexOf(next) > -1 || Number.isNaN(next)) {
          this.raise(this.state.pos, _error.Errors.UnexpectedNumericSeparator);
        }

        if (!allowNumSeparator) {
          this.raise(this.state.pos, _error.Errors.NumericSeparatorInEscapeSequence);
        }

        ++this.state.pos;
        continue;
      }

      if (code >= 97) {
        val = code - 97 + 10;
      } else if (code >= 65) {
        val = code - 65 + 10;
      } else if (_isDigit(code)) {
        val = code - 48;
      } else {
        val = Infinity;
      }

      if (val >= radix) {
        if (this.options.errorRecovery && val <= 9) {
          val = 0;
          this.raise(this.state.start + i + 2, _error.Errors.InvalidDigit, radix);
        } else if (forceLen) {
          val = 0;
          invalid = true;
        } else {
          break;
        }
      }

      ++this.state.pos;
      total = total * radix + val;
    }

    if (this.state.pos === start || len != null && this.state.pos - start !== len || invalid) {
      return null;
    }

    return total;
  }

  readRadixNumber(radix) {
    const start = this.state.pos;
    let isBigInt = false;
    this.state.pos += 2;
    const val = this.readInt(radix);

    if (val == null) {
      this.raise(this.state.start + 2, _error.Errors.InvalidDigit, radix);
    }

    const next = this.input.charCodeAt(this.state.pos);

    if (next === 110) {
      ++this.state.pos;
      isBigInt = true;
    } else if (next === 109) {
      throw this.raise(start, _error.Errors.InvalidDecimal);
    }

    if ((0, _identifier.isIdentifierStart)(this.codePointAtPos(this.state.pos))) {
      throw this.raise(this.state.pos, _error.Errors.NumberIdentifier);
    }

    if (isBigInt) {
      const str = this.input.slice(start, this.state.pos).replace(/[_n]/g, "");
      this.finishToken(126, str);
      return;
    }

    this.finishToken(125, val);
  }

  readNumber(startsWithDot) {
    const start = this.state.pos;
    let isFloat = false;
    let isBigInt = false;
    let isDecimal = false;
    let hasExponent = false;
    let isOctal = false;

    if (!startsWithDot && this.readInt(10) === null) {
      this.raise(start, _error.Errors.InvalidNumber);
    }

    const hasLeadingZero = this.state.pos - start >= 2 && this.input.charCodeAt(start) === 48;

    if (hasLeadingZero) {
      const integer = this.input.slice(start, this.state.pos);
      this.recordStrictModeErrors(start, _error.Errors.StrictOctalLiteral);

      if (!this.state.strict) {
        const underscorePos = integer.indexOf("_");

        if (underscorePos > 0) {
          this.raise(underscorePos + start, _error.Errors.ZeroDigitNumericSeparator);
        }
      }

      isOctal = hasLeadingZero && !/[89]/.test(integer);
    }

    let next = this.input.charCodeAt(this.state.pos);

    if (next === 46 && !isOctal) {
      ++this.state.pos;
      this.readInt(10);
      isFloat = true;
      next = this.input.charCodeAt(this.state.pos);
    }

    if ((next === 69 || next === 101) && !isOctal) {
      next = this.input.charCodeAt(++this.state.pos);

      if (next === 43 || next === 45) {
        ++this.state.pos;
      }

      if (this.readInt(10) === null) {
        this.raise(start, _error.Errors.InvalidOrMissingExponent);
      }

      isFloat = true;
      hasExponent = true;
      next = this.input.charCodeAt(this.state.pos);
    }

    if (next === 110) {
      if (isFloat || hasLeadingZero) {
        this.raise(start, _error.Errors.InvalidBigIntLiteral);
      }

      ++this.state.pos;
      isBigInt = true;
    }

    if (next === 109) {
      this.expectPlugin("decimal", this.state.pos);

      if (hasExponent || hasLeadingZero) {
        this.raise(start, _error.Errors.InvalidDecimal);
      }

      ++this.state.pos;
      isDecimal = true;
    }

    if ((0, _identifier.isIdentifierStart)(this.codePointAtPos(this.state.pos))) {
      throw this.raise(this.state.pos, _error.Errors.NumberIdentifier);
    }

    const str = this.input.slice(start, this.state.pos).replace(/[_mn]/g, "");

    if (isBigInt) {
      this.finishToken(126, str);
      return;
    }

    if (isDecimal) {
      this.finishToken(127, str);
      return;
    }

    const val = isOctal ? parseInt(str, 8) : parseFloat(str);
    this.finishToken(125, val);
  }

  readCodePoint(throwOnInvalid) {
    const ch = this.input.charCodeAt(this.state.pos);
    let code;

    if (ch === 123) {
      const codePos = ++this.state.pos;
      code = this.readHexChar(this.input.indexOf("}", this.state.pos) - this.state.pos, true, throwOnInvalid);
      ++this.state.pos;

      if (code !== null && code > 0x10ffff) {
        if (throwOnInvalid) {
          this.raise(codePos, _error.Errors.InvalidCodePoint);
        } else {
          return null;
        }
      }
    } else {
      code = this.readHexChar(4, false, throwOnInvalid);
    }

    return code;
  }

  readString(quote) {
    let out = "",
        chunkStart = ++this.state.pos;

    for (;;) {
      if (this.state.pos >= this.length) {
        throw this.raise(this.state.start, _error.Errors.UnterminatedString);
      }

      const ch = this.input.charCodeAt(this.state.pos);
      if (ch === quote) break;

      if (ch === 92) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.readEscapedChar(false);
        chunkStart = this.state.pos;
      } else if (ch === 8232 || ch === 8233) {
        ++this.state.pos;
        ++this.state.curLine;
        this.state.lineStart = this.state.pos;
      } else if ((0, _whitespace.isNewLine)(ch)) {
        throw this.raise(this.state.start, _error.Errors.UnterminatedString);
      } else {
        ++this.state.pos;
      }
    }

    out += this.input.slice(chunkStart, this.state.pos++);
    this.finishToken(124, out);
  }

  readTmplToken() {
    let out = "",
        chunkStart = this.state.pos,
        containsInvalid = false;

    for (;;) {
      if (this.state.pos >= this.length) {
        throw this.raise(this.state.start, _error.Errors.UnterminatedTemplate);
      }

      const ch = this.input.charCodeAt(this.state.pos);

      if (ch === 96 || ch === 36 && this.input.charCodeAt(this.state.pos + 1) === 123) {
        if (this.state.pos === this.state.start && this.match(20)) {
          if (ch === 36) {
            this.state.pos += 2;
            this.finishToken(23);
            return;
          } else {
            ++this.state.pos;
            this.finishToken(22);
            return;
          }
        }

        out += this.input.slice(chunkStart, this.state.pos);
        this.finishToken(20, containsInvalid ? null : out);
        return;
      }

      if (ch === 92) {
        out += this.input.slice(chunkStart, this.state.pos);
        const escaped = this.readEscapedChar(true);

        if (escaped === null) {
          containsInvalid = true;
        } else {
          out += escaped;
        }

        chunkStart = this.state.pos;
      } else if ((0, _whitespace.isNewLine)(ch)) {
        out += this.input.slice(chunkStart, this.state.pos);
        ++this.state.pos;

        switch (ch) {
          case 13:
            if (this.input.charCodeAt(this.state.pos) === 10) {
              ++this.state.pos;
            }

          case 10:
            out += "\n";
            break;

          default:
            out += String.fromCharCode(ch);
            break;
        }

        ++this.state.curLine;
        this.state.lineStart = this.state.pos;
        chunkStart = this.state.pos;
      } else {
        ++this.state.pos;
      }
    }
  }

  recordStrictModeErrors(pos, message) {
    if (this.state.strict && !this.state.strictErrors.has(pos)) {
      this.raise(pos, message);
    } else {
      this.state.strictErrors.set(pos, message);
    }
  }

  readEscapedChar(inTemplate) {
    const throwOnInvalid = !inTemplate;
    const ch = this.input.charCodeAt(++this.state.pos);
    ++this.state.pos;

    switch (ch) {
      case 110:
        return "\n";

      case 114:
        return "\r";

      case 120:
        {
          const code = this.readHexChar(2, false, throwOnInvalid);
          return code === null ? null : String.fromCharCode(code);
        }

      case 117:
        {
          const code = this.readCodePoint(throwOnInvalid);
          return code === null ? null : String.fromCodePoint(code);
        }

      case 116:
        return "\t";

      case 98:
        return "\b";

      case 118:
        return "\u000b";

      case 102:
        return "\f";

      case 13:
        if (this.input.charCodeAt(this.state.pos) === 10) {
          ++this.state.pos;
        }

      case 10:
        this.state.lineStart = this.state.pos;
        ++this.state.curLine;

      case 8232:
      case 8233:
        return "";

      case 56:
      case 57:
        if (inTemplate) {
          return null;
        } else {
          this.recordStrictModeErrors(this.state.pos - 1, _error.Errors.StrictNumericEscape);
        }

      default:
        if (ch >= 48 && ch <= 55) {
          const codePos = this.state.pos - 1;
          const match = this.input.substr(this.state.pos - 1, 3).match(/^[0-7]+/);
          let octalStr = match[0];
          let octal = parseInt(octalStr, 8);

          if (octal > 255) {
            octalStr = octalStr.slice(0, -1);
            octal = parseInt(octalStr, 8);
          }

          this.state.pos += octalStr.length - 1;
          const next = this.input.charCodeAt(this.state.pos);

          if (octalStr !== "0" || next === 56 || next === 57) {
            if (inTemplate) {
              return null;
            } else {
              this.recordStrictModeErrors(codePos, _error.Errors.StrictNumericEscape);
            }
          }

          return String.fromCharCode(octal);
        }

        return String.fromCharCode(ch);
    }
  }

  readHexChar(len, forceLen, throwOnInvalid) {
    const codePos = this.state.pos;
    const n = this.readInt(16, len, forceLen, false);

    if (n === null) {
      if (throwOnInvalid) {
        this.raise(codePos, _error.Errors.InvalidEscapeSequence);
      } else {
        this.state.pos = codePos - 1;
      }
    }

    return n;
  }

  readWord1(firstCode) {
    this.state.containsEsc = false;
    let word = "";
    const start = this.state.pos;
    let chunkStart = this.state.pos;

    if (firstCode !== undefined) {
      this.state.pos += firstCode <= 0xffff ? 1 : 2;
    }

    while (this.state.pos < this.length) {
      const ch = this.codePointAtPos(this.state.pos);

      if ((0, _identifier.isIdentifierChar)(ch)) {
        this.state.pos += ch <= 0xffff ? 1 : 2;
      } else if (ch === 92) {
        this.state.containsEsc = true;
        word += this.input.slice(chunkStart, this.state.pos);
        const escStart = this.state.pos;
        const identifierCheck = this.state.pos === start ? _identifier.isIdentifierStart : _identifier.isIdentifierChar;

        if (this.input.charCodeAt(++this.state.pos) !== 117) {
          this.raise(this.state.pos, _error.Errors.MissingUnicodeEscape);
          chunkStart = this.state.pos - 1;
          continue;
        }

        ++this.state.pos;
        const esc = this.readCodePoint(true);

        if (esc !== null) {
          if (!identifierCheck(esc)) {
            this.raise(escStart, _error.Errors.EscapedCharNotAnIdentifier);
          }

          word += String.fromCodePoint(esc);
        }

        chunkStart = this.state.pos;
      } else {
        break;
      }
    }

    return word + this.input.slice(chunkStart, this.state.pos);
  }

  readWord(firstCode) {
    const word = this.readWord1(firstCode);

    const type = _types2.keywords.get(word);

    if (type !== undefined) {
      this.finishToken(type, (0, _types2.tokenLabelName)(type));
    } else {
      this.finishToken(123, word);
    }
  }

  checkKeywordEscapes() {
    const {
      type
    } = this.state;

    if ((0, _types2.tokenIsKeyword)(type) && this.state.containsEsc) {
      this.raise(this.state.start, _error.Errors.InvalidEscapedReservedWord, (0, _types2.tokenLabelName)(type));
    }
  }

  updateContext(prevType) {
    const {
      context,
      type
    } = this.state;

    switch (type) {
      case 8:
        context.pop();
        break;

      case 5:
      case 7:
      case 23:
        context.push(_context.types.brace);
        break;

      case 22:
        if (context[context.length - 1] === _context.types.template) {
          context.pop();
        } else {
          context.push(_context.types.template);
        }

        break;

      default:
        break;
    }
  }

}

exports.default = Tokenizer;