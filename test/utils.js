'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var setReadOnly = require( '@stdlib/utils/define-read-only-property' );
var noop = require( '@stdlib/utils/noop' );


// VARIABLES //

var dbURI = 'mongodb://localhost/isle-test-clearing-db';


// MAIN //

var ns = {};

setReadOnly( ns, 'before', function before( t ) {
	function clearDB() {
		var i;
		for ( i in mongoose.connection.collections ) {
			mongoose.connection.collections[ i ].remove( noop );
			t.pass( 'removed collection' );
		}
		return t.end();
	}

	if ( mongoose.connection.readyState === 0 ) {
		mongoose.connect( dbURI, function onConnect( err ) {
			if ( err ) {
				throw err;
			}
			t.pass( 'connected to database' );
			return clearDB();
		});
	} else {
		return clearDB();
	}
});

setReadOnly( ns, 'after', function after( t ) {
	mongoose.disconnect();
	t.pass( 'disconnected from database' );
	return t.end();
});


// EXPORTS //

module.exports = ns;
