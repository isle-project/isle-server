'use strict';

// MODULES //

var tape = require( 'tape' );
var waterfall = require( '@stdlib/utils/series-waterfall' );
var papply = require( '@stdlib/utils/papply' );
var utils = require( './utils.js' );
var Namespace = require( './../lib/namespace.js' );
var Lesson = require( './../lib/lesson.js' );
var File = require( './../lib/file.js' );


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

tape( 'successfully creates a file for a given lesson and user', function test( t ) {
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
	function createFile( obj, next ) {
		File.create({
			'title': 'Name of the file',
			'path': 'File path',
			'user': obj.user,
			'lesson': obj.lesson
		}, function onCreate( err, file ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( file.title, 'Name of the file', 'has expected title' );
			t.strictEqual( file.path, 'File path', 'has expected file path' );
			t.strictEqual( file.user, obj.user, 'has expected user' );
			t.strictEqual( file.lesson, obj.lesson, 'has expected lesson' );
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
	}), createLesson, createFile ], done );
});

tape( 'fails creating a file for a given lesson and user when no path is given', function test( t ) {
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
	function createFile( obj, next ) {
		File.create({
			'title': 'Name of the file',
			'user': obj.user,
			'lesson': obj.lesson
		}, next );
	}
	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
			t.strictEqual( error.message, 'File validation failed: path: Path `path` is required.', 'returns expected error message' );
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
	}), createLesson, createFile ], done );
});

tape( 'fails creating a file for a given lesson and user when no title is given', function test( t ) {
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
	function createFile( obj, next ) {
		File.create({
			'path': 'File path',
			'user': obj.user,
			'lesson': obj.lesson
		}, next );
	}
	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
			t.strictEqual( error.message, 'File validation failed: title: Path `title` is required.', 'returns expected error message' );
		} else {
			t.fail( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ papply( utils.createUser, {
		'email': 'damian2.super@gmail.com',
		'password': 'damian2'
	}), papply( createNamespace, {
		'title': 'Lesson_Namespace3',
		'description': 'Yet another namespace with lessons'
	}), createLesson, createFile ], done );
});

tape( 'fails creating a file when no user or lesson is given', function test( t ) {
	File.create({
		'title': 'Name of the file',
		'path': 'File path'
	}, function onCreate( err, file ) {
		var expected = 'File validation failed: user: Path `user` is required., lesson: Path `lesson` is required.';
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
