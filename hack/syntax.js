const Syntax = require('jsdoc/src/syntax').Syntax;
// 添加对 TypeScipt interface 的支持
Syntax.TSInterfaceDeclaration = 'TSInterfaceDeclaration';
Syntax.TSInterfaceBody = 'TSInterfaceBody';
Syntax.TSMethodSignature = 'TSMethodSignature';
Syntax.TSModuleDeclaration = 'TSModuleDeclaration';
Syntax.TSPropertySignature = 'TSPropertySignature';
Syntax.TSDeclareFunction = 'TSDeclareFunction';
Syntax.TSIndexSignature = 'TSIndexSignature';
Syntax.TSTypeAliasDeclaration = 'TSTypeAliasDeclaration';
Syntax.TSEnumDeclaration = 'TSEnumDeclaration';
Syntax.TSCallSignatureDeclaration = 'TSCallSignatureDeclaration';
Syntax.TSEnumMember = 'TSEnumMember';
Syntax.TSQualifiedName = 'TSQualifiedName';
exports.Syntax = Syntax;
