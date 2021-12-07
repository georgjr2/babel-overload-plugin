"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "ErrorCodes", {
  enumerable: true,
  get: function () {
    return _errorCodes.ErrorCodes;
  }
});
Object.defineProperty(exports, "Errors", {
  enumerable: true,
  get: function () {
    return _errorMessage.ErrorMessages;
  }
});
Object.defineProperty(exports, "SourceTypeModuleErrors", {
  enumerable: true,
  get: function () {
    return _errorMessage.SourceTypeModuleErrorMessages;
  }
});
exports.default = void 0;
exports.makeErrorTemplates = makeErrorTemplates;

var _location = require("../util/location");

var _comments = require("./comments");

var _errorCodes = require("./error-codes");

var _errorMessage = require("./error-message");

function keepReasonCodeCompat(reasonCode, syntaxPlugin) {
  if (!process.env.BABEL_8_BREAKING) {
    if (syntaxPlugin === "flow" && reasonCode === "PatternIsOptional") {
      return "OptionalBindingPattern";
    }
  }

  return reasonCode;
}

function makeErrorTemplates(messages, code, syntaxPlugin) {
  const templates = {};
  Object.keys(messages).forEach(reasonCode => {
    templates[reasonCode] = Object.freeze({
      code,
      reasonCode: keepReasonCodeCompat(reasonCode, syntaxPlugin),
      template: messages[reasonCode]
    });
  });
  return Object.freeze(templates);
}

class ParserError extends _comments.default {
  getLocationForPosition(pos) {
    let loc;
    if (pos === this.state.start) loc = this.state.startLoc;else if (pos === this.state.lastTokStart) loc = this.state.lastTokStartLoc;else if (pos === this.state.end) loc = this.state.endLoc;else if (pos === this.state.lastTokEnd) loc = this.state.lastTokEndLoc;else loc = (0, _location.getLineInfo)(this.input, pos);
    return loc;
  }

  raise(pos, {
    code,
    reasonCode,
    template
  }, ...params) {
    return this.raiseWithData(pos, {
      code,
      reasonCode
    }, template, ...params);
  }

  raiseOverwrite(pos, {
    code,
    template
  }, ...params) {
    const loc = this.getLocationForPosition(pos);
    const message = template.replace(/%(\d+)/g, (_, i) => params[i]) + ` (${loc.line}:${loc.column})`;

    if (this.options.errorRecovery) {
      const errors = this.state.errors;

      for (let i = errors.length - 1; i >= 0; i--) {
        const error = errors[i];

        if (error.pos === pos) {
          return Object.assign(error, {
            message
          });
        } else if (error.pos < pos) {
          break;
        }
      }
    }

    return this._raise({
      code,
      loc,
      pos
    }, message);
  }

  raiseWithData(pos, data, errorTemplate, ...params) {
    const loc = this.getLocationForPosition(pos);
    const message = errorTemplate.replace(/%(\d+)/g, (_, i) => params[i]) + ` (${loc.line}:${loc.column})`;
    return this._raise(Object.assign({
      loc,
      pos
    }, data), message);
  }

  _raise(errorContext, message) {
    const err = new SyntaxError(message);
    Object.assign(err, errorContext);

    if (this.options.errorRecovery) {
      if (!this.isLookahead) this.state.errors.push(err);
      return err;
    } else {
      throw err;
    }
  }

}

exports.default = ParserError;