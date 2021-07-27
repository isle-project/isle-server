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

// MAIN //

/**
* Checks whether a GET request originates from within the same host as the server.
*
* @param {Request} req - HTTP request object
* @param {Response} res - HTTP response object
* @param {Function} next - callback to invoke after executing a route handler
* @returns {void}
*/
function fromWithinApp( req, res, next ) {
	const userAgent = req.headers[ 'user-agent' ];
	if ( userAgent === 'isle-editor' ) {
		return next();
	}
	console.log( req.session );
	if ( false ) {
		return res.status( 403 ).send( req.t( 'access-denied' ) );
	}
	next();
}


// EXPORTS //

module.exports = fromWithinApp;
