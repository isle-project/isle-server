'use strict';

// MODULES //

var fs = require( 'fs-extra' );
var ncp = require('ncp').ncp;
var path = require( 'path' );
var join = require( 'path' ).join;
var express = require( 'express' );
var bodyParser = require( 'body-parser' );
var jwt = require( 'jsonwebtoken' );
var async = require( 'async' );
var multer = require( 'multer' );
var debug = require( 'debug' )( 'server' );
var swot = require( 'swot-js' )();
var passport = require( 'passport' );
var passportJWT = require( 'passport-jwt' );
var cors = require( 'cors' );
var isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
var contains = require( '@stdlib/assert/contains' );
var pick = require( '@stdlib/utils/pick' );
var groupBy = require( '@stdlib/utils/group-by' );
var copy = require( '@stdlib/utils/copy' );
var isObject = require( '@stdlib/assert/is-object' );
var isString = require( '@stdlib/assert/is-string' );
var isNull = require( '@stdlib/assert/is-null' );
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var User = require( './user.js' );
var Cohort = require( './cohort.js' );
var File = require( './file.js' );
var Lesson = require( './lesson.js' );
var Namespace = require( './namespace.js' );
var Session = require( './session.js' ); // eslint-disable-line
var SessionData = require( './session_data.js' );
var mailer = require( './mailer.js' );
var socketHandler = require( './sockets/handler.js' );
var serveStatic = require( './serve_static.js' );
var config = require( './config.json' );
var namespacesDirectory = config.namespacesDirectory;
var serverHostName = config.server;
var tokens = require( './../credentials/tokens.json' );
var unzipLessonFolder = require( './unzip_lesson_folder.js' );
require( './connect_mongoose.js' );


// FUNCTIONS //

function createNamespaceDirectory( dir, clbk ) {
	let dirpath = path.join( namespacesDirectory, dir );
	dirpath = path.resolve( __dirname, dirpath );
	fs.mkdir( dirpath, clbk );
}

function deleteNamespaceDirectory( dir, clbk ) {
	let dirpath = path.join( namespacesDirectory, dir );
	dirpath = path.resolve( __dirname, dirpath );
	fs.rmdir( dirpath, clbk );
}

function deleteLessonDirectory( dir, clbk ) {
	let dirpath = path.join( namespacesDirectory, dir );
	dirpath = path.resolve( __dirname, dirpath );
	fs.remove( dirpath, clbk );
}

function renameDirectory( oldDir, newDir, clbk ) {
	let oldDirPath = path.join( namespacesDirectory, oldDir );
	let newDirPath = path.join( namespacesDirectory, newDir );
	oldDirPath = path.resolve( __dirname, oldDirPath );
	newDirPath = path.resolve( __dirname, newDirPath );
	fs.rename( oldDirPath, newDirPath, clbk );
}

function check( str ) {
	var name = swot.check( str );
	if ( !name ) {
		if ( str.includes( 'andrew.cmu.edu' ) ) {
			return 'Carnegie Mellon University';
		}
	}
	return 'Other';
}


// VARIABLES //

var lessonUpload = multer({
	dest: 'public'
});

var storage = multer.diskStorage({
	destination: function onDestination( req, file, cb ) {
		if ( file.fieldname === 'avatar' ) {
			return cb( null, 'media/avatar' );
		}
		cb( null, 'media' );
	},
	filename: function onFilename( req, file, cb ) {
		if ( file.fieldname === 'avatar' ) {
			return cb( null, file.originalname );
		}
		var ext = path.extname( file.originalname );
		var base = path.basename( file.originalname, ext );
		cb( null, base + '_' + Date.now() + ext );
	}
});
var fileUpload = multer({
	storage: storage
});
var MAX_NUM_ACTIONS = 50000;


// MAIN //

var app = express();

var server;
if ( config[ 'key' ] && config[ 'certificate' ] ) {
	var privateKey = fs.readFileSync( config[ 'key' ] );
	var certificate = fs.readFileSync( config[ 'certificate' ] );
	server = require( 'https' ).createServer({
		key: privateKey,
		cert: certificate
	}, app );
} else {
	server = require( 'http' ).createServer( app );
}

var io = require( 'socket.io' )( server );
socketHandler( io );

app.use( cors({
	'origin': '*',
	'methods': 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
	'preflightContinue': false,
	'optionsSuccessStatus': 204,
	'allowedHeaders': [ 'Range', 'Authorization', 'Content-Type', 'If-Modified-Since' ],
	'exposedHeaders': [ 'Content-Range', 'Content-Encoding', 'Content-Length', 'Accept-Ranges' ],
	'credentials': true
}) );

app.use( serveStatic( 'public' ) );

app.use( express.static( 'media' ) );

var jwtOptions = {
	jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme( 'jwt' ),
	secretOrKey: 'tasmanianDevil'
};

var strategy = new JwtStrategy( jwtOptions, function onPayloadReceived( jwtPayload, next ) {
	debug( 'payload received: ', jwtPayload );
	User.findOne({ '_id': jwtPayload.id }, function onFindOne( err, user ) {
		if ( !err ) {
			next( null, user );
		} else {
			next( err, false );
		}
	});
});

passport.use( strategy );

app.use( passport.initialize() );

// Parse application/x-www-form-urlencoded for easier testing with Postman or plain HTML forms
app.use( bodyParser.urlencoded({
	extended: true,
	limit: '5mb'
}) );

// Parse application/json:
app.use( bodyParser.json({
	limit: '5mb'
}) );

app.get( '/', function onDefault( req, res ) {
	res.redirect( '/dashboard/' );
});

app.post( '/credentials', passport.authenticate( 'jwt', { session: false }), function onCredentials( req, res ) {
	if ( !isValidObjectId( req.body.id ) ) {
		return res.status( 400 ).send( '`id` has to be a valid ObjectID.' );
	}
	User
		.findOne({ '_id': req.body.id })
		.populate( 'enrolledNamespaces' )
		.populate( 'ownedNamespaces' )
		.exec( function onFindUser( err, user ) {
			debug( 'Retrieve user credentials...' );
			res.json({
				id: req.body.id,
				email: user.email,
				name: user.name,
				organization: user.organization,
				enrolledNamespaces: user.enrolledNamespaces,
				ownedNamespaces: user.ownedNamespaces,
				writeAccess: user.writeAccess,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				picture: user.picture,
				score: user.score,
				spentTime: user.spentTime
			});
		});
});

app.post( '/credentials_dashboard', passport.authenticate( 'jwt', { session: false }), function onCredentials( req, res ) {
	if ( !isValidObjectId( req.body.id ) ) {
		return res.status( 400 ).send( '`id` has to be a valid ObjectID.' );
	}
	User
		.findOne({ '_id': req.body.id })
		.populate( 'enrolledNamespaces' )
		.populate( 'ownedNamespaces' )
		.exec( function onFindUser( err, user ) {
			debug( 'Retrieve user credentials...' );
			Namespace.populate( user.ownedNamespaces, { path: 'owners' }, function onDone( err ) {
				res.json({
					id: req.body.id,
					email: user.email,
					name: user.name,
					organization: user.organization,
					enrolledNamespaces: user.enrolledNamespaces,
					ownedNamespaces: user.ownedNamespaces,
					writeAccess: user.writeAccess,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
					picture: user.picture,
					score: user.score,
					spentTime: user.spentTime,
					lessonData: user.lessonData
				});
			});
		});
});

app.get( '/ping', function onPing( req, res ) {
	debug( 'Send live status...' );
	res.send( 'live' );
});

app.post( '/create_user', function onCreateUser( req, res ) {
	if ( req.body.email && req.body.password ) {
		var user = new User({
			email: req.body.email,
			name: req.body.name,
			password: req.body.password,
			organization: check( req.body.email ),
			role: 'user'
		});
		user.save( function onSaveUser( err ) {
			if ( err ) {
				debug( 'Encountered an error: %s', err.message );
				if ( contains( err.message, 'duplicate key error' ) ) {
					return res.status( 403 ).send( 'Operation was not successful. The user already exists.' );
				}
				return res.status( 403 ).send( err.message );
			}
			debug( 'Successfully created user: %s', req.body.email );
			res.json({
				message: 'The user was successfully created!'
			});
		});
	} else {
		return res.status( 403 ).send( 'Password and email address are required' );
	}
});


app.get( '/forgot_password', function onForgotPassword( req, res ) {
	debug( 'Forgot Password GET Request...' );
	User.findOne({ email: req.query.email }, function onFindUser( err, user ) {
		if ( err || !user ) {
			return res.status( 404 ).send( 'User with the supplied email address not found.' );
		}
		const mail = {
			'from': 'support@isledocs.com',
			'subject': 'New Password Requested',
			'to': req.query.email,
			'text': `
				Dear ${user.name}, you have indicated that you have forgotten your password. You can choose a new password by clicking this link:
				<a href="${serverHostName}/dashboard/#/new-password/?token=${user._id}">Link</a>
			`
		};
		debug( 'Mail: ' + JSON.stringify( mail ) );
		mailer.send( mail, function onDone( error, response ) {
			if ( !error ) {
				res.json( response );
			} else {
				debug( 'Mail could not be sent: '+error.message );
				res.status( 503 ).send( 'Email service currently not available' );
			}
		});
	});
});

app.get( '/has_write_access', function onHasWriteAccess( req, res ) {
	User.findOne({ email: req.query.email }, function onFindUser( err, user ) {
		if ( err ) {
			return res.status( 404 ).send( 'Unknown user.' );
		}
		res.json({
			message: `The user ${ user.writeAccess ? 'has' : 'has no'} write access`,
			writeAccess: user.writeAccess
		});
	});
});

app.get( '/get_lesson_info', function onGetLessonInfo( req, res ) {
	debug( 'LessonID GET Request...' );
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			return debug( 'Encountered an error while retrieving namespace: ' + err.message );
		}
		Lesson.findOne({ namespace: namespace, title: lessonName }, function onFindLesson( err, lesson ) {
			if ( err ) {
				debug( 'Encountered an error while retrieving lesson: ' + err.message );
				return res.status( 404 ).send( err.message );
			}
			if ( !isObject( lesson ) ) {
				const msg = 'Lesson was not found.';
				debug( msg );
				return res.status( 410 ).send( msg );
			}
			const info = {
				lessonID: lesson._id,
				namespaceID: namespace._id
			};
			debug( 'Send lesson info: ' + JSON.stringify( info ) );
			res.json( info );
		});
	});
});

app.get( '/get_lesson', function onGetLesson( req, res ) {
	if ( !isString( req.query.namespaceName ) ) {
		return res.status( 400 ).send( '`namespaceName` has to be a string' );
	}
	if ( !isString( req.query.lessonName ) ) {
		return res.status( 400 ).send( '`lessonName` has to be a string' );
	}
	Namespace.findOne({ title: req.query.namespaceName }, onFindNamespace );
	function onFindNamespace( err, namespace ) {
		if ( err || isNull( namespace )) {
			return res.status( 404 ).send( 'Namespace query failed.' );
		}
		Lesson.findOne({ namespace: namespace, title: req.query.lessonName }, onFindLesson );
	}
	function onFindLesson( err, lesson ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson query failed.' );
		}
		res.json({ message: 'ok', lesson: lesson });
	}
});

app.get( '/get_public_lessons', function onGetPublicLesson( req, res ) {
	Lesson.find({ public: true }, function onLessonFind( err, lessons ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson query failed.' );
		}
		async.map( lessons, onMapAsync, onDone );
	});

	function onMapAsync( lesson, clbk ) {
		Namespace.findOne({ _id: lesson.namespace }, function onFindNamespace( err, res ) {
			lesson = lesson.toObject();
			// Replace ID by namespace title:
			lesson.namespace = res.title;
			clbk( null, lesson );
		});
	}
	function onDone( err, results ) {
		res.json({
			message: 'ok',
			lessons: results
		});
	}
});

app.get( '/get_isle_file', passport.authenticate( 'jwt', { session: false }), function onGetIsleFile( req, res ) {
	const namespace = req.query.namespaceName;
	const lesson = req.query.lessonName;
	let file = join( namespacesDirectory, namespace, lesson, '/index.isle' );
	file = path.resolve( __dirname, file );
	debug( `Retrieve file at: '${file}'` );
	fs.readFile( file, 'utf8', function readIsleFile( err, data ) {
		if ( err ) {
			return res.status( 404 ).send( err.message );
		}
		res.send( data );
	});
});

app.get( '/get_lessons', function onGetLessons( req, res ) {
	if ( isString( req.query.namespaceName ) ) {
		debug( 'Retrieve lessons...' );
		Namespace.findOne({ title: req.query.namespaceName }, onFindNamespace );
	} else {
		return res.status( 400 ).send( '`namespaceName` has to be a string.' );
	}

	function onFindNamespace( err, namespace ) {
		if ( err ) {
			return res.status( 404 ).send( 'Namespace query failed.' );
		}
		Lesson.find({ namespace: namespace }, onFindLesson );
	}
	function onFindLesson( err, lessons ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson query failed.' );
		}
		lessons = lessons.map( lesson => {
			lesson = lesson.toObject();
			// Replace ID by namespace title:
			lesson.namespace = req.query.namespaceName;
			return lesson;
		});
		res.json({ message: 'ok', lessons: lessons });
	}
});

app.post( '/get_user_rights', passport.authenticate( 'jwt', { session: false }), function onGetUserRights( req, res ) {
	const { namespaceName } = req.body;
	debug( 'Should retrieve user rights....' );
	Namespace.findOne({ title: namespaceName }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
		}
		else if ( !namespace ) {
			res.json({
				owner: false,
				enrolled: false
			});
		}
		else {
			debug( 'Namespace owners: ' + JSON.stringify( namespace.owners ) );
			debug( 'User: ' + req.user );
			let id = req.user._id.toString();
			let owner = false;
			for ( let i = 0; i < namespace.owners.length; i++ ) {
				if ( namespace.owners[ i ].toString() === id ) {
					owner = true;
				}
			}
			Cohort.findOne({
				namespace: namespace,
				members: { $in: [ req.user ] },
				startDate: { '$lt': new Date() },
				endDate: { '$gte': new Date() }
		}, function onCohortFindOne( err, cohort ) {
				if ( err ) {
					return debug( 'Encountered an error: ' + err.message );
				}
				res.json({
					owner: !!owner,
					enrolled: !!cohort
				});
			});
		}
	});
});

app.get( '/set_write_access', passport.authenticate( 'jwt', { session: false }), function onSetWriteAccess( req, res ) {
	const { token } = req.query;
	const user = req.user;
	debug( 'Should set user write access...' );
	if ( token === tokens.writeAccess ) {
		user.writeAccess = true;
		user.save( function onUserSave( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'User could not be updated.' );
			}
			res.json({
				message: 'User successfully updated.'
			});
		});
	} else {
		return res.status( 401 ).send( 'Incorrect write-access token.' );
	}
});

app.post( '/send_mail', function onSendMail( req, res ) {
	mailer.send( req.body, function onDone( error, response ) {
		if ( !error ) {
			res.json( response );
		} else {
			debug( 'Mail could not be sent' );
			res.json( error );
		}
	});
});

app.get( '/copy_lesson', passport.authenticate( 'jwt', { session: false }), function onCopyLesson( req, res ) {
	const { source, target, sourceName, targetName } = req.query;
	debug( 'Should copy lesson....' );
	Namespace.findOne({ title: target, owners: { $in: [ req.user ]}}, onFindNamespace );

	function onFindNamespace( err, namespace ) {
		var lesson;
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
		}
		else {
			debug( 'Create lesson object: ' );
			lesson = new Lesson({
				namespace: namespace,
				title: targetName,
				public: false
			});
			debug( 'Save lesson to database...' );
			let sourceDir = path.join( namespacesDirectory, source, sourceName );
			sourceDir = path.resolve( __dirname, sourceDir );
			let targetDir = path.join( namespacesDirectory, target, targetName );
			targetDir = path.resolve( __dirname, targetDir );
			ncp( sourceDir, targetDir, onNcp );
		}

		function onNcp(err) {
			if ( err ) {
				debug( 'Encountered an error: ' + err );
				return res.status( 405 ).send( 'Lesson could not be copied' );
			}
			lesson.save( onLessonSave );
		}
	}

	function onLessonSave( err ) {
		if ( err ) {
			return res.status( 409 ).send( 'Lesson could not be saved to database' );
		}
		res.json({
			message: 'The lesson has been successfully copied.'
		});
	}
});

app.post( '/create_lesson', lessonUpload.single( 'zipped' ), passport.authenticate( 'jwt', { session: false }), function onCreateLesson( req, res ) {
	const { namespaceName, lessonName } = req.body;
	debug( 'Should create lesson....' );
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ]}}, onFindNamespace );

	function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
		}
		else {
			debug( 'Create lesson object: ' );
			Lesson.findOne({
				namespace: namespace,
				title: lessonName
			}, onFindLesson );
		}
		function onFindLesson( err, lesson ) {
			if ( !lesson ) {
				lesson = new Lesson({
					namespace: namespace,
					title: lessonName
				});
				debug( 'Save lesson to database...' );
				lesson.save( onSave );
			} else {
				unzipLessonFolder( namespaceName, lessonName, req.file.filename );
				res.json({
					message: 'The lesson has been successfully uploaded.'
				});
			}
		}
	}
	function onSave( err ) {
		if ( err ) {
			return res.status( 409 ).send( 'Lesson could not be saved to database' );
		}
		unzipLessonFolder( namespaceName, lessonName, req.file.filename );
		res.json({
			message: 'The lesson has been successfully uploaded.'
		});
	}
});

app.get( '/delete_lesson', passport.authenticate( 'jwt', { session: false }), function onDeleteLesson( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ]}}, onFindNamespace );

	function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		deleteLessonDirectory( path.join( namespaceName, lessonName ), function onDelete( err ) {
			if ( err ) {
				return res.status( 403 ).send( err.message );
			}
			Lesson.remove({ namespace: namespace, title: lessonName }, onLessonRemove );
		});
	}

	function onLessonRemove( err, lesson ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson delete failed.' );
		}
		res.json({
			message: 'The lesson has been successfully deleted.'
		});
	}
});

app.get( '/update_lesson', passport.authenticate( 'jwt', { session: false }), function onUpdateLesson( req, res ) {
	const { namespaceName, lessonName, newTitle, newDescription } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			return debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { title: newTitle, description: newDescription }, onLessonUpdate );
	});

	function onLessonUpdate( err ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson update failed.' );
		}
		renameDirectory(
			path.join( namespaceName, lessonName ),
			path.join( namespaceName, newTitle ),
			onRename
		);
	}

	function onRename( err ) {
		if ( err ) {
			return res.status( 403 ).send( err.message );
		}
		res.json({
			message: 'The lesson has been successfully updated.'
		});
	}
});

app.get( '/activate_lesson', passport.authenticate( 'jwt', { session: false }), function onActivateLesson( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { active: true }, function onLessonUpdate( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson has been successfully activated.'
			});
		});
	});
});

app.get( '/deactivate_lesson', passport.authenticate( 'jwt', { session: false }), function onDeactivateLesson( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { active: false }, function onLessonUpdate( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson has been successfully deactivated.'
			});
		});
	});
});

app.get( '/show_lesson', passport.authenticate( 'jwt', { session: false }), function onShowLesson( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { public: true }, function onLessonUpdate( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson is now visible inside the public gallery.'
			});
		});
	});
});

app.get( '/hide_lesson', passport.authenticate( 'jwt', { session: false }), function onHideLesson( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { public: false }, function onLessonUpdate( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson is now hidden from the public gallery.'
			});
		});
	});
});

app.post( '/create_namespace', passport.authenticate( 'jwt', { session: false }), function onCreateNamespace( req, res ) {
	if ( req.body.title && req.body.description && req.body.owners ) {
		User.find({ 'email': req.body.owners }, onFindUser );
	}
	function onFindUser( err, users ) {
		debug( 'Retrieve user credentials: ' + JSON.stringify( users ) );
		var namespace = new Namespace({
			owners: users,
			title: req.body.title,
			description: req.body.description
		});
		users.forEach( user => {
			user.ownedNamespaces.push( namespace );
			user.save();
		});
		namespace.save( onSaveNamespace );
	}
	function onSaveNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error when saving namespace: ' + err.message );
			res.json({
				message: 'The namespace could not be created as it already exists.',
				successful: false
			});
		} else {
			createNamespaceDirectory( namespace.title, onCreate );
		}
		function onCreate( err ) {
			if ( err ) {
				debug( 'Encountered an error when creating namespace directory: ' + err.message );
				return res.json({
					message: err.message,
					successful: false
				});
			}
			res.json({
				message: 'The namespace was successfully created!',
				successful: true,
				_id: namespace._id
			});
		}
	}
});

app.get( '/delete_namespace', passport.authenticate( 'jwt', { session: false }), function onDeleteNamespace( req, res ) {
	Namespace.findOne({ _id: req.query.id }, onFindNamespace );

	function onFindNamespace( err, namespace ) {
		if ( err || !namespace ) {
			debug( 'Encountered an error when deleting namespace: ' + err );
			return res.status( 404 ).send( 'Namespace does not exist.' );
		}
		User.find({ email: namespace.owners }, onFindUsers );
		deleteNamespaceDirectory( namespace.title, function onDelete( err ) {
			if ( err ) {
				return res.status( 403 ).send( err.message );
			}
			namespace.remove( onRemoveNamespace);
		});
		function onFindUsers( err, users ) {
			users.forEach( user => {
				debug( `Removing namespace ${namespace.title} for user ${user.email}` );
				const arr = [];
				for ( let i = 0; i < user.ownedNamespaces.length; i++ ) {
					if ( !user.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
						arr.push( user.ownedNamespaces[ i ] );
					}
				}
				user.ownedNamespaces = arr;
				user.save();
			});
		}
	}
	function onRemoveNamespace( err ) {
		if ( err ) {
			return res.status( 400 ).send( 'Namespace could not be removed' );
		}
		res.json({ message: 'Namespace successfully deleted.' });
	}
});

app.post( '/update_namespace', passport.authenticate( 'jwt', { session: false }), function onUpdateNamespace( req, res ) {
	let ns = req.body.ns;
	Namespace
		.findOne({ _id: ns._id })
		.populate( 'owners' )
		.exec( function onFindNamespace( err, namespace ) {
			if ( err ) {
				debug( 'Encountered an error when updating namespace: ' + err.message );
				return res.status( 404 ).send( err.message );
			}
			if ( !namespace ) {
				return res.status( 404 ).send( 'Namespace does not exist.' );
			}
			namespace.owners.forEach( user => {
				debug( `Removing namespace ${namespace.title} for user ${user.email}` );
				const arr = [];
				for ( let i = 0; i < user.ownedNamespaces.length; i++ ) {
					if ( !user.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
						arr.push( user.ownedNamespaces[ i ] );
					}
				}
				user.ownedNamespaces = arr;
				user.save();
			});
			let newProps = pick( ns, [ 'owners', 'title', 'description' ]);
			User.find({ email: newProps.owners }, onFindUser );

			function onFindUser( err, users ) {
				if ( err ) {
					debug( 'Encountered an error: ' + err.message );
					return res.status( 400 ).send( err.message );
				}
				debug( 'Found %d users...', users.length );
				users.forEach( user => {
					debug( `Push namespace to user ${user.email}.` );
					user.ownedNamespaces.push( namespace );
					user.save();
				});
				newProps.owners = users;
				namespace.update( { $set: newProps }, onUpdateNamespace );
			}

			function onUpdateNamespace( err ) {
				if ( err ) {
					return res.status( 400 ).send( err.message );
				}
				renameDirectory( namespace.title, ns.title, onRename );
			}

			function onRename( err ) {
				if ( err ) {
					return res.status( 403 ).send( err.message );
				}
				res.json({ message: 'Namespace successfully updated.' });
			}
		});
});

app.post( '/update_user', passport.authenticate( 'jwt', { session: false }), function onUpdateUser( req, res ) {
	var user = req.user;
	if ( req.body.name ) {
		user.name = req.body.name;
	}
	if ( req.body.password ) {
		user.password = req.body.password;
	}
	if ( req.body.organization ) {
		user.organization = req.body.organization;
	}
	user.save( function onSaveUser( err ) {
		if ( err ) {
			return res.status( 404 ).send( 'User could not be updated.' );
		}
		res.json({
			message: 'User successfully updated.'
		});
	});
});

app.post( '/update_user_password', function onUpdateUserPassword( req, res ) {
	debug( 'Should update user password...' );
	var newPassword = req.body.newPassword;
	var id = req.body.id;
	if ( !isString( newPassword ) ) {
		return res.status( 400 ).send( 'New password has to be a string' );
	}
	if ( !isValidObjectId( id ) ) {
		return res.status( 400 ).send( '`id` has to be a valid ObjectID' );
	}
	User.findOne({ _id: id }, function onFindUser( err, user ) {
		if ( err || !user ) {
			return res.status( 404 ).send( 'User does not exist.' );
		}
		user.password = newPassword;
		user.save( function onSaveUser( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Password could not be updated.' );
			}
			res.json({
				message: 'User password successfully updated.'
			});
		});
	});
});

app.post( '/login', function onLogin( req, res ) {
	var password = req.body.password;
	var email = req.body.email;

	if ( !isString( password ) ) {
		return res.status( 400 ).send( '`password` has to be a string' );
	}
	if ( !isString( email ) ) {
		return res.status( 400 ).send( '`email` has to be a string' );
	}
	User.findOne({ 'email': email }, function onFindUser( err, user ) {
		if ( !user ) {
			res.status( 404 ).json({
				message: 'No user with the given email address found.',
				type: 'no_user'
			});
		} else {
			user.comparePassword( password, function onComparePassword( err, isMatch ) {
				if ( isMatch === true ) {
					// Identify users by their ID:
					var payload = { id: user.id };
					var token = jwt.sign( payload, jwtOptions.secretOrKey );
					res.json({ message: 'ok', token: token, id: user.id });
				} else {
					res.status( 401 ).json({
						message: 'Password is not correct.',
						type: 'incorrect_password'
					});
				}
			});
		}
	});
});

app.post( '/store_session_element', function onStoreSessionElement( req, res ) {
	debug( 'Should store session element...' );
	if ( req.body ) {
		debug( 'Session data: ' + req.body );
		var formData = req.body;
		if ( formData.type === 'action' ) {
			var sessionData;
			if ( !formData.userID ) {
				// Anonymous user:
				sessionData = new SessionData({
					data: formData.data,
					lesson: formData.lessonID,
					type: formData.type
				});
			} else {
				sessionData = new SessionData({
					data: formData.data,
					user: formData.userID,
					lesson: formData.lessonID,
					type: formData.type
				});
			}
			sessionData.save( function onSaveSessionData( err ) {
				if ( err ) {
					return res.status( 404 ).send( 'Session data could not be saved.' );
				}
				res.json({
					message: 'User action successfully saved.'
				});
			});
		}
	}
});

app.get( '/delete_session_element', passport.authenticate( 'jwt', { session: false }), function onDeleteSessionElement( req, res ) {
	debug( 'Should delete session element...' );
	SessionData.findById( req.query._id, onFindSessionData );

	function onFindSessionData( err, sessionData ) {
		if ( err ) {
			return res.status( 404 ).send( 'Session data not found.' );
		}

		Lesson.findById( sessionData.lesson, function onFindLesson( err, lesson ) {
			Namespace.findOne({ _id: lesson.namespace, owners: { $in: [ req.user ]}}, onNamespace );
		});

		function onNamespace( err, namespace ) {
			if ( err ) {
				return res.status( 403 ).send( 'Access forbidden due to missing owner credentials.' );
			}
			if ( namespace ) {
				sessionData.remove( onRemove );
			}
		}
	}

	function onRemove( err ) {
		if ( err ) {
			return res.status( 400 ).send( 'SessionData could not be removed.' );
		}
		res.json({ message: 'SessionData successfully deleted.' });
	}
});

app.post( '/get_user_actions', passport.authenticate( 'jwt', { session: false }), function onGetUserActions( req, res ) {
	if ( !req.body.lessonID ) {
		return res.status( 422 ).send( 'Missing lessonID.' );
	}
	SessionData
		.find({ type: 'action', lesson: req.body.lessonID }, null )
		.sort( '-data.absoluteTime' )
		.limit( MAX_NUM_ACTIONS )
		.exec( function onExecute( err, actions ) {
			if ( err ) {
				return res.status( 404 ).send( 'Session data could not be retrieved.' );
			}
			debug( `Return ${actions.length} actions to the caller` );
			res.json({
				actions: actions.map( d => {
					const out = d.data;
					out.sessiondataID = d._id;
					return out;
				})
			});
		});
});

app.get( '/get_fake_users', passport.authenticate( 'jwt', { session: false }), function onDeleteSessionElement( req, res ) {
	User.find( function onUsers( err, users ) {
		if ( err ) {
			return res.status( 404 ).send( 'User session data could not be retrieved.' );
		}
		var email = {};
		var name = {};
		var i;
		for ( i = 0; i < users.length; i++ ) {
			email[ users[i].email ] = users[i].anonEmail;
			name[ users[i].name ] = users[i].anonName;
		}
		return res.json({
			email: email,
			name: name
		});
	});
});

app.post( '/get_current_user_actions', passport.authenticate( 'jwt', { session: false }), function onGetCurrentUserActions( req, res ) {
	SessionData
		.find({
			type: 'action',
			lesson: req.body.lessonID,
			'data.email': req.user.email
		}, null )
		.sort( '-data.absoluteTime' )
		.exec( function onExecute( err, actions ) {
			if ( err ) {
				return res.status( 404 ).send( 'User session data could not be retrieved.' );
			}
			debug( `Return ${actions.length} actions to the caller` );
			res.json({
				actions: groupBy( actions.map( d => {
					const out = d.data;
					out.sessiondataID = d._id;
					return out;
				}), grouping )
			});
		});

	function grouping( elem ) {
		return elem.id;
	}
});

app.post( '/retrieve_data', function onRetrieveData( req, res ) {
	debug( 'Should retrieve data...' );
	if ( req.body ) {
		let query = req.body.query;
		SessionData.find({ 'data.id': query.componentID }, function onFind( err, data ) {
			if ( err ) {
				return res.status( 404 ).send( err.message );
			}
			debug( 'Return found data...' );
			res.json( data );
		});
	}
});

app.post( '/create_cohort', passport.authenticate( 'jwt', { session: false }), function onCreateCohort( req, res ) {
	debug( 'POST request: ' + JSON.stringify( req.body ) );
	if ( req.body.title && req.body.namespaceID ) {
		var cohort = {
			title: req.body.title,
			namespace: req.body.namespaceID,
			startDate: req.body.startDate,
			endDate: req.body.endDate
		};
		debug( 'Cohort: ' + JSON.stringify( cohort ) );
		if ( req.body.students.length > 0 ) {
			User.find({ 'email': req.body.students.split( ',' ) }, function onFindUser( err, users ) {
				debug( 'Retrieve user credentials: ' + JSON.stringify( users ) );
				cohort.members = users;
				cohort = new Cohort( cohort );
				cohort.save( onSave );
				Namespace.findOne({ _id: req.body.namespaceID }, onNamespace );
				function onNamespace( err, namespace ) {
					if ( err ) {
						debug( 'Encountered an error when loading namespace for cohort: ' + err.message );
						return res.status( 404 ).send( err.message );
					}
					users.forEach( user => {
						user.enrolledNamespaces.push( namespace );
						user.save();
					});
				}
			});
		} else {
			cohort = new Cohort( cohort );
			cohort.save( onSave );
		}
	}

	function onSave( err ) {
		if ( err ) {
			debug( 'Encountered an error when saving cohort: ' + err.message );
			res.status( 401 ).send( err.message );
		} else {
			res.json({
				message: 'The cohort was successfully created.',
				successful: true
			});
		}
	}
});

app.get( '/get_cohorts', passport.authenticate( 'jwt', { session: false }), function onGetCohort( req, res ) {
	Cohort.find({ namespace: req.query.namespaceID }, function onFindCohort( err, cohorts ) {
		if ( err ) {
			return res.status( 404 ).send( 'No cohorts found.' );
		}
		async.map( cohorts, mapCohort, function onMapAsync( err, results ) {
			res.json({ message: 'ok', cohorts: results });
		});

		function mapCohort( cohort, done ) {
			User.find({ _id: { $in: cohort.members }}, onFindUser );
			function onFindUser( err, users ) {
				cohort = cohort.toObject();
				cohort.members = users.map( user => user.email );
				done( null, cohort );
			}
		}
	});
});

app.get( '/delete_cohort', passport.authenticate( 'jwt', { session: false }), function onDeleteCohort( req, res ) {
	Cohort.findOne({ _id: req.query._id }, function onFindCohort( err, cohort ) {
		if ( err || !cohort ) {
			debug( 'Encountered an error when deleting cohort: ' + err );
			return res.status( 404 ).send( 'Cohort does not exist.' );
		}
		User.find({ _id: { $in: cohort.members }}, onFindUsers );
		function onFindUsers( err, users ) {
			users.forEach( user => {
				const idx = user.enrolledNamespaces.indexOf( cohort.namespace );
				if ( idx !== -1 ) {
					user.enrolledNamespaces.splice( idx, 1 );
					user.save();
				}
			});
		}
		cohort.remove( function onRemoveCohort( err ) {
			if ( err ) {
				return res.status( 400 ).send( 'Cohort could not be removed' );
			}
			res.json({ message: 'Cohort successfully deleted.' });
		});
	});
});

app.post( '/update_cohort', passport.authenticate( 'jwt', { session: false }), function onUpdateCohort( req, res ) {
	const updatedCohort = req.body.cohort;
	debug( 'Updated cohort: '+ JSON.stringify( updatedCohort ) );
	Cohort
		.findOne({ _id: updatedCohort._id })
		.populate( 'members' )
		.exec( onFindCohort );

	function onFindCohort( err, cohort ) {
		if ( err ) {
			debug( 'Encountered an error when updating cohort: ' + err.message );
			return res.status( 404 ).send( err.message );
		}
		if ( !cohort ) {
			return res.status( 404 ).send( 'Cohort does not exist.' );
		}
		cohort.members.forEach( user => {
			const idx = user.enrolledNamespaces.indexOf( cohort.namespace );
			if ( idx !== -1 ) {
				user.enrolledNamespaces.splice( idx, 1 );
				user.save();
			}
		});
		let newProps = pick( updatedCohort, [ 'members', 'title', 'startDate', 'endDate' ]);
		if ( newProps.members.includes( ',' ) ) {
			newProps.members = newProps.members.split( ',' );
		}
		User.find({ email: newProps.members }, onFindUser );

		function onFindUser( err, users ) {
			if ( err ) {
				debug( 'Encountered an error: ' + err.message );
				return res.status( 400 ).send( err.message );
			}
			debug( 'Found %d users...', users.length );
			newProps.members = users;
			users.forEach( user => {
				user.enrolledNamespaces.push( cohort.namespace );
				user.save();
			});
			cohort.update( { $set: newProps }, onCohortUpdate );
		}
	}

	function onCohortUpdate( err ) {
		if ( err ) {
			return res.status( 400 ).send( err.message );
		}
		res.json({ message: 'Cohort successfully updated.' });
	}
});

app.get( '/get_files', passport.authenticate( 'jwt', { session: false }), function onRequest( req, res ) {
	if ( isString( req.query.namespaceName ) ) {
		debug( `Retrieve lessons for namespace ${req.query.namespaceName}...` );
		Namespace.findOne({ title: req.query.namespaceName }, onFindNamespace );
	} else {
		return res.status( 400 ).send( '`namespaceName` has to be a string.' );
	}
	function onFindNamespace( err, namespace ) {
		if ( err ) {
			return res.status( 404 ).send( 'Namespace query failed.' );
		}

		File.find({
			'namespace': namespace
		})
		.lean()
		.exec( function onExecute( err, files ) {
			if ( err ) {
				return res.status( 404 ).send( 'Files could not be retrieved.' );
			}
			const ids = files.map( x => x.user );
			User.find({
				'_id': { $in: ids }
			}, function onUsers( err, users ) {
				if ( !err ) {
					for ( let i = 0; i < files.length; i++ ) {
						for ( let j = 0; j < users.length; j++ ) {
							if ( users[ j ]._id.equals( ids[ i ] ) ) {
								files[ i ].name = users[ j ].name;
								files[ i ].email = users[ j ].email;
							}
						}
					}
				}
				debug( `Return ${files.length} files to the caller` );
				res.json({
					'files': files
				});
			});
		});
	}
});

app.get( '/get_user_files', passport.authenticate( 'jwt', { session: false }), function onRequest( req, res ) {
	if ( !isString( req.query.namespaceID ) ) {
		return res.status( 400 ).send( '`namespaceID` has to be a string.' );
	}
	File.find({
		'namespace': req.query.namespaceID,
		'user': req.user
	})
	.exec( function onExecute( err, files ) {
		if ( err ) {
			return res.status( 404 ).send( 'Files could not be retrieved.' );
		}
		res.json({
			'files': files
		});
	});
});

app.post( '/upload_file', fileUpload.single( 'file' ), passport.authenticate( 'jwt', { session: false }), function onUploadFile( req, res ) {
	const { namespaceName, lessonName } = req.body;
	let file;
	debug( 'Received a file: ' + JSON.stringify( req.file ) );

	Namespace.findOne({ title: namespaceName }, onFindNamespace );
	debug( `Store file for namespace ${namespaceName} and lesson ${lessonName}` );

	const fileMetaData = {
		user: req.user,
		title: req.file.originalname,
		filename: req.file.filename,
		path: req.file.path,
		type: req.file.mimetype
	};

	function onFindNamespace( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
			return res.status( 404 ).send( 'Namespace not found.' );
		}
		fileMetaData.namespace = namespace;
		if ( !lessonName ) {
			file = new File( fileMetaData );
			file.save( onSaveFile );
		} else {
			Lesson.findOne({ title: lessonName, namespace: namespace }, onFindLesson );
		}
	}

	function onFindLesson( err, lesson ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
			return res.status( 404 ).send( 'Lesson not found.' );
		}
		debug( 'Should save to database... ' );
		fileMetaData.lesson = lesson;
		file = new File( fileMetaData );
		file.save( onSaveFile );
	}

	function onSaveFile( err ) {
		if ( err ) {
			return res.status( 404 ).send( 'File could not be saved.' );
		}
		res.json({ message: 'File successfully saved.', filename: file.filename });
	}
});

app.post( '/upload_profile_pic', fileUpload.single( 'avatar' ), passport.authenticate( 'jwt', { session: false }), function onUploadFile( req, res ) {
	req.user.picture = req.file.filename;
	req.user.save( onSaveUser );
	function onSaveUser( err ) {
		if ( err ) {
			return res.status( 404 ).send( 'Profile picture could not be saved.' );
		}
		res.json({
			message: 'Profile picture successfully saved.',
			filename: req.file.filename
		});
	}
});

app.get( '/get_namespaces', passport.authenticate( 'jwt', { session: false }), function onGetNamespaces( req, res ) {
	Namespace.find({ owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespaces ) {
		if ( err ) {
			return res.status( 404 ).send( 'Namespaces not found.' );
		}

		async.map( namespaces, mapNamespace, function onMapAsync( err, results ) {
			debug( 'Results: '+JSON.stringify( results ) );
			res.json({ message: 'ok', namespaces: results });
		});

		function mapNamespace( ns, done ) {
			User.find({ _id: { $in: ns.owners }}, onFindUser );

			function onFindUser( err, users ) {
				ns = ns.toObject();
				ns.owners = users.map( user => user.email );
				done( null, ns );
			}
		}
	});
});

app.post( '/update_user_session', passport.authenticate( 'jwt', { session: false }), function onUpdateUserSession( req, res ) {
	debug( 'Should update the user session...' );
	const user = req.user;
	const { addedScore, elapsed, lessonID, progress } = req.body;
	const spentTime = user.spentTime + elapsed;
	const score = user.score + addedScore;
	const lessonData = copy( user.lessonData );
	if ( !lessonData[ lessonID ] ) {
		lessonData[ lessonID ] = {};
	}
	lessonData[ lessonID ].progress = progress;
	if ( lessonData[ lessonID ].spentTime ) {
		lessonData[ lessonID ].spentTime += elapsed;
	} else {
		lessonData[ lessonID ].spentTime = elapsed;
	}
	debug( 'New lesson data: '+ JSON.stringify( lessonData ) );
	User.update({ '_id': user._id }, {
		lessonData,
		score,
		spentTime
	}, onUpdate );

	function onUpdate( err, stats ) {
		if ( err ) {
			return debug( 'Encountered an error:' + err.message );
		}
		debug( 'Result: ' + JSON.stringify( stats ) );
		res.json({
			score,
			spentTime
		});
	}
});

// Only listen to requests when directly run and not in tests:
if ( require.main === module ) {
	server.listen( 17777, function onStart() {
		console.log( 'Express running' ); // eslint-disable-line no-console
	});
}


// EXPORTS //

module.exports = app;
