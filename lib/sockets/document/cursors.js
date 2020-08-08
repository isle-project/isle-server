'use strict';

// MODULES //

const objectKeys = require( '@stdlib/utils/keys' );


// MAIN //

class Cursors {
	constructor() {
		this.cursors = {};
	}

	update( clientID, selection ) {
		this.cursors[ clientID ] = selection;
		console.log( this.cursors );
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
