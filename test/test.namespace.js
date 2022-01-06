/**
* Copyright (C) 2016-present The ISLE Authors
*
* The isle-server program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

// MODULES //

const tape = require( 'tape' );
const isArray = require( '@stdlib/assert/is-array' );
const waterfall = require( '@stdlib/utils/async/series-waterfall' );
const papply = require( '@stdlib/utils/papply' );
const utils = require( './utils.js' );
const User = require( './../lib/models/user.js' );
const Namespace = require( './../lib/models/namespace.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'successfully creates a namespace with an owner and a title', function test( t ) {
	function createNamespace( owners, next ) {
		const o = {
			'title': 'First_Namespace',
			'owners': owners,
			'description': 'The first namespace'
		};
		Namespace.create( o, function onCreate( err, createdNamespace ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( createdNamespace.title, 'First_Namespace', 'has correct title' );
			t.ok( isArray( createdNamespace.owners ), 'has owners' );
			t.strictEqual( createdNamespace.description, 'The first namespace', 'has correct description' );
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
	waterfall( [ papply( utils.createUser, [
		{
			'email': 'lotti.anton.super@gmail.com',
			'password': 'hans'
		}
	]), createNamespace ], done );
});

tape( 'fails creating a namespace with an already used title', function test( t ) {
	const o = {
		'title': 'Duplicate_Namespace',
		'description': 'Namespace with already taken title'
	};
	function createUser( next ) {
		const u = [
			{
				'email': 'peter.flux.super@gmail.com',
				'password': 'fluxus'
			}
		];
		User.create( u, function onCreate( err, users ) {
			if ( err ) {
				return next( err );
			}
			next( null, users );
		});
	}

	function createFirstNamespace( owners, next ) {
		o.owners = owners;
		Namespace.create( o, function onCreate() {
			next();
		});
	}

	function createSecondNamespace( next ) {
		Namespace.create( o, function onCreate( err, res ) {
			t.strictEqual( err instanceof Error, true, 'returns an error' );
			next( err );
		});
	}

	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
		} else {
			t.fail( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ createUser, createFirstNamespace, createSecondNamespace ], done );
});

tape( 'fails creating a namespace without a title', function test( t ) {
	function createUser( next ) {
		const u = [
			{
				'email': 'hans.anton.super@gmail.com',
				'password': 'lotti'
			}
		];
		User.create( u, function onCreate( err, users ) {
			if ( err ) {
				return next( err );
			}
			next( null, users );
		});
	}

	function createNamespace( owners, next ) {
		const o = {
			'owners': owners,
			'description': 'Namespace without title'
		};
		Namespace.create( o, function onCreate( err ) {
			const expected = 'Namespace validation failed: title: Path `title` is required.';
			t.strictEqual( err instanceof Error, true, 'returns an error' );
			t.strictEqual( err.message, expected, 'has expected message' );
			next( err );
		});
	}

	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
		} else {
			t.fail( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ createUser, createNamespace ], done );
});

tape( 'fails creating a namespace without owners', function test( t ) {
	const o = {
		'title': 'ownerless_namespace',
		'description': 'Namespace without an owner',
		'owners': null
	};
	Namespace.create( o, function onCreate( err ) {
		const expected = 'Namespace validation failed: owners: Namespaces need at least one owner';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'fails creating a namespace with an empty owners array', function test( t ) {
	const o = {
		'title': 'ownerless_namespace',
		'description': 'Namespace without an owner',
		'owners': []
	};
	Namespace.create( o, function onCreate( err ) {
		const expected = 'Namespace validation failed: owners: Namespaces need at least one owner';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'perform clean-up', utils.after );
