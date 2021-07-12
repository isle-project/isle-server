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
const isOwner = require( './is_owner.js' );


// MAIN //

/**
* Validates that a request is made by an owner of a namespace.
*
* @param {Object} request - HTTP request object
* @param {string} namespaceID- namespace identifier
* @throws {Error} error if the request is not made by an owner of a namespace
*/
async function validateOwner( req, namespaceID ) {
	const owner = await isOwner( req, namespaceID );
	if ( !owner ) {
		throw new ErrorStatus( 401, req.t( 'access-denied-no-owner' ) );
	}
}


// EXPORTS //

module.exports = validateOwner;
