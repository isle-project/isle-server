'use strict';

// MODULES //

var tape = require( 'tape' );
var waterfall = require( '@stdlib/utils/async/series-waterfall' );
var papply = require( '@stdlib/utils/papply' );
var utils = require( './utils.js' );
var Namespace = require( './../lib/namespace.js' );
var Lesson = require( './../lib/lesson.js' );
var SessionData = require( './../lib/session_data.js' );


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

tape( 'successfully creates a session data object for a given lesson and user', function test( t ) {
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
	function createSessionData( obj, next ) {
		var data = {
			'name': '',
			'email': 'lotti.anton.super@gmail.com',
			'time': 25509,
			'absoluteTime': 1499033385712,
			'value': '2',
			'type': 'RSHELL_EVALUATION',
			'id': 'Question 1'
		};
		SessionData.create({
			'type': 'action',
			'data': data,
			'user': obj.user,
			'lesson': obj.lesson
		}, function onCreate( err, sessionData ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( sessionData.type, 'action', 'has expected type' );
			t.deepEqual( sessionData.data, data, 'has expected data' );
			t.strictEqual( sessionData.user, obj.user, 'has expected user' );
			t.strictEqual( sessionData.lesson, obj.lesson, 'has expected lesson' );
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
	}), createLesson, createSessionData ], done );
});

tape( 'successfully creates a session data object for a given lesson and an anonymous user', function test( t ) {
	function createLesson( obj, next ) {
		var o = {
			'title': 'My first lesson',
			'namespace': obj.namespace
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			next( null, lesson );
		});
	}
	function createSessionData( lesson, next ) {
		var data = {
			'name': 'anonymous',
			'email': 'anonymous',
			'time': 25509,
			'absoluteTime': 1499033385712,
			'value': '2',
			'type': 'RSHELL_EVALUATION',
			'id': 'Question 1'
		};
		SessionData.create({
			'type': 'action',
			'data': data,
			'lesson': lesson
		}, function onCreate( err, sessionData ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( sessionData.type, 'action', 'has expected type' );
			t.deepEqual( sessionData.data, data, 'has expected data' );
			t.strictEqual( sessionData.lesson, lesson, 'has expected lesson' );
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
		'email': 'zorro.super@gmail.com',
		'password': 'hans'
	}), papply( createNamespace, {
		'title': 'Lesson_Namespace_Anonymous',
		'description': 'A namespace with a lesson for an anonymous user'
	}), createLesson, createSessionData ], done );
});

tape( 'fails creating a session for a given lesson and user when no data or type is given', function test( t ) {
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
	function createSessionData( obj, next ) {
		SessionData.create({
			'user': obj.user,
			'lesson': obj.lesson
		}, next );
	}
	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
			t.strictEqual( error.message, 'SessionData validation failed: data: Path `data` is required., type: Path `type` is required.', 'returns expected error message' );
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
	}), createLesson, createSessionData ], done );
});

tape( 'fails creating a session data object when no lesson is given', function test( t ) {
	var data = {
		'name': 'anonymous',
		'email': 'anonymous',
		'time': 25509,
		'absoluteTime': 1499033385712,
		'value': '2',
		'type': 'RSHELL_EVALUATION',
		'id': 'Question 1'
	};
	SessionData.create({
		'type': 'action',
		'data': data
	}, function onCreate( err ) {
		var expected = 'SessionData validation failed: lesson: Path `lesson` is required.';
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
