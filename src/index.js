export default function (babel) {
	const { types: t } = babel;

	return {
		name: "nej",
		visitor: {
			CallExpression(path) {
				const callee = path.node.callee;
				const args = path.node.arguments;
				if (
					callee.name === 'define' &&
					args.length === 2 &&
					args &&
					args[0].type === 'ArrayExpression' &&
					args[1].type === 'FunctionExpression'
				) {
					const deps = args[ 0 ].elements.map( element => element.value );
					const fn = args[ 1 ];
					const params = fn.params.map( param => param.name );
					const program = path.findParent( path => path.isProgram() );

					program.node.body = fn.body.body;
					[].unshift.apply( program.node.body, getRequire( deps, params ) );

					let returned = false;
					program.node.body = program.node.body.map( v => {
						if ( v.type !== 'ReturnStatement' ) {
							return v;
						} else if( !returned ) {
							returned = true;
							return t.ExpressionStatement(
								buildAssignment(
									t.memberExpression(
										t.identifier( 'module' ),
										t.identifier( 'exports' )
									),
									v.argument
								)
							);
						}
					} );
				}
			}
		}
	};
}

function getRequire( deps, params ) {
	return params.map( ( param, i ) => {
		if ( deps[i] ) {
			return buildRequire( param, deps[i] );
		} else {
			return buildEmptyObjectAssignment( param );
		}
	} );
}

function buildRequire( variableName, dep ) {
	return t.VariableDeclaration(
		'var',
		[
			t.VariableDeclarator(
				t.Identifier( variableName ),
				t.CallExpression(
					t.Identifier('require'),
					[
						t.StringLiteral( dep )
					]
				)
			)
		]
	);
}

function buildEmptyObjectAssignment( variableName ) {
	return t.VariableDeclaration(
		'var',
		[
			t.VariableDeclarator(
				t.Identifier( variableName ),
				t.ObjectExpression([])
			)
		]
	);
}

function buildAssignment(left, right) {
	return t.assignmentExpression("=", left, right);
}