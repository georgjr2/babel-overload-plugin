"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../../tokenizer/types");

var _context = require("../../tokenizer/context");

var N = require("../../types");

var _scopeflags = require("../../util/scopeflags");

var _scope = require("./scope");

var _productionParameter = require("../../util/production-parameter");

var _error = require("../../parser/error");

var _node = require("../../parser/node");

function nonNull(x) {
  if (x == null) {
    throw new Error(`Unexpected ${x} value.`);
  }

  return x;
}

function assert(x) {
  if (!x) {
    throw new Error("Assert fail");
  }
}

const TSErrors = (0, _error.makeErrorTemplates)({
  AbstractMethodHasImplementation: "Method '%0' cannot have an implementation because it is marked abstract.",
  AbstractPropertyHasInitializer: "Property '%0' cannot have an initializer because it is marked abstract.",
  AccesorCannotDeclareThisParameter: "'get' and 'set' accessors cannot declare 'this' parameters.",
  AccesorCannotHaveTypeParameters: "An accessor cannot have type parameters.",
  ClassMethodHasDeclare: "Class methods cannot have the 'declare' modifier.",
  ClassMethodHasReadonly: "Class methods cannot have the 'readonly' modifier.",
  ConstructorHasTypeParameters: "Type parameters cannot appear on a constructor declaration.",
  DeclareAccessor: "'declare' is not allowed in %0ters.",
  DeclareClassFieldHasInitializer: "Initializers are not allowed in ambient contexts.",
  DeclareFunctionHasImplementation: "An implementation cannot be declared in ambient contexts.",
  DuplicateAccessibilityModifier: "Accessibility modifier already seen.",
  DuplicateModifier: "Duplicate modifier: '%0'.",
  EmptyHeritageClauseType: "'%0' list cannot be empty.",
  EmptyTypeArguments: "Type argument list cannot be empty.",
  EmptyTypeParameters: "Type parameter list cannot be empty.",
  ExpectedAmbientAfterExportDeclare: "'export declare' must be followed by an ambient declaration.",
  ImportAliasHasImportType: "An import alias can not use 'import type'.",
  IncompatibleModifiers: "'%0' modifier cannot be used with '%1' modifier.",
  IndexSignatureHasAbstract: "Index signatures cannot have the 'abstract' modifier.",
  IndexSignatureHasAccessibility: "Index signatures cannot have an accessibility modifier ('%0').",
  IndexSignatureHasDeclare: "Index signatures cannot have the 'declare' modifier.",
  IndexSignatureHasOverride: "'override' modifier cannot appear on an index signature.",
  IndexSignatureHasStatic: "Index signatures cannot have the 'static' modifier.",
  InvalidModifierOnTypeMember: "'%0' modifier cannot appear on a type member.",
  InvalidModifiersOrder: "'%0' modifier must precede '%1' modifier.",
  InvalidTupleMemberLabel: "Tuple members must be labeled with a simple identifier.",
  MissingInterfaceName: "'interface' declarations must be followed by an identifier.",
  MixedLabeledAndUnlabeledElements: "Tuple members must all have names or all not have names.",
  NonAbstractClassHasAbstractMethod: "Abstract methods can only appear within an abstract class.",
  NonClassMethodPropertyHasAbstractModifer: "'abstract' modifier can only appear on a class, method, or property declaration.",
  OptionalTypeBeforeRequired: "A required element cannot follow an optional element.",
  OverrideNotInSubClass: "This member cannot have an 'override' modifier because its containing class does not extend another class.",
  PatternIsOptional: "A binding pattern parameter cannot be optional in an implementation signature.",
  PrivateElementHasAbstract: "Private elements cannot have the 'abstract' modifier.",
  PrivateElementHasAccessibility: "Private elements cannot have an accessibility modifier ('%0').",
  ReadonlyForMethodSignature: "'readonly' modifier can only appear on a property declaration or index signature.",
  ReservedArrowTypeParam: "This syntax is reserved in files with the .mts or .cts extension. Add a trailing comma, as in `<T,>() => ...`.",
  ReservedTypeAssertion: "This syntax is reserved in files with the .mts or .cts extension. Use an `as` expression instead.",
  SetAccesorCannotHaveOptionalParameter: "A 'set' accessor cannot have an optional parameter.",
  SetAccesorCannotHaveRestParameter: "A 'set' accessor cannot have rest parameter.",
  SetAccesorCannotHaveReturnType: "A 'set' accessor cannot have a return type annotation.",
  StaticBlockCannotHaveModifier: "Static class blocks cannot have any modifier.",
  TypeAnnotationAfterAssign: "Type annotations must come before default assignments, e.g. instead of `age = 25: number` use `age: number = 25`.",
  TypeImportCannotSpecifyDefaultAndNamed: "A type-only import can specify a default import or named bindings, but not both.",
  TypeModifierIsUsedInTypeExports: "The 'type' modifier cannot be used on a named export when 'export type' is used on its export statement.",
  TypeModifierIsUsedInTypeImports: "The 'type' modifier cannot be used on a named import when 'import type' is used on its import statement.",
  UnexpectedParameterModifier: "A parameter property is only allowed in a constructor implementation.",
  UnexpectedReadonly: "'readonly' type modifier is only permitted on array and tuple literal types.",
  UnexpectedTypeAnnotation: "Did not expect a type annotation here.",
  UnexpectedTypeCastInParameter: "Unexpected type cast in parameter position.",
  UnsupportedImportTypeArgument: "Argument in a type import must be a string literal.",
  UnsupportedParameterPropertyKind: "A parameter property may not be declared using a binding pattern.",
  UnsupportedSignatureParameterKind: "Name in a signature must be an Identifier, ObjectPattern or ArrayPattern, instead got %0."
}, _error.ErrorCodes.SyntaxError, "typescript");

function keywordTypeFromName(value) {
  switch (value) {
    case "any":
      return "TSAnyKeyword";

    case "boolean":
      return "TSBooleanKeyword";

    case "bigint":
      return "TSBigIntKeyword";

    case "never":
      return "TSNeverKeyword";

    case "number":
      return "TSNumberKeyword";

    case "object":
      return "TSObjectKeyword";

    case "string":
      return "TSStringKeyword";

    case "symbol":
      return "TSSymbolKeyword";

    case "undefined":
      return "TSUndefinedKeyword";

    case "unknown":
      return "TSUnknownKeyword";

    default:
      return undefined;
  }
}

function tsIsAccessModifier(modifier) {
  return modifier === "private" || modifier === "public" || modifier === "protected";
}

var _default = superClass => class extends superClass {
  getScopeHandler() {
    return _scope.default;
  }

  tsIsIdentifier() {
    return (0, _types.tokenIsIdentifier)(this.state.type);
  }

  tsTokenCanFollowModifier() {
    return (this.match(0) || this.match(5) || this.match(50) || this.match(21) || this.match(129) || this.isLiteralPropertyName()) && !this.hasPrecedingLineBreak();
  }

  tsNextTokenCanFollowModifier() {
    this.next();
    return this.tsTokenCanFollowModifier();
  }

  tsParseModifier(allowedModifiers, stopOnStartOfClassStaticBlock) {
    if (!(0, _types.tokenIsIdentifier)(this.state.type)) {
      return undefined;
    }

    const modifier = this.state.value;

    if (allowedModifiers.indexOf(modifier) !== -1) {
      if (stopOnStartOfClassStaticBlock && this.tsIsStartOfStaticBlocks()) {
        return undefined;
      }

      if (this.tsTryParse(this.tsNextTokenCanFollowModifier.bind(this))) {
        return modifier;
      }
    }

    return undefined;
  }

  tsParseModifiers(modified, allowedModifiers, disallowedModifiers, errorTemplate, stopOnStartOfClassStaticBlock) {
    const enforceOrder = (pos, modifier, before, after) => {
      if (modifier === before && modified[after]) {
        this.raise(pos, TSErrors.InvalidModifiersOrder, before, after);
      }
    };

    const incompatible = (pos, modifier, mod1, mod2) => {
      if (modified[mod1] && modifier === mod2 || modified[mod2] && modifier === mod1) {
        this.raise(pos, TSErrors.IncompatibleModifiers, mod1, mod2);
      }
    };

    for (;;) {
      const startPos = this.state.start;
      const modifier = this.tsParseModifier(allowedModifiers.concat(disallowedModifiers ?? []), stopOnStartOfClassStaticBlock);
      if (!modifier) break;

      if (tsIsAccessModifier(modifier)) {
        if (modified.accessibility) {
          this.raise(startPos, TSErrors.DuplicateAccessibilityModifier);
        } else {
          enforceOrder(startPos, modifier, modifier, "override");
          enforceOrder(startPos, modifier, modifier, "static");
          enforceOrder(startPos, modifier, modifier, "readonly");
          modified.accessibility = modifier;
        }
      } else {
        if (Object.hasOwnProperty.call(modified, modifier)) {
          this.raise(startPos, TSErrors.DuplicateModifier, modifier);
        } else {
          enforceOrder(startPos, modifier, "static", "readonly");
          enforceOrder(startPos, modifier, "static", "override");
          enforceOrder(startPos, modifier, "override", "readonly");
          enforceOrder(startPos, modifier, "abstract", "override");
          incompatible(startPos, modifier, "declare", "override");
          incompatible(startPos, modifier, "static", "abstract");
        }

        modified[modifier] = true;
      }

      if (disallowedModifiers != null && disallowedModifiers.includes(modifier)) {
        this.raise(startPos, errorTemplate, modifier);
      }
    }
  }

  tsIsListTerminator(kind) {
    switch (kind) {
      case "EnumMembers":
      case "TypeMembers":
        return this.match(8);

      case "HeritageClauseElement":
        return this.match(5);

      case "TupleElementTypes":
        return this.match(3);

      case "TypeParametersOrArguments":
        return this.match(45);
    }

    throw new Error("Unreachable");
  }

  tsParseList(kind, parseElement) {
    const result = [];

    while (!this.tsIsListTerminator(kind)) {
      result.push(parseElement());
    }

    return result;
  }

  tsParseDelimitedList(kind, parseElement, refTrailingCommaPos) {
    return nonNull(this.tsParseDelimitedListWorker(kind, parseElement, true, refTrailingCommaPos));
  }

  tsParseDelimitedListWorker(kind, parseElement, expectSuccess, refTrailingCommaPos) {
    const result = [];
    let trailingCommaPos = -1;

    for (;;) {
      if (this.tsIsListTerminator(kind)) {
        break;
      }

      trailingCommaPos = -1;
      const element = parseElement();

      if (element == null) {
        return undefined;
      }

      result.push(element);

      if (this.eat(12)) {
        trailingCommaPos = this.state.lastTokStart;
        continue;
      }

      if (this.tsIsListTerminator(kind)) {
        break;
      }

      if (expectSuccess) {
        this.expect(12);
      }

      return undefined;
    }

    if (refTrailingCommaPos) {
      refTrailingCommaPos.value = trailingCommaPos;
    }

    return result;
  }

  tsParseBracketedList(kind, parseElement, bracket, skipFirstToken, refTrailingCommaPos) {
    if (!skipFirstToken) {
      if (bracket) {
        this.expect(0);
      } else {
        this.expect(44);
      }
    }

    const result = this.tsParseDelimitedList(kind, parseElement, refTrailingCommaPos);

    if (bracket) {
      this.expect(3);
    } else {
      this.expect(45);
    }

    return result;
  }

  tsParseImportType() {
    const node = this.startNode();
    this.expect(78);
    this.expect(10);

    if (!this.match(124)) {
      this.raise(this.state.start, TSErrors.UnsupportedImportTypeArgument);
    }

    node.argument = this.parseExprAtom();
    this.expect(11);

    if (this.eat(16)) {
      node.qualifier = this.tsParseEntityName(true);
    }

    if (this.match(44)) {
      node.typeParameters = this.tsParseTypeArguments();
    }

    return this.finishNode(node, "TSImportType");
  }

  tsParseEntityName(allowReservedWords) {
    let entity = this.parseIdentifier();

    while (this.eat(16)) {
      const node = this.startNodeAtNode(entity);
      node.left = entity;
      node.right = this.parseIdentifier(allowReservedWords);
      entity = this.finishNode(node, "TSQualifiedName");
    }

    return entity;
  }

  tsParseTypeReference() {
    const node = this.startNode();
    node.typeName = this.tsParseEntityName(false);

    if (!this.hasPrecedingLineBreak() && this.match(44)) {
      node.typeParameters = this.tsParseTypeArguments();
    }

    return this.finishNode(node, "TSTypeReference");
  }

  tsParseThisTypePredicate(lhs) {
    this.next();
    const node = this.startNodeAtNode(lhs);
    node.parameterName = lhs;
    node.typeAnnotation = this.tsParseTypeAnnotation(false);
    node.asserts = false;
    return this.finishNode(node, "TSTypePredicate");
  }

  tsParseThisTypeNode() {
    const node = this.startNode();
    this.next();
    return this.finishNode(node, "TSThisType");
  }

  tsParseTypeQuery() {
    const node = this.startNode();
    this.expect(82);

    if (this.match(78)) {
      node.exprName = this.tsParseImportType();
    } else {
      node.exprName = this.tsParseEntityName(true);
    }

    return this.finishNode(node, "TSTypeQuery");
  }

  tsParseTypeParameter() {
    const node = this.startNode();
    node.name = this.tsParseTypeParameterName();
    node.constraint = this.tsEatThenParseType(76);
    node.default = this.tsEatThenParseType(27);
    return this.finishNode(node, "TSTypeParameter");
  }

  tsTryParseTypeParameters() {
    if (this.match(44)) {
      return this.tsParseTypeParameters();
    }
  }

  tsParseTypeParameters() {
    const node = this.startNode();

    if (this.match(44) || this.match(133)) {
      this.next();
    } else {
      this.unexpected();
    }

    const refTrailingCommaPos = {
      value: -1
    };
    node.params = this.tsParseBracketedList("TypeParametersOrArguments", this.tsParseTypeParameter.bind(this), false, true, refTrailingCommaPos);

    if (node.params.length === 0) {
      this.raise(node.start, TSErrors.EmptyTypeParameters);
    }

    if (refTrailingCommaPos.value !== -1) {
      this.addExtra(node, "trailingComma", refTrailingCommaPos.value);
    }

    return this.finishNode(node, "TSTypeParameterDeclaration");
  }

  tsTryNextParseConstantContext() {
    if (this.lookahead().type === 70) {
      this.next();
      return this.tsParseTypeReference();
    }

    return null;
  }

  tsFillSignature(returnToken, signature) {
    const returnTokenRequired = returnToken === 19;
    signature.typeParameters = this.tsTryParseTypeParameters();
    this.expect(10);
    signature.parameters = this.tsParseBindingListForSignature();

    if (returnTokenRequired) {
      signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
    } else if (this.match(returnToken)) {
      signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
    }
  }

  tsParseBindingListForSignature() {
    return this.parseBindingList(11, 41).map(pattern => {
      if (pattern.type !== "Identifier" && pattern.type !== "RestElement" && pattern.type !== "ObjectPattern" && pattern.type !== "ArrayPattern") {
        this.raise(pattern.start, TSErrors.UnsupportedSignatureParameterKind, pattern.type);
      }

      return pattern;
    });
  }

  tsParseTypeMemberSemicolon() {
    if (!this.eat(12) && !this.isLineTerminator()) {
      this.expect(13);
    }
  }

  tsParseSignatureMember(kind, node) {
    this.tsFillSignature(14, node);
    this.tsParseTypeMemberSemicolon();
    return this.finishNode(node, kind);
  }

  tsIsUnambiguouslyIndexSignature() {
    this.next();

    if ((0, _types.tokenIsIdentifier)(this.state.type)) {
      this.next();
      return this.match(14);
    }

    return false;
  }

  tsTryParseIndexSignature(node) {
    if (!(this.match(0) && this.tsLookAhead(this.tsIsUnambiguouslyIndexSignature.bind(this)))) {
      return undefined;
    }

    this.expect(0);
    const id = this.parseIdentifier();
    id.typeAnnotation = this.tsParseTypeAnnotation();
    this.resetEndLocation(id);
    this.expect(3);
    node.parameters = [id];
    const type = this.tsTryParseTypeAnnotation();
    if (type) node.typeAnnotation = type;
    this.tsParseTypeMemberSemicolon();
    return this.finishNode(node, "TSIndexSignature");
  }

  tsParsePropertyOrMethodSignature(node, readonly) {
    if (this.eat(17)) node.optional = true;
    const nodeAny = node;

    if (this.match(10) || this.match(44)) {
      if (readonly) {
        this.raise(node.start, TSErrors.ReadonlyForMethodSignature);
      }

      const method = nodeAny;

      if (method.kind && this.match(44)) {
        this.raise(this.state.pos, TSErrors.AccesorCannotHaveTypeParameters);
      }

      this.tsFillSignature(14, method);
      this.tsParseTypeMemberSemicolon();

      if (method.kind === "get") {
        if (method.parameters.length > 0) {
          this.raise(this.state.pos, _error.Errors.BadGetterArity);

          if (this.isThisParam(method.parameters[0])) {
            this.raise(this.state.pos, TSErrors.AccesorCannotDeclareThisParameter);
          }
        }
      } else if (method.kind === "set") {
        if (method.parameters.length !== 1) {
          this.raise(this.state.pos, _error.Errors.BadSetterArity);
        } else {
          const firstParameter = method.parameters[0];

          if (this.isThisParam(firstParameter)) {
            this.raise(this.state.pos, TSErrors.AccesorCannotDeclareThisParameter);
          }

          if (firstParameter.type === "Identifier" && firstParameter.optional) {
            this.raise(this.state.pos, TSErrors.SetAccesorCannotHaveOptionalParameter);
          }

          if (firstParameter.type === "RestElement") {
            this.raise(this.state.pos, TSErrors.SetAccesorCannotHaveRestParameter);
          }
        }

        if (method.typeAnnotation) {
          this.raise(method.typeAnnotation.start, TSErrors.SetAccesorCannotHaveReturnType);
        }
      } else {
        method.kind = "method";
      }

      return this.finishNode(method, "TSMethodSignature");
    } else {
      const property = nodeAny;
      if (readonly) property.readonly = true;
      const type = this.tsTryParseTypeAnnotation();
      if (type) property.typeAnnotation = type;
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(property, "TSPropertySignature");
    }
  }

  tsParseTypeMember() {
    const node = this.startNode();

    if (this.match(10) || this.match(44)) {
      return this.tsParseSignatureMember("TSCallSignatureDeclaration", node);
    }

    if (this.match(72)) {
      const id = this.startNode();
      this.next();

      if (this.match(10) || this.match(44)) {
        return this.tsParseSignatureMember("TSConstructSignatureDeclaration", node);
      } else {
        node.key = this.createIdentifier(id, "new");
        return this.tsParsePropertyOrMethodSignature(node, false);
      }
    }

    this.tsParseModifiers(node, ["readonly"], ["declare", "abstract", "private", "protected", "public", "static", "override"], TSErrors.InvalidModifierOnTypeMember);
    const idx = this.tsTryParseIndexSignature(node);

    if (idx) {
      return idx;
    }

    this.parsePropertyName(node);

    if (!node.computed && node.key.type === "Identifier" && (node.key.name === "get" || node.key.name === "set") && this.tsTokenCanFollowModifier()) {
      node.kind = node.key.name;
      this.parsePropertyName(node);
    }

    return this.tsParsePropertyOrMethodSignature(node, !!node.readonly);
  }

  tsParseTypeLiteral() {
    const node = this.startNode();
    node.members = this.tsParseObjectTypeMembers();
    return this.finishNode(node, "TSTypeLiteral");
  }

  tsParseObjectTypeMembers() {
    this.expect(5);
    const members = this.tsParseList("TypeMembers", this.tsParseTypeMember.bind(this));
    this.expect(8);
    return members;
  }

  tsIsStartOfMappedType() {
    this.next();

    if (this.eat(48)) {
      return this.isContextual(113);
    }

    if (this.isContextual(113)) {
      this.next();
    }

    if (!this.match(0)) {
      return false;
    }

    this.next();

    if (!this.tsIsIdentifier()) {
      return false;
    }

    this.next();
    return this.match(53);
  }

  tsParseMappedTypeParameter() {
    const node = this.startNode();
    node.name = this.tsParseTypeParameterName();
    node.constraint = this.tsExpectThenParseType(53);
    return this.finishNode(node, "TSTypeParameter");
  }

  tsParseMappedType() {
    const node = this.startNode();
    this.expect(5);

    if (this.match(48)) {
      node.readonly = this.state.value;
      this.next();
      this.expectContextual(113);
    } else if (this.eatContextual(113)) {
      node.readonly = true;
    }

    this.expect(0);
    node.typeParameter = this.tsParseMappedTypeParameter();
    node.nameType = this.eatContextual(88) ? this.tsParseType() : null;
    this.expect(3);

    if (this.match(48)) {
      node.optional = this.state.value;
      this.next();
      this.expect(17);
    } else if (this.eat(17)) {
      node.optional = true;
    }

    node.typeAnnotation = this.tsTryParseType();
    this.semicolon();
    this.expect(8);
    return this.finishNode(node, "TSMappedType");
  }

  tsParseTupleType() {
    const node = this.startNode();
    node.elementTypes = this.tsParseBracketedList("TupleElementTypes", this.tsParseTupleElementType.bind(this), true, false);
    let seenOptionalElement = false;
    let labeledElements = null;
    node.elementTypes.forEach(elementNode => {
      let {
        type
      } = elementNode;

      if (seenOptionalElement && type !== "TSRestType" && type !== "TSOptionalType" && !(type === "TSNamedTupleMember" && elementNode.optional)) {
        this.raise(elementNode.start, TSErrors.OptionalTypeBeforeRequired);
      }

      seenOptionalElement = seenOptionalElement || type === "TSNamedTupleMember" && elementNode.optional || type === "TSOptionalType";

      if (type === "TSRestType") {
        elementNode = elementNode.typeAnnotation;
        type = elementNode.type;
      }

      const isLabeled = type === "TSNamedTupleMember";
      labeledElements = labeledElements ?? isLabeled;

      if (labeledElements !== isLabeled) {
        this.raise(elementNode.start, TSErrors.MixedLabeledAndUnlabeledElements);
      }
    });
    return this.finishNode(node, "TSTupleType");
  }

  tsParseTupleElementType() {
    const {
      start: startPos,
      startLoc
    } = this.state;
    const rest = this.eat(21);
    let type = this.tsParseType();
    const optional = this.eat(17);
    const labeled = this.eat(14);

    if (labeled) {
      const labeledNode = this.startNodeAtNode(type);
      labeledNode.optional = optional;

      if (type.type === "TSTypeReference" && !type.typeParameters && type.typeName.type === "Identifier") {
        labeledNode.label = type.typeName;
      } else {
        this.raise(type.start, TSErrors.InvalidTupleMemberLabel);
        labeledNode.label = type;
      }

      labeledNode.elementType = this.tsParseType();
      type = this.finishNode(labeledNode, "TSNamedTupleMember");
    } else if (optional) {
      const optionalTypeNode = this.startNodeAtNode(type);
      optionalTypeNode.typeAnnotation = type;
      type = this.finishNode(optionalTypeNode, "TSOptionalType");
    }

    if (rest) {
      const restNode = this.startNodeAt(startPos, startLoc);
      restNode.typeAnnotation = type;
      type = this.finishNode(restNode, "TSRestType");
    }

    return type;
  }

  tsParseParenthesizedType() {
    const node = this.startNode();
    this.expect(10);
    node.typeAnnotation = this.tsParseType();
    this.expect(11);
    return this.finishNode(node, "TSParenthesizedType");
  }

  tsParseFunctionOrConstructorType(type, abstract) {
    const node = this.startNode();

    if (type === "TSConstructorType") {
      node.abstract = !!abstract;
      if (abstract) this.next();
      this.next();
    }

    this.tsFillSignature(19, node);
    return this.finishNode(node, type);
  }

  tsParseLiteralTypeNode() {
    const node = this.startNode();

    node.literal = (() => {
      switch (this.state.type) {
        case 125:
        case 126:
        case 124:
        case 80:
        case 81:
          return this.parseExprAtom();

        default:
          throw this.unexpected();
      }
    })();

    return this.finishNode(node, "TSLiteralType");
  }

  tsParseTemplateLiteralType() {
    const node = this.startNode();
    node.literal = this.parseTemplate(false);
    return this.finishNode(node, "TSLiteralType");
  }

  parseTemplateSubstitution() {
    if (this.state.inType) return this.tsParseType();
    return super.parseTemplateSubstitution();
  }

  tsParseThisTypeOrThisTypePredicate() {
    const thisKeyword = this.tsParseThisTypeNode();

    if (this.isContextual(108) && !this.hasPrecedingLineBreak()) {
      return this.tsParseThisTypePredicate(thisKeyword);
    } else {
      return thisKeyword;
    }
  }

  tsParseNonArrayType() {
    switch (this.state.type) {
      case 124:
      case 125:
      case 126:
      case 80:
      case 81:
        return this.tsParseLiteralTypeNode();

      case 48:
        if (this.state.value === "-") {
          const node = this.startNode();
          const nextToken = this.lookahead();

          if (nextToken.type !== 125 && nextToken.type !== 126) {
            throw this.unexpected();
          }

          node.literal = this.parseMaybeUnary();
          return this.finishNode(node, "TSLiteralType");
        }

        break;

      case 73:
        return this.tsParseThisTypeOrThisTypePredicate();

      case 82:
        return this.tsParseTypeQuery();

      case 78:
        return this.tsParseImportType();

      case 5:
        return this.tsLookAhead(this.tsIsStartOfMappedType.bind(this)) ? this.tsParseMappedType() : this.tsParseTypeLiteral();

      case 0:
        return this.tsParseTupleType();

      case 10:
        if (process.env.BABEL_8_BREAKING) {
          if (!this.options.createParenthesizedExpressions) {
            const startPos = this.state.start;
            this.next();
            const type = this.tsParseType();
            this.expect(11);
            this.addExtra(type, "parenthesized", true);
            this.addExtra(type, "parenStart", startPos);
            return type;
          }
        }

        return this.tsParseParenthesizedType();

      case 22:
        return this.tsParseTemplateLiteralType();

      default:
        {
          const {
            type
          } = this.state;

          if ((0, _types.tokenIsIdentifier)(type) || type === 83 || type === 79) {
            const nodeType = type === 83 ? "TSVoidKeyword" : type === 79 ? "TSNullKeyword" : keywordTypeFromName(this.state.value);

            if (nodeType !== undefined && this.lookaheadCharCode() !== 46) {
              const node = this.startNode();
              this.next();
              return this.finishNode(node, nodeType);
            }

            return this.tsParseTypeReference();
          }
        }
    }

    throw this.unexpected();
  }

  tsParseArrayTypeOrHigher() {
    let type = this.tsParseNonArrayType();

    while (!this.hasPrecedingLineBreak() && this.eat(0)) {
      if (this.match(3)) {
        const node = this.startNodeAtNode(type);
        node.elementType = type;
        this.expect(3);
        type = this.finishNode(node, "TSArrayType");
      } else {
        const node = this.startNodeAtNode(type);
        node.objectType = type;
        node.indexType = this.tsParseType();
        this.expect(3);
        type = this.finishNode(node, "TSIndexedAccessType");
      }
    }

    return type;
  }

  tsParseTypeOperator() {
    const node = this.startNode();
    const operator = this.state.value;
    this.next();
    node.operator = operator;
    node.typeAnnotation = this.tsParseTypeOperatorOrHigher();

    if (operator === "readonly") {
      this.tsCheckTypeAnnotationForReadOnly(node);
    }

    return this.finishNode(node, "TSTypeOperator");
  }

  tsCheckTypeAnnotationForReadOnly(node) {
    switch (node.typeAnnotation.type) {
      case "TSTupleType":
      case "TSArrayType":
        return;

      default:
        this.raise(node.start, TSErrors.UnexpectedReadonly);
    }
  }

  tsParseInferType() {
    const node = this.startNode();
    this.expectContextual(107);
    const typeParameter = this.startNode();
    typeParameter.name = this.tsParseTypeParameterName();
    node.typeParameter = this.finishNode(typeParameter, "TSTypeParameter");
    return this.finishNode(node, "TSInferType");
  }

  tsParseTypeOperatorOrHigher() {
    const isTypeOperator = (0, _types.tokenIsTSTypeOperator)(this.state.type) && !this.state.containsEsc;
    return isTypeOperator ? this.tsParseTypeOperator() : this.isContextual(107) ? this.tsParseInferType() : this.tsParseArrayTypeOrHigher();
  }

  tsParseUnionOrIntersectionType(kind, parseConstituentType, operator) {
    const node = this.startNode();
    const hasLeadingOperator = this.eat(operator);
    const types = [];

    do {
      types.push(parseConstituentType());
    } while (this.eat(operator));

    if (types.length === 1 && !hasLeadingOperator) {
      return types[0];
    }

    node.types = types;
    return this.finishNode(node, kind);
  }

  tsParseIntersectionTypeOrHigher() {
    return this.tsParseUnionOrIntersectionType("TSIntersectionType", this.tsParseTypeOperatorOrHigher.bind(this), 42);
  }

  tsParseUnionTypeOrHigher() {
    return this.tsParseUnionOrIntersectionType("TSUnionType", this.tsParseIntersectionTypeOrHigher.bind(this), 40);
  }

  tsIsStartOfFunctionType() {
    if (this.match(44)) {
      return true;
    }

    return this.match(10) && this.tsLookAhead(this.tsIsUnambiguouslyStartOfFunctionType.bind(this));
  }

  tsSkipParameterStart() {
    if ((0, _types.tokenIsIdentifier)(this.state.type) || this.match(73)) {
      this.next();
      return true;
    }

    if (this.match(5)) {
      let braceStackCounter = 1;
      this.next();

      while (braceStackCounter > 0) {
        if (this.match(5)) {
          ++braceStackCounter;
        } else if (this.match(8)) {
          --braceStackCounter;
        }

        this.next();
      }

      return true;
    }

    if (this.match(0)) {
      let braceStackCounter = 1;
      this.next();

      while (braceStackCounter > 0) {
        if (this.match(0)) {
          ++braceStackCounter;
        } else if (this.match(3)) {
          --braceStackCounter;
        }

        this.next();
      }

      return true;
    }

    return false;
  }

  tsIsUnambiguouslyStartOfFunctionType() {
    this.next();

    if (this.match(11) || this.match(21)) {
      return true;
    }

    if (this.tsSkipParameterStart()) {
      if (this.match(14) || this.match(12) || this.match(17) || this.match(27)) {
        return true;
      }

      if (this.match(11)) {
        this.next();

        if (this.match(19)) {
          return true;
        }
      }
    }

    return false;
  }

  tsParseTypeOrTypePredicateAnnotation(returnToken) {
    return this.tsInType(() => {
      const t = this.startNode();
      this.expect(returnToken);
      const node = this.startNode();
      const asserts = !!this.tsTryParse(this.tsParseTypePredicateAsserts.bind(this));

      if (asserts && this.match(73)) {
        let thisTypePredicate = this.tsParseThisTypeOrThisTypePredicate();

        if (thisTypePredicate.type === "TSThisType") {
          node.parameterName = thisTypePredicate;
          node.asserts = true;
          node.typeAnnotation = null;
          thisTypePredicate = this.finishNode(node, "TSTypePredicate");
        } else {
          this.resetStartLocationFromNode(thisTypePredicate, node);
          thisTypePredicate.asserts = true;
        }

        t.typeAnnotation = thisTypePredicate;
        return this.finishNode(t, "TSTypeAnnotation");
      }

      const typePredicateVariable = this.tsIsIdentifier() && this.tsTryParse(this.tsParseTypePredicatePrefix.bind(this));

      if (!typePredicateVariable) {
        if (!asserts) {
          return this.tsParseTypeAnnotation(false, t);
        }

        node.parameterName = this.parseIdentifier();
        node.asserts = asserts;
        node.typeAnnotation = null;
        t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
        return this.finishNode(t, "TSTypeAnnotation");
      }

      const type = this.tsParseTypeAnnotation(false);
      node.parameterName = typePredicateVariable;
      node.typeAnnotation = type;
      node.asserts = asserts;
      t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
      return this.finishNode(t, "TSTypeAnnotation");
    });
  }

  tsTryParseTypeOrTypePredicateAnnotation() {
    return this.match(14) ? this.tsParseTypeOrTypePredicateAnnotation(14) : undefined;
  }

  tsTryParseTypeAnnotation() {
    return this.match(14) ? this.tsParseTypeAnnotation() : undefined;
  }

  tsTryParseType() {
    return this.tsEatThenParseType(14);
  }

  tsParseTypePredicatePrefix() {
    const id = this.parseIdentifier();

    if (this.isContextual(108) && !this.hasPrecedingLineBreak()) {
      this.next();
      return id;
    }
  }

  tsParseTypePredicateAsserts() {
    if (this.state.type !== 101) {
      return false;
    }

    const containsEsc = this.state.containsEsc;
    this.next();

    if (!(0, _types.tokenIsIdentifier)(this.state.type) && !this.match(73)) {
      return false;
    }

    if (containsEsc) {
      this.raise(this.state.lastTokStart, _error.Errors.InvalidEscapedReservedWord, "asserts");
    }

    return true;
  }

  tsParseTypeAnnotation(eatColon = true, t = this.startNode()) {
    this.tsInType(() => {
      if (eatColon) this.expect(14);
      t.typeAnnotation = this.tsParseType();
    });
    return this.finishNode(t, "TSTypeAnnotation");
  }

  tsParseType() {
    assert(this.state.inType);
    const type = this.tsParseNonConditionalType();

    if (this.hasPrecedingLineBreak() || !this.eat(76)) {
      return type;
    }

    const node = this.startNodeAtNode(type);
    node.checkType = type;
    node.extendsType = this.tsParseNonConditionalType();
    this.expect(17);
    node.trueType = this.tsParseType();
    this.expect(14);
    node.falseType = this.tsParseType();
    return this.finishNode(node, "TSConditionalType");
  }

  isAbstractConstructorSignature() {
    return this.isContextual(115) && this.lookahead().type === 72;
  }

  tsParseNonConditionalType() {
    if (this.tsIsStartOfFunctionType()) {
      return this.tsParseFunctionOrConstructorType("TSFunctionType");
    }

    if (this.match(72)) {
      return this.tsParseFunctionOrConstructorType("TSConstructorType");
    } else if (this.isAbstractConstructorSignature()) {
      return this.tsParseFunctionOrConstructorType("TSConstructorType", true);
    }

    return this.tsParseUnionTypeOrHigher();
  }

  tsParseTypeAssertion() {
    if (this.getPluginOption("typescript", "disallowAmbiguousJSXLike")) {
      this.raise(this.state.start, TSErrors.ReservedTypeAssertion);
    }

    const node = this.startNode();

    const _const = this.tsTryNextParseConstantContext();

    node.typeAnnotation = _const || this.tsNextThenParseType();
    this.expect(45);
    node.expression = this.parseMaybeUnary();
    return this.finishNode(node, "TSTypeAssertion");
  }

  tsParseHeritageClause(descriptor) {
    const originalStart = this.state.start;
    const delimitedList = this.tsParseDelimitedList("HeritageClauseElement", this.tsParseExpressionWithTypeArguments.bind(this));

    if (!delimitedList.length) {
      this.raise(originalStart, TSErrors.EmptyHeritageClauseType, descriptor);
    }

    return delimitedList;
  }

  tsParseExpressionWithTypeArguments() {
    const node = this.startNode();
    node.expression = this.tsParseEntityName(false);

    if (this.match(44)) {
      node.typeParameters = this.tsParseTypeArguments();
    }

    return this.finishNode(node, "TSExpressionWithTypeArguments");
  }

  tsParseInterfaceDeclaration(node) {
    if ((0, _types.tokenIsIdentifier)(this.state.type)) {
      node.id = this.parseIdentifier();
      this.checkLVal(node.id, "typescript interface declaration", _scopeflags.BIND_TS_INTERFACE);
    } else {
      node.id = null;
      this.raise(this.state.start, TSErrors.MissingInterfaceName);
    }

    node.typeParameters = this.tsTryParseTypeParameters();

    if (this.eat(76)) {
      node.extends = this.tsParseHeritageClause("extends");
    }

    const body = this.startNode();
    body.body = this.tsInType(this.tsParseObjectTypeMembers.bind(this));
    node.body = this.finishNode(body, "TSInterfaceBody");
    return this.finishNode(node, "TSInterfaceDeclaration");
  }

  tsParseTypeAliasDeclaration(node) {
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, "typescript type alias", _scopeflags.BIND_TS_TYPE);
    node.typeParameters = this.tsTryParseTypeParameters();
    node.typeAnnotation = this.tsInType(() => {
      this.expect(27);

      if (this.isContextual(106) && this.lookahead().type !== 16) {
        const node = this.startNode();
        this.next();
        return this.finishNode(node, "TSIntrinsicKeyword");
      }

      return this.tsParseType();
    });
    this.semicolon();
    return this.finishNode(node, "TSTypeAliasDeclaration");
  }

  tsInNoContext(cb) {
    const oldContext = this.state.context;
    this.state.context = [oldContext[0]];

    try {
      return cb();
    } finally {
      this.state.context = oldContext;
    }
  }

  tsInType(cb) {
    const oldInType = this.state.inType;
    this.state.inType = true;

    try {
      return cb();
    } finally {
      this.state.inType = oldInType;
    }
  }

  tsEatThenParseType(token) {
    return !this.match(token) ? undefined : this.tsNextThenParseType();
  }

  tsExpectThenParseType(token) {
    return this.tsDoThenParseType(() => this.expect(token));
  }

  tsNextThenParseType() {
    return this.tsDoThenParseType(() => this.next());
  }

  tsDoThenParseType(cb) {
    return this.tsInType(() => {
      cb();
      return this.tsParseType();
    });
  }

  tsParseEnumMember() {
    const node = this.startNode();
    node.id = this.match(124) ? this.parseExprAtom() : this.parseIdentifier(true);

    if (this.eat(27)) {
      node.initializer = this.parseMaybeAssignAllowIn();
    }

    return this.finishNode(node, "TSEnumMember");
  }

  tsParseEnumDeclaration(node, isConst) {
    if (isConst) node.const = true;
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, "typescript enum declaration", isConst ? _scopeflags.BIND_TS_CONST_ENUM : _scopeflags.BIND_TS_ENUM);
    this.expect(5);
    node.members = this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
    this.expect(8);
    return this.finishNode(node, "TSEnumDeclaration");
  }

  tsParseModuleBlock() {
    const node = this.startNode();
    this.scope.enter(_scopeflags.SCOPE_OTHER);
    this.expect(5);
    this.parseBlockOrModuleBlockBody(node.body = [], undefined, true, 8);
    this.scope.exit();
    return this.finishNode(node, "TSModuleBlock");
  }

  tsParseModuleOrNamespaceDeclaration(node, nested = false) {
    node.id = this.parseIdentifier();

    if (!nested) {
      this.checkLVal(node.id, "module or namespace declaration", _scopeflags.BIND_TS_NAMESPACE);
    }

    if (this.eat(16)) {
      const inner = this.startNode();
      this.tsParseModuleOrNamespaceDeclaration(inner, true);
      node.body = inner;
    } else {
      this.scope.enter(_scopeflags.SCOPE_TS_MODULE);
      this.prodParam.enter(_productionParameter.PARAM);
      node.body = this.tsParseModuleBlock();
      this.prodParam.exit();
      this.scope.exit();
    }

    return this.finishNode(node, "TSModuleDeclaration");
  }

  tsParseAmbientExternalModuleDeclaration(node) {
    if (this.isContextual(104)) {
      node.global = true;
      node.id = this.parseIdentifier();
    } else if (this.match(124)) {
      node.id = this.parseExprAtom();
    } else {
      this.unexpected();
    }

    if (this.match(5)) {
      this.scope.enter(_scopeflags.SCOPE_TS_MODULE);
      this.prodParam.enter(_productionParameter.PARAM);
      node.body = this.tsParseModuleBlock();
      this.prodParam.exit();
      this.scope.exit();
    } else {
      this.semicolon();
    }

    return this.finishNode(node, "TSModuleDeclaration");
  }

  tsParseImportEqualsDeclaration(node, isExport) {
    node.isExport = isExport || false;
    node.id = this.parseIdentifier();
    this.checkLVal(node.id, "import equals declaration", _scopeflags.BIND_LEXICAL);
    this.expect(27);
    const moduleReference = this.tsParseModuleReference();

    if (node.importKind === "type" && moduleReference.type !== "TSExternalModuleReference") {
      this.raise(moduleReference.start, TSErrors.ImportAliasHasImportType);
    }

    node.moduleReference = moduleReference;
    this.semicolon();
    return this.finishNode(node, "TSImportEqualsDeclaration");
  }

  tsIsExternalModuleReference() {
    return this.isContextual(111) && this.lookaheadCharCode() === 40;
  }

  tsParseModuleReference() {
    return this.tsIsExternalModuleReference() ? this.tsParseExternalModuleReference() : this.tsParseEntityName(false);
  }

  tsParseExternalModuleReference() {
    const node = this.startNode();
    this.expectContextual(111);
    this.expect(10);

    if (!this.match(124)) {
      throw this.unexpected();
    }

    node.expression = this.parseExprAtom();
    this.expect(11);
    return this.finishNode(node, "TSExternalModuleReference");
  }

  tsLookAhead(f) {
    const state = this.state.clone();
    const res = f();
    this.state = state;
    return res;
  }

  tsTryParseAndCatch(f) {
    const result = this.tryParse(abort => f() || abort());
    if (result.aborted || !result.node) return undefined;
    if (result.error) this.state = result.failState;
    return result.node;
  }

  tsTryParse(f) {
    const state = this.state.clone();
    const result = f();

    if (result !== undefined && result !== false) {
      return result;
    } else {
      this.state = state;
      return undefined;
    }
  }

  tsTryParseDeclare(nany) {
    if (this.isLineTerminator()) {
      return;
    }

    let starttype = this.state.type;
    let kind;

    if (this.isContextual(94)) {
      starttype = 69;
      kind = "let";
    }

    return this.tsInAmbientContext(() => {
      switch (starttype) {
        case 63:
          nany.declare = true;
          return this.parseFunctionStatement(nany, false, true);

        case 75:
          nany.declare = true;
          return this.parseClass(nany, true, false);

        case 70:
          if (this.match(70) && this.isLookaheadContextual("enum")) {
            this.expect(70);
            this.expectContextual(117);
            return this.tsParseEnumDeclaration(nany, true);
          }

        case 69:
          kind = kind || this.state.value;
          return this.parseVarStatement(nany, kind);

        case 104:
          return this.tsParseAmbientExternalModuleDeclaration(nany);

        default:
          {
            if ((0, _types.tokenIsIdentifier)(starttype)) {
              return this.tsParseDeclaration(nany, this.state.value, true);
            }
          }
      }
    });
  }

  tsTryParseExportDeclaration() {
    return this.tsParseDeclaration(this.startNode(), this.state.value, true);
  }

  tsParseExpressionStatement(node, expr) {
    switch (expr.name) {
      case "declare":
        {
          const declaration = this.tsTryParseDeclare(node);

          if (declaration) {
            declaration.declare = true;
            return declaration;
          }

          break;
        }

      case "global":
        if (this.match(5)) {
          this.scope.enter(_scopeflags.SCOPE_TS_MODULE);
          this.prodParam.enter(_productionParameter.PARAM);
          const mod = node;
          mod.global = true;
          mod.id = expr;
          mod.body = this.tsParseModuleBlock();
          this.scope.exit();
          this.prodParam.exit();
          return this.finishNode(mod, "TSModuleDeclaration");
        }

        break;

      default:
        return this.tsParseDeclaration(node, expr.name, false);
    }
  }

  tsParseDeclaration(node, value, next) {
    switch (value) {
      case "abstract":
        if (this.tsCheckLineTerminator(next) && (this.match(75) || (0, _types.tokenIsIdentifier)(this.state.type))) {
          return this.tsParseAbstractDeclaration(node);
        }

        break;

      case "enum":
        if (next || (0, _types.tokenIsIdentifier)(this.state.type)) {
          if (next) this.next();
          return this.tsParseEnumDeclaration(node, false);
        }

        break;

      case "interface":
        if (this.tsCheckLineTerminator(next) && (0, _types.tokenIsIdentifier)(this.state.type)) {
          return this.tsParseInterfaceDeclaration(node);
        }

        break;

      case "module":
        if (this.tsCheckLineTerminator(next)) {
          if (this.match(124)) {
            return this.tsParseAmbientExternalModuleDeclaration(node);
          } else if ((0, _types.tokenIsIdentifier)(this.state.type)) {
            return this.tsParseModuleOrNamespaceDeclaration(node);
          }
        }

        break;

      case "namespace":
        if (this.tsCheckLineTerminator(next) && (0, _types.tokenIsIdentifier)(this.state.type)) {
          return this.tsParseModuleOrNamespaceDeclaration(node);
        }

        break;

      case "type":
        if (this.tsCheckLineTerminator(next) && (0, _types.tokenIsIdentifier)(this.state.type)) {
          return this.tsParseTypeAliasDeclaration(node);
        }

        break;
    }
  }

  tsCheckLineTerminator(next) {
    if (next) {
      if (this.hasFollowingLineBreak()) return false;
      this.next();
      return true;
    }

    return !this.isLineTerminator();
  }

  tsTryParseGenericAsyncArrowFunction(startPos, startLoc) {
    if (!this.match(44)) {
      return undefined;
    }

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    this.state.maybeInArrowParameters = true;
    const res = this.tsTryParseAndCatch(() => {
      const node = this.startNodeAt(startPos, startLoc);
      node.typeParameters = this.tsParseTypeParameters();
      super.parseFunctionParams(node);
      node.returnType = this.tsTryParseTypeOrTypePredicateAnnotation();
      this.expect(19);
      return node;
    });
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

    if (!res) {
      return undefined;
    }

    return this.parseArrowExpression(res, null, true);
  }

  tsParseTypeArguments() {
    const node = this.startNode();
    node.params = this.tsInType(() => this.tsInNoContext(() => {
      this.expect(44);
      return this.tsParseDelimitedList("TypeParametersOrArguments", this.tsParseType.bind(this));
    }));

    if (node.params.length === 0) {
      this.raise(node.start, TSErrors.EmptyTypeArguments);
    }

    this.expect(45);
    return this.finishNode(node, "TSTypeParameterInstantiation");
  }

  tsIsDeclarationStart() {
    return (0, _types.tokenIsTSDeclarationStart)(this.state.type);
  }

  isExportDefaultSpecifier() {
    if (this.tsIsDeclarationStart()) return false;
    return super.isExportDefaultSpecifier();
  }

  parseAssignableListItem(allowModifiers, decorators) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let accessibility;
    let readonly = false;
    let override = false;

    if (allowModifiers !== undefined) {
      const modified = {};
      this.tsParseModifiers(modified, ["public", "private", "protected", "override", "readonly"]);
      accessibility = modified.accessibility;
      override = modified.override;
      readonly = modified.readonly;

      if (allowModifiers === false && (accessibility || readonly || override)) {
        this.raise(startPos, TSErrors.UnexpectedParameterModifier);
      }
    }

    const left = this.parseMaybeDefault();
    this.parseAssignableListItemTypes(left);
    const elt = this.parseMaybeDefault(left.start, left.loc.start, left);

    if (accessibility || readonly || override) {
      const pp = this.startNodeAt(startPos, startLoc);

      if (decorators.length) {
        pp.decorators = decorators;
      }

      if (accessibility) pp.accessibility = accessibility;
      if (readonly) pp.readonly = readonly;
      if (override) pp.override = override;

      if (elt.type !== "Identifier" && elt.type !== "AssignmentPattern") {
        this.raise(pp.start, TSErrors.UnsupportedParameterPropertyKind);
      }

      pp.parameter = elt;
      return this.finishNode(pp, "TSParameterProperty");
    }

    if (decorators.length) {
      left.decorators = decorators;
    }

    return elt;
  }

  parseFunctionBodyAndFinish(node, type, isMethod = false) {
    if (this.match(14)) {
      node.returnType = this.tsParseTypeOrTypePredicateAnnotation(14);
    }

    const bodilessType = type === "FunctionDeclaration" ? "TSDeclareFunction" : type === "ClassMethod" || type === "ClassPrivateMethod" ? "TSDeclareMethod" : undefined;

    if (bodilessType && !this.match(5) && this.isLineTerminator()) {
      this.finishNode(node, bodilessType);
      return;
    }

    if (bodilessType === "TSDeclareFunction" && this.state.isAmbientContext) {
      this.raise(node.start, TSErrors.DeclareFunctionHasImplementation);

      if (node.declare) {
        super.parseFunctionBodyAndFinish(node, bodilessType, isMethod);
        return;
      }
    }

    super.parseFunctionBodyAndFinish(node, type, isMethod);
  }

  registerFunctionStatementId(node) {
    if (!node.body && node.id) {
      this.checkLVal(node.id, "function name", _scopeflags.BIND_TS_AMBIENT);
    } else {
      super.registerFunctionStatementId(...arguments);
    }
  }

  tsCheckForInvalidTypeCasts(items) {
    items.forEach(node => {
      if ((node == null ? void 0 : node.type) === "TSTypeCastExpression") {
        this.raise(node.typeAnnotation.start, TSErrors.UnexpectedTypeAnnotation);
      }
    });
  }

  toReferencedList(exprList, isInParens) {
    this.tsCheckForInvalidTypeCasts(exprList);
    return exprList;
  }

  parseArrayLike(...args) {
    const node = super.parseArrayLike(...args);

    if (node.type === "ArrayExpression") {
      this.tsCheckForInvalidTypeCasts(node.elements);
    }

    return node;
  }

  parseSubscript(base, startPos, startLoc, noCalls, state) {
    if (!this.hasPrecedingLineBreak() && this.match(33)) {
      this.state.canStartJSXElement = false;
      this.next();
      const nonNullExpression = this.startNodeAt(startPos, startLoc);
      nonNullExpression.expression = base;
      return this.finishNode(nonNullExpression, "TSNonNullExpression");
    }

    let isOptionalCall = false;

    if (this.match(18) && this.lookaheadCharCode() === 60) {
      if (noCalls) {
        state.stop = true;
        return base;
      }

      state.optionalChainMember = isOptionalCall = true;
      this.next();
    }

    if (this.match(44)) {
      let missingParenErrorPos;
      const result = this.tsTryParseAndCatch(() => {
        if (!noCalls && this.atPossibleAsyncArrow(base)) {
          const asyncArrowFn = this.tsTryParseGenericAsyncArrowFunction(startPos, startLoc);

          if (asyncArrowFn) {
            return asyncArrowFn;
          }
        }

        const node = this.startNodeAt(startPos, startLoc);
        node.callee = base;
        const typeArguments = this.tsParseTypeArguments();

        if (typeArguments) {
          if (isOptionalCall && !this.match(10)) {
            missingParenErrorPos = this.state.pos;
            this.unexpected();
          }

          if (!noCalls && this.eat(10)) {
            node.arguments = this.parseCallExpressionArguments(11, false);
            this.tsCheckForInvalidTypeCasts(node.arguments);
            node.typeParameters = typeArguments;

            if (state.optionalChainMember) {
              node.optional = isOptionalCall;
            }

            return this.finishCallExpression(node, state.optionalChainMember);
          } else if (this.match(22)) {
            const result = this.parseTaggedTemplateExpression(base, startPos, startLoc, state);
            result.typeParameters = typeArguments;
            return result;
          }
        }

        this.unexpected();
      });

      if (missingParenErrorPos) {
        this.unexpected(missingParenErrorPos, 10);
      }

      if (result) return result;
    }

    return super.parseSubscript(base, startPos, startLoc, noCalls, state);
  }

  parseNewArguments(node) {
    if (this.match(44)) {
      const typeParameters = this.tsTryParseAndCatch(() => {
        const args = this.tsParseTypeArguments();
        if (!this.match(10)) this.unexpected();
        return args;
      });

      if (typeParameters) {
        node.typeParameters = typeParameters;
      }
    }

    super.parseNewArguments(node);
  }

  parseExprOp(left, leftStartPos, leftStartLoc, minPrec) {
    if ((0, _types.tokenOperatorPrecedence)(53) > minPrec && !this.hasPrecedingLineBreak() && this.isContextual(88)) {
      const node = this.startNodeAt(leftStartPos, leftStartLoc);
      node.expression = left;

      const _const = this.tsTryNextParseConstantContext();

      if (_const) {
        node.typeAnnotation = _const;
      } else {
        node.typeAnnotation = this.tsNextThenParseType();
      }

      this.finishNode(node, "TSAsExpression");
      this.reScan_lt_gt();
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec);
    }

    return super.parseExprOp(left, leftStartPos, leftStartLoc, minPrec);
  }

  checkReservedWord(word, startLoc, checkKeywords, isBinding) {}

  checkDuplicateExports() {}

  parseImport(node) {
    node.importKind = "value";

    if ((0, _types.tokenIsIdentifier)(this.state.type) || this.match(50) || this.match(5)) {
      let ahead = this.lookahead();

      if (this.isContextual(121) && ahead.type !== 12 && ahead.type !== 92 && ahead.type !== 27) {
        node.importKind = "type";
        this.next();
        ahead = this.lookahead();
      }

      if ((0, _types.tokenIsIdentifier)(this.state.type) && ahead.type === 27) {
        return this.tsParseImportEqualsDeclaration(node);
      }
    }

    const importNode = super.parseImport(node);

    if (importNode.importKind === "type" && importNode.specifiers.length > 1 && importNode.specifiers[0].type === "ImportDefaultSpecifier") {
      this.raise(importNode.start, TSErrors.TypeImportCannotSpecifyDefaultAndNamed);
    }

    return importNode;
  }

  parseExport(node) {
    if (this.match(78)) {
      this.next();

      if (this.isContextual(121) && this.lookaheadCharCode() !== 61) {
        node.importKind = "type";
        this.next();
      } else {
        node.importKind = "value";
      }

      return this.tsParseImportEqualsDeclaration(node, true);
    } else if (this.eat(27)) {
      const assign = node;
      assign.expression = this.parseExpression();
      this.semicolon();
      return this.finishNode(assign, "TSExportAssignment");
    } else if (this.eatContextual(88)) {
      const decl = node;
      this.expectContextual(119);
      decl.id = this.parseIdentifier();
      this.semicolon();
      return this.finishNode(decl, "TSNamespaceExportDeclaration");
    } else {
      if (this.isContextual(121) && this.lookahead().type === 5) {
        this.next();
        node.exportKind = "type";
      } else {
        node.exportKind = "value";
      }

      return super.parseExport(node);
    }
  }

  isAbstractClass() {
    return this.isContextual(115) && this.lookahead().type === 75;
  }

  parseExportDefaultExpression() {
    if (this.isAbstractClass()) {
      const cls = this.startNode();
      this.next();
      cls.abstract = true;
      this.parseClass(cls, true, true);
      return cls;
    }

    if (this.match(120)) {
      const interfaceNode = this.startNode();
      this.next();
      const result = this.tsParseInterfaceDeclaration(interfaceNode);
      if (result) return result;
    }

    return super.parseExportDefaultExpression();
  }

  parseStatementContent(context, topLevel) {
    if (this.state.type === 70) {
      const ahead = this.lookahead();

      if (ahead.type === 117) {
        const node = this.startNode();
        this.next();
        this.expectContextual(117);
        return this.tsParseEnumDeclaration(node, true);
      }
    }

    return super.parseStatementContent(context, topLevel);
  }

  parseAccessModifier() {
    return this.tsParseModifier(["public", "protected", "private"]);
  }

  tsHasSomeModifiers(member, modifiers) {
    return modifiers.some(modifier => {
      if (tsIsAccessModifier(modifier)) {
        return member.accessibility === modifier;
      }

      return !!member[modifier];
    });
  }

  tsIsStartOfStaticBlocks() {
    return this.isContextual(99) && this.lookaheadCharCode() === 123;
  }

  parseClassMember(classBody, member, state) {
    const modifiers = ["declare", "private", "public", "protected", "override", "abstract", "readonly", "static"];
    this.tsParseModifiers(member, modifiers, undefined, undefined, true);

    const callParseClassMemberWithIsStatic = () => {
      if (this.tsIsStartOfStaticBlocks()) {
        this.next();
        this.next();

        if (this.tsHasSomeModifiers(member, modifiers)) {
          this.raise(this.state.pos, TSErrors.StaticBlockCannotHaveModifier);
        }

        this.parseClassStaticBlock(classBody, member);
      } else {
        this.parseClassMemberWithIsStatic(classBody, member, state, !!member.static);
      }
    };

    if (member.declare) {
      this.tsInAmbientContext(callParseClassMemberWithIsStatic);
    } else {
      callParseClassMemberWithIsStatic();
    }
  }

  parseClassMemberWithIsStatic(classBody, member, state, isStatic) {
    const idx = this.tsTryParseIndexSignature(member);

    if (idx) {
      classBody.body.push(idx);

      if (member.abstract) {
        this.raise(member.start, TSErrors.IndexSignatureHasAbstract);
      }

      if (member.accessibility) {
        this.raise(member.start, TSErrors.IndexSignatureHasAccessibility, member.accessibility);
      }

      if (member.declare) {
        this.raise(member.start, TSErrors.IndexSignatureHasDeclare);
      }

      if (member.override) {
        this.raise(member.start, TSErrors.IndexSignatureHasOverride);
      }

      return;
    }

    if (!this.state.inAbstractClass && member.abstract) {
      this.raise(member.start, TSErrors.NonAbstractClassHasAbstractMethod);
    }

    if (member.override) {
      if (!state.hadSuperClass) {
        this.raise(member.start, TSErrors.OverrideNotInSubClass);
      }
    }

    super.parseClassMemberWithIsStatic(classBody, member, state, isStatic);
  }

  parsePostMemberNameModifiers(methodOrProp) {
    const optional = this.eat(17);
    if (optional) methodOrProp.optional = true;

    if (methodOrProp.readonly && this.match(10)) {
      this.raise(methodOrProp.start, TSErrors.ClassMethodHasReadonly);
    }

    if (methodOrProp.declare && this.match(10)) {
      this.raise(methodOrProp.start, TSErrors.ClassMethodHasDeclare);
    }
  }

  parseExpressionStatement(node, expr) {
    const decl = expr.type === "Identifier" ? this.tsParseExpressionStatement(node, expr) : undefined;
    return decl || super.parseExpressionStatement(node, expr);
  }

  shouldParseExportDeclaration() {
    if (this.tsIsDeclarationStart()) return true;
    return super.shouldParseExportDeclaration();
  }

  parseConditional(expr, startPos, startLoc, refExpressionErrors) {
    if (!this.state.maybeInArrowParameters || !this.match(17)) {
      return super.parseConditional(expr, startPos, startLoc, refExpressionErrors);
    }

    const result = this.tryParse(() => super.parseConditional(expr, startPos, startLoc));

    if (!result.node) {
      if (result.error) {
        super.setOptionalParametersError(refExpressionErrors, result.error);
      }

      return expr;
    }

    if (result.error) this.state = result.failState;
    return result.node;
  }

  parseParenItem(node, startPos, startLoc) {
    node = super.parseParenItem(node, startPos, startLoc);

    if (this.eat(17)) {
      node.optional = true;
      this.resetEndLocation(node);
    }

    if (this.match(14)) {
      const typeCastNode = this.startNodeAt(startPos, startLoc);
      typeCastNode.expression = node;
      typeCastNode.typeAnnotation = this.tsParseTypeAnnotation();
      return this.finishNode(typeCastNode, "TSTypeCastExpression");
    }

    return node;
  }

  parseExportDeclaration(node) {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const isDeclare = this.eatContextual(116);

    if (isDeclare && (this.isContextual(116) || !this.shouldParseExportDeclaration())) {
      throw this.raise(this.state.start, TSErrors.ExpectedAmbientAfterExportDeclare);
    }

    let declaration;

    if ((0, _types.tokenIsIdentifier)(this.state.type)) {
      declaration = this.tsTryParseExportDeclaration();
    }

    if (!declaration) {
      declaration = super.parseExportDeclaration(node);
    }

    if (declaration && (declaration.type === "TSInterfaceDeclaration" || declaration.type === "TSTypeAliasDeclaration" || isDeclare)) {
      node.exportKind = "type";
    }

    if (declaration && isDeclare) {
      this.resetStartLocation(declaration, startPos, startLoc);
      declaration.declare = true;
    }

    return declaration;
  }

  parseClassId(node, isStatement, optionalId) {
    if ((!isStatement || optionalId) && this.isContextual(105)) {
      return;
    }

    super.parseClassId(node, isStatement, optionalId, node.declare ? _scopeflags.BIND_TS_AMBIENT : _scopeflags.BIND_CLASS);
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) node.typeParameters = typeParameters;
  }

  parseClassPropertyAnnotation(node) {
    if (!node.optional && this.eat(33)) {
      node.definite = true;
    }

    const type = this.tsTryParseTypeAnnotation();
    if (type) node.typeAnnotation = type;
  }

  parseClassProperty(node) {
    this.parseClassPropertyAnnotation(node);

    if (this.state.isAmbientContext && this.match(27)) {
      this.raise(this.state.start, TSErrors.DeclareClassFieldHasInitializer);
    }

    if (node.abstract && this.match(27)) {
      const {
        key
      } = node;
      this.raise(this.state.start, TSErrors.AbstractPropertyHasInitializer, key.type === "Identifier" && !node.computed ? key.name : `[${this.input.slice(key.start, key.end)}]`);
    }

    return super.parseClassProperty(node);
  }

  parseClassPrivateProperty(node) {
    if (node.abstract) {
      this.raise(node.start, TSErrors.PrivateElementHasAbstract);
    }

    if (node.accessibility) {
      this.raise(node.start, TSErrors.PrivateElementHasAccessibility, node.accessibility);
    }

    this.parseClassPropertyAnnotation(node);
    return super.parseClassPrivateProperty(node);
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper) {
    const typeParameters = this.tsTryParseTypeParameters();

    if (typeParameters && isConstructor) {
      this.raise(typeParameters.start, TSErrors.ConstructorHasTypeParameters);
    }

    if (method.declare && (method.kind === "get" || method.kind === "set")) {
      this.raise(method.start, TSErrors.DeclareAccessor, method.kind);
    }

    if (typeParameters) method.typeParameters = typeParameters;
    super.pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor, allowsDirectSuper);
  }

  pushClassPrivateMethod(classBody, method, isGenerator, isAsync) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) method.typeParameters = typeParameters;
    super.pushClassPrivateMethod(classBody, method, isGenerator, isAsync);
  }

  declareClassPrivateMethodInScope(node, kind) {
    if (node.type === "TSDeclareMethod") return;
    if (node.type === "MethodDefinition" && !node.value.body) return;
    super.declareClassPrivateMethodInScope(node, kind);
  }

  parseClassSuper(node) {
    super.parseClassSuper(node);

    if (node.superClass && this.match(44)) {
      node.superTypeParameters = this.tsParseTypeArguments();
    }

    if (this.eatContextual(105)) {
      node.implements = this.tsParseHeritageClause("implements");
    }
  }

  parseObjPropValue(prop, ...args) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) prop.typeParameters = typeParameters;
    super.parseObjPropValue(prop, ...args);
  }

  parseFunctionParams(node, allowModifiers) {
    const typeParameters = this.tsTryParseTypeParameters();
    if (typeParameters) node.typeParameters = typeParameters;
    super.parseFunctionParams(node, allowModifiers);
  }

  parseVarId(decl, kind) {
    super.parseVarId(decl, kind);

    if (decl.id.type === "Identifier" && this.eat(33)) {
      decl.definite = true;
    }

    const type = this.tsTryParseTypeAnnotation();

    if (type) {
      decl.id.typeAnnotation = type;
      this.resetEndLocation(decl.id);
    }
  }

  parseAsyncArrowFromCallExpression(node, call) {
    if (this.match(14)) {
      node.returnType = this.tsParseTypeAnnotation();
    }

    return super.parseAsyncArrowFromCallExpression(node, call);
  }

  parseMaybeAssign(...args) {
    var _jsx, _jsx2, _typeCast, _jsx3, _typeCast2, _jsx4, _typeCast3;

    let state;
    let jsx;
    let typeCast;

    if (this.hasPlugin("jsx") && (this.match(133) || this.match(44))) {
      state = this.state.clone();
      jsx = this.tryParse(() => super.parseMaybeAssign(...args), state);
      if (!jsx.error) return jsx.node;
      const {
        context
      } = this.state;

      if (context[context.length - 1] === _context.types.j_oTag) {
        context.length -= 2;
      } else if (context[context.length - 1] === _context.types.j_expr) {
        context.length -= 1;
      }
    }

    if (!((_jsx = jsx) != null && _jsx.error) && !this.match(44)) {
      return super.parseMaybeAssign(...args);
    }

    let typeParameters;
    state = state || this.state.clone();
    const arrow = this.tryParse(abort => {
      var _expr$extra, _typeParameters;

      typeParameters = this.tsParseTypeParameters();
      const expr = super.parseMaybeAssign(...args);

      if (expr.type !== "ArrowFunctionExpression" || (_expr$extra = expr.extra) != null && _expr$extra.parenthesized) {
        abort();
      }

      if (((_typeParameters = typeParameters) == null ? void 0 : _typeParameters.params.length) !== 0) {
        this.resetStartLocationFromNode(expr, typeParameters);
      }

      expr.typeParameters = typeParameters;
      return expr;
    }, state);

    if (!arrow.error && !arrow.aborted) {
      if (typeParameters) this.reportReservedArrowTypeParam(typeParameters);
      return arrow.node;
    }

    if (!jsx) {
      assert(!this.hasPlugin("jsx"));
      typeCast = this.tryParse(() => super.parseMaybeAssign(...args), state);
      if (!typeCast.error) return typeCast.node;
    }

    if ((_jsx2 = jsx) != null && _jsx2.node) {
      this.state = jsx.failState;
      return jsx.node;
    }

    if (arrow.node) {
      this.state = arrow.failState;
      if (typeParameters) this.reportReservedArrowTypeParam(typeParameters);
      return arrow.node;
    }

    if ((_typeCast = typeCast) != null && _typeCast.node) {
      this.state = typeCast.failState;
      return typeCast.node;
    }

    if ((_jsx3 = jsx) != null && _jsx3.thrown) throw jsx.error;
    if (arrow.thrown) throw arrow.error;
    if ((_typeCast2 = typeCast) != null && _typeCast2.thrown) throw typeCast.error;
    throw ((_jsx4 = jsx) == null ? void 0 : _jsx4.error) || arrow.error || ((_typeCast3 = typeCast) == null ? void 0 : _typeCast3.error);
  }

  reportReservedArrowTypeParam(node) {
    var _node$extra;

    if (node.params.length === 1 && !((_node$extra = node.extra) != null && _node$extra.trailingComma) && this.getPluginOption("typescript", "disallowAmbiguousJSXLike")) {
      this.raise(node.start, TSErrors.ReservedArrowTypeParam);
    }
  }

  parseMaybeUnary(refExpressionErrors) {
    if (!this.hasPlugin("jsx") && this.match(44)) {
      return this.tsParseTypeAssertion();
    } else {
      return super.parseMaybeUnary(refExpressionErrors);
    }
  }

  parseArrow(node) {
    if (this.match(14)) {
      const result = this.tryParse(abort => {
        const returnType = this.tsParseTypeOrTypePredicateAnnotation(14);
        if (this.canInsertSemicolon() || !this.match(19)) abort();
        return returnType;
      });
      if (result.aborted) return;

      if (!result.thrown) {
        if (result.error) this.state = result.failState;
        node.returnType = result.node;
      }
    }

    return super.parseArrow(node);
  }

  parseAssignableListItemTypes(param) {
    if (this.eat(17)) {
      if (param.type !== "Identifier" && !this.state.isAmbientContext && !this.state.inType) {
        this.raise(param.start, TSErrors.PatternIsOptional);
      }

      param.optional = true;
    }

    const type = this.tsTryParseTypeAnnotation();
    if (type) param.typeAnnotation = type;
    this.resetEndLocation(param);
    return param;
  }

  isAssignable(node, isBinding) {
    switch (node.type) {
      case "TSTypeCastExpression":
        return this.isAssignable(node.expression, isBinding);

      case "TSParameterProperty":
        return true;

      default:
        return super.isAssignable(node, isBinding);
    }
  }

  toAssignable(node, isLHS = false) {
    switch (node.type) {
      case "TSTypeCastExpression":
        return super.toAssignable(this.typeCastToParameter(node), isLHS);

      case "TSParameterProperty":
        return super.toAssignable(node, isLHS);

      case "ParenthesizedExpression":
        return this.toAssignableParenthesizedExpression(node, isLHS);

      case "TSAsExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
        node.expression = this.toAssignable(node.expression, isLHS);
        return node;

      default:
        return super.toAssignable(node, isLHS);
    }
  }

  toAssignableParenthesizedExpression(node, isLHS) {
    switch (node.expression.type) {
      case "TSAsExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "ParenthesizedExpression":
        node.expression = this.toAssignable(node.expression, isLHS);
        return node;

      default:
        return super.toAssignable(node, isLHS);
    }
  }

  checkLVal(expr, contextDescription, ...args) {
    var _expr$extra2;

    switch (expr.type) {
      case "TSTypeCastExpression":
        return;

      case "TSParameterProperty":
        this.checkLVal(expr.parameter, "parameter property", ...args);
        return;

      case "TSAsExpression":
      case "TSTypeAssertion":
        if (!args[0] && contextDescription !== "parenthesized expression" && !((_expr$extra2 = expr.extra) != null && _expr$extra2.parenthesized)) {
          this.raise(expr.start, _error.Errors.InvalidLhs, contextDescription);
          break;
        }

        this.checkLVal(expr.expression, "parenthesized expression", ...args);
        return;

      case "TSNonNullExpression":
        this.checkLVal(expr.expression, contextDescription, ...args);
        return;

      default:
        super.checkLVal(expr, contextDescription, ...args);
        return;
    }
  }

  parseBindingAtom() {
    switch (this.state.type) {
      case 73:
        return this.parseIdentifier(true);

      default:
        return super.parseBindingAtom();
    }
  }

  parseMaybeDecoratorArguments(expr) {
    if (this.match(44)) {
      const typeArguments = this.tsParseTypeArguments();

      if (this.match(10)) {
        const call = super.parseMaybeDecoratorArguments(expr);
        call.typeParameters = typeArguments;
        return call;
      }

      this.unexpected(this.state.start, 10);
    }

    return super.parseMaybeDecoratorArguments(expr);
  }

  checkCommaAfterRest(close) {
    if (this.state.isAmbientContext && this.match(12) && this.lookaheadCharCode() === close) {
      this.next();
    } else {
      super.checkCommaAfterRest(close);
    }
  }

  isClassMethod() {
    return this.match(44) || super.isClassMethod();
  }

  isClassProperty() {
    return this.match(33) || this.match(14) || super.isClassProperty();
  }

  parseMaybeDefault(...args) {
    const node = super.parseMaybeDefault(...args);

    if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
      this.raise(node.typeAnnotation.start, TSErrors.TypeAnnotationAfterAssign);
    }

    return node;
  }

  getTokenFromCode(code) {
    if (this.state.inType) {
      if (code === 62) {
        return this.finishOp(45, 1);
      }

      if (code === 60) {
        return this.finishOp(44, 1);
      }
    }

    return super.getTokenFromCode(code);
  }

  reScan_lt_gt() {
    const {
      type
    } = this.state;

    if (type === 44) {
      this.state.pos -= 1;
      this.readToken_lt();
    } else if (type === 45) {
      this.state.pos -= 1;
      this.readToken_gt();
    }
  }

  toAssignableList(exprList) {
    for (let i = 0; i < exprList.length; i++) {
      const expr = exprList[i];
      if (!expr) continue;

      switch (expr.type) {
        case "TSTypeCastExpression":
          exprList[i] = this.typeCastToParameter(expr);
          break;

        case "TSAsExpression":
        case "TSTypeAssertion":
          if (!this.state.maybeInArrowParameters) {
            exprList[i] = this.typeCastToParameter(expr);
          } else {
            this.raise(expr.start, TSErrors.UnexpectedTypeCastInParameter);
          }

          break;
      }
    }

    return super.toAssignableList(...arguments);
  }

  typeCastToParameter(node) {
    node.expression.typeAnnotation = node.typeAnnotation;
    this.resetEndLocation(node.expression, node.typeAnnotation.end, node.typeAnnotation.loc.end);
    return node.expression;
  }

  shouldParseArrow(params) {
    if (this.match(14)) {
      return params.every(expr => this.isAssignable(expr, true));
    }

    return super.shouldParseArrow(params);
  }

  shouldParseAsyncArrow() {
    return this.match(14) || super.shouldParseAsyncArrow();
  }

  canHaveLeadingDecorator() {
    return super.canHaveLeadingDecorator() || this.isAbstractClass();
  }

  jsxParseOpeningElementAfterName(node) {
    if (this.match(44)) {
      const typeArguments = this.tsTryParseAndCatch(() => this.tsParseTypeArguments());
      if (typeArguments) node.typeParameters = typeArguments;
    }

    return super.jsxParseOpeningElementAfterName(node);
  }

  getGetterSetterExpectedParamCount(method) {
    const baseCount = super.getGetterSetterExpectedParamCount(method);
    const params = this.getObjectOrClassMethodParams(method);
    const firstParam = params[0];
    const hasContextParam = firstParam && this.isThisParam(firstParam);
    return hasContextParam ? baseCount + 1 : baseCount;
  }

  parseCatchClauseParam() {
    const param = super.parseCatchClauseParam();
    const type = this.tsTryParseTypeAnnotation();

    if (type) {
      param.typeAnnotation = type;
      this.resetEndLocation(param);
    }

    return param;
  }

  tsInAmbientContext(cb) {
    const oldIsAmbientContext = this.state.isAmbientContext;
    this.state.isAmbientContext = true;

    try {
      return cb();
    } finally {
      this.state.isAmbientContext = oldIsAmbientContext;
    }
  }

  parseClass(node, ...args) {
    const oldInAbstractClass = this.state.inAbstractClass;
    this.state.inAbstractClass = !!node.abstract;

    try {
      return super.parseClass(node, ...args);
    } finally {
      this.state.inAbstractClass = oldInAbstractClass;
    }
  }

  tsParseAbstractDeclaration(node) {
    if (this.match(75)) {
      node.abstract = true;
      return this.parseClass(node, true, false);
    } else if (this.isContextual(120)) {
      if (!this.hasFollowingLineBreak()) {
        node.abstract = true;
        this.raise(node.start, TSErrors.NonClassMethodPropertyHasAbstractModifer);
        this.next();
        return this.tsParseInterfaceDeclaration(node);
      }
    } else {
      this.unexpected(null, 75);
    }
  }

  parseMethod(...args) {
    const method = super.parseMethod(...args);

    if (method.abstract) {
      const hasBody = this.hasPlugin("estree") ? !!method.value.body : !!method.body;

      if (hasBody) {
        const {
          key
        } = method;
        this.raise(method.start, TSErrors.AbstractMethodHasImplementation, key.type === "Identifier" && !method.computed ? key.name : `[${this.input.slice(key.start, key.end)}]`);
      }
    }

    return method;
  }

  tsParseTypeParameterName() {
    const typeName = this.parseIdentifier();
    return process.env.BABEL_8_BREAKING ? typeName : typeName.name;
  }

  shouldParseAsAmbientContext() {
    return !!this.getPluginOption("typescript", "dts");
  }

  parse() {
    if (this.shouldParseAsAmbientContext()) {
      this.state.isAmbientContext = true;
    }

    return super.parse();
  }

  getExpression() {
    if (this.shouldParseAsAmbientContext()) {
      this.state.isAmbientContext = true;
    }

    return super.getExpression();
  }

  parseExportSpecifier(node, isString, isInTypeExport, isMaybeTypeOnly) {
    if (!isString && isMaybeTypeOnly) {
      this.parseTypeOnlyImportExportSpecifier(node, false, isInTypeExport);
      return this.finishNode(node, "ExportSpecifier");
    }

    node.exportKind = "value";
    return super.parseExportSpecifier(node, isString, isInTypeExport, isMaybeTypeOnly);
  }

  parseImportSpecifier(specifier, importedIsString, isInTypeOnlyImport, isMaybeTypeOnly) {
    if (!importedIsString && isMaybeTypeOnly) {
      this.parseTypeOnlyImportExportSpecifier(specifier, true, isInTypeOnlyImport);
      return this.finishNode(specifier, "ImportSpecifier");
    }

    specifier.importKind = "value";
    return super.parseImportSpecifier(specifier, importedIsString, isInTypeOnlyImport, isMaybeTypeOnly);
  }

  parseTypeOnlyImportExportSpecifier(node, isImport, isInTypeOnlyImportExport) {
    const leftOfAsKey = isImport ? "imported" : "local";
    const rightOfAsKey = isImport ? "local" : "exported";
    let leftOfAs = node[leftOfAsKey];
    let rightOfAs;
    let hasTypeSpecifier = false;
    let canParseAsKeyword = true;
    const pos = leftOfAs.start;

    if (this.isContextual(88)) {
      const firstAs = this.parseIdentifier();

      if (this.isContextual(88)) {
        const secondAs = this.parseIdentifier();

        if ((0, _types.tokenIsKeywordOrIdentifier)(this.state.type)) {
          hasTypeSpecifier = true;
          leftOfAs = firstAs;
          rightOfAs = this.parseIdentifier();
          canParseAsKeyword = false;
        } else {
          rightOfAs = secondAs;
          canParseAsKeyword = false;
        }
      } else if ((0, _types.tokenIsKeywordOrIdentifier)(this.state.type)) {
        canParseAsKeyword = false;
        rightOfAs = this.parseIdentifier();
      } else {
        hasTypeSpecifier = true;
        leftOfAs = firstAs;
      }
    } else if ((0, _types.tokenIsKeywordOrIdentifier)(this.state.type)) {
      hasTypeSpecifier = true;
      leftOfAs = this.parseIdentifier();
    }

    if (hasTypeSpecifier && isInTypeOnlyImportExport) {
      this.raise(pos, isImport ? TSErrors.TypeModifierIsUsedInTypeImports : TSErrors.TypeModifierIsUsedInTypeExports);
    }

    node[leftOfAsKey] = leftOfAs;
    node[rightOfAsKey] = rightOfAs;
    const kindKey = isImport ? "importKind" : "exportKind";
    node[kindKey] = hasTypeSpecifier ? "type" : "value";

    if (canParseAsKeyword && this.eatContextual(88)) {
      node[rightOfAsKey] = isImport ? this.parseIdentifier() : this.parseModuleExportName();
    }

    if (!node[rightOfAsKey]) {
      node[rightOfAsKey] = (0, _node.cloneIdentifier)(node[leftOfAsKey]);
    }

    if (isImport) {
      this.checkLVal(node[rightOfAsKey], "import specifier", _scopeflags.BIND_LEXICAL);
    }
  }

};

exports.default = _default;