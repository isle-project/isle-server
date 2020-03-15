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

const isOwner = require( './../helpers/is_owner.js' );
const User = require( './../models/user.js' );


// MAIN //

async function getFakeUsers( req, res ) {
	const owner = await isOwner( req.user, req.query.namespaceID );
	if ( !owner ) {
		return res.status( 403 ).send( 'User is not a course owner.' );
	}
	const users = await User.find();
	const email = {};
	const name = {};
	for ( let i = 0; i < users.length; i++ ) {
		email[ users[ i ].email ] = users[i].anonEmail;
		name[ users[ i ].name ] = users[i].anonName;
	}
	return res.json({
		email: email,
		name: name
	});
}


// EXPORTS //

module.exports = getFakeUsers;
