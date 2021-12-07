"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultOptions = void 0;
exports.getOptions = getOptions;
const defaultOptions = {
  sourceType: "script",
  sourceFilename: undefined,
  startColumn: 0,
  startLine: 1,
  allowAwaitOutsideFunction: false,
  allowReturnOutsideFunction: false,
  allowImportExportEverywhere: false,
  allowSuperOutsideMethod: false,
  allowUndeclaredExports: false,
  plugins: [],
  strictMode: null,
  ranges: false,
  tokens: false,
  createParenthesizedExpressions: false,
  errorRecovery: false,
  attachComment: true
};
exports.defaultOptions = defaultOptions;

function getOptions(opts) {
  const options = {};

  for (const key of Object.keys(defaultOptions)) {
    options[key] = opts && opts[key] != null ? opts[key] : defaultOptions[key];
  }

  return options;
}