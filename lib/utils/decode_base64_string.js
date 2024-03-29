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
* Base64 decodes a string.
*
* @param {string} data - string to be decoded
* @returns {string} decoded string
*/
function decodeBase64String( data ) {
	const buffer = Buffer.from( data, 'base64' );
	return buffer.toString( 'utf-8' );
}


// EXPORTS //

module.exports = decodeBase64String;
