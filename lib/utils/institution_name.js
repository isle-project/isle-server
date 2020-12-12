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

const swot = require( 'swot-simple' );


// MAIN ///

/**
* Extracts the institution name for an educational email address.
*
* @param {string} email - email address
* @returns {string} institution name or `Other` if not found
*/
function institutionName( email ) {
	const name = swot.getInstitutionName( email );
	return name || 'Other';
}


// EXPORTS //

module.exports = institutionName;
