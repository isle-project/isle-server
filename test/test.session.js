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
const isEmptyArray = require( '@stdlib/assert/is-empty-array' );
const waterfall = require( '@stdlib/utils/async/series-waterfall' );
const papply = require( '@stdlib/utils/papply' );
const utils = require( './utils.js' );
const Namespace = require( './../lib/models/namespace.js' );
const Lesson = require( './../lib/models/lesson.js' );
const Session = require( './../lib/models/session.js' );


// FUNCTIONS //

function createNamespace( ns, owners, next ) {
	ns.owners = owners;
	Namespace.create( ns, function onCreate( err, namespace ) {
		if ( err ) {
			return next( err );
		}
		next( null, {
			'namespace': namespace,
			'user': owners
		});
	});
}


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'successfully creates a session for a given lesson and user', function test( t ) {
	function createLesson( obj, next ) {
		var o = {
			'title': 'My first lesson',
			'namespace': obj.namespace
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			next( null, {
				'user': obj.user,
				'lesson': lesson
			});
		});
	}
	function createSession( obj, next ) {
		var startTime = new Date().getTime();
		var endTime = startTime + 10000;
		Session.create({
			'startTime': startTime,
			'endTime': endTime,
			'duration': endTime - startTime,
			'user': obj.user,
			'lesson': obj.lesson
		}, function onCreate( err, session ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( session.startTime, startTime, 'has expected start time' );
			t.strictEqual( session.endTime, endTime, 'has expected end time' );
			t.strictEqual( session.duration, 10000, 'has expected duration' );
			t.strictEqual( session.user, obj.user, 'has expected user' );
			t.strictEqual( session.lesson, obj.lesson, 'has expected lesson' );
			t.strictEqual( session.finished, false, 'has default `finished` status' );
			t.ok( isEmptyArray( session.actions ), 'has empty `actions` array' );
			next( null );
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
	waterfall( [ papply( utils.createUser, {
		'email': 'lotti.anton.super@gmail.com',
		'password': 'hans'
	}), papply( createNamespace, {
		'title': 'Lesson_Namespace',
		'description': 'A namespace with lessons'
	}), createLesson, createSession ], done );
});

tape( 'fails creating a session for a given lesson and user when no start time is given', function test( t ) {
	function createLesson( obj, next ) {
		var o = {
			'title': 'My first lesson',
			'namespace': obj.namespace
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			next( null, {
				'user': obj.user,
				'lesson': lesson
			});
		});
	}
	function createSession( obj, next ) {
		Session.create({
			'user': obj.user,
			'lesson': obj.lesson
		}, next );
	}
	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
			t.strictEqual( error.message, 'Session validation failed: startTime: Path `startTime` is required.', 'returns expected error message' );
		} else {
			t.fail( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ papply( utils.createUser, {
		'email': 'damian.super@gmail.com',
		'password': 'damian'
	}), papply( createNamespace, {
		'title': 'Lesson_Namespace2',
		'description': 'Another namespace with lessons'
	}), createLesson, createSession ], done );
});

tape( 'fails creating a session when no user or lesson is given', function test( t ) {
	Session.create({
		'startTime': new Date().getTime()
	}, function onCreate( err ) {
		var expected = 'Session validation failed: lesson: Path `lesson` is required.';
		if ( err ) {
			t.pass( 'encountered an error' );
			t.strictEqual( err.message, expected, 'returns expected error message' );
		} else {
			t.fail( 'expected an error' );
		}
		t.end();
	});
});

tape( 'perform clean-up', utils.after );
