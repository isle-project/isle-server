'use strict';

// MODULES //

var fs = require( 'fs-extra' );
var ncp = require('ncp').ncp;
var path = require( 'path' );
var express = require( 'express' );
var bodyParser = require( 'body-parser' );
var mongoose = require( 'mongoose' );
var Schema = mongoose.Schema;
var jwt = require( 'jsonwebtoken' );
var async = require( 'async' );
var _ = require( 'lodash' );
var admZip = require( 'adm-zip' );
var multer  = require( 'multer' );
var bcrypt = require( 'bcrypt' );
var debug = require( 'debug' )( 'server' );
var swot = require( 'swot-js' )();
var passport = require( 'passport' );
var passportJWT = require( 'passport-jwt' );
var cors = require( 'cors' );
var pick = require( '@stdlib/utils/pick' );
var groupBy = require( '@stdlib/utils/group-by' );
var isObject = require( '@stdlib/assert/is-object' );
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var User = require( './user.js' );
var Cohort = require( './cohort.js' );
var File = require( './file.js' );
var Lesson = require( './lesson.js' );
var Namespace = require( './namespace.js' );
var Session = require( './session.js' );
var SessionData = require( './session_data.js' );
var Mailer = require( './mailer.js' );
var socketHandler = require( './sockets/handler.js' );
var serveStatic = require( './serve_static.js' );
var config = require( './config.json' );
var namespacesDirectory = require( './config.json' ).namespacesDirectory;
var serverHostName = require( './config.json' ).server;
var tokens = require( './../credentials/tokens.json' );


// FUNCTIONS //

function createNamespaceDirectory( dir, clbk ) {
	let dirpath = path.join( namespacesDirectory, dir );
	dirpath = path.resolve( __dirname, dirpath );
	fs.mkdir( dirpath, clbk );
}

function deleteNamespaceDirectory( dir, clbk ) {
	let dirpath = path.join( namespacesDirectory, dir );
	dirpath = path.resolve( __dirname, dirpath );
	console.log( dirpath )
	fs.rmdir( dirpath, clbk );
}

function deleteLessonDirectory( dir, clbk ) {
	let dirpath = path.join( namespacesDirectory, dir );
	dirpath = path.resolve( __dirname, dirpath );
	fs.remove( dirpath, clbk );
}

function renameNamespaceDirectory( oldDir, newDir, clbk ) {
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
} // end FUNCTION check()


// VARIABLES //

var connStr = 'mongodb://localhost/isle-db';
mongoose.connect( connStr, function( err ) {
	if ( err ) {
		throw err;
	}
	debug( 'Successfully connected to MongoDB' );
});
var mailer = new Mailer();
var lessonUpload = multer({
	dest: 'public'
});

var storage = multer.diskStorage({
  destination: function( req, file, cb ) {
    cb( null, 'media' )
  },
  filename: function( req, file, cb ) {
    cb( null, file.originalname + '_' + Date.now() )
  }
})
var fileUpload = multer({
	storage: storage
});


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

app.use( cors() );

app.use( serveStatic( 'public' ) );

var jwtOptions = {
	jwtFromRequest: ExtractJwt.fromAuthHeader(),
	secretOrKey: 'tasmanianDevil'
};

var strategy = new JwtStrategy( jwtOptions, function( jwt_payload, next ) {
	debug( 'payload received: ', jwt_payload );
	User.findOne({ '_id': jwt_payload.id }, function ( err, user ) {
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
	extended: true
}) );

// Parse application/json:
app.use( bodyParser.json() );

app.get( '/', function( req, res ) {
	res.redirect( '/dashboard/' );
});

app.post( '/credentials', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	if ( req.body.id ) {
			User.findOne({ '_id': req.body.id }, function ( err, user ) {
				debug( 'Retrieve user credentials...' );
				res.json({
					id: req.body.id,
					email: user.email,
					name: user.name,
					organization: user.organization,
					writeAccess: user.writeAccess
				});
			});
	}
});

app.get( '/ping', function( req, res ) {
	debug( 'Send live status...' );
	res.send( 'live' );
});

app.get( '/get_lesson_info', function( req, res ) {
	debug( 'LessonID GET Request...' );
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName }, function( err, namespace ) {
		if ( err ) {
			return debug( 'Encountered an error while retrieving namespace: ' + err.message );
		}
		Lesson.findOne({ namespace: namespace, title: lessonName }, function( err, lesson ) {
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

app.post( '/get_user_rights', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.body;
	debug( 'Should retrieve user rights....' );
	Namespace.findOne({ title: namespaceName }, function( err, namespace ) {
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
			debug( namespace.owners )
			debug( 'User: ' +  req.user );
			debug( req.user )
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
				startDate: { "$lt": new Date() },
				endDate: { "$gte": new Date() }
		}, function( err, cohort ) {
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

app.get( '/has_write_access', function( req, res ) {
	User.findOne({ email: req.query.email }, function( err, user ) {
		if ( err ) {
			return res.status( 404 ).send( 'Unknown user.' );
		}
		res.json({
			message: `The user ${ user.writeAccess ? 'has' : 'has no'} write access`,
			writeAccess: user.writeAccess
		});
	});
});

app.get( '/set_write_access',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { token } = req.query;
	const user = req.user;
	debug( 'Should set user write access...' );
	if ( token === tokens.writeAccess ) {
		user.writeAccess = true;
		user.save( function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'User could not be updated.' );
			}
			res.json({
				message: 'User successfully updated.',
			});
		});
	} else {
		return res.status( 401 ).send( 'Incorrect write-access token.' );
	}
});

app.post( '/send_mail', function( req, res ) {
	mailer.send( req.body, function onDone( error, response ) {
		if ( !error ) {
			res.json( response );
		} else {
			debug( 'Mail could not be sent' );
			res.json( error );
		}
	});
});

function unzipLessonFolder( namespaceName, lessonName, filename ) {
	debug( 'Unzipping lesson file...' );
	let filePath = path.resolve( __dirname, namespacesDirectory, filename );
	let zip = new admZip( filePath );
	let dirpath = path.join( namespacesDirectory, namespaceName, lessonName );
	dirpath = path.resolve( __dirname, dirpath );
	zip.extractAllTo( dirpath, true );
	let lessonURL = serverHostName + '/' + namespaceName + '/' + lessonName + '/index.html';
	fs.unlink( filePath );
}

app.get( '/get_lesson', function( req, res ) {
	Namespace.findOne({ title: req.query.namespace }, function( err, namespace ) {
		if ( err ) {
			return res.status( 404 ).send( 'Namespace query failed.' );
		}
		Lesson.findOne({ namespace: namespace, title: req.query.lessonName }, function( err, lesson ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson query failed.' );
			}
			res.json({ message: "ok", lesson: lesson });
		});
	});
});

app.get( '/get_public_lessons', function( req, res ) {
	Lesson.find({ public: true }, function( err, lessons ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson query failed.' );
		}
		async.map( lessons, function( lesson, clbk ) {
			Namespace.findOne({ _id: lesson.namespace }, function( err, res ) {
				lesson = lesson.toObject();
				// Replace ID by namespace title:
				lesson.namespace = res.title;
				clbk( null, lesson );
			});
		}, function( err, results ) {
			res.json({ message: "ok", lessons: results });
		});
	});
});

app.get( '/get_lessons', function( req, res ) {
	if ( req.query.namespaceName ) {
		debug( 'Retrieve lessons...' );
		Namespace.findOne({ title: req.query.namespaceName }, function( err, namespace ) {
			if ( err ) {
				return res.status( 404 ).send( 'Namespace query failed.' );
			}
			Lesson.find({ namespace: namespace }, function( err, lessons ) {
				if ( err ) {
					return res.status( 404 ).send( 'Lesson query failed.' );
				}
				lessons = lessons.map( lesson => {
					lesson = lesson.toObject();
					// Replace ID by namespace title:
					lesson.namespace = req.query.namespaceName;
					return lesson;
				});
				res.json({ message: "ok", lessons: lessons });
			});
		});
	} else {
		return res.status( 400 ).send( 'Query string must contain `namespaceName`.' );
	}
});

app.get( '/copy_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { source, target, sourceName, targetName } = req.query;
	debug( 'Should copy lesson....' );
	Namespace.findOne({ title: target, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
		}
		else {
			debug( 'Create lesson object: ' );
			let lesson = new Lesson({
				namespace: namespace,
				title: targetName,
				public: false
			});
			debug( 'Save lesson to database...' );
			let sourceDir = path.join( namespacesDirectory, source, sourceName );
			sourceDir = path.resolve( __dirname, sourceDir );
			let targetDir = path.join( namespacesDirectory, target, targetName );
			targetDir = path.resolve( __dirname, targetDir );
			ncp( sourceDir, targetDir, function (err) {
				if ( err ) {
					debug( 'Encountered an error: ' + err );
					return res.status( 405 ).send( 'Lesson could not be copied' );
				}
				lesson.save( function( err ) {
					if ( err ) {
						return res.status( 409 ).send( 'Lesson could not be saved to database' );
					}
					res.json({
						message: 'The lesson has been successfully copied.'
					});
				});
			});
		}
	});
});

app.post( '/create_lesson', lessonUpload.single( 'zipped' ), passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.body;
	debug( 'Should create lesson....' );
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
		}
		else {
			debug( 'Create lesson object: ' );
			Lesson.findOne({
				namespace: namespace,
				title: lessonName
			}, function ( err, lesson ) {
				if ( !lesson ) {
					lesson = new Lesson({
						namespace: namespace,
						title: lessonName
					});
					debug( 'Save lesson to database...' );
					lesson.save( function( err ) {
						if ( err ) {
							return res.status( 409 ).send( 'Lesson could not be saved to database' );
						}
						unzipLessonFolder( namespaceName, lessonName, req.file.filename );
						res.json({
							message: 'The lesson has been successfully uploaded.'
						});
					});
				} else {
					unzipLessonFolder( namespaceName, lessonName, req.file.filename );
					res.json({
						message: 'The lesson has been successfully uploaded.'
					});
				}
			});
		}
	});
});

app.get( '/delete_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		deleteLessonDirectory( path.join( namespaceName, lessonName ), ( err ) => {
			if ( err ) {
				return res.status( 403 ).send( err.message );
			}
			Lesson.remove({ namespace: namespace, title: lessonName }, function( err, lesson ) {
				if ( err ) {
					return res.status( 404 ).send( 'Lesson delete failed.' );
				}
				res.json({
					message: 'The lesson has been successfully deleted.'
				});
			});
		});
	});
});

app.get( '/update_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName, newTitle, newDescription } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			return debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { title: newTitle, description: newDescription }, function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson has been successfully updated.'
			});
		});
	});
});

app.get( '/activate_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { active: true }, function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson has been successfully activated.'
			});
		});
	});
});

app.get( '/deactivate_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { active: false }, function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson has been successfully deactivated.'
			});
		});
	});
});

app.get( '/show_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { public: true }, function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson is now visible inside the public gallery.'
			});
		});
	});
});

app.get( '/hide_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.update({ namespace: namespace, title: lessonName }, { public: false }, function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson update failed.' );
			}
			res.json({
				message: 'The lesson is now hidden from the public gallery.'
			});
		});
	});
});

app.post( '/create_namespace', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	if ( req.body.title && req.body.description && req.body.owners ) {
		User.find({ 'email': req.body.owners.split( ',' ) }, function ( err, users ) {
			debug( 'Retrieve user credentials: ' + JSON.stringify( users ) );
			var namespace = new Namespace({
				owners: users,
				title: req.body.title,
				description: req.body.description
			});
			namespace.save( function( err, namespace ) {
				if ( err ) {
					debug( 'Encountered an error when saving namespace: ' + err.message );
					res.json({
						message: 'The namespace could not be created as it already exists.',
						successful: false
					});
				} else {
					createNamespaceDirectory( namespace.title, ( err ) => {
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
					});
				}
			});
		});
	}
});

app.get( '/get_namespaces', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	Namespace.find({ owners: { $in: [ req.user ] } }, function( err, namespaces ) {
		if ( err ) {
			return res.status( 404 ).send( 'Namespaces not found.' );
		}

		async.map( namespaces, mapNamespace, function( err, results ) {
			console.log( results );
			res.json({ message: "ok", namespaces: results });
		});

		function mapNamespace( ns, done ) {
			User.find({ _id: { $in: ns.owners }}, function( err, users ) {
				ns = ns.toObject();
				ns.owners = users.map( user => user.email );
				done( null, ns );
			});
		}
	});
});

app.get( '/forgot_password', function( req, res ) {
	debug( 'Forgot Password GET Request...' );
	User.findOne({ email: req.query.email}, function( err, user ) {
		if ( err ) {
			return res.status( 404 ).send( 'User with the supplied email address not found.' );
		}
		const mail = {
			'from': 'support@isledocs.com',
			'subject': 'New Password Requested',
			'to': req.query.email,
			'html': `
				<div>Dear ${user.name}, you have indicated that you have forgotten your password. You can choose a new password by clicking this link:
				</div>
				<a href="${serverHostName}/dashboard/#/new-password/?token=${user._id}">Link</a>
			`
		};
		debug( 'Mail: ' + JSON.stringify( mail ) );
		mailer.send( mail, function onDone( error, response ) {
			if ( !error ) {
				res.json( response );
			} else {
				debug( 'Mail could not be sent: '+error.message );
				res.json( error );
			}
		});
	});
});

app.get( '/delete_namespace', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	Namespace.findOne({ _id: req.query.id }, function( err, namespace ) {
		if ( err || !namespace ) {
			debug( 'Encountered an error when deleting namespace: ' + err );
			return res.status( 404 ).send( 'Namespace does not exist.' );
		}
		deleteNamespaceDirectory( namespace.title, ( err ) => {
			if ( err ) {
				return res.status( 403 ).send( err.message );
			}
			namespace.remove( function( err ) {
				if ( err ) {
					return res.status( 400 ).send( 'Namespace could not be removed' );
				}
				res.json({ message: 'Namespace successfully deleted.' });
			});
		});
	});
});

app.post( '/update_namespace', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	let ns = req.body.ns;
	console.log( ns );
	Namespace.findOne({ _id: ns._id }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error when updating namespace: ' + err.message );
			return res.status( 404 ).send( err.message );
		}
		if ( !namespace ) {
			return res.status( 404 ).send( 'Namespace does not exist.' );
		}
		let newProps = pick( ns, [ 'owners', 'title', 'description' ]);
		if ( newProps.owners.includes( ',' ) ) {
			newProps.owners = newProps.owners.split( ',' );
		}
		User.find({ email: newProps.owners }, function( err, users ) {
			if ( err ) {
				debug( 'Encountered an error: ' + err.message );
				return res.status( 400 ).send( err.message );
			}
			debug( 'Found %d users...', users.length );
			newProps.owners = users;
			namespace.update( { $set: newProps }, function( err ) {
				if ( err ) {
					return res.status( 400 ).send( err.message );
				}
				renameNamespaceDirectory( namespace.title, ns.title, ( err ) => {
					if ( err ) {
						return res.status( 403 ).send( err.message );
					}
					res.json({ message: 'Namespace successfully updated.' });
				});
			});
		});
	});
});

app.post( '/create_user', function( req, res ) {
	if ( req.body.email && req.body.password ) {
		var user = new User({
			email: req.body.email,
			name: req.body.name,
			password: req.body.password,
			organization: check( req.body.email ),
			role: 'user'
		});

		user.save( function( err ) {
			if ( err ) {
				res.json({
					message: 'Operation was not successful. The user already exists.',
					successful: false
				});
			} else {
				res.json({
					message: 'The user was successfully created!',
					successful: true
				});
			}
		});
	}
});

app.post( '/update_user', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
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
	user.save( function( err ) {
		if ( err ) {
			return res.status( 404 ).send( 'User could not be updated.' );
		}
		res.json({
			message: 'User successfully updated.',
		});
	});
});

app.post( '/update_user_password', function( req, res ) {
	debug( 'Should update user password...' );
	var newPassword = req.body.newPassword;
	var id = req.body.id;
	console.log( id );
	User.findOne({ _id: id }, function( err, user ) {
		if ( err || !user ) {
			return res.status( 404 ).send( 'User does not exist.' );
		}
		user.password = newPassword;
		user.save( function( err ) {
			if ( err ) {
				return res.status( 404 ).send( 'Password could not be updated.' );
			}
			res.json({
				message: 'User password successfully updated.',
			});
		});
	});
});

app.post( '/login', function( req, res ) {
	var password;
	var email;

	if ( req.body.email && req.body.password ) {
		email = req.body.email;
		password = req.body.password;
		User.findOne({ 'email': email }, function ( err, user ) {
			if ( !user ) {
				res.status( 401 ).json({
					message: 'No user with the given email address found.',
					type: 'no_user'
				});
			} else {
				user.comparePassword( password, function ( err, isMatch ) {
					if ( isMatch === true ) {
						// Identify users by their ID:
						var payload = { id: user.id };
						var token = jwt.sign( payload, jwtOptions.secretOrKey );
						res.json({ message: "ok", token: token, id: user.id });
					} else {
						res.status( 401 ).json({
							message: 'Password is not correct.',
							type: 'incorrect_password'
						});
					}
				});
			}
		});
	} else {
		debug( 'Received invalid POST request at /login' );
		res.status( 400 ).json({
			message: 'Invalid request.',
			type: 'invalid_request'
		});
	}
});

app.post( '/store_session_element', function( req, res ) {
	debug( 'Should store session element...' );
	if ( req.body.stringified ) {
		debug( 'Session data: ' + req.body.stringified );
		var formData = JSON.parse( req.body.stringified );
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
			sessionData.save( function( err ) {
				if ( err ) {
					return res.status( 404 ).send( 'Session data could not be saved.' );
				}
				res.json({
					message: 'User action successfully saved.',
				});
			});
		}
	}
});

app.get( '/delete_session_element', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	debug( 'Should delete session element...' );
	SessionData.findById( req.query._id, function( err, sessionData ) {
		if ( err ) {
			return res.status( 404 ).send( 'Session data not found.' );
		}
		Lesson.findById( sessionData.lesson, function( err, lesson ) {
			Namespace.findOne({ _id: lesson.namespace, owners: { $in: [ req.user ] } }, function( err, namespace ) {
				if ( err ) {
					return res.status( 403 ).send( 'Access forbidden due to missing owner credentials.' );
				}
				if ( namespace ) {
					sessionData.remove( function( err ) {
						if ( err ) {
							return res.status( 400 ).send( 'SessionData could not be removed.' );
						}
						res.json({ message: 'SessionData successfully deleted.' });
					});
				}
			});
		});
	});
});

app.post( '/get_user_actions', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	SessionData
		.find({ type: 'action', lesson: req.body.lessonID }, null )
		.sort( '-data.absoluteTime' )
		.limit( 5000 )
		.exec( function( err, actions ) {
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

app.post( '/get_current_user_actions', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	SessionData
		.find({
			type: 'action',
			lesson: req.body.lessonID,
			data: {
				email: req.user.email
			}
		}, null )
		.sort( '-data.absoluteTime' )
		.exec( function( err, actions ) {
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

app.post( '/retrieve_data', function( req, res ) {
	debug( 'Parse user and query: ' );
	let user = JSON.parse( req.body.user );
	let query = JSON.parse( req.body.query );
	SessionData.find({ 'data.id': query.componentID }, function( err, data ) {
		if ( err ) {
			return res.status( 404 ).send( err.message );
		}
		debug( 'Return found data...' );
		res.json( data );
	});
});

app.post( '/delete_session_data', function( req, res ) {
	debug( 'Parse user and query: ' );
	let user = JSON.parse( req.body.user );
	let query = JSON.parse( req.body.query );
	SessionData.remove({ 'data.id': query.componentID }, function( err ) {
		if ( err ) {
			return res.status( 404 ).send( err.message );
		}
		res.json({ message: 'ok' });
	});
});

app.post( '/create_cohort', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
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
			User.find({ 'email': req.body.students.split( ',' ) }, function ( err, users ) {
				debug( 'Retrieve user credentials: ' + JSON.stringify( users ) );
				cohort.members = users;
				cohort = new Cohort( cohort );
				cohort.save( onSave );
			});
		} else {
			cohort = new Cohort( cohort );
			cohort.save( onSave );
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
	}
});

app.get( '/get_cohorts', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	Cohort.find({ namespace: req.query.namespaceID }, function( err, cohorts ) {
		if ( err ) {
			return res.status( 404 ).send( 'No cohorts found.' );
		}

		async.map( cohorts, mapCohort, function( err, results ) {
			console.log( results );
			res.json({ message: "ok", cohorts: results });
		});

		function mapCohort( cohort, done ) {
			User.find({ _id: { $in: cohort.members }}, function( err, users ) {
				cohort = cohort.toObject();
				cohort.members = users.map( user => user.email );
				done( null, cohort );
			});
		}
	});
});

app.get( '/delete_cohort', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	Cohort.findOne({ _id: req.query._id }, function( err, cohort ) {
		if ( err || !cohort ) {
			debug( 'Encountered an error when deleting cohort: ' + err );
			return res.status( 404 ).send( 'Cohort does not exist.' );
		}
		cohort.remove( function( err ) {
			if ( err ) {
				return res.status( 400 ).send( 'Cohort could not be removed' );
			}
			res.json({ message: 'Cohort successfully deleted.' });
		});
	});
});

app.post( '/update_cohort', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	let updatedCohort = req.body.cohort;
	console.log( updatedCohort );
	Cohort.findOne({ _id: updatedCohort._id }, function( err, cohort ) {
		if ( err ) {
			debug( 'Encountered an error when updating cohort: ' + err.message );
			return res.status( 404 ).send( err.message );
		}
		if ( !cohort ) {
			return res.status( 404 ).send( 'Cohort does not exist.' );
		}
		let newProps = pick( updatedCohort, [ 'members', 'title', 'startDate', 'endDate' ]);
		if ( newProps.members.includes( ',' ) ) {
			newProps.members = newProps.members.split( ',' );
		}
		User.find({ email: newProps.members }, function( err, users ) {
			if ( err ) {
				debug( 'Encountered an error: ' + err.message );
				return res.status( 400 ).send( err.message );
			}
			debug( 'Found %d users...', users.length );
			newProps.members = users;
			cohort.update( { $set: newProps }, function( err ) {
				if ( err ) {
					return res.status( 400 ).send( err.message );
				}
				res.json({ message: 'Cohort successfully updated.' });
			});
		});
	});
});

app.post( '/upload_file', fileUpload.single( 'file' ), passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.body;
	console.log( req.body );
	debug( 'Received a file: ' + JSON.stringify( req.file ) );
	Namespace.findOne({ title: namespaceName }, function( err, namespace ) {
		if ( err ) {
			return debug( 'Encountered an error: ' + err.message );
		}
		Lesson.findOne({ title: lessonName }, function( err, lesson ) {
			if ( err ) {
				return debug( 'Encountered an error: ' + err.message );
			}
			debug( 'Should save to database... ' );
			let file = new File({
				namespace: namespace,
				lesson: lesson,
				user: req.user,
				title: req.file.originalname,
				path: req.file.path
			});
			file.save( function( err ) {
				if ( err ) {
					return res.status( 404 ).send( 'File could not be saved.' );
				}
				res.json({ message: 'File successfully saved.' });
			});
		});
	});
});

server.listen( 17777, function() {
	console.log( 'Express running' );
});
