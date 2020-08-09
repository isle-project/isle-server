'use strict';

// MODULES //

const debug = require( 'debug' )( 'socket' );
const objectKeys = require( '@stdlib/utils/keys' );


// MAIN //

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
		console.log( 'Removing cursor for user '+clientID );
		if ( this.cursors[ clientID ] ) {
			delete this.cursors[ clientID ];
			this.version += 1;
		}
		console.log( this.cursors );
	}

	/**
	* Returns all cursors in case the client doesn't have the newest version yet.
	*
	* @param {integer} version
	*/
	getCursors( version ) {
		if ( version >= this.version ) {
			// Already have newest cursors...
			return null
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
