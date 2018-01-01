'use strict';

// MODULES //

var tape = require( 'tape' );
var contains = require( '@stdlib/assert/contains' );
var utils = require( './utils.js' );
var User = require( './../lib/user.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'the model can create a new user', function test( t ) {
	var o = {
		'name': 'Oliver Cromwell',
		'organization': 'England',
		'email': 'cromwell.oliver@isledocs.com',
		'password': 'charles'
	};
	User.create( o, function onCreate( err, createdUser ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( createdUser.email, 'cromwell.oliver@isledocs.com', 'has correct email' );
		t.strictEqual( createdUser.name, 'Oliver Cromwell', 'has correct name' );
		t.strictEqual( createdUser.organization, 'England', 'has correct organization' );
		t.notEqual( createdUser.password, 'charles', 'does not save password in clear-text' );
		createdUser.comparePassword( 'charles', function cmp( err, isMatch ) {
			t.strictEqual( err instanceof Error, false, 'does not return an error' );
			t.ok( isMatch, 'saved password represents the unhashed one' );
			t.end();
		});
	});
});

tape( 'creating a user fails when email is already taken', function test( t ) {
	var o = {
		'email': 'cromwell.oliver@isledocs.com',
		'password': 'charles'
	};
	User.create( o, function onCreate( err ) {
		if ( err ) {
			t.ok( contains( err.message, 'duplicate key error' ), 'returns expected error message' );
			t.pass( 'encountered an error' );
		} else {
			t.pass( 'expected an error' );
		}
		t.end();
	});
});

tape( 'updating a user does not change the hashed password', function test( t ) {
	var o = {
		'email': 'cromwell.oliver@isledocs.com'
	};
	User.findOneAndUpdate( o, { '$set': { 'organization': 'United Kingdom' }}, { 'new': true }, function onCreate( err, createdUser ) {
		t.strictEqual( createdUser.organization, 'United Kingdom', 'has updated the organization' );
		t.notEqual( createdUser.password, 'charles', 'does not save password in clear-text' );
		createdUser.comparePassword( 'charles', function cmp( err, isMatch ) {
			t.strictEqual( err instanceof Error, false, 'does not return an error' );
			t.ok( isMatch, 'saved password represents the unhashed one' );
			t.end();
		});
	});
});

tape( 'perform clean-up', utils.after );
