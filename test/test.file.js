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
const waterfall = require( '@stdlib/utils/async/series-waterfall' );
const papply = require( '@stdlib/utils/papply' );
const utils = require( './utils.js' );
const Namespace = require( './../lib/models/namespace.js' );
const Lesson = require( './../lib/models/lesson.js' );
const File = require( './../lib/models/file.js' );


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
		const o = {
			'title': 'My first lesson',
			'namespace': obj.namespace
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			next( null, {
				'user': obj.user,
				'lesson': lesson,
				'namespace': obj.namespace
			});
		});
	}
	function createFile( obj, next ) {
		File.create({
			'title': 'Title of the file',
			'path': 'File path',
			'filename': 'File name',
			'user': obj.user,
			'lesson': obj.lesson,
			'namespace': obj.namespace
		}, function onCreate( err, file ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( file.title, 'Title of the file', 'has expected title' );
			t.strictEqual( file.path, 'File path', 'has expected file path' );
			t.strictEqual( file.filename, 'File name', 'has expected file name' );
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
		const o = {
			'title': 'My first lesson',
			'namespace': obj.namespace
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			next( null, {
				'user': obj.user,
				'lesson': lesson,
				'namespace': obj.namespace
			});
		});
	}
	function createFile( obj, next ) {
		File.create({
			'title': 'Title of the file',
			'user': obj.user,
			'filename': 'File name',
			'lesson': obj.lesson,
			'namespace': obj.namespace
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
		const o = {
			'title': 'My first lesson',
			'namespace': obj.namespace
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			next( null, {
				'user': obj.user,
				'lesson': lesson,
				'namespace': obj.namespace
			});
		});
	}
	function createFile( obj, next ) {
		File.create({
			'path': 'File path',
			'user': obj.user,
			'filename': 'File name',
			'lesson': obj.lesson,
			'namespace': obj.namespace
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

tape( 'fails creating a file when no user or namespace is given', function test( t ) {
	File.create({
		'title': 'Title of the file',
		'path': 'File path',
		'filename': 'File name'
	}, function onCreate( err, file ) {
		const expected = 'File validation failed: user: Path `user` is required., namespace: Path `namespace` is required.';
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
