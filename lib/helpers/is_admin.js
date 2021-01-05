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

const jwt = require( 'jsonwebtoken' );
const User = require( './../models/user.js' );
const tokens = require( './../../credentials/tokens.json' );


// MAIN //

async function isAdmin( req, res, next ) {
	const token = req.query.jwt;
	if ( !token ) {
		return res.status( 403 ).send( req.t( 'access-denied' ) );
	}
	const payload = jwt.verify( token, tokens.jwtKey );
	const user = await User.findOne({ '_id': payload.id });
	if ( !user.administrator ) {
		return res.status( 403 ).send( req.t( 'access-denied' ) );
	}
	next();
}


// EXPORTS //

module.exports = isAdmin;
