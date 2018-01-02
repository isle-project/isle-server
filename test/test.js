'use strict';

// MODULES //

var tape = require( 'tape' );
var request = require( 'supertest' );
var proxyquire = require( 'proxyquire' );
var noop = require( '@stdlib/utils/noop' );
var copy = require( '@stdlib/utils/copy' );
var utils = require( './utils.js' );

var requires = {
	'./config.json': {
		'namespacesDirectory': './fixtures',
		'server': 'http://localhost',
		'@noCallThru': true
	},
	'./connect_mongoose.js': noop,
	'./mailer.js': {
		'send': function send( mail, clbk ) {
			clbk( null, 'Mail sent' );
		},
		'@noCallThru': true
	},
	'./../credentials/tokens.json': {
		'writeAccess': 'no_restrictions',
		'@noCallThru': true
	}
};
var app = proxyquire( './../lib/index.js', requires );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'GET /', function test( t ) {
	request( app )
		.get( '/' )
		.end( function onEnd( err, res ) {
			t.error( err, 'does not return an error' );
			t.ok( res.redirect, 'redirects request' );
			t.strictEqual( res.text, 'Found. Redirecting to /dashboard/', 'has expected `text`' );
			t.end();
		});
});

tape( 'GET /ping', function test( t ) {
	request( app )
		.get( '/ping' )
		.end( function onEnd( err, res ) {
			t.error( err, 'does not return an error' );
			t.strictEqual( res.text, 'live', 'sends live status' );
			t.end();
		});
});

tape( 'POST /create_user - success', function test( t ) {
	request( app )
	.post( '/create_user' )
	.send({ name: 'Fridolin', email: 'fridolin.supertester@gmail.com', password: 'simsalabim' })
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.deepEqual( res.body, { message: 'The user was successfully created!' }, 'sends message' );
		t.end();
	});
});

tape( 'POST /create_user - duplicate email address', function test( t ) {
	request( app )
	.post( '/create_user' )
	.send({ name: 'Frido', email: 'fridolin.supertester@gmail.com', password: 'hokuspokus' })
	.expect( 403 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'Operation was not successful. The user already exists.', 'returns expected message' );
		t.end();
	});
});

tape( 'POST /create_user - missing field', function test( t ) {
	request( app )
	.post( '/create_user' )
	.send({ name: 'Hannah', email: 'hannah.supertester@gmail.com' })
	.expect( 403 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'Password and email address are required' );
		t.end();
	});
});

tape( 'GET /forgot_password - unknown user', function test( t ) {
	request( app )
	.get( '/forgot_password' )
	.query({ email: 'superman.supertester@gmail.com' })
	.expect( 404 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'User with the supplied email address not found.' );
		t.end();
	});
});

tape( 'GET /forgot_password - success', function test( t ) {
	request( app )
	.get( '/forgot_password' )
	.query({ email: 'fridolin.supertester@gmail.com' })
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '"Mail sent"', 'returns expected message' );
		t.end();
	});
});

tape( 'GET /forgot_password - failure sending email', function test( t ) {
	var newRequires = copy( requires );
	newRequires[ './mailer.js' ] = {
		'send': function send( mail, clbk ) {
			clbk( new Error( 'Service unavailable' ) );
		},
		'@noCallThru': true
	};
	var app = proxyquire( './../lib/index.js', newRequires );
	request( app )
	.get( '/forgot_password' )
	.query({ email: 'fridolin.supertester@gmail.com' })
	.expect( 503 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'Email service currently not available', 'returns expected message' );
		t.end();
	});
});

/*
tape( 'GET /get_lesson_info', function test( t ) {

});

tape( 'GET /has_write_access', function test( t ) {

});

tape( 'POST /send_mail', function test( t ) {

});

tape( 'GET /get_lesson', function test( t ) {

});

tape( 'GET /get_public_lessons', function test( t ) {

});

tape( 'GET /get_lessons', function test( t ) {

});

tape( 'POST /update_user_password', function test( t ) {

});

tape( 'POST /login', function test( t ) {

});

tape( 'POST /store_session_element', function test( t ) {

});

tape( 'POST /retrieve_data', function test( t ) {

});
*/

tape( 'perform clean-up', utils.after );
