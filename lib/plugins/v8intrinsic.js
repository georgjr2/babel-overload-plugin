"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var N = require("../types");

var _default = superClass => class extends superClass {
  parseV8Intrinsic() {
    if (this.match(49)) {
      const v8IntrinsicStart = this.state.start;
      const node = this.startNode();
      this.next();

      if ((0, _types.tokenIsIdentifier)(this.state.type)) {
        const name = this.parseIdentifierName(this.state.start);
        const identifier = this.createIdentifier(node, name);
        identifier.type = "V8IntrinsicIdentifier";

        if (this.match(10)) {
          return identifier;
        }
      }

      this.unexpected(v8IntrinsicStart);
    }
  }

  parseExprAtom() {
    return this.parseV8Intrinsic() || super.parseExprAtom(...arguments);
  }

};

exports.default = _default;