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

const ErrorStatus = require( './error.js' );


// MAIN //

/**
* Determines whether current user is an administrator and sends an error message back if not.
*
* @param {Request} req - HTTP request object
* @throws {Error} user is not an administrator
* @returns {void}
*/
function validateAdmin( req ) {
	if ( !req.user.administrator ) {
		throw new ErrorStatus( 403, req.t( 'access-denied-no-admin' ) );
	}
}


// EXPORTS //

module.exports = validateAdmin;
