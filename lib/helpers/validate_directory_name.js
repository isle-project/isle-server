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

const contains = require( '@stdlib/assert/contains' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const ErrorStatus = require( './error.js' );


// MAIN //

/**
* Validates a directory name.
*
* @param {*} value- value to validate
* @param {string} name - property name
* @param {Function} t - translation function
* @throws {Error} not a string primitive
* @throws {Error} `value` contains slashes or periods
*/
function validateDirectoryName( value, name, t ) {
	if ( !isString( value ) ) {
		throw new ErrorStatus( 400, t('field-expect-string', { field: name }));
	}
	if ( contains( value, '\\' ) || contains( value, '/' ) ) {
		throw new ErrorStatus( 400, t('field-no-slashes', { field: name }));
	}
	if ( contains( value, '.' ) ) {
		throw new ErrorStatus( 400, t('field-no-periods', { field: name }));
	}
}


// EXPORTS //

module.exports = validateDirectoryName;
