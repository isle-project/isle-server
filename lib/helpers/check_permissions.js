/**
* Copyright (C) 2016-present The ISLE Authors
*
* The isle-server program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

// MODULES //

const setReadOnly = require( '@stdlib/utils/define-read-only-property' );
const merge = require( '@stdlib/utils/merge' );
const Role = require( './models/role.js' );


// VARIABLES //

const mergeOR = merge.factory({
	'override': ( a, b, key ) => {
		/* Parameters:
			a => target value
			b => source value
			key => object key
		*/
		return a || b;
	},
	'copy': false,
	'extend': true
});
const DEFAULT_PERMISSIONS = Role.schema.paths.permissions.defaultValue();
let ROLES = {};


// FUNCTIONS //

/**
* Returns the next level in the hierarchy.
*
* @private
* @param {string} level - input level
* @returns {string} successor level
*/
function successor( level ) {
	switch ( level ) {
		case 'lesson':
			return 'namespace';
		case 'namespace':
			return 'program';
		case 'program':
			return 'global';
		case 'global':
		default:
			return null;
	}
}

/**
* Updates the `ROLES` object with the latest roles.
*
* @private
*/
function updateRolesHash() {
	Role.find({}).then( arr => {
		ROLES = {};
		for ( let i = 0; arr.length; i++ ) {
			const elem = arr[ i ];
			ROLES[ elem._id ] = elem;
		}
	});
}

/**
* Returns a boolean indicating whether a user has a permission in the relevant context.
*
* @private
* @param {Object} user - user object
* @param {string} permission - name of permission
* @param {string} level - context level
* @param {(string|null)} target - context target (ObjectId or null)
* @returns {boolean} boolean indicating whether user has the specified permission
*/
function hasIndividualPermission( user, permission, level, target ) {
	let idx = 0;
	while ( level ) {
		const roles = user.roles[ level ];
		for ( let i = 0; i < roles.length; i += 1 ) {
			const role = roles[ i ];
			if ( role.context === ( target[ idx ] || null ) ) {
				const permissions = ROLES[ role.role ].permissions;
				if ( permissions[ permission ] === true ) {
					return true;
				} else if ( permissions[ permission] === false ) {
					return false;
				}
			}
		}
		level = successor( level );
		idx += 1;
	}
	return false;
}

/**
* Returns a boolean indicating whether a user has two specified permissions in the relevant context.
*
* @private
* @param {Object} user - user object
* @param {string} perm1 - name of first permission
* @param {string} perm2 - name of second permission
* @param {string} level - context level
* @param {(string|null)} target - context target (ObjectId or null)
* @returns {boolean} boolean indicating whether user has the specified permissions
*/
function hasTwoPermissions( user, perm1, perm2, level, target ) {
	let idx = 0;
	let bool1 = false;
	let bool2 = false;
	while ( level ) {
		const roles = user.roles[ level ];
		for ( let i = 0; i < roles.length; i += 1 ) {
			const role = roles[ i ];
			if ( role.context === target[ idx ] ) {
				const permissions = ROLES[ role.role ].permissions;
				if ( permissions[ perm1 ] === true ) {
					bool1 = true;
				} else if ( permissions[ perm1 ] === false ) {
					return false;
				}
				if ( permissions[ perm2 ] === true ) {
					bool2 = true;
				} else if ( permissions[ perm2 ] === false ) {
					return false;
				}
				if ( bool1 && bool2 ) {
					return true;
				}
			}
		}
		level = successor( level );
		idx += 1;
	}
	return false;
}

/**
* Returns a boolean indicating whether a user has a list of permissions in the relevant context.
*
* @private
* @param {Object} user - user object
* @param {Array<string>} args - permission names
* @param {string} level - context level
* @param {(string|null)} target - context target (ObjectId or null)
* @returns {boolean} boolean indicating whether user has permissions
*/
function hasMultiplePermissions( user, args, level, target ) {
	const userPermissions = user.roles
		.filter( x => {
			return x.context.level === level && x.context.target === target;
		})
		.map( tag => ROLES[ tag.role ].permissions );

	// Filter for only the permissions that matter
	const permissions = { ...DEFAULT_PERMISSIONS };
	userPermissions.forEach( ( perm ) => {
		permissions = mergeOR( permissions, perm );
	});
	return args.reduce( ( auth, perm ) => auth && permissions[ perm ], true );
}

/**
* Returns a function to create Express middleware functions for the specified context.
*
* @param {string} checkLevel - context for checks (either `namespace`, `lesson`, `global`)
* @returns {Function} function to create Express middleware function for the specified permissions
*/
function permissionCheckFactory( checkLevel ) {
	return ( ...args ) => {
		if ( args.length === 0 ) {
			return ( req, res, next ) => {
				// Only check whether the context level is set:
				const level = req.headers[ 'X-Context-Level' ];
				if ( level !== checkLevel ) {
					return res.status( 403 ).send( req.t( 'access-denied' ) );
				}
				next();
			};
		}
		if ( args.length === 1 ) {
			return ( req, res, next ) => {
				const target = req.headers[ 'X-Context-Target' ].split( ';' ) || ''; // ObjectId or `null`
				const level = req.headers[ 'X-Context-Level' ];
				if ( level !== checkLevel ) {
					return res.status( 403 ).send( req.t( 'access-denied' ) );
				}
				const bool = hasIndividualPermission( req.user, args[ 0 ], level, target );
				if ( !bool ) {
					return res.status( 403 ).send( req.t( 'access-denied' ) );
				}
				next();
			};
		}
		if ( args.length === 2 ) {
			return ( req, res, next ) => {
				const target = req.headers[ 'X-Context-Target' ] || ''; // ObjectId or `null`
				const level = req.headers[ 'X-Context-Level' ];
				if ( level !== checkLevel ) {
					return res.status( 403 ).send( req.t( 'access-denied' ) );
				}
				const bool = hasTwoPermissions( req.user, args[ 0 ], args[ 1 ], level, target );
				if ( !bool ) {
					return res.status( 403 ).send( req.t( 'access-denied' ) );
				}
				next();
			};
		}
		// Case: More than two permissions to check
		return ( req, res, next ) => {
			const target = req.headers[ 'X-Context-Target' ] || ''; // ObjectId or `null`
			const level = req.headers[ 'X-Context-Level' ];
			if ( level !== checkLevel ) {
				return res.status( 403 ).send( req.t( 'access-denied' ) );
			}
			const bool = hasMultiplePermissions( req.user, args, target, level );
			if ( !bool ) {
				return res.status( 403 ).send( req.t( 'access-denied' ) );
			}
			next();
		};
	};
}


// MAIN //

updateRolesHash();

/**
* Permission check namespace.
*
* @namespace ns
*/
const ns = {};

/**
* @name checkGlobalPermissions
* @memberof ns
* @readonly
* @type {Function}
*/
setReadOnly( ns, 'checkGlobalPermissions', permissionCheckFactory( 'global' ) );

/**
* @name checkNamespacePermissions
* @memberof ns
* @readonly
* @type {Function}
*/
setReadOnly( ns, 'checkNamespacePermissions', permissionCheckFactory( 'namespace' ) );

/**
* @name checkLessonPermissions
* @memberof ns
* @readonly
* @type {Function}
*/
setReadOnly( ns, 'checkLessonPermissions', permissionCheckFactory( 'lesson' ) );


// EXPORTS //

module.exports = ns;
