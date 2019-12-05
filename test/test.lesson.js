'use strict';

// MODULES //

const tape = require( 'tape' );
const waterfall = require( '@stdlib/utils/async/series-waterfall' );
const papply = require( '@stdlib/utils/papply' );
const utils = require( './utils.js' );
const Namespace = require( './../lib/namespace.js' );
const Lesson = require( './../lib/lesson.js' );


// FUNCTIONS //

function createNamespace( ns, owners, next ) {
	ns.owners = owners;
	Namespace.create( ns, function onCreate( err, namespace ) {
		if ( err ) {
			return next( err );
		}
		next( null, namespace );
	});
}


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'successfully creates a lesson for a given namespace', function test( t ) {
	function createLesson( ns, next ) {
		var o = {
			'title': 'My first lesson',
			'namespace': ns
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( lesson.namespace, ns );
			t.strictEqual( lesson.title, 'My first lesson', 'has expected title' );
			t.strictEqual( lesson.description, 'No description supplied.', 'has default description' );
			t.strictEqual( lesson.active, true, 'has default `active` status' );
			t.strictEqual( lesson.public, false, 'has default `public` status' );
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
	waterfall( [ papply( utils.createUser, {
		'email': 'lotti.anton.super@gmail.com',
		'password': 'hans'
	}), papply( createNamespace, {
		'title': 'Lesson_Namespace',
		'description': 'A namespace with lessons'
	}), createLesson ], done );
});

tape( 'creating a lesson fails if no title is given', function test( t ) {
	function createLesson( ns, next ) {
		var o = {
			'namespace': ns
		};
		Lesson.create( o, next );
	}
	function done( error ) {
		if ( error ) {
			t.pass( 'should return an error' );
			t.strictEqual( error.message, 'Lesson validation failed: title: Path `title` is required.', 'has expected error message' );
		} else {
			t.fail( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ papply( utils.createUser, {
		'email': 'fridolin.super@gmail.com',
		'password': 'frido123'
	}), papply( createNamespace, {
		'title': 'Failed_Namespace',
		'description': 'A namespace for a lesson without a title'
	}), createLesson ], done );
});

tape( 'creating a lesson fails if no namespace is given', function test( t ) {
	var o = {
		'title': 'Lesson_without_Namespace'
	};
	Lesson.create( o, function onCreate( err ) {
		if ( err ) {
			t.pass( 'should return an error' );
			t.strictEqual( err.message, 'Lesson validation failed: namespace: Path `namespace` is required.', 'has expected error message' );
		} else {
			t.fail( 'executed without errors' );
		}
		t.end();
	});
});

tape( 'successfully creates a lesson for a given namespace (custom optional attributes)', function test( t ) {
	function createLesson( ns, next ) {
		var o = {
			'title': 'My first lesson',
			'description': 'my description',
			'namespace': ns,
			'active': false,
			'public': false
		};
		Lesson.create( o, function onCreate( err, lesson ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( lesson.namespace, ns );
			t.strictEqual( lesson.title, 'My first lesson', 'has expected title' );
			t.strictEqual( lesson.description, 'my description', 'has supplied description' );
			t.strictEqual( lesson.active, false, 'has chosen `active` status' );
			t.strictEqual( lesson.public, false, 'has chosen `public` status' );
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
	waterfall( [ papply( utils.createUser, {
		'email': 'annabelle.super@gmail.com',
		'password': 'anna'
	}), papply( createNamespace, {
		'title': 'Custom_Lesson_Namespace',
		'description': 'A namespace with custom lessons'
	}), createLesson ], done );
});

tape( 'perform clean-up', utils.after );
