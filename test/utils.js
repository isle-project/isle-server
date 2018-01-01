'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var setReadOnly = require( '@stdlib/utils/define-read-only-property' );
var hasOwnProp = require( '@stdlib/assert/has-own-property' );
var noop = require( '@stdlib/utils/noop' );
var User = require( './../lib/user.js' );


// VARIABLES //

var dbURI = 'mongodb://localhost/isle-test-clearing-db';


// MAIN //

// Set Promise library for mongoose:
mongoose.Promise = global.Promise;

var ns = {};

setReadOnly( ns, 'before', function before( t ) {
	function clearDB() {
		var i;
		for ( i in mongoose.connection.collections ) {
			if ( hasOwnProp( mongoose.connection.collections, i ) ) {
				mongoose.connection.collections[ i ].remove( noop );
				t.pass( 'removed collection' );
			}
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
	setTimeout( function onTimeout() {
		t.end();
	}, 1000 );
});

setReadOnly( ns, 'createUser', function createUser( obj, next ) {
	User.create( obj, function onCreate( err, users ) {
		if ( err ) {
			return next( err );
		}
		next( null, users );
	});
});


// EXPORTS //

module.exports = ns;
