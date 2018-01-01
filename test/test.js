'use strict';

// MODULES //

var tape = require( 'tape' );
var request = require( 'supertest' );
var proxyquire = require( 'proxyquire' );
var app = proxyquire( './../lib/index.js', {
	'./config.json': {
		method: {
			'namespacesDirectory': './fixtures',
			'server': 'http://localhost'
		},
		'@noCallThru': true
	}
});


// TESTS //

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
