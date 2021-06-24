const astnode = require('jsdoc/src/astnode');
const Syntax = require('./syntax').Syntax;
const catharsis = require('catharsis');

const name = require('jsdoc/name');
const logger = require('jsdoc/util/logger');
const origin_astnode = {
  isScope: astnode.isScope,
  isFunction: astnode.isFunction,
  getInfo: astnode.getInfo,
  getParamNames: astnode.getParamNames,
  nodeToValue: astnode.nodeToValue
};

astnode.isScope = node => Boolean(node) && typeof node === 'object' && (node.type === Syntax.TSInterfaceDeclaration || origin_astnode.isScope(node));
astnode.isFunction = node => {
  if (!node) {
    return false;
  }
  const type = typeof node === 'string' ? node : node.type;
  return type === Syntax.TSMethodSignature || type === Syntax.TSDeclareFunction || type === Syntax.TSCallSignatureDeclaration || origin_astnode.isFunction(type);
};
const TypeParametersIgnoreNodes = ['FunctionExpression', 'TSMethodSignature', 'TSTypeAliasDeclaration', 'TSDeclareFunction'];
const getParentName = (parent, isconstructor = false) => {
  let str;
  // for the constructor of a module's default export, use a special name
  if (isconstructor && parent.parent && parent.parent.type === Syntax.ExportDefaultDeclaration) {
    str = 'module.exports';
  }
  // for the constructor of a module's named export, use the name of the export
  // declaration
  else if (isconstructor && parent.parent && parent.parent.type === Syntax.ExportNamedDeclaration) {
    str = astnode.nodeToValue(parent.parent);
  }
  // for other constructors, use the name of the parent class
  else if (isconstructor) {
    str = astnode.nodeToValue(parent);
  }
  // if the method is a member of a module's default export, ignore the name, because it's
  // irrelevant
  else if (parent.parent && parent.parent.type === Syntax.ExportDefaultDeclaration) {
    str = '';
  } // otherwise, use the class's name
  else {
    str = parent.id ? astnode.nodeToValue(parent.id) : '';
  }
  return str;
};

const nodeToValue = node => {
  let parent = node.parent;
  let str;
  let isconstructor;
  switch (node.type) {
    case Syntax.TSModuleDeclaration:
      str = nodeToValue(node.id).replace(/\*[\\/]/, '');
      break;
    case Syntax.TSInterfaceDeclaration:
    case Syntax.TSDeclareFunction:
    case Syntax.TSTypeAliasDeclaration:
      str = nodeToValue(node.id);
      break;
    case Syntax.TSCallSignatureDeclaration:
    case Syntax.TSMethodSignature:
      parent = parent.parent;
      // for class expressions, we want the name of the variable the class is assigned to
      // (but there won't be a name if the class is returned by an arrow function expression)
      // TODO: we should use `name.LONGNAMES.ANONYMOUS` instead of an empty string, but that
      // causes problems downstream if the parent class has an `@alias` tag

      isconstructor = node.kind === 'constructor' || node.type === Syntax.TSCallSignatureDeclaration;
      str = getParentName(parent, isconstructor);
      if (node.kind !== 'constructor' && node.type !== Syntax.TSCallSignatureDeclaration) {
        if (str) {
          str += node.static ? name.SCOPE.PUNC.STATIC : name.SCOPE.PUNC.INSTANCE;
        }
        str += nodeToValue(node.key);
      }
      break;

    case Syntax.TSPropertySignature:
      str = `${getParentName(parent.parent)}${node.static ? name.SCOPE.PUNC.STATIC : name.SCOPE.PUNC.INSTANCE}${nodeToValue(node.key)}`;
      break;
    case Syntax.TSQualifiedName:
      str = `${nodeToValue(node.left)}.${nodeToValue(node.right)}`;
      break;
    default:
      str = origin_astnode.nodeToValue(node);
      break;
  }
  return str;
};
/**
 * @param {import('@babel/types').Node} node babel node
 * @returns {string} catharsis style string
 */
const nodeToTypeString = node => {
  let expression = '';
  if (node) {
    switch (node.type) {
      case 'TSStringKeyword':
        expression = 'string';
        break;
      case 'TSBooleanKeyword':
        expression = 'boolean';
        break;
      case 'TSNumberKeyword':
        expression = 'number';
        break;
      case 'TSAnyKeyword':
        expression = 'any';
        break;
      case 'TSTypeReference':
        expression = nodeToValue(node.typeName);
        break;
      case 'TSUnionType':
      case 'TSIntersectionType':
        expression = node.types.map(nodeToTypeString).join('|');
        break;
      case 'TSTypeLiteral':
        expression = `{${node.members.map(nodeToTypeString).join(',')}}`;
        break;
      case 'TSPropertySignature':
        return `${node.key.name} :${node.optional ? '?' : ''}${nodeToTypeString(node.typeAnnotation)}`;
      case 'TSLiteralType':
        expression = nodeToTypeString(node.literal);
        break;
      case 'Literal':
        return node.raw;
      case 'TSTupleType':
        if (node.elementTypes.length > 0) {
          expression = `Array<${node.elementTypes.map(nodeToTypeString).join('|')}>`;
        } else {
          expression = 'any[]';
        }
        break;
      case 'TSArrayType':
        expression = `Array<${nodeToTypeString(node.elementType)}>`;
        break;
      case 'TSObjectKeyword':
        expression = '{}';
        break;
      case 'TSVoidKeyword':
        expression = 'void';
        break;
      case 'TSNullKeyword':
        expression = 'null';
        break;
      case 'TSDeclareFunction':
      case 'FunctionExpression':
        expression = nodeToTypeString(node.returnType);
        break;
      case 'TSEnumDeclaration':
        expression = node.members.map(nodeToTypeString).join('|');
        break;
      case 'TSEnumMember':
        expression = nodeToTypeString(node.initializer);
        break;
      case 'TSIndexedAccessType':
        expression = `${nodeToTypeString(node.objectType)}.${nodeToTypeString(node.indexType)}`;
        break;
      case 'TSTypeParameter':
        expression = node.name;
        break;
      case 'TSTypeParameterDeclaration':
      case 'TSTypeParameterInstantiation':
        expression = `<${node.params.map(nodeToTypeString).join(',')}>`;
        break;
      case 'MethodDefinition':
        expression = nodeToTypeString(node.value);
        break;
      case 'TSThisType':
        expression = 'this';
        break;
      case 'TSTypeQuery':
        expression = nodeToValue(node.exprName);
        break;
      default:
        if (node.typeAnnotation) {
          expression = nodeToTypeString(node.typeAnnotation);
          break;
        } else {
          switch (node.type) {
            case 'Identifier':
              break;
            case 'TSMethodSignature':
              logger.debug('The return type of method %s.%s is not defined', node.parent.parent.id.name, node.key.name);
              break;
            default:
              logger.warn('Found type annotation of unrecognized node type %s', node.type);
          }
          return;
        }
    }
    if (!TypeParametersIgnoreNodes.includes(node.type)) {
      if (node.typeParameters) {
        expression = `${expression}.${nodeToTypeString(node.typeParameters)}`;
      }
    }

    if (node.optional) {
      return `?${expression}`;
    }
  }

  return expression;
};

const getParamNames = node => {
  if (node && node.parameters) {
    return node.parameters.map(param => nodeToValue(param)).filter(value => value !== 'this');
  }
  return origin_astnode.getParamNames(node);
};

function getTypeStrings(parsedType, isOutermostType) {
  let applications;
  let typeString;

  let types = [];

  const TYPES = catharsis.Types;

  switch (parsedType.type) {
    case TYPES.AllLiteral:
      types.push('*');
      break;
    case TYPES.FunctionType:
      types.push('function');
      break;
    case TYPES.NameExpression:
      types.push(parsedType.name);
      break;
    case TYPES.NullLiteral:
      types.push('null');
      break;
    case TYPES.RecordType:
      types.push('Object');
      break;
    case TYPES.TypeApplication:
      // if this is the outermost type, we strip the modifiers; otherwise, we keep them
      if (isOutermostType) {
        applications = parsedType.applications.map(application => catharsis.stringify(application)).join(', ');
        typeString = `${getTypeStrings(parsedType.expression)[0]}.<${applications}>`;

        types.push(typeString);
      } else {
        types.push(catharsis.stringify(parsedType));
      }
      break;
    case TYPES.TypeUnion:
      parsedType.elements.forEach(element => {
        types = types.concat(getTypeStrings(element));
      });
      break;
    case TYPES.UndefinedLiteral:
      types.push('undefined');
      break;
    case TYPES.UnknownLiteral:
      types.push('?');
      break;
    default:
      // this shouldn't happen
      throw new Error(`unrecognized type ${parsedType.type} in parsed type: ${parsedType}`);
  }

  return types;
}

const nodeToType = node => {
  const expression = nodeToTypeString(node);
  if (expression) {
    try {
      const type = catharsis.parse(expression, { jsdoc: true });
      return {
        names: getTypeStrings(type, true),
        parsedType: type,
        typeExpression: type.typeExpression
      };
    } catch (ex) {
      logger.debug('Fail to parse expression %s of node type %s, exception: %s', expression, node.type, ex);
    }
  }
};

astnode.nodeToValue = nodeToValue;
astnode.getParamNames = getParamNames;
astnode.nodeToType = nodeToType;
astnode.nodeToTypeString = nodeToTypeString;
astnode.getTypeStrings = getTypeStrings;
astnode.getInfo = node => {
  const info = {};
  switch (node.type) {
    case Syntax.TSInterfaceDeclaration:
      info.node = node;
      // if this class is the default export, we need to use a special name
      if (node.parent && node.parent.type === Syntax.ExportDefaultDeclaration) {
        info.name = 'module.exports';
      } else {
        info.name = nodeToValue(node);
      }
      info.kind = 'interface';
      info.type = node.type;
      info.paramnames = [];

      node.body.body.some(node => {
        if (node.type === Syntax.TSCallSignatureDeclaration) {
          info.paramnames = getParamNames(node);
          return true;
        }

        return false;
      });
      break;
    case Syntax.TSMethodSignature:
    case Syntax.TSDeclareFunction:
    case Syntax.TSCallSignatureDeclaration:
      info.kind = 'function';
      info.node = node;
      info.name = nodeToValue(node);
      info.type = info.node.type;
      info.paramnames = getParamNames(node);
      break;
    case Syntax.TSModuleDeclaration:
      info.kind = 'module';
      info.node = node;
      info.name = nodeToValue(node);
      node.type = info.node.type;
      break;
    case Syntax.TSPropertySignature:
      info.node = node;
      info.name = nodeToValue(node);
      node.type = info.node.type;
      break;
    case Syntax.TSTypeAliasDeclaration:
      info.kind = 'typedef';
      info.node = node;
      info.name = nodeToValue(node);
      node.type = info.node.type;
      break;
    case Syntax.TSEnumDeclaration:
      info.kind = 'typedef';
      info.node = node;
      info.name = nodeToValue(node.id);
      info.type = info.node.type;
      break;
    case Syntax.TSEnumMember:
      info.node = node.initializer;
      info.name = nodeToValue(node.id);
      info.value = nodeToValue(node.initializer);

      // property names with unsafe characters must be quoted
      if (!/^[$_a-zA-Z0-9]*$/.test(info.name)) {
        info.name = `"${String(info.name).replace(/"/g, '\\"')}"`;
      }
      info.type = info.node.type;
      break;
    case Syntax.TSIndexSignature:
      info.node = node;
      info.name = `${getParentName(node.parent.parent)}${name.SCOPE.PUNC.INSTANCE}[${nodeToValue(node.parameters[0])}:${nodeToTypeString(node.parameters[0])}]`;
      info.type = info.node.type;
      break;
    default:
      return origin_astnode.getInfo(node);
  }
  return info;
};

module.exports = astnode;
