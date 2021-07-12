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
* Validates whether an array is a valid array of object ids.
*
* @param {Array} value - array to validate
* @param {string} name - name of property being validated
* @param {Function} t - translation function
* @throws {Error} if array is not a valid array of object ids
*/
function validateObjectIdArray( value, name, t ) {
	for ( let i = 0; i < value.length; i++ ) {
		const val = value[ i ];
		if ( !isValidObjectId( val ) ) {
			throw new ErrorStatus( 400, t( 'field-expect-id-array', { field: name }) );
		}
	}
}


// EXPORTS //

module.exports = validateObjectIdArray;
