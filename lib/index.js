"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parse = parse;
exports.parseExpression = parseExpression;
exports.tokTypes = void 0;

var _pluginUtils = require("./plugin-utils");

var _parser = require("./parser");

var _types = require("./tokenizer/types");

require("./tokenizer/context");

function parse(input, options) {
  var _options;

  if (((_options = options) == null ? void 0 : _options.sourceType) === "unambiguous") {
    options = Object.assign({}, options);

    try {
      options.sourceType = "module";
      const parser = getParser(options, input);
      const ast = parser.parse();

      if (parser.sawUnambiguousESM) {
        return ast;
      }

      if (parser.ambiguousScriptDifferentAst) {
        try {
          options.sourceType = "script";
          return getParser(options, input).parse();
        } catch {}
      } else {
        ast.program.sourceType = "script";
      }

      return ast;
    } catch (moduleError) {
      try {
        options.sourceType = "script";
        return getParser(options, input).parse();
      } catch {}

      throw moduleError;
    }
  } else {
    return getParser(options, input).parse();
  }
}

function parseExpression(input, options) {
  const parser = getParser(options, input);

  if (parser.options.strictMode) {
    parser.state.strict = true;
  }

  return parser.getExpression();
}

function generateExportedTokenTypes(internalTokenTypes) {
  const tokenTypes = {};

  for (const typeName of Object.keys(internalTokenTypes)) {
    tokenTypes[typeName] = (0, _types.getExportedToken)(internalTokenTypes[typeName]);
  }

  return tokenTypes;
}

const tokTypes = generateExportedTokenTypes(_types.tt);
exports.tokTypes = tokTypes;

function getParser(options, input) {
  let cls = _parser.default;

  if (options != null && options.plugins) {
    (0, _pluginUtils.validatePlugins)(options.plugins);
    cls = getParserClass(options.plugins);
  }

  return new cls(options, input);
}

const parserClassCache = {};

function getParserClass(pluginsFromOptions) {
  const pluginList = _pluginUtils.mixinPluginNames.filter(name => (0, _pluginUtils.hasPlugin)(pluginsFromOptions, name));

  const key = pluginList.join("/");
  let cls = parserClassCache[key];

  if (!cls) {
    cls = _parser.default;

    for (const plugin of pluginList) {
      cls = _pluginUtils.mixinPlugins[plugin](cls);
    }

    parserClassCache[key] = cls;
  }

  return cls;
}