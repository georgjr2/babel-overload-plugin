"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var N = require("../types");

var _location = require("../util/location");

var _context = require("./context");

var _types2 = require("./types");

class State {
  strict;
  curLine;
  lineStart;
  startLoc;
  endLoc;

  init({
    strictMode,
    sourceType,
    startLine,
    startColumn
  }) {
    this.strict = strictMode === false ? false : strictMode === true ? true : sourceType === "module";
    this.curLine = startLine;
    this.lineStart = -startColumn;
    this.startLoc = this.endLoc = new _location.Position(startLine, startColumn);
  }

  errors = [];
  potentialArrowAt = -1;
  noArrowAt = [];
  noArrowParamsConversionAt = [];
  maybeInArrowParameters = false;
  inType = false;
  noAnonFunctionType = false;
  hasFlowComment = false;
  isAmbientContext = false;
  inAbstractClass = false;
  topicContext = {
    maxNumOfResolvableTopics: 0,
    maxTopicIndex: null
  };
  soloAwait = false;
  inFSharpPipelineDirectBody = false;
  labels = [];
  decoratorStack = [[]];
  comments = [];
  commentStack = [];
  pos = 0;
  type = 130;
  value = null;
  start = 0;
  end = 0;
  lastTokEndLoc = null;
  lastTokStartLoc = null;
  lastTokStart = 0;
  lastTokEnd = 0;
  context = [_context.types.brace];
  canStartJSXElement = true;
  containsEsc = false;
  strictErrors = new Map();
  tokensLength = 0;

  curPosition() {
    return new _location.Position(this.curLine, this.pos - this.lineStart);
  }

  clone(skipArrays) {
    const state = new State();
    const keys = Object.keys(this);

    for (let i = 0, length = keys.length; i < length; i++) {
      const key = keys[i];
      let val = this[key];

      if (!skipArrays && Array.isArray(val)) {
        val = val.slice();
      }

      state[key] = val;
    }

    return state;
  }

}

exports.default = State;