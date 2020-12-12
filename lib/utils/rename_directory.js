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

const join = require( 'path' ).join;
const rename = require( 'fs' ).rename;
const { NAMESPACES_DIRECTORY } = require( './../constants.js' );


// MAIN //

/**
* Renames the directory for storing lessons of a namespace in case of a name change for the namespace.
*
* @param {string} oldDir - old namespace name
* @param {string} newDir - new namespace name
* @param {Function} clbk - callback function
*/
function renameDirectory( oldDir, newDir, clbk ) {
	const oldDirPath = join( NAMESPACES_DIRECTORY, oldDir );
	const newDirPath = join( NAMESPACES_DIRECTORY, newDir );
	rename( oldDirPath, newDirPath, clbk );
}


// EXPORTS //

module.exports = renameDirectory;
