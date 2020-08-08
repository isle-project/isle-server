'use strict';

// MODULES //

const objectKeys = require( '@stdlib/utils/keys' );


// MAIN //

class Cursors {
	constructor() {
		this.cursors = {};
		this.version = 0;
	}

	update( clientID, selection ) {
		this.cursors[ clientID ] = selection;
		this.version += 1;
	}

	getCursors( version ) {
		if ( version >= this.version ) {
			// Already have newest cursors...
			return null
		}
		return this.cursors;
	}

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
