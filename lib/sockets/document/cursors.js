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

const debug = require( './../debug' )( 'sockets' );
const objectKeys = require( '@stdlib/utils/keys' );


// MAIN //

/**
* A cursor instance represents a cursor in a document.
*/
class Cursors {
	constructor() {
		this.cursors = {};
		this.version = 0;
	}

	/**
	* Updates the cursor for the specified client.
	*
	* @param {string} clientID
	* @param {Object} cursor
	*/
	update( clientID, cursor ) {
		this.cursors[ clientID ] = cursor;
		this.version += 1;
	}

	/**
	* Removes the cursor for the specified client.
	*
	* @param {string} clientID
	*/
	remove( clientID ) {
		debug( 'Removing cursor for user '+clientID );
		if ( this.cursors[ clientID ] ) {
			delete this.cursors[ clientID ];
			this.version += 1;
		}
	}

	/**
	* Returns all cursors in case the client doesn't have the newest version yet.
	*
	* @param {integer} version
	*/
	getCursors( version ) {
		if ( version >= this.version ) {
			// Already have newest cursors...
			return null;
		}
		return this.cursors;
	}

	/**
	* Updates the positions of all cursors in light of changes to the document.
	*
	* @param {Object} mapping
	*/
	mapThrough( mapping ) {
		const users = objectKeys( this.cursors );
		for ( let i = 0; i < users.length; i++ ) {
			const cursor = this.cursors[ users[ i ] ];
			if ( cursor ) {
				const from = mapping.map( cursor.from, 1 );
				const to = mapping.map( cursor.to, -1 );
				cursor.from = from;
				cursor.to = to;
			}
		}
	}
}


// EXPORTS //

exports.Cursors = Cursors;
