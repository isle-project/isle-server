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

const mongoose = require( 'mongoose' );
const setReadOnly = require( '@stdlib/utils/define-read-only-property' );
const waterfall = require( '@stdlib/utils/async/series-waterfall' );
const objectKeys = require( '@stdlib/utils/keys' );
const Namespace = require( './../lib/models/namespace.js' );
const Lesson = require( './../lib/models/lesson.js' );
const User = require( './../lib/models/user.js' );


// VARIABLES //

const dbURI = 'mongodb://localhost/isle-test-clearing-db';


// MAIN //

// Set Promise library for mongoose:
mongoose.Promise = global.Promise;

const ns = {};

function clearDB( clbk ) {
	let counter = 0;
	const keys = objectKeys( mongoose.connection.collections );
	const len = keys.length;
	for ( let i = 0; i < len; i++ ) {
		const collection = mongoose.connection.collections[ keys[ i ] ];
		collection.deleteMany( onDone );
	}
	function onDone() {
		counter += 1;
		if ( counter === len-1 ) {
			return clbk();
		}
	}
}

setReadOnly( ns, 'before', function before( t ) {
	if ( mongoose.connection.readyState === 0 ) {
		mongoose.connect( dbURI, {
			'keepAlive': false
		})
		.then( () => {
			t.pass( 'connected to database' );
			return clearDB( t.end );
		})
		.catch( err => {
			throw err;
		});
	} else {
		return clearDB( t.end );
	}
});

setReadOnly( ns, 'populateDatabase', function populateDatabase( t ) {
	function createUsers( next ) {
		const pop = [
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
		const namespaces = [
			{
				'title': 'FrankensteinMeetsTheWolfMan',
				'description': 'Open the grave of Larry Talbot',
				'owners': [ users[ 1 ]._id, users[ 5 ]._id ]
			},
			{
				'title': 'DraculaVsTheWolfMan',
				'description': 'A great match',
				'owners': [ users[ 1 ]._id, users[ 2 ]._id ]
			},
			{
				'title': 'DraculaVsFrankenstein',
				'description': 'Dracula unearthes Frankenstein',
				'owners': [ users[ 2 ]._id, users[ 5 ]._id ]
			}
		];
		Namespace.create( namespaces, next );
	}

	function createLessons( namespaces, next ) {
		const lessons = [
			{
				namespace: namespaces[ 2 ]._id,
				title: 'Unearth the monster',
				public: true
			},
			{
				namespace: namespaces[ 2 ]._id,
				title: 'Kill the cemetery keeper',
				public: true
			},
			{
				namespace: namespaces[ 2 ]._id,
				title: 'Drink his blood',
				public: false
			},
			{
				namespace: namespaces[ 0 ]._id,
				title: 'Why have you followed me',
				public: true
			},
			{
				namespace: namespaces[ 0 ]._id,
				title: 'Talbot, you are a murderer',
				public: true
			},
			{
				namespace: namespaces[ 0 ]._id,
				title: 'Prove it',
				public: false
			}
		];
		Lesson.create( lessons, next );
	}

	function done( err, res ) {
		if ( err ) {
			t.fail( 'encountered an error: '+err.message );
		} else {
			t.pass( 'executed without errors' );
		}
		t.end();
	}
	waterfall([ createUsers, createNamespaces, createLessons ], done );
});

setReadOnly( ns, 'after', function after( t ) {
	clearDB( function onClear() {
		mongoose.disconnect()
			.then( () => {
				t.pass( 'disconnected from database' );
				t.end();
			})
			.catch( ( err ) => {
				t.error( err );
			});
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
