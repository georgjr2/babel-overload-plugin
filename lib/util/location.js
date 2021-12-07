"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SourceLocation = exports.Position = void 0;
exports.getLineInfo = getLineInfo;

var _whitespace = require("./whitespace");

class Position {
  line;
  column;

  constructor(line, col) {
    this.line = line;
    this.column = col;
  }

}

exports.Position = Position;

class SourceLocation {
  start;
  end;
  filename;
  identifierName;

  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

}

exports.SourceLocation = SourceLocation;

function getLineInfo(input, offset) {
  let line = 1;
  let lineStart = 0;
  let match;
  _whitespace.lineBreakG.lastIndex = 0;

  while ((match = _whitespace.lineBreakG.exec(input)) && match.index < offset) {
    line++;
    lineStart = _whitespace.lineBreakG.lastIndex;
  }

  return new Position(line, offset - lineStart);
}