'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (babel) {
	var t = babel.types;


	return {
		name: 'nej',
		visitor: {
			CallExpression: function CallExpression(path) {
				var _this = this;

				var callee = path.node.callee;
				var args = path.node.arguments;
				if ((
				// define
				callee.name === 'define' ||
				// NEJ.define
				callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'NEJ' && callee.property.type === 'Identifier' && callee.property.name === 'define') && args.length === 2 && args && args[0].type === 'ArrayExpression' && args[1].type === 'FunctionExpression') {
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
						[].unshift.apply(program.node.body, getRequire(deps, params, _this));

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

	function getRequire(deps, params, context) {
		var hit = false;

		var result = params.map(function (param, i) {
			if (~deps[i].indexOf('regularjs/dist/regular')) {
				hit = true;
				return buildEmptyObjectAssignment(param);
			}

			if (deps[i]) {
				var dep = transformBrace(deps[i]);
				return buildRequireAssignment(param, dep, context);
			}

			return buildEmptyObjectAssignment(param);
		});

		if (hit) {
			result.unshift(buildRequireAssignment('Regular', 'regularjs', context));
		}

		return result;
	}

	// '{pro}file.js' -> 'pro/file.js'
	// '{platform}/file.js' -> './platform/file.js'
	function transformBrace(str) {
		return str.replace(/\{(.+)\}\/?/, function (_, name) {
			if (name === 'platform') {
				return './platform/';
			} else {
				return name + '/';
			}
		});
	}

	function buildRequireAssignment(variableName, dep, context) {
		return t.VariableDeclaration('var', [t.VariableDeclarator(t.Identifier(variableName), t.memberExpression(t.CallExpression(context.addHelper('interopRequireDefault'), [t.CallExpression(t.Identifier('require'), [t.StringLiteral(dep)])]), t.identifier('default')))]);
	}

	function buildEmptyObjectAssignment(variableName) {
		return t.VariableDeclaration('var', [t.VariableDeclarator(t.Identifier(variableName), t.ObjectExpression([]))]);
	}

	function buildAssignment(left, right) {
		return t.assignmentExpression('=', left, right);
	}
};