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
* Helper function which wraps async functions and forwards them to error handling if an error is thrown.
*
* @param {Function} fn - async function
* @returns {Function} wrapped function
*/
function wrapAsync( fn ) {
	return ( req, res, next ) => {
		// `.catch()` any errors and pass them along to the `next()` middleware in the chain
		fn( req, res, next ).catch( next );
	};
}


//

module.exports = wrapAsync;
