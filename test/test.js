'use strict';

// MODULES //

var tape = require( 'tape' );
var request = require( 'supertest' );
var proxyquire = require( 'proxyquire' );
var isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
var isObject = require( '@stdlib/assert/is-object' );
var isString = require( '@stdlib/assert/is-string' );
var isArray = require( '@stdlib/assert/is-array' );
var isNull = require( '@stdlib/assert/is-null' );
var noop = require( '@stdlib/utils/noop' );
var copy = require( '@stdlib/utils/copy' );
var User = require( './../lib/user.js' );
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


// VARIABLES //

var USER_TOKEN;
var USER_ID;


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

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

tape( 'GET /has_write_access (no write access)', function test( t ) {
	request( app )
	.get( '/has_write_access' )
	.query({ email: 'fridolin.supertester@gmail.com' })
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error');
		var obj = JSON.parse( res.text );
		t.strictEqual( obj.message, 'The user has no write access', 'returns expected message' );
		t.strictEqual( obj.writeAccess, false, 'returns expected write access' );
		t.end();
	});
});

tape( 'GET /has_write_access (write access)', function test( t ) {
	var email = 'fridolin.supertester@gmail.com';
	User.findOneAndUpdate({ email: email },
		{
			$set: { writeAccess: true }
		},
		function onDone( err ) {
			request( app )
			.get( '/has_write_access' )
			.query({ email: email })
			.expect( 200 )
			.end( function onEnd( err, res ) {
				t.error( err, 'does not return an error');
				var obj = JSON.parse( res.text );
				t.strictEqual( obj.message, 'The user has write access', 'returns expected message' );
				t.strictEqual( obj.writeAccess, true, 'returns expected write access' );
				t.end();
			});
		}
	);
});

tape( 'GET /get_lesson_info', function test( t ) {
	request( app )
	.get( '/get_lesson_info' )
	.query({ lessonName: 'Why have you followed me?', namespaceName: 'Frankenstein meets the Wolf Man' })
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var obj = JSON.parse( res.text );
		t.ok( isString( obj.lessonID ), 'returns ID of lesson' );
		t.ok( isString( obj.namespaceID ), 'returns ID of namespace' );
		t.end();
	});
});

tape( 'GET /get_lesson_info (unknown lesson)', function test( t ) {
	request( app )
	.get( '/get_lesson_info' )
	.query({ lessonName: 'Unknown monster', namespaceName: 'Frankenstein meets the Wolf Man' })
	.expect( 410 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'Lesson was not found.', 'returns expected message' );
		t.end();
	});
});

tape( 'GET /get_lesson', function test( t ) {
	request( app )
	.get( '/get_lesson' )
	.query({ lessonName: 'Why have you followed me?', namespaceName: 'Frankenstein meets the Wolf Man' })
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var obj = JSON.parse( res.text );
		t.strictEqual( obj.message, 'ok', 'returns message' );
		t.strictEqual( isObject( obj.lesson ), true, 'returns lesson object' );
		t.strictEqual( obj.lesson.title, 'Why have you followed me?', 'returns correct title' );
		t.end();
	});
});

tape( 'GET /get_lesson (unknown lesson)', function test( t ) {
	request( app )
	.get( '/get_lesson' )
	.query({ lessonName: 'Why have you forsaken me?', namespaceName: 'Frankenstein meets the Wolf Man' })
	.expect( 404 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'Lesson query failed.', 'returns message' );
		t.end();
	});
});

tape( 'GET /get_lesson (unknown namespace)', function test( t ) {
	request( app )
	.get( '/get_lesson' )
	.query({ lessonName: 'Why have you followed me?', namespaceName: 'Frankenstein kills the Wolf Man' })
	.expect( 404 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'Namespace query failed.', 'returns message' );
		t.end();
	});
});

tape( 'GET /get_lesson (invalid `lessonName`)', function test( t ) {
	request( app )
	.get( '/get_lesson' )
	.query({ lessonName: [], namespaceName: 'Frankenstein meets the Wolf Man' })
	.expect( 400 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '`lessonName` has to be a string', 'returns message' );
		t.end();
	});
});

tape( 'GET /get_lesson (invalid `namespaceName`)', function test( t ) {
	request( app )
	.get( '/get_lesson' )
	.query({ lessonName: 'Why have you followed me?', namespaceName: []})
	.expect( 400 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '`namespaceName` has to be a string', 'returns message' );
		t.end();
	});
});

tape( 'GET /get_public_lessons', function test( t ) {
	request( app )
	.get( '/get_public_lessons' )
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var body = res.body;
		t.strictEqual( body.message, 'ok', 'returns expected message' );
		t.ok( isArray( body.lessons ), 'returns array of public lessons' );
		t.strictEqual( body.lessons.length, 4, 'array has expected length' );
		t.end();
	});
});

tape( 'GET /get_lessons (invalid `namespaceName`)', function test( t ) {
	request( app )
	.get( '/get_lessons' )
	.query({ namespaceName: []})
	.expect( 400 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '`namespaceName` has to be a string.', 'returns message' );
		t.end();
	});
});

tape( 'GET /get_lessons', function test( t ) {
	request( app )
	.get( '/get_lessons' )
	.query({ namespaceName: 'Frankenstein meets the Wolf Man' })
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var body = res.body;
		t.strictEqual( body.message, 'ok', 'returns expected message' );
		t.ok( isArray( body.lessons ), 'returns expected array' );
		t.strictEqual( body.lessons.length, 3, 'array has expected length' );
		t.end();
	});
});

tape( 'POST /update_user_password (invalid ID)', function test( t ) {
	request( app )
	.post( '/update_user_password' )
	.send({ id: 'abc', newPassword: 'zorro123' })
	.expect( 400 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '`id` has to be a valid ObjectID', 'returns expected message' );
		t.end();
	});
});

tape( 'POST /update_user_password (invalid `newPassword`)', function test( t ) {
	User.findOne( function onUser( err, user ) {
		request( app )
		.post( '/update_user_password' )
		.send({ id: user._id, newPassword: [] })
		.expect( 400 )
		.end( function onEnd( err, res ) {
			t.error( err, 'does not return an error' );
			t.strictEqual( res.text, 'New password has to be a string', 'returns expected message' );
			t.end();
		});
	});
});

tape( 'POST /update_user_password', function test( t ) {
	User.findOne( function onUser( err, user ) {
		request( app )
		.post( '/update_user_password' )
		.send({ id: user._id, newPassword: 'zorro123' })
		.expect( 200 )
		.end( function onEnd( err, res ) {
			t.error( err, 'does not return an error' );
			var body = res.body;
			t.strictEqual( body.message, 'User password successfully updated.', 'returns expected message' );
			t.end();
		});
	});
});

tape( 'POST /update_user_password (unknown user)', function test( t ) {
	request( app )
	.post( '/update_user_password' )
	.send({ id: '5a4e409c3d8668487003dec6', newPassword: 'zorro123' })
	.expect( 404 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, 'User does not exist.', 'returns expected message' );
		t.end();
	});
});

tape( 'POST /send_mail', function test( t ) {
	request( app )
	.post( '/send_mail' )
	.send({
		from: 'harry.potter123@gmx.de',
		to: 'hermine.granger777@gmx.de',
		text: 'I am hungry'
	})
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.body, 'Mail sent', 'returns expected message' );
		t.end();
	});
});

tape( 'POST /login (invalid email)', function test( t ) {
	request( app )
	.post( '/login' )
	.send({
		email: [],
		password: 'Lon Chaney Jr.'
	})
	.expect( 400 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '`email` has to be a string', 'returns expected message' );
		t.end();
	});
});

tape( 'POST /login (invalid password)', function test( t ) {
	request( app )
	.post( '/login' )
	.send({
		email: 'wolfman666@gmail.com',
		password: []
	})
	.expect( 400 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.strictEqual( res.text, '`password` has to be a string', 'returns expected message' );
		t.end();
	});
});

tape( 'POST /login (unknown email address)', function test( t ) {
	request( app )
	.post( '/login' )
	.send({
		email: 'wolfman667@gmail.com',
		password: 'Lon Chaney Jr.'
	})
	.expect( 404 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var body = res.body;
		t.strictEqual( body.message, 'No user with the given email address found.', 'returns expected message' );
		t.strictEqual( body.type, 'no_user', 'returns expected type' );
		t.end();
	});
});

tape( 'POST /login (wrong password)', function test( t ) {
	request( app )
	.post( '/login' )
	.send({
		email: 'wolfman666@gmail.com',
		password: 'Lon Chaney Sr.'
	})
	.expect( 401 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var body = res.body;
		t.strictEqual( body.message, 'Password is not correct.', 'returns expected message' );
		t.strictEqual( body.type, 'incorrect_password', 'returns expected type' );
		t.end();
	});
});

tape( 'POST /login', function test( t ) {
	request( app )
	.post( '/login' )
	.send({
		email: 'dracula@gmail.com',
		password: 'Bela Lugosi'
	})
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		var body = res.body;
		t.strictEqual( body.message, 'ok', 'returns expected message' );
		t.ok( isString( body.token ), 'returns `token` string' );
		USER_TOKEN = body.token;
		t.ok( isValidObjectId( body.id ), 'returns valid `id`' );
		USER_ID = body.id;
		t.end();
	});
});

tape( 'POST /credentials', function test( t ) {
	request( app )
	.post( '/credentials' )
	.set( 'Authorization', 'JWT '+USER_TOKEN )
	.send({
		id: USER_ID
	})
	.expect( 200 )
	.end( function onEnd( err, res ) {
		t.error( err, 'does not return an error' );
		t.ok( isObject( res.body ), 'returns a user object' );
		t.strictEqual( res.body.id, USER_ID, 'has expected ID' );
		t.strictEqual( res.body.email, 'dracula@gmail.com', 'has expected email' );
		t.strictEqual( res.body.name, 'Count Dracula', 'has expected name' );
		t.strictEqual( res.body.writeAccess, false, 'has expected writeAccess' );
		t.end();
	});
});

/*

tape( 'POST /store_session_element', function test( t ) {

});

tape( 'POST /retrieve_data', function test( t ) {

});

tape( 'POST /get_user_rights', function test( t ) {

});

tape( 'GET /set_write_access', function test( t ) {

});

tape( 'GET /copy_lesson', function test( t ) {

});

tape( 'POST /create_lesson', function test( t ) {

});

tape( 'GET /delete_lesson', function test( t ) {

});

tape( 'GET /update_lesson', function test( t ) {

});

tape( 'GET /activate_lesson', function test( t ) {

});

tape( 'GET /deactivate_lesson', function test( t ) {

});

tape( 'GET /show_lesson', function test( t ) {

});

tape( 'GET /hide_lesson', function test( t ) {

});

tape( 'POST /create_namespace', function test( t ) {

});

tape( 'GET /get_namespaces', function test( t ) {

});

tape( 'GET /delete_namespace', function test( t ) {

});

tape( 'POST /update_namespace', function test( t ) {

});

tape( 'POST /update_user', function test( t ) {

});

tape( 'GET /delete_session_element', function test( t ) {

});

tape( 'POST /get_user_actions', function test( t ) {

});

tape( 'POST /get_current_user_actions', function test( t ) {

});

tape( 'POST /create_cohort', function test( t ) {

});

tape( 'GET /get_cohorts', function test( t ) {

});

tape( 'GET /delete_cohort', function test( t ) {

});

tape( 'POST /update_cohort', function test( t ) {

});

tape( 'POST /upload_file', function test( t ) {

});
*/

tape( 'perform clean-up', utils.after );
