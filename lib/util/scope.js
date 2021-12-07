"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Scope = void 0;

var _scopeflags = require("./scopeflags");

var N = require("../types");

var _error = require("../parser/error");

class Scope {
  var = new Set();
  lexical = new Set();
  functions = new Set();

  constructor(flags) {
    this.flags = flags;
  }

}

exports.Scope = Scope;

class ScopeHandler {
  scopeStack = [];
  undefinedExports = new Map();
  undefinedPrivateNames = new Map();

  constructor(raise, inModule) {
    this.raise = raise;
    this.inModule = inModule;
  }

  get inFunction() {
    return (this.currentVarScopeFlags() & _scopeflags.SCOPE_FUNCTION) > 0;
  }

  get allowSuper() {
    return (this.currentThisScopeFlags() & _scopeflags.SCOPE_SUPER) > 0;
  }

  get allowDirectSuper() {
    return (this.currentThisScopeFlags() & _scopeflags.SCOPE_DIRECT_SUPER) > 0;
  }

  get inClass() {
    return (this.currentThisScopeFlags() & _scopeflags.SCOPE_CLASS) > 0;
  }

  get inClassAndNotInNonArrowFunction() {
    const flags = this.currentThisScopeFlags();
    return (flags & _scopeflags.SCOPE_CLASS) > 0 && (flags & _scopeflags.SCOPE_FUNCTION) === 0;
  }

  get inStaticBlock() {
    for (let i = this.scopeStack.length - 1;; i--) {
      const {
        flags
      } = this.scopeStack[i];

      if (flags & _scopeflags.SCOPE_STATIC_BLOCK) {
        return true;
      }

      if (flags & (_scopeflags.SCOPE_VAR | _scopeflags.SCOPE_CLASS)) {
        return false;
      }
    }
  }

  get inNonArrowFunction() {
    return (this.currentThisScopeFlags() & _scopeflags.SCOPE_FUNCTION) > 0;
  }

  get treatFunctionsAsVar() {
    return this.treatFunctionsAsVarInScope(this.currentScope());
  }

  createScope(flags) {
    return new Scope(flags);
  }

  enter(flags) {
    this.scopeStack.push(this.createScope(flags));
  }

  exit() {
    this.scopeStack.pop();
  }

  treatFunctionsAsVarInScope(scope) {
    return !!(scope.flags & _scopeflags.SCOPE_FUNCTION || !this.inModule && scope.flags & _scopeflags.SCOPE_PROGRAM);
  }

  declareName(name, bindingType, pos) {
    let scope = this.currentScope();

    if (bindingType & _scopeflags.BIND_SCOPE_LEXICAL || bindingType & _scopeflags.BIND_SCOPE_FUNCTION) {
      this.checkRedeclarationInScope(scope, name, bindingType, pos);

      if (bindingType & _scopeflags.BIND_SCOPE_FUNCTION) {
        scope.functions.add(name);
      } else {
        scope.lexical.add(name);
      }

      if (bindingType & _scopeflags.BIND_SCOPE_LEXICAL) {
        this.maybeExportDefined(scope, name);
      }
    } else if (bindingType & _scopeflags.BIND_SCOPE_VAR) {
      for (let i = this.scopeStack.length - 1; i >= 0; --i) {
        scope = this.scopeStack[i];
        this.checkRedeclarationInScope(scope, name, bindingType, pos);
        scope.var.add(name);
        this.maybeExportDefined(scope, name);
        if (scope.flags & _scopeflags.SCOPE_VAR) break;
      }
    }

    if (this.inModule && scope.flags & _scopeflags.SCOPE_PROGRAM) {
      this.undefinedExports.delete(name);
    }
  }

  maybeExportDefined(scope, name) {
    if (this.inModule && scope.flags & _scopeflags.SCOPE_PROGRAM) {
      this.undefinedExports.delete(name);
    }
  }

  checkRedeclarationInScope(scope, name, bindingType, pos) {
    if (this.isRedeclaredInScope(scope, name, bindingType)) {
      this.raise(pos, _error.Errors.VarRedeclaration, name);
    }
  }

  isRedeclaredInScope(scope, name, bindingType) {
    if (!(bindingType & _scopeflags.BIND_KIND_VALUE)) return false;

    if (bindingType & _scopeflags.BIND_SCOPE_LEXICAL) {
      return scope.lexical.has(name) || scope.functions.has(name) || scope.var.has(name);
    }

    if (bindingType & _scopeflags.BIND_SCOPE_FUNCTION) {
      return scope.lexical.has(name) || !this.treatFunctionsAsVarInScope(scope) && scope.var.has(name);
    }

    return scope.lexical.has(name) && !(scope.flags & _scopeflags.SCOPE_SIMPLE_CATCH && scope.lexical.values().next().value === name) || !this.treatFunctionsAsVarInScope(scope) && scope.functions.has(name);
  }

  checkLocalExport(id) {
    const {
      name
    } = id;
    const topLevelScope = this.scopeStack[0];

    if (!topLevelScope.lexical.has(name) && !topLevelScope.var.has(name) && !topLevelScope.functions.has(name)) {
      this.undefinedExports.set(name, id.start);
    }
  }

  currentScope() {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  currentVarScopeFlags() {
    for (let i = this.scopeStack.length - 1;; i--) {
      const {
        flags
      } = this.scopeStack[i];

      if (flags & _scopeflags.SCOPE_VAR) {
        return flags;
      }
    }
  }

  currentThisScopeFlags() {
    for (let i = this.scopeStack.length - 1;; i--) {
      const {
        flags
      } = this.scopeStack[i];

      if (flags & (_scopeflags.SCOPE_VAR | _scopeflags.SCOPE_CLASS) && !(flags & _scopeflags.SCOPE_ARROW)) {
        return flags;
      }
    }
  }

}

exports.default = ScopeHandler;