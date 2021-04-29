/* eslint-disable no-proto */
const Syntax = require('./syntax').Syntax;
const { getInfo, nodeToType, isFunction } = require('./astnode');
const {
  trackVars,
  jsdoc,
  makeDefaultParamFinisher,
  makeRestParamFinisher,
  makeAsyncFunctionFinisher,
  makeGeneratorFinisher,
  makeNodeTypeFinisher,
  makeInlineParamsFinisher,
  makeReturnTypeFinisher,
  makeConstructorFinisher,
  makeTempateFinisher
} = require('./util');

/**
 * Check whether a comment node represents a block comment.
 *
 * @param {!Object} comment - A comment node with `type` and `value` properties.
 * @return {boolean} `true` if the comment is a block comment, `false` otherwise.
 */
function isBlockComment({ type }) {
  return type === 'CommentBlock';
}

/**
 * Get the raw comment string for a block comment node.
 *
 * @private
 * @param {!Object} comment - A comment node with `type` and `value` properties.
 */
function getRawComment({ value }) {
  return `/*${value}*/`;
}

/**
 * Verify that a block comment exists; that it is a JSDoc comment; and that its leading delimiter
 * does not contain three or more asterisks.
 *
 * @private
 * @memberof module:jsdoc/src/parser.Parser
 */
function isValidJsdoc(commentSrc) {
  return commentSrc && commentSrc.length > 4 && commentSrc.indexOf('/**') === 0 && commentSrc.indexOf('/***') !== 0;
}
function getLeadingJsdocComment(node) {
  let comment = null;
  let leadingComments = node.leadingComments;

  if (Array.isArray(leadingComments) && leadingComments.length) {
    // the attached comments may include line comments, which we don't want
    leadingComments = leadingComments.filter(isBlockComment);

    if (leadingComments.length) {
      // treat the comment closest to the node as the leading comment
      comment = getRawComment(leadingComments[leadingComments.length - 1]);

      if (!isValidJsdoc(comment)) {
        comment = null;
      }
    }
  }

  return comment;
}
// TODO: docs
class TypeScriptSymbolFound {
  // TODO: docs
  constructor(node, filename, extras = {}) {
    this.id = extras.id || node.nodeId;
    this.comment = extras.comment || getLeadingJsdocComment(node) || '@undocumented';
    this.lineno = extras.lineno || node.loc.start.line;
    this.columnno = extras.columnno || node.loc.start.column;
    this.range = extras.range || node.range;
    this.filename = extras.filename || filename;
    this.astnode = extras.astnode || node;
    this.code = extras.code;
    this.event = extras.event || 'symbolFound';
    this.finishers = extras.finishers || [];

    // make sure the event includes properties that don't have default values
    Object.keys(extras).forEach(key => {
      this[key] = extras[key];
    });
  }
}
/**
 * @param {import('@babel/types').Node} node babel node
 */
function nodeToTempalteType(node) {
  if (node) {
    let nodetype;
    switch (node.type) {
      case 'TSTypeParameterDeclaration':
        return node.params.map(nodeToTempalteType);
      case 'TSTypeParameter':
        return {
          name: node.name,
          default: nodeToTempalteType(node.default),
          constraint: nodeToTempalteType(node.constraint)
        };
      case 'TSTypeOperator':
        nodetype = nodeToType(node);
        if (nodetype) {
          nodetype.operator = node.operator;
        }
        break;
      default:
        nodetype = nodeToType(node);
        break;
    }

    if (!nodetype) {
      debugger;
      jsdoc.util.logger.warn('Found template type annotation of unrecognized node type %s failed!', node.type);
    }
    return nodetype;
  }
}
module.exports = function onTypeScriptVisitNode(node, e, parser, currentSourceName) {
  const extras = {
    code: getInfo(node)
  };
  let basename;
  let nodetype;
  const parent = node.parent;
  switch (node.type) {
    case Syntax.TSInterfaceDeclaration:
      e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
      trackVars(parser, node, e);
      break;
    case Syntax.MethodDefinition:
    case Syntax.TSMethodSignature:
    case Syntax.TSDeclareFunction:
    case Syntax.TSCallSignatureDeclaration:
      e.finishers = [
        // handle cases where at least one parameter has a default value
        makeDefaultParamFinisher(),
        // handle rest parameters
        makeRestParamFinisher(),
        // handle async functions
        makeAsyncFunctionFinisher(),
        // handle generator functions
        makeGeneratorFinisher()
      ];

      e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
      if (node.kind === 'constructor' || node.type === Syntax.TSCallSignatureDeclaration) {
        e.finishers.push(makeConstructorFinisher(parser));
      }
      trackVars(parser, node, e);

      basename = jsdoc.name.getBasename(e.code.name);
      e.code.funcscope = parser.resolveVar(node, basename);
      nodetype = nodeToType(node);
      if (nodetype) {
        e.finishers.unshift(makeReturnTypeFinisher(nodetype));
      }
      break;
    case Syntax.TSModuleDeclaration:
      if (extras.code.name !== 'global') {
        e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
        trackVars(parser, node, e);
      }
      break;
    case Syntax.TSPropertySignature:
      nodetype = nodeToType(node.typeAnnotation);
      if (node.kind !== 'get' && node.kind !== 'set') {
        extras.finishers = [parser.resolveEnum];
      }
      e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
      if (nodetype) {
        e.finishers.unshift(makeNodeTypeFinisher(nodetype));
      }

      break;
    // like `...bar` in: function foo(...bar) {}
    case Syntax.RestElement:
    case Syntax.Identifier:
      nodetype = nodeToType(node);
      if (nodetype) {
        extras.comment = `/**\n@type {${nodetype.typeExpression}}\n*/`;
        e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
        // function parameters with inline comments
        if (!node.leadingComments && parent && isFunction(parent)) {
          e.finishers = [makeInlineParamsFinisher(parser)];
          trackVars(parser, node, e);
        }
        e.finishers.unshift(makeNodeTypeFinisher(nodetype));
      }

      break;

    case Syntax.TSEnumDeclaration:
    case Syntax.TSTypeAliasDeclaration:
      nodetype = nodeToType(node);
      e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
      trackVars(parser, node, e);
      e.finishers.unshift(makeNodeTypeFinisher(nodetype));
      break;
    case Syntax.TSEnumMember:
      nodetype = nodeToType(node);
      e.finishers.push(parser.resolveEnum);
      e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
      if (nodetype) {
        e.finishers.unshift(makeNodeTypeFinisher(nodetype));
      }
      break;
    case Syntax.TSIndexSignature:
      nodetype = nodeToType(node);
      e.__proto__ = new TypeScriptSymbolFound(node, currentSourceName, extras);
      e.finishers.unshift(makeNodeTypeFinisher(nodetype));
      break;
    default:
      break;
  }
  if (node.typeParameters) {
    e.finishers.unshift(makeTempateFinisher(nodeToTempalteType(node.typeParameters)));
  }
};
