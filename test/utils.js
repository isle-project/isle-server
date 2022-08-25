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
const Assessment = require( './../lib/models/assessment.js' );


// VARIABLES //

const dbURI = 'mongodb://localhost/isle-test-clearing-db';
const ObjectID = mongoose.Types.ObjectId;


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
				'_id': new ObjectID('623ce01a33522d1d834b8f10'),
				'email': 'zorro707@gmail.com',
				'name': 'Zorro',
				'password': 'zorro_is_the_best'
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f11'),
				'email': 'wolfman666@gmail.com',
				'name': 'The Wolfman',
				'password': 'Lon Chaney Jr.'
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f12'),
				'email': 'dracula@gmail.com',
				'name': 'Count Dracula',
				'password': 'Bela Lugosi'
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f13'),
				'email': 'ed_wood@gmail.com',
				'name': 'Ed Wood',
				'password': 'Plan 9 from Outer Space'
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f14'),
				'email': 'mummy@gmail.com',
				'name': 'The Mummy',
				'password': 'Egypt'
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f15'),
				'email': 'frankenstein@gmail.com',
				'name': 'Boris Karloff',
				'password': 'Mary Shelly'
			}
			/*
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f16')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f17')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f18')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f19')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f1a')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f1b')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f1c')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f1d')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f1e')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f1f')
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f20')
			}
			*/
		];
		User.create( pop, ( err, users ) => {
			next( err, { users });
		});
	}

	function createNamespaces({ users }, next ) {
		const rawNamespaces = [
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f27'),
				'title': 'FrankensteinMeetsTheWolfMan',
				'description': 'Open the grave of Larry Talbot',
				'owners': [ users[ 1 ]._id, users[ 5 ]._id ],
				'assessment': [
					{
						'name': 'average-score',
						'level': 'namespace',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'lesson-score'
					}
				],
				'lessons': [
					new ObjectID('623ce01a33522d1d834b8f2a'),
					new ObjectID('623ce01a33522d1d834b8f2b'),
					new ObjectID('623ce01a33522d1d834b8f2c')
				]
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f28'),
				'title': 'DraculaVsTheWolfMan',
				'description': 'A great match',
				'owners': [ users[ 1 ]._id, users[ 2 ]._id ],
				'assessment': [
					{
						'name': 'average-score',
						'level': 'namespace',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'lesson-score'
					}
				]
			},
			{
				'_id': new ObjectID('623ce01a33522d1d834b8f29'),
				'title': 'DraculaVsFrankenstein',
				'description': 'Dracula unearthes Frankenstein',
				'owners': [ users[ 2 ]._id, users[ 5 ]._id ],
				'assessment': [
					{
						'name': 'average-score',
						'level': 'namespace',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'lesson-score'
					}
				],
				lessons: [
					new ObjectID('623ce01a33522d1d834b8f2d'),
					new ObjectID('623ce01a33522d1d834b8f2e'),
					new ObjectID('623ce01a33522d1d834b8f2f')
				]
			}
		];
		Namespace.create( rawNamespaces, ( err, namespaces ) => {
			next( err, { users, namespaces });
		});
	}

	function createLessons({ users, namespaces }, next ) {
		const rawLessons = [
			{
				_id: namespaces[ 2 ].lessons[ 0 ],
				namespace: namespaces[ 2 ]._id,
				title: 'Unearth the monster',
				public: true,
				assessments: [
					{
						'name': 'lesson-score',
						'level': 'lesson',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'completed'
					}
				]
			},
			{
				_id: namespaces[ 2 ].lessons[ 1 ],
				namespace: namespaces[ 2 ]._id,
				title: 'Kill the cemetery keeper',
				public: true,
				assessments: [
					{
						'name': 'lesson-score',
						'level': 'lesson',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'completed'
					}
				]
			},
			{
				_id: namespaces[ 2 ].lessons[ 2 ],
				namespace: namespaces[ 2 ]._id,
				title: 'Drink his blood',
				public: false,
				assessments: [
					{
						'name': 'lesson-score',
						'level': 'lesson',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'completed'
					}
				]
			},
			{
				_id: namespaces[ 0 ].lessons[ 0 ],
				namespace: namespaces[ 0 ]._id,
				title: 'Why have you followed me',
				public: true,
				assessments: [
					{
						'name': 'lesson-score',
						'level': 'lesson',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'completed'
					}
				]
			},
			{
				_id: namespaces[ 0 ].lessons[ 1 ],
				namespace: namespaces[ 0 ]._id,
				title: 'Talbot, you are a murderer',
				public: true,
				assessments: [
					{
						'name': 'lesson-score',
						'level': 'lesson',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'completed'
					}
				]
			},
			{
				_id: namespaces[ 0 ].lessons[ 2 ],
				namespace: namespaces[ 0 ]._id,
				title: 'Prove it',
				public: false,
				assessments: [
					{
						'name': 'lesson-score',
						'level': 'lesson',
						'coverage': [ 'all' ],
						'rule': [ 'avg' ],
						'ref': 'completed'
					}
				]
			}
		];
		Lesson.create( rawLessons, ( err, lessons ) => {
			next( err, { lessons, namespaces, users });
		});
	}

	function createAssessments({ lessons, users }, next ) {
		const assessments = [
			{
				lesson: lessons[ 0 ]._id,
				user: users[ 0 ]._id,
				component: 'free-text-question-1',
				assessment: 'completed',
				time: new Date( '2017-01-03T00:00:00.000Z' ).getTime(),
				value: 80
			},
			{
				lesson: lessons[ 0 ]._id,
				user: users[ 0 ]._id,
				component: 'free-text-question-2',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 100
			},
			{
				lesson: lessons[ 0 ]._id,
				user: users[ 1 ]._id,
				component: 'free-text-question-1',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 50
			},
			{
				lesson: lessons[ 0 ]._id,
				user: users[ 1 ]._id,
				component: 'free-text-question-2',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 20
			},
			{
				lesson: lessons[ 1 ]._id,
				user: users[ 1 ]._id,
				component: 'free-text-question-3',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 60
			},
			{
				lesson: lessons[ 1 ]._id,
				user: users[ 1 ]._id,
				component: 'free-text-question-4',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 90
			},
			{
				lesson: lessons[ 1 ]._id,
				user: users[ 2 ]._id,
				component: 'free-text-question-3',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 80
			},
			{
				lesson: lessons[ 2 ]._id,
				user: users[ 2 ]._id,
				component: 'free-text-question-6',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 40
			},
			{
				lesson: lessons[ 2 ]._id,
				user: users[ 2 ]._id,
				component: 'free-text-question-7',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 60
			},
			{
				lesson: lessons[ 2 ]._id,
				user: users[ 4 ]._id,
				component: 'free-text-question-7',
				assessment: 'completed',
				time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
				value: 60
			},
			{
				lesson: lessons[ 4 ]._id,
				user: users[ 5 ]._id,
				component: 'number-question-1',
				assessment: 'completed',
				time: new Date( '2017-01-03T00:00:00.000Z' ).getTime(),
				value: 100
			},
			{
				lesson: lessons[ 4 ]._id,
				user: users[ 5 ]._id,
				component: 'number-question-2',
				assessment: 'completed',
				time: new Date( '2017-01-03T00:00:00.000Z' ).getTime(),
				value: 90
			},
			{
				lesson: lessons[ 4 ]._id,
				user: users[ 4 ]._id,
				component: 'number-question-1',
				assessment: 'completed',
				time: new Date( '2017-01-03T00:00:00.000Z' ).getTime(),
				value: 80
			}
		];
		Assessment.create( assessments, next );
	}

	function done( err, res ) {
		if ( err ) {
			t.fail( 'encountered an error: '+err.message );
		} else {
			t.pass( 'executed without errors' );
		}
		t.end();
	}
	waterfall([ createUsers, createNamespaces, createLessons, createAssessments ], done );
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
