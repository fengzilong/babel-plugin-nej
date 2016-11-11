'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (babel) {
	var t = babel.types;


	return {
		name: "nej",
		visitor: {
			CallExpression: function CallExpression(path) {
				var callee = path.node.callee;
				var args = path.node.arguments;
				if (callee.name === 'define' && args.length === 2 && args && args[0].type === 'ArrayExpression' && args[1].type === 'FunctionExpression') {
					(function () {
						var deps = args[0].elements.map(function (element) {
							return element.value;
						});
						var fn = args[1];
						var params = fn.params.map(function (param) {
							return param.name;
						});
						var program = path.findParent(function (path) {
							return path.isProgram();
						});

						program.node.body = fn.body.body;
						[].unshift.apply(program.node.body, getRequire(deps, params));

						var returned = false;
						program.node.body = program.node.body.map(function (v) {
							if (v.type !== 'ReturnStatement') {
								return v;
							} else if (!returned) {
								returned = true;
								return t.ExpressionStatement(buildAssignment(t.memberExpression(t.identifier('module'), t.identifier('exports')), v.argument));
							}
						});
					})();
				}
			}
		}
	};
};

function getRequire(deps, params) {
	return params.map(function (param, i) {
		if (deps[i]) {
			return buildRequire(param, deps[i]);
		} else {
			return buildEmptyObjectAssignment(param);
		}
	});
}

function buildRequire(variableName, dep) {
	return t.VariableDeclaration('var', [t.VariableDeclarator(t.Identifier(variableName), t.CallExpression(t.Identifier('require'), [t.StringLiteral(dep)]))]);
}

function buildEmptyObjectAssignment(variableName) {
	return t.VariableDeclaration('var', [t.VariableDeclarator(t.Identifier(variableName), t.ObjectExpression([]))]);
}

function buildAssignment(left, right) {
	return t.assignmentExpression("=", left, right);
}