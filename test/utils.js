'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var setReadOnly = require( '@stdlib/utils/define-read-only-property' );
var hasOwnProp = require( '@stdlib/assert/has-own-property' );
var waterfall = require( '@stdlib/utils/series-waterfall' );
var noop = require( '@stdlib/utils/noop' );
var Namespace = require( './../lib/namespace.js' );
var Lesson = require( './../lib/lesson.js' );
var User = require( './../lib/user.js' );


// VARIABLES //

var dbURI = 'mongodb://localhost/isle-test-clearing-db';


// MAIN //

// Set Promise library for mongoose:
mongoose.Promise = global.Promise;

var ns = {};

setReadOnly( ns, 'before', function before( t ) {
	function clearDB() {
		var collection;
		var counter = 0;
		var keys = Object.keys( mongoose.connection.collections );
		var len = keys.length;
		var i;
		for ( i = 0; i < len; i++ ) {
			collection = mongoose.connection.collections[ keys[ i ] ];
			collection.remove( onDone );
		}
		function onDone() {
			counter += 1;
			t.pass( 'removed collection' );
			if ( counter === len-1 ) {
				t.end();
			}
		}
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

setReadOnly( ns, 'populateDatabase', function populateDatabase( t ) {
	function createUsers( next ) {
		var pop = [
			{
				'email': 'zorro707@gmail.com',
				'name': 'Zorro',
				'password': 'zorro_is_the_best'
			},
			{
				'email': 'wolfman666@gmail.com',
				'name': 'The Wolfman',
				'password': 'Lon Chaney Jr.'
			},
			{
				'email': 'dracula@gmail.com',
				'name': 'Count Dracula',
				'password': 'Bela Lugosi'
			},
			{
				'email': 'ed_wood@gmail.com',
				'name': 'Ed Wood',
				'password': 'Plan 9 from Outer Space'
			},
			{
				'email': 'mummy@gmail.com',
				'name': 'The Mummy',
				'password': 'Egypt'
			},
			{
				'email': 'frankenstein@gmail.com',
				'name': 'Boris Karloff',
				'password': 'Mary Shelly'
			}
		];
		User.create( pop, next );
	}

	function createNamespaces( users, next ) {
		var namespaces = [
			{
				'title': 'Frankenstein meets the Wolf Man',
				'description': 'Open the grave of Larry Talbot',
				'owners': [ users[ 1 ]._id, users[ 5 ]._id ]
			},
			{
				'title': 'Dracula vs. the Wolf Man',
				'description': 'A great match',
				'owners': [ users[ 1 ]._id, users[ 2 ]._id ]
			},
			{
				'title': 'Dracula vs. Frankenstein',
				'description': 'Dracula unearthes Frankenstein',
				'owners': [ users[ 2 ]._id, users[ 5 ]._id ]
			}
		];
		Namespace.create( namespaces, next );
	}

	function createLessons( namespaces, next ) {
		var lessons = [
			{
				namespace: namespaces[ 2 ]._id,
				title: 'Unearth the monster!',
				public: true
			},
			{
				namespace: namespaces[ 2 ]._id,
				title: 'Kill the cemetery keeper!',
				public: true
			},
			{
				namespace: namespaces[ 2 ]._id,
				title: 'Drink his blood!',
				public: false
			},
			{
				namespace: namespaces[ 0 ]._id,
				title: 'Why have you followed me?',
				public: true
			},
			{
				namespace: namespaces[ 0 ]._id,
				title: 'Talbot, you are a murderer!',
				public: true
			},
			{
				namespace: namespaces[ 0 ]._id,
				title: 'Prove it!',
				public: false
			}
		];
		Lesson.create( lessons, next );
	}

	function done( err, res ) {
		if ( err ) {
			t.fail( 'should not return an error' );
		} else {
			t.pass( 'executed without errors' );
		}
		t.end();
	}
	waterfall([ createUsers, createNamespaces, createLessons ], done );
});

setReadOnly( ns, 'after', function after( t ) {
	mongoose.disconnect( function onDisconnect() {
		t.pass( 'disconnected from database' );
		t.end();
	});
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
