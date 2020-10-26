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
const User = require( '../models/user.js' );
const tokens = require( '../../credentials/tokens.json' );


// MAIN //

async function fileOwnerCheck( req, res, next ) {
	if ( !req.query.owner ) {
		return next();
	}
	const token = req.query.jwt;
	const payload = jwt.verify( token, tokens.jwtKey );
	const user = await User
		.findOne({ '_id': payload.id })
		.populate( 'ownedNamespaces' )
		.exec();
	let isOwner = false;
	user.ownedNamespaces.forEach( x => {
		if ( x.title === req.query.namespaceName ) {
			isOwner = true;
		}
	})
	if ( !isOwner ) {
		return res.status( 403 ).send( 'Access denied.' );
	}
	next();
}


// EXPORTS //

module.exports = fileOwnerCheck;
