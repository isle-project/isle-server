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
const validateAdmin = require( './helpers/validate_admin.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObject = require( './helpers/validate_object.js' );
const validateObjectIdArray = require('./helpers/validate_object_id_array.js');
const Role = require( './models/role.js' );


// MAIN //

router.get( '/get_all_roles',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		validateAdmin( req );
		const roles = await Role
			.find({})
			.populate( 'authorizedRoles', [ 'title' ] )
			.exec();
		res.json({ message: 'ok', roles });
	})
);

router.post( '/create_role',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		const { title, authorizedRoles, searchContext, permissions } = req.body;

		validateString( title, 'title', req.t );
		validateString( searchContext, 'searchContext', req.t );
		validateObjectIdArray( authorizedRoles, 'authorizedRoles', req.t );
		validateObject( permissions, 'permissions', req.t );

		const role = new Role({
			title,
			authorizedRoles,
			searchContext,
			permissions
		});
		await role.save();
		res.json({
			message: req.t( 'role-created' ),
			role
		});
	})
);


// EXPORTS //

module.exports = router;
