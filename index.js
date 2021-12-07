const parser = require('./lib')

module.exports = function ({ types: t }) {
  return {
    parserOverride(code, opts) {
      return parser.parse(code, opts)
    },
    visitor: {
      BinaryExpression(path) {
        if (path.get('overloaded').node) {
          path.replaceWith(
            t.callExpression(t.identifier(path.node.operator), [path.node.left, path.node.right])
          )
        }
      }
    },
  }
}
