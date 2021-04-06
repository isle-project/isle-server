// MODULES //

const ROLES = require( './roles.js' );


// MAIN //

checkPermissions( 'delete_user' )

function checkPermissions( ...args ) {
	if ( args.length === 1 ) {
		return () => {
			// ...
		}
	}

	// Case: more than three permissions...
	return ( req ) => {
		const context = req.context; { global: false, program: null, lesson: '<id>', namespace: null }; // could be also an array
		const userPermissions = req.user.roles
			.filter( x => context.includes( x.context ) )
			.map( tag => ROLES[ tag.role ].permissions ) ;

		// Filter for only the permissions that matter

		const permissions = { ...DEFAULT_PERMISSIONS };
		userPermissions.forEach( ( perm ) => {
			permissions = mergeOR( permissions, perm );
		});

		const bool = args.reduce( ( auth, perm ) => auth && userPermissions[ perm ], true )

		// check that all `args` permissions are set to true; if not, send permission denied
		{
			context: {
				global: false,
				namespace: '<namespaceID>',
				lesson: '<lessonID>',
				program: null
			},
			role: 'extra_time'
		}
	};
}


// EXPORTS //

module.exports = checkPermissions;
