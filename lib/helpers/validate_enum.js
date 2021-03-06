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
const contains = require( '@stdlib/assert/contains' );


// MAIN //

/**
* Validates whether value is contained in a set of enumerated values.
*
* @param {*} value - value to validate
* @param {Array} arr - enumerated values
* @param {string} name - name of the property being validated
* @param {Function} t - translation function
* @throws {Error} if a validation error occurs
*/
function validateEnum( value, arr, name, t ) {
	if ( !contains( arr, value ) ) {
		throw new ErrorStatus( 400, t('field-expect-one-of', {
			enum: arr,
			field: name
		}) );
	}
}


// EXPORTS //

module.exports = validateEnum;
