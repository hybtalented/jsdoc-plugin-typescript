const util = require('./util');
const { Syntax } = require('./syntax');
const walkers = require('jsdoc/lib/jsdoc/src/walker').walkers;

// typescript 允许函数体未定义
walkers[Syntax.ArrowFunctionExpression] = (node, parent, state, cb) => {
  let param_parent = node;
  if (node.id) {
    cb(node.id, node, state);
  }
  if (param_parent && param_parent.parent && param_parent.parent.type === Syntax.MethodDefinition) {
    param_parent = param_parent.parent;
  }
  for (const param of node.params) {
    cb(param, param_parent, state);
  }

  if (node.body) {
    cb(node.body, parent, state);
  }
};
walkers[Syntax.FunctionExpression] = walkers[Syntax.ArrowFunctionExpression];

walkers[Syntax.TSInterfaceDeclaration] = (node, parent, state, cb) => {
  cb(node.body, node, state);
};
walkers[Syntax.TSInterfaceBody] = (node, parent, state, cb) => {
  if (Array.isArray(node.body)) {
    node.body.forEach(child => cb(child, node, state));
  }
};

walkers[Syntax.TSMethodSignature] = (node, parent, state, cb) => {
  if (node.key) {
    cb(node.key, node, state);
  }

  for (const param of node.parameters) {
    cb(param, node, state);
  }
  if (node.body) {
    cb(node.body, node, state);
  }
};
walkers[Syntax.TSCallSignatureDeclaration] = walkers[Syntax.TSMethodSignature];
walkers[Syntax.TSModuleDeclaration] = (node, parent, state, cb) => {
  if (node.body && Array.isArray(node.body.body)) {
    node.body.body.forEach(param => cb(param, node, state));
  }
};
walkers[Syntax.TSPropertySignature] = util.noop;
walkers[Syntax.TSDeclareFunction] = walkers[Syntax.ArrowFunctionExpression];
walkers[Syntax.TSEnumDeclaration] = (node, parent, state, cb) => {
  if (Array.isArray(node.members)) {
    node.members.forEach(member => {
      cb(member, node, state);
    });
  }
};
walkers[Syntax.TSEnumMember] = (node, parent, state, cb) => {
  if (node.initializer) {
    cb(node.initializer, node, state);
  }
};

walkers[Syntax.TSTypeAliasDeclaration] = util.noop;
walkers[Syntax.TSIndexSignature] = util.noop;
