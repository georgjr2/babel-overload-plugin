"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.newArrowHeadScope = newArrowHeadScope;
exports.newAsyncArrowScope = newAsyncArrowScope;
exports.newExpressionScope = newExpressionScope;
exports.newParameterDeclarationScope = newParameterDeclarationScope;
const kExpression = 0,
      kMaybeArrowParameterDeclaration = 1,
      kMaybeAsyncArrowParameterDeclaration = 2,
      kParameterDeclaration = 3;

class ExpressionScope {
  type;

  constructor(type = kExpression) {
    this.type = type;
  }

  canBeArrowParameterDeclaration() {
    return this.type === kMaybeAsyncArrowParameterDeclaration || this.type === kMaybeArrowParameterDeclaration;
  }

  isCertainlyParameterDeclaration() {
    return this.type === kParameterDeclaration;
  }

}

class ArrowHeadParsingScope extends ExpressionScope {
  errors = new Map();

  constructor(type) {
    super(type);
  }

  recordDeclarationError(pos, template) {
    this.errors.set(pos, template);
  }

  clearDeclarationError(pos) {
    this.errors.delete(pos);
  }

  iterateErrors(iterator) {
    this.errors.forEach(iterator);
  }

}

class ExpressionScopeHandler {
  stack = [new ExpressionScope()];

  constructor(raise) {
    this.raise = raise;
  }

  enter(scope) {
    this.stack.push(scope);
  }

  exit() {
    this.stack.pop();
  }

  recordParameterInitializerError(pos, template) {
    const {
      stack
    } = this;
    let i = stack.length - 1;
    let scope = stack[i];

    while (!scope.isCertainlyParameterDeclaration()) {
      if (scope.canBeArrowParameterDeclaration()) {
        scope.recordDeclarationError(pos, template);
      } else {
        return;
      }

      scope = stack[--i];
    }

    this.raise(pos, template);
  }

  recordParenthesizedIdentifierError(pos, template) {
    const {
      stack
    } = this;
    const scope = stack[stack.length - 1];

    if (scope.isCertainlyParameterDeclaration()) {
      this.raise(pos, template);
    } else if (scope.canBeArrowParameterDeclaration()) {
      scope.recordDeclarationError(pos, template);
    } else {
      return;
    }
  }

  recordAsyncArrowParametersError(pos, template) {
    const {
      stack
    } = this;
    let i = stack.length - 1;
    let scope = stack[i];

    while (scope.canBeArrowParameterDeclaration()) {
      if (scope.type === kMaybeAsyncArrowParameterDeclaration) {
        scope.recordDeclarationError(pos, template);
      }

      scope = stack[--i];
    }
  }

  validateAsPattern() {
    const {
      stack
    } = this;
    const currentScope = stack[stack.length - 1];
    if (!currentScope.canBeArrowParameterDeclaration()) return;
    currentScope.iterateErrors((template, pos) => {
      this.raise(pos, template);
      let i = stack.length - 2;
      let scope = stack[i];

      while (scope.canBeArrowParameterDeclaration()) {
        scope.clearDeclarationError(pos);
        scope = stack[--i];
      }
    });
  }

}

exports.default = ExpressionScopeHandler;

function newParameterDeclarationScope() {
  return new ExpressionScope(kParameterDeclaration);
}

function newArrowHeadScope() {
  return new ArrowHeadParsingScope(kMaybeArrowParameterDeclaration);
}

function newAsyncArrowScope() {
  return new ArrowHeadParsingScope(kMaybeAsyncArrowParameterDeclaration);
}

function newExpressionScope() {
  return new ExpressionScope();
}