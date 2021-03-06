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

const router = require( 'express' ).Router();
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObject = require( './helpers/validate_object.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateObjectIdArray = require('./helpers/validate_object_id_array.js');
const Role = require( './models/role.js' );
const User = require( './models/user.js' );


// MAIN //

router.get( '/get_all_roles',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		validateAdmin( req );
		const roles = await Role
			.find({})
			.populate( 'authorizedRoles', [ 'title' ] )
			.populate( 'createdBy', [ 'name', 'email' ] )
			.exec();
		res.json({ message: 'ok', roles });
	})
);

router.post( '/create_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreate( req, res ) {
		const { title, authorizedRoles, searchContext, permissions } = req.body;

		validateString( title, 'title', req.t );
		validateString( searchContext, 'searchContext', req.t );
		validateObjectIdArray( authorizedRoles, 'authorizedRoles', req.t );
		validateObject( permissions, 'permissions', req.t );

		const role = new Role({
			title,
			authorizedRoles,
			searchContext,
			permissions,
			createdBy: req.user
		});
		await role.save();
		res.json({
			message: req.t( 'role-created' ),
			role
		});
	})
);

router.post( '/update_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdate( req, res ) {
		const { id, title, authorizedRoles, searchContext, permissions } = req.body;

		validateObjectId( id, 'id', req.t );
		const role = await Role.findById( id );

		if ( !req.user.administrator ) {
			if ( !req.user.roles ) {
				throw new ErrorStatus( 403, req.t( 'access-denied' ) );
			}
			// Check whether user is authorized to edit the role:
			const rolesToCheck = req.user.roles.global;
			let authorized = false;
			for ( let i = 0; i < rolesToCheck.length; i++ ) {
				for ( let j = 0; j < authorizedRoles.length; j++ ) {
					if ( rolesToCheck[ i ] === authorizedRoles[ j ] ) {
						authorized = true;
					}
				}
			}
			if ( !authorized ) {
				throw new ErrorStatus( 403, req.t( 'access-denied' ) );
			}
		}
		if ( title ) {
			validateString( title, 'title', req.t );
			role.title = title;
		}
		if ( searchContext ) {
			validateString( searchContext, 'searchContext', req.t );
			role.searchContext = searchContext;
		}
		if ( authorizedRoles ) {
			validateObjectIdArray( authorizedRoles, 'authorizedRoles', req.t );
			role.authorizedRoles = authorizedRoles;
		}
		if ( permissions ) {
			validateObject( permissions, 'permissions', req.t );
			role.permissions = permissions;
		}
		await role.save();
		res.json({
			message: req.t( 'role-updated' ),
			role
		});
	})
);

router.post( '/delete_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDelete( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		await Role.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'role-deleted' ) });
	})
);

router.post( 'assign_global_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAssign( req, res ) {
		validateAdmin( req );
		const { roleID, userID } = req.body;

		await User.findOneAndUpdate(
			{ _id: userID },
			{
				$push: {
					'roles.global': {
						context: null,
						role: roleID
					}
				}
			}
		);
		res.json({ message: req.t( 'role-assigned' ) });
	})
);

router.post( 'assign_lesson_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAssign( req, res ) {
		const { roleID, lessonID, namespaceID, userID } = req.body;
		if ( !req.user.administrator ) {
			await validateOwner( req, namespaceID );
		}
		await User.findOneAndUpdate(
			{ _id: userID },
			{
				$push: {
					'roles.lesson': {
						context: lessonID,
						role: roleID
					}
				}
			}
		);
		res.json({ message: req.t( 'role-assigned' ) });
	})
);

router.post( 'assign_namespace_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAssign( req, res ) {
		const { roleID, namespaceID, userID } = req.body;
		if ( !req.user.administrator ) {
			await validateOwner( req, namespaceID );
		}
		await User.findOneAndUpdate(
			{ _id: userID },
			{
				$push: {
					'roles.namespace': {
						context: namespaceID,
						role: roleID
					}
				}
			}
		);
		res.json({ message: req.t( 'role-assigned' ) });
	})
);


// EXPORTS //

module.exports = router;
