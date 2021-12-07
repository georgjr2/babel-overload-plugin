"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.ClassScope = void 0;

var _scopeflags = require("./scopeflags");

var _error = require("../parser/error");

class ClassScope {
  privateNames = new Set();
  loneAccessors = new Map();
  undefinedPrivateNames = new Map();
}

exports.ClassScope = ClassScope;

class ClassScopeHandler {
  stack = [];
  undefinedPrivateNames = new Map();

  constructor(raise) {
    this.raise = raise;
  }

  current() {
    return this.stack[this.stack.length - 1];
  }

  enter() {
    this.stack.push(new ClassScope());
  }

  exit() {
    const oldClassScope = this.stack.pop();
    const current = this.current();

    for (const [name, pos] of Array.from(oldClassScope.undefinedPrivateNames)) {
      if (current) {
        if (!current.undefinedPrivateNames.has(name)) {
          current.undefinedPrivateNames.set(name, pos);
        }
      } else {
        this.raise(pos, _error.Errors.InvalidPrivateFieldResolution, name);
      }
    }
  }

  declarePrivateName(name, elementType, pos) {
    const {
      privateNames,
      loneAccessors,
      undefinedPrivateNames
    } = this.current();
    let redefined = privateNames.has(name);

    if (elementType & _scopeflags.CLASS_ELEMENT_KIND_ACCESSOR) {
      const accessor = redefined && loneAccessors.get(name);

      if (accessor) {
        const oldStatic = accessor & _scopeflags.CLASS_ELEMENT_FLAG_STATIC;
        const newStatic = elementType & _scopeflags.CLASS_ELEMENT_FLAG_STATIC;
        const oldKind = accessor & _scopeflags.CLASS_ELEMENT_KIND_ACCESSOR;
        const newKind = elementType & _scopeflags.CLASS_ELEMENT_KIND_ACCESSOR;
        redefined = oldKind === newKind || oldStatic !== newStatic;
        if (!redefined) loneAccessors.delete(name);
      } else if (!redefined) {
        loneAccessors.set(name, elementType);
      }
    }

    if (redefined) {
      this.raise(pos, _error.Errors.PrivateNameRedeclaration, name);
    }

    privateNames.add(name);
    undefinedPrivateNames.delete(name);
  }

  usePrivateName(name, pos) {
    let classScope;

    for (classScope of this.stack) {
      if (classScope.privateNames.has(name)) return;
    }

    if (classScope) {
      classScope.undefinedPrivateNames.set(name, pos);
    } else {
      this.raise(pos, _error.Errors.InvalidPrivateFieldResolution, name);
    }
  }

}

exports.default = ClassScopeHandler;