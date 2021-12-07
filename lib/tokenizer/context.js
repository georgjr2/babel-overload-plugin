"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.types = exports.TokContext = void 0;

class TokContext {
  constructor(token, preserveSpace) {
    this.token = token;
    this.preserveSpace = !!preserveSpace;
  }

  token;
  preserveSpace;
}

exports.TokContext = TokContext;
const types = {
  brace: new TokContext("{"),
  template: new TokContext("`", true)
};
exports.types = types;