/* eslint-disable no-multi-assign */
/* eslint-disable global-require */
const Syntax = require('./syntax').Syntax;

const jsdoc = {
  doclet: require('jsdoc/doclet'),
  name: require('jsdoc/name'),
  src: {
    astnode: require('jsdoc/src/astnode'),
    syntax: require('jsdoc/src/syntax')
  },
  util: {
    logger: require('jsdoc/util/logger')
  }
};
function noop() {}
function debug(...args) {
  // eslint-disable-next-line no-console
  jsdoc.util.logger.debug(args);
  debugger;
}
exports.noop = noop;
exports.debug = debug;
exports.jsdoc = jsdoc;

// TODO: docs
function makeVarsFinisher(scopeDoclet) {
  return ({ doclet, code }) => {
    // no need to evaluate all things related to scopeDoclet again, just use it
    if (scopeDoclet && doclet && (doclet.alias || doclet.memberof)) {
      scopeDoclet.meta.vars[code.name] = doclet.longname;
    }
  };
}
// TODO: note that it's essential to call this function before you try to resolve names!
exports.trackVars = function trackVars(parser, { enclosingScope }, { code, finishers }) {
  let doclet;
  const enclosingScopeId = enclosingScope ? enclosingScope.nodeId : null;

  if (enclosingScopeId) {
    doclet = parser._getDocletById(enclosingScopeId);
  } else {
    doclet = parser._getDocletByLongname(jsdoc.name.LONGNAMES.GLOBAL);
  }

  if (doclet) {
    doclet.meta.vars = doclet.meta.vars || {};
    doclet.meta.vars[code.name] = null;
    finishers.push(makeVarsFinisher(doclet));
  }
};
/**
 * Given an array of nodes that represent function parameters, find the nodes for the default
 * parameters, if any.
 *
 * @private
 * @param {Array.<Object>} params - An array of nodes that represent function parameters.
 * @return {Array.<Object>} The nodes for the default parameters.
 */
function findDefaultParams(params) {
  const defaultParams = [];

  params.forEach(param => {
    if (param.type === Syntax.AssignmentPattern) {
      defaultParams.push(param);
    } else {
      defaultParams.push(null);
    }
  });

  return defaultParams;
}
/**
 * For functions that may have at least one parameter with default values, create a function that
 * will automatically add the parameters' default values to the function's documentation. If any
 * default value is already documented, the function's doclet will remain unchanged.
 *
 * This function is only intended to handle default parameters whose node type is `Syntax.Literal`
 * (string, numeric, and boolean literals). This is because more complex default values may include,
 * for example, references to internal variables, which it may not make sense to include in
 * documentation.
 *
 * @private
 * @return {function} A function that updates the function doclet to include the default values of
 * parameters.
 */
exports.makeDefaultParamFinisher = function makeDefaultParamFinisher() {
  return e => {
    const doclet = e.doclet;

    let paramName;

    if (!doclet) {
      return;
    }

    doclet.params = doclet.params || [];
    const documentedParams = doclet.params;
    const params = e.code.node.params || e.code.node.parameters || (e.code.node.value && e.code.node.value.params) || [];
    const defaultValues = findDefaultParams(params);

    for (let i = 0, j = 0, l = params.length; i < l; i++) {
      // bail out if we ran out of documented params
      if (!documentedParams[j]) {
        break;
      }

      // if the current parameter doesn't appear to be documented, move to the next one
      paramName = params[i].type === Syntax.AssignmentPattern ? params[i].left.name : params[i].name;
      if (paramName !== documentedParams[j].name) {
        continue;
      }

      // add the default value iff a) a literal default value is defined in the code,
      // b) no default value is documented, and c) the default value is not an empty string
      if (
        defaultValues[i] &&
        defaultValues[i].right &&
        defaultValues[i].right.type === Syntax.Literal &&
        typeof documentedParams[j].defaultvalue === 'undefined' &&
        defaultValues[i].right.value !== ''
      ) {
        documentedParams[j].defaultvalue = jsdoc.src.astnode.nodeToValue(defaultValues[i].right);
      }

      // move to the next documented param
      j++;
    }
  };
};

/**
 * Given an array of nodes that represent function parameters, find the node for the rest parameter,
 * if any.
 *
 * @private
 * @param {Array.<Object>} params - An array of nodes that represent function parameters.
 * @return {Object?} The node for the rest parameter.
 */
function findRestParam(params) {
  let restParam = null;

  params.some(param => {
    if (param.type === Syntax.RestElement) {
      restParam = param;

      return true;
    }

    return false;
  });

  return restParam;
}
/**
 * For functions that may include a rest parameter, create a function that will automatically update
 * the rest parameter's documentation to indicate that the parameter is repeatable. If the parameter
 * is not documented, the function's doclet will remain unchanged.
 *
 * @private
 * @return {function} A function that updates the rest parameter's documentation to indicate that
 * the parameter is repeatable.
 */
exports.makeRestParamFinisher = function makeRestParamFinisher() {
  return e => {
    const doclet = e.doclet;

    if (!doclet) {
      return;
    }
    doclet.params = doclet.params || [];
    const documentedParams = doclet.params;
    const restNode = findRestParam(e.code.node.params || e.code.node.parameters || (e.code.node.value && e.code.node.value.params) || (e.code.node.init && e.code.node.init.params) || []);

    if (restNode) {
      for (let i = documentedParams.length - 1; i >= 0; i--) {
        if (documentedParams[i].name === restNode.argument.name) {
          documentedParams[i].variable = true;
          break;
        }
      }
    }
  };
};

// Given an event, get the parent node's doclet.
function getParentDocletFromEvent(parser, { doclet }) {
  if (doclet && doclet.meta && doclet.meta.code && doclet.meta.code.node && doclet.meta.code.node.parent) {
    return parser._getDocletById(doclet.meta.code.node.parent.nodeId);
  }

  return null;
}
function getParamType(param_name, parsed_type) {
  if (param_name.length > 0) {
    let sub_param_name;
    let sub_parsed_type;
    switch (parsed_type.type) {
      case 'RecordType':
        if (param_name[0] === '.') {
          sub_param_name = param_name.substr(1);
          parsed_type.fields.some(field => {
            const field_name = field.key.name;
            if (sub_param_name.startsWith(field_name)) {
              sub_parsed_type = getParamType(sub_param_name.substr(field_name.length), field.value);
              if (sub_parsed_type) {
                return true;
              }
            }
            return false;
          });
        }
        break;
      default:
        break;
    }
    return sub_parsed_type;
  } else {
    return parsed_type;
  }
}
function getRedirectDoclet(doclet) {
  let ret = doclet;
  while (ret && ret.redirectDoclet) {
    ret = ret.redirectDoclet;
  }
  return ret;
}
/**
 * For function parameters that have inline documentation, create a function that will merge the
 * inline documentation into the function's doclet. If the parameter is already documented in the
 * function's doclet, the inline documentation will be ignored.
 *
 * @private
 * @param {module:jsdoc/lib/jsdoc/src/parser.Parser} parser - The JSDoc parser.
 * @return {function} A function that merges a parameter's inline documentation into the function's
 * doclet.
 */
exports.makeInlineParamsFinisher = function makeInlineParamsFinisher(parser) {
  return e => {
    let parentDoclet = getParentDocletFromEvent(parser, e);
    if (!parentDoclet) {
      return;
    }
    if (parentDoclet.redirectDoclet) {
      parentDoclet = getRedirectDoclet(parentDoclet);
    }
    const doclet = e.doclet;
    if (doclet.kind !== 'param') {
      // we only want to use the doclet if it's param-specific (but not, for example, if it's
      // a param tagged with `@exports` in an AMD module)
      return;
    }

    parentDoclet.params = parentDoclet.params || [];
    const documentedParams = parentDoclet.params;
    const knownParams = parentDoclet.meta.code.paramnames || [];
    const param_name = doclet.name;
    const relate_params = documentedParams.filter(param => param.name.startsWith(param_name));
    if (param_name === parentDoclet.name) {
      e.doclet.undocumented = true;
      parentDoclet.addTag('this', doclet.type.parsedType.typeExpression);
      return;
    }
    let has_param = false;
    relate_params.forEach(param => {
      if (!param.type) {
        const type = getParamType(param.name.substr(param_name.length), doclet.type.parsedType);
        if (param.name === param_name) {
          has_param = true;
        }
        if (type) {
          param.type = {
            names: jsdoc.src.astnode.getTypeStrings(type, true),
            parsedType: type
          };
        }
      }
    });
    if (has_param) {
      doclet.undocumented = true;
    } else {
      const index = knownParams.indexOf(param_name);
      if (index >= 0) {
        documentedParams.splice(index, 0, {
          type: doclet.type || {},
          description: '',
          name: param_name
        });
        doclet.undocumented = true;
      }
    }
  };
};

/**
 * For method definitions that are constructors, create a function that will merge portions of the
 * constructor's doclet into the class's doclet, provided that a doclet exists for the class.
 * Merging the constructor's documentation allows ES 2015 classes to be documented in a natural way,
 * with separate JSDoc comments for the class and its constructor.
 *
 * @private
 * @param {module:jsdoc/src/parser.Parser} parser - The JSDoc parser.
 * @return {function} A function that merges the constructor's doclet into the class's doclet.
 */
exports.makeConstructorFinisher = function makeConstructorFinisher(parser) {
  return e => {
    const doclet = e.doclet;
    let parentDoclet;

    // for class declarations that are named module exports, the node that's documented is the
    // ExportNamedDeclaration, not the ClassDeclaration
    if (e.code.node.parent.parent.parent && e.code.node.parent.parent.parent.type === Syntax.ExportNamedDeclaration) {
      parentDoclet = parser._getDocletById(e.code.node.parent.parent.parent.nodeId);
    }
    // otherwise, we want the ClassDeclaration
    else {
      parentDoclet = parser._getDocletById(e.code.node.parent.parent.nodeId);
    }

    if (!doclet || !parentDoclet || parentDoclet.undocumented) {
      return;
    }

    // We prefer the parent doclet because it has the correct kind, longname, and memberof.
    // The child doclet might or might not have the correct kind, longname, and memberof.
    const combined = jsdoc.doclet.combine(parentDoclet, doclet);
    parser.addResult(combined);
    doclet.redirectDoclet = combined;
    parentDoclet.redirectDoclet = combined;
    doclet.undocumented = true;
    parentDoclet.undocumented = true;
  };
};

/**
 * Create a function that will add an `async` property to the doclet for async functions.
 *
 * @private
 * @return {function} A function that adds an `async` property to the doclet of async functions.
 */
exports.makeAsyncFunctionFinisher = function makeAsyncFunctionFinisher() {
  return e => {
    const doclet = e.doclet;

    if (!doclet) {
      return;
    }

    if (e.code.node.async || (e.code.node.value && e.code.node.value.async) || (e.code.node.init && e.code.node.init.async)) {
      doclet.async = true;
    }
  };
};

/**
 * Create a function that will mark a doclet as private.
 *
 * @private
 * @return {function} A function that marks a doclet as private.
 */
exports.makePrivatePropertyFinisher = function makePrivatePropertyFinisher() {
  return ({ doclet }) => {
    doclet.access = 'private';
  };
};

/**
 * Create a function that will mark a doclet as a generator function.
 *
 * @private
 * @return {function} A function that marks a doclet as a generator function.
 */
exports.makeGeneratorFinisher = function makeGeneratorFinisher() {
  return e => {
    const doclet = e.doclet;

    if (!doclet) {
      return;
    }

    if (e.code.node.generator || (e.code.node.init && e.code.node.init.generator) || (e.code.node.value && e.code.node.value.generator)) {
      doclet.generator = true;
    }
  };
};

exports.makeNodeTypeFinisher = function makeNodeTypeFinisher(type) {
  return e => {
    const doclet = e.doclet;
    if (!doclet) {
      return;
    }
    let typeString = e.doclet.name;
    if (type) {
      /**
       * 如果节点本身有文档，这个时候 @type 无效，需要手动添加类型定义
       */
      if (!doclet.type) {
        doclet.type = type;
      }
      typeString = `{${type.typeExpression}} ${typeString}`;
    }

    switch (e.code.type) {
      case Syntax.TSEnumDeclaration:
        doclet.addTag('enum', typeString);
        break;
      case Syntax.TSTypeAliasDeclaration:
        doclet.addTag('typedef', typeString);
        break;
      default:
        break;
    }
  };
};

exports.makeReturnTypeFinisher = function makeReturnTypeFinisher(type) {
  return e => {
    const doclet = e.doclet;
    if (!doclet) {
      return;
    }
    doclet.returns = doclet.returns || [{}];
    doclet.returns = (doclet.returns || [{}]).map(ret => {
      const _ret = ret || {};
      if (!_ret.type) {
        _ret.type = type;
      }
      return _ret;
    });
  };
};

exports.makeTempateFinisher = function makeTempateFinisher(templateParams) {
  if (!templateParams || templateParams.length === 0) {
    return noop;
  }
  return e => {
    const doclet = getRedirectDoclet(e.doclet);
    if (!doclet) {
      return;
    }
    doclet.tparams = doclet.tparams || [];
    const tparams = doclet.tparams;
    if (Array.isArray(templateParams)) {
      templateParams.forEach((param, index) => {
        const tparam = tparams.find(tparam => tparam.name === param.name);
        if (!tparam) {
          tparams.splice(index, 0, param);
        } else if (!tparam.type) {
          tparam.constraint = param.constraint;
          tparam.type = param.type;
          tparam.default = param.default;
        }
      });
    }
  };
};

exports.makeSuperClassFinisher = function makeSuperClassFinisher(className) {
  return e => {
    const { doclet } = e;
    if (!doclet) {
      return;
    }
    doclet.addTag('extends', className);
  };
};
