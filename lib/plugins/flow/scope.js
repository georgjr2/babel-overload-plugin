"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _scope = require("../../util/scope");

var _scopeflags = require("../../util/scopeflags");

var N = require("../../types");

class FlowScope extends _scope.Scope {
  declareFunctions = new Set();
}

class FlowScopeHandler extends _scope.default {
  createScope(flags) {
    return new FlowScope(flags);
  }

  declareName(name, bindingType, pos) {
    const scope = this.currentScope();

    if (bindingType & _scopeflags.BIND_FLAGS_FLOW_DECLARE_FN) {
      this.checkRedeclarationInScope(scope, name, bindingType, pos);
      this.maybeExportDefined(scope, name);
      scope.declareFunctions.add(name);
      return;
    }

    super.declareName(...arguments);
  }

  isRedeclaredInScope(scope, name, bindingType) {
    if (super.isRedeclaredInScope(...arguments)) return true;

    if (bindingType & _scopeflags.BIND_FLAGS_FLOW_DECLARE_FN) {
      return !scope.declareFunctions.has(name) && (scope.lexical.has(name) || scope.functions.has(name));
    }

    return false;
  }

  checkLocalExport(id) {
    if (!this.scopeStack[0].declareFunctions.has(id.name)) {
      super.checkLocalExport(id);
    }
  }

}

exports.default = FlowScopeHandler;