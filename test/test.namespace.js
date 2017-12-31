'use strict';

// MODULES //

var tape = require( 'tape' );

var waterfall = require( '@stdlib/utils/series-waterfall' );
var utils = require( './utils.js' );
var User = require( './../lib/user.js' );
var Namespace = require( './../lib/namespace.js' );

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'creating a namespace with an owner and a title', function test( t ) {

    function createUser( next ) {
        var u = [
			{
				'email': 'lotti.anton.super@gmail.com',
				'password': 'hans'
			}
		];
		User.create( u, function onCreate( err, users ) {
			if ( err ) {
				next( err );
			} else {
				next( null, users );
			}
		});
    }


    function createNamespace( members, next ) {
		var o = {
			'title': 'First_Namespace',
            'members': members,
            'description': 'The first namespace'
		};
		Namespace.create( o, function onCreate( err, createdNamespace ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( createdNamespace.title, 'First_Namespace', 'has correct title' );
			t.ok( isArray( createdNamespace.members ), 'has members' );
			next();
		});
	}

	function done( error ) {
		if ( error ) {
			t.fail( 'should not return an error' );
		} else {
			t.pass( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ createUser, createNamespace ], done );

});