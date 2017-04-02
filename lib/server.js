'use strict';

// MODULES //

var fs = require( 'fs' );
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
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var User = require( './user.js' );
var Lesson = require( './lesson.js' );
var Namespace = require( './namespace.js' );
var SessionData = require( './session_data.js' );
var Mailer = require( './mailer.js' );
var namespacesDirectory = require( './config.json' ).namespacesDirectory;


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

var connStr = 'mongodb://localhost/mongoose-bcrypt-test';
mongoose.connect( connStr, function( err ) {
	if ( err ) {
		throw err;
	}
	debug( 'Successfully connected to MongoDB' );
});
var mailer = new Mailer();
var upload = multer({
	dest: 'public'
});


// MAIN //

var app = express();

app.use( cors() );

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
	res.json({ message: 'Express is up!' });
});

app.post( '/credentials', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	if ( req.body.id ) {
			User.findOne({ '_id': req.body.id }, function ( err, user ) {
				debug( 'Retrieve user credentials...' );
				res.json({
					id: req.body.id,
					email: user.email,
					name: user.name,
					organization: user.organization
				});
			});
	}
});

app.get( '/ping', function( req, res ) {
	res.send( 'live' );
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

app.get( '/get_lessons', function( req, res ) {
	if ( req.query.namespaceName ) {
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

app.post( '/create_lesson',  upload.single( 'zipped' ), passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.body;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error: ' + err.message );
		}
		else {
			debug( 'Create lesson object: ' );
			let lesson = new Lesson({
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
		}
	});
});

app.get( '/delete_lesson',  passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	const { namespaceName, lessonName } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function( err, namespace ) {
		if ( err ) {
			debug( 'Encountered an error in namespace query: ' + err.message );
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
	User.findOne({ email: req.query.email}, function( err, user ) {
		mailer.send({
			'from': 'support@isledocs.com',
			'subject': 'New Password Requested',
			'to': req.query.email,
			'html': `
				<div>Dear ${user.name}, you have indicated that you have forgotten your password. You can choose a new password by clicking this link:
				</div>
				<a href="http://localhost:3001/new-password#${user._id}">Link</a>
			`
		}, function onDone( error, response ) {
			if ( !error ) {
				res.json( response );
			} else {
				debug( 'Mail could not be sent' );
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

app.listen( 3000, function() {
	console.log( 'Express running' );
});
