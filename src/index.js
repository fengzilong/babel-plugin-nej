export default function ( babel ) {
	const { types: t } = babel;

	return {
		name: 'nej',
		visitor: {
			CallExpression(path) {
				const callee = path.node.callee;
				const args = path.node.arguments;
				if (
					(
						// define
						callee.name === 'define' ||
						// NEJ.define
						(
							callee.type === 'MemberExpression' &&
							callee.object.type === 'Identifier' &&
							callee.object.name === 'NEJ' &&
							callee.property.type === 'Identifier' &&
							callee.property.name === 'define'
						)
					) &&
					args.length === 2 &&
					args &&
					args[ 0 ].type === 'ArrayExpression' &&
					args[ 1 ].type === 'FunctionExpression'
				) {
					const deps = args[ 0 ].elements.map( element => element.value );
					const fn = args[ 1 ];
					const params = fn.params.map( param => param.name );
					const program = path.findParent( path => path.isProgram() );

					program.node.body = fn.body.body;
					[].unshift.apply( program.node.body, getRequire( deps, params, this ) );

					let returned = false;
					program.node.body = program.node.body.map( v => {
						if ( v.type !== 'ReturnStatement' ) {
							return v;
						} else if ( !returned ) {
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

	function getRequire( deps, params, context ) {
		const result = params.map( ( param, i ) => {
			if ( ~deps[ i ].indexOf( 'regularjs/dist/regular' ) ) {
				return buildEmptyObjectAssignment( param );
			}

			if ( deps[ i ] ) {
				var dep = transformDep( deps[ i ] );
				return buildRequireAssignment( param, dep, context );
			}

			return buildEmptyObjectAssignment( param );
		} );

		let hit = false;
		deps.some( dep => {
			if ( ~dep.indexOf( 'regularjs/dist/regular' ) ) {
				hit = true;
				return true;
			}
		} );

		// if hit, prepend `var Regular = require( 'regularjs' )`
		if ( hit ) {
			result.unshift( buildRequireAssignment( 'Regular', 'regularjs', context ) );
		}

		return result;
	}

	// '{pro}file.js' -> 'pro/file.js'
	// '{platform}/file.js' -> './platform/file.js'
	function transformDep( str ) {
		return str.replace( /\{(.+)\}\/?/, function( _, name ) {
			if ( name === 'platform' ) {
				return './platform/';
			} else {
				return name + '/';
			}
		} ).replace( /^text!/, '!!text!' );
	}

	function buildRequireAssignment( variableName, dep, context ) {
		return t.VariableDeclaration(
			'var',
			[
				t.VariableDeclarator(
					t.Identifier( variableName ),
					t.memberExpression(
						t.CallExpression(
							context.addHelper( 'interopRequireDefault' ),
							[
								t.CallExpression(
									t.Identifier('require'),
									[
										t.StringLiteral( dep )
									]
								)
							]
						),
						t.identifier( 'default' )
					),
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
					t.ObjectExpression( [] ),
				)
			]
		);
	}

	function buildAssignment( left, right ) {
		return t.assignmentExpression( '=', left, right );
	}
}
