const astBuilder = require('jsdoc/lib/jsdoc/src/astbuilder');
const TypeScriptVisitor = require('./hack/visitor');
require('./hack/walkers');
require('./hack/astnode');
// 添加 typescript 支持
astBuilder.parserOptions.plugins.push('typescript');

exports.handlers = {
  newDoclet: function onNewDoclet(event) {}
};
exports.defineTags = function defineTypeScriptTag(dictionary) {
  dictionary.defineTag('tparam', {
    onTagged(doclet, { value }) {
      doclet.tparams = doclet.tparams || [];
      doclet.tparams.push(value);
    },
    canHaveName: true,
    mustHaveValue: true
  });
};
exports.astNodeVisitor = { visitNode: TypeScriptVisitor };
