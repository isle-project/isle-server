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

const isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
const ErrorStatus = require( './error.js' );


// MAIN //

/**
* Validates a MongoDB ObjectId.
*
* @param {*} value - value to validate
* @param {string} name - name of the field being validated
* @param {Function} t - translation function
* @throws {Error} validation error
*/
function validateObjectId( value, name, t ) {
	if ( !isValidObjectId( value ) ) {
		throw new ErrorStatus( 400, t( 'field-expect-id', { field: name }) );
	}
}


// EXPORTS //

module.exports = validateObjectId;
