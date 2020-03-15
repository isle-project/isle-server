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

const fs = require( 'fs-extra' );
const ncp = require('ncp').ncp;
const path = require( 'path' );
const join = require( 'path' ).join;
const resolve = require( 'path' ).resolve;
const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const jwt = require( 'jsonwebtoken' );
const async = require( 'async' );
const multer = require( 'multer' );
const debug = require( 'debug' )( 'server' );
const swot = require( 'swot-simple' );
const rfs = require( 'rotating-file-stream' );
const morgan = require( 'morgan' );
const passport = require( 'passport' );
const passportJWT = require( 'passport-jwt' );
const cors = require( 'cors' );
const isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
const exists = require( '@stdlib/fs/exists' );
const contains = require( '@stdlib/assert/contains' );
const pick = require( '@stdlib/utils/pick' );
const groupBy = require( '@stdlib/utils/group-by' );
const objectKeys = require( '@stdlib/utils/keys' );
const copy = require( '@stdlib/utils/copy' );
const isObject = require( '@stdlib/assert/is-object' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const isEmptyObject = require( '@stdlib/assert/is-empty-object' );
const isNull = require( '@stdlib/assert/is-null' );
const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;
const User = require( './models/user.js' );
const Cohort = require( './models/cohort.js' );
const File = require( './models/file.js' );
const Lesson = require( './models/lesson.js' );
const Namespace = require( './models/namespace.js' );
const Session = require( './models/session.js' ); // eslint-disable-line
const SessionData = require( './models/session_data.js' );
const SketchpadUserData = require( './models/sketchpad_user_data.js' );
const SketchpadOwnerData = require( './models/sketchpad_owner_data.js' );
const mailer = require( './mailer' );
const socketHandler = require( './sockets/handler.js' );
const config = require( './../etc/config.json' );
const namespacesDirectory = config.namespacesDirectory;
const serverHostName = config.server;
const tokens = require( './../credentials/tokens.json' );
const badges = require( './badge_check/badges.json' );
const unzipLessonFolder = require( './helpers/unzip_lesson_folder.js' );
const badgeCheck = require( './badge_check' );
const isOwner = require( './helpers/is_owner.js' );
const ErrorStatus = require( './helpers/error.js' );
require( './connect_mongoose.js' );


// FUNCTIONS //

function createNamespaceDirectory( dir ) {
	let dirpath = join( namespacesDirectory, dir );
	dirpath = resolve( __dirname, dirpath );
	debug( 'Create namespace directory: '+dirpath );
	return fs.mkdir( dirpath );
}

function deleteNamespaceDirectory( dir ) {
	let dirpath = join( namespacesDirectory, dir );
	dirpath = resolve( __dirname, dirpath );
	debug( 'Remove namespace directory: '+dirpath );
	return fs.rmdir( dirpath );
}

function renameDirectory( oldDir, newDir, clbk ) {
	let oldDirPath = join( namespacesDirectory, oldDir );
	let newDirPath = join( namespacesDirectory, newDir );
	oldDirPath = resolve( __dirname, oldDirPath );
	newDirPath = resolve( __dirname, newDirPath );
	fs.rename( oldDirPath, newDirPath, clbk );
}

function check( str ) {
	const name = swot.getInstitutionName( str );
	return name || 'Other';
}

function wrapAsync( fn ) {
	return ( req, res, next ) => {
		// `.catch()` any errors and pass them along to the `next()` middleware in the chain
		fn( req, res, next ).catch( next );
	};
}


// VARIABLES //

const lessonUpload = multer({
	dest: 'public',
	limits: {
		fieldNameSize: 100,
		fileSize: 30 * 1024 * 1024, // 30MB
		files: 99
	}
});

const storage = multer.diskStorage({
	destination: function onDestination( req, file, cb ) {
		const body = req.body;
		if ( body.owner === 'true' && body.namespaceName ) {
			const dirname = 'media';
			const dirpath = resolve( __dirname, './../media' );
			exists( dirpath, ( bool ) => {
				if ( bool ) {
					return cb( null, dirname );
				}
				debug( `Create ${dirpath} directory...` );
				fs.mkdir( dirpath, () => {
					cb( null, dirname );
				});
			});
		}
		else if ( file.fieldname === 'avatar' ) {
			return cb( null, 'media/avatar' );
		}
		else if ( file.fieldname === 'thumbnail' ) {
			return cb( null, 'media/thumbnail' );
		} else {
			return cb( null, 'media' );
		}
	},
	filename: function onFilename( req, file, cb ) {
		const body = req.body;
		if ( body.owner === 'true' ) {
			return cb( null, body.namespaceName+'_'+file.originalname );
		}
		if ( file.fieldname === 'avatar' || file.fieldname === 'thumbnail' ) {
			return cb( null, file.originalname );
		}
		const ext = path.extname( file.originalname );
		const base = path.basename( file.originalname, ext );
		cb( null, base + '_' + Date.now() + ext );
	}
});
const fileUpload = multer({
	storage: storage
});
const MAX_NUM_ACTIONS = 50000;


// MAIN //

const app = express();

let server;
if ( config[ 'key' ] && config[ 'certificate' ] ) {
	const privateKey = fs.readFileSync( config[ 'key' ] );
	const certificate = fs.readFileSync( config[ 'certificate' ] );
	server = require( 'https' ).createServer({
		key: privateKey,
		cert: certificate
	}, app );
} else {
	server = require( 'http' ).createServer( app );
}

const io = require( 'socket.io' )( server );
socketHandler( io );

const errorLogStream = rfs.createStream( 'errors.log', {
	interval: '30d', // Monthly interval for error logging...
	maxSize: '10M',
	path: resolve( __dirname, './../logs' )
});
errorLogStream.on( 'error', console.log );
errorLogStream.on( 'warning', console.log );

const accessLogStream = rfs.createStream( 'access.log', {
	interval: '30d', // Monthly interval for error logging...
	maxSize: '100M',
	path: resolve( __dirname, './../logs' )
});
accessLogStream.on( 'error', console.log );
accessLogStream.on( 'warning', console.log );

app.use( morgan( 'common', {
	stream: accessLogStream
}) );

app.use( cors({
	'origin': '*',
	'methods': 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
	'preflightContinue': false,
	'optionsSuccessStatus': 204,
	'allowedHeaders': [ 'Range', 'Authorization', 'Content-Type', 'If-Modified-Since' ],
	'exposedHeaders': [ 'Content-Range', 'Content-Encoding', 'Content-Length', 'Accept-Ranges' ],
	'credentials': true
}) );

app.use( express.static( 'public' ) );

app.use( express.static( 'logs' ) );

app.use( express.static( 'media' ) );

const jwtOptions = {
	jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme( 'jwt' ),
	secretOrKey: tokens.jwtKey
};

const strategy = new JwtStrategy( jwtOptions, function onPayloadReceived( jwtPayload, next ) {
	debug( 'Payload received: ', jwtPayload );
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

app.get( '/user_update_check', passport.authenticate( 'jwt', { session: false }), function onUserCheck( req, res ) {
	const { id, updatedAt } = req.query;
	User.findOne({ '_id': id }, ( err, user ) => {
		if ( err ) {
			return res.status( 404 ).send( 'Unknown user.' );
		}
		const hasMostRecent = updatedAt === user.updatedAt.toISOString();
		res.json({
			message: `Most recent user data ${ hasMostRecent ? 'has' : 'has not'} already been downloaded.`,
			hasMostRecent: hasMostRecent
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

app.post( '/sanitize_user', passport.authenticate( 'jwt', { session: false }), function onSanitizeUser( req, res ) {
	if ( !isValidObjectId( req.body.id ) ) {
		return res.status( 400 ).send( '`id` has to be a valid ObjectID.' );
	}
	User
		.findOne({ '_id': req.body.id })
		.populate( 'enrolledNamespaces' )
		.populate( 'ownedNamespaces' )
		.exec( function onFindUser( err, user ) {
			const ownedNamespaces = user.ownedNamespaces;
			const newOwnedNamespaces = [];
			let ids = new Set();
			for ( let i = 0; i < ownedNamespaces.length; i++ ) {
				if ( !ids.has( ownedNamespaces[ i ]._id ) ) {
					ids.add( ownedNamespaces[ i ]._id );
					newOwnedNamespaces.push( ownedNamespaces[ i ] );
				}
			}
			const enrolledNamespaces = user.enrolledNamespaces;
			const newEnrolledNamespaces = [];
			ids = new Set();
			for ( let i = 0; i < enrolledNamespaces.length; i++ ) {
				if ( !ids.has( enrolledNamespaces[ i ]._id ) ) {
					ids.add( enrolledNamespaces[ i ]._id );
					newEnrolledNamespaces.push( enrolledNamespaces[ i ] );
				}
			}
			const newProps = {};
			if ( newEnrolledNamespaces.length !== enrolledNamespaces.length ) {
				newProps.enrolledNamespaces = newEnrolledNamespaces;
			}
			if ( newOwnedNamespaces.length !== ownedNamespaces.length ) {
				newProps.ownedNamespaces = newOwnedNamespaces;
			}
			if ( !isEmptyObject( newProps ) ) {
				user.update( { $set: newProps }, function onUserUpdate( err ) {
					if ( err ) {
						return res.status( 400 ).send( err.message );
					}
					res.json({ message: 'User successfully sanitized.' });
				});
			}
		});
});

app.get( '/ping', function onPing( req, res ) {
	debug( 'Send live status...' );
	res.send( 'live' );
});

app.post( '/create_user', wrapAsync( async function onCreateUser( req, res ) {
	if ( !req.body.email || !req.body.password ) {
		throw new ErrorStatus( 403, 'Password and email address are required' );
	}
	const user = new User({
		email: req.body.email,
		name: req.body.name,
		password: req.body.password,
		organization: check( req.body.email ),
		role: 'user'
	});
	await user.save();
	debug( 'Successfully created user: %s', req.body.email );
	res.json({
		message: 'The user was successfully created!'
	});
}));

app.get( '/forgot_password', wrapAsync( async function onForgotPassword( req, res ) {
	debug( 'Forgot Password GET Request...' );
	const user = await User.findOne({ email: req.query.email });
	if ( !user ) {
		throw new ErrorStatus( 404, 'User with the supplied email address not found.' );
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
			throw new ErrorStatus( 503, 'Email service currently not available' );
		}
	});
}));

app.get( '/has_write_access', wrapAsync( async function onHasWriteAccess( req, res ) {
	const user = await User.findOne({ email: req.query.email });
	res.json({
		message: `The user ${ user.writeAccess ? 'has' : 'has no'} write access`,
		writeAccess: user.writeAccess
	});
}));

app.get( '/get_lesson_info', wrapAsync( async function onGetLessonInfo( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({ title: namespaceName });
		const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
		if ( !isObject( lesson ) ) {
			return res.status( 410 ).send( 'Lesson was not found.' );
		}
		const info = {
			lessonID: lesson._id,
			namespaceID: namespace._id,
			active: lesson.active
		};
		debug( 'Send lesson info: ' + JSON.stringify( info ) );
		res.json( info );
	})
);

app.get( '/get_lesson', wrapAsync( async function onGetLesson( req, res ) {
		if ( !isString( req.query.namespaceName ) ) {
			return res.status( 400 ).send( '`namespaceName` has to be a string' );
		}
		if ( !isString( req.query.lessonName ) ) {
			return res.status( 400 ).send( '`lessonName` has to be a string' );
		}
		const namespace = await Namespace.findOne({ title: req.query.namespaceName });
		if ( isNull( namespace )) {
			return res.status( 404 ).send( 'Namespace does not exist.' );
		}
		const lesson = await Lesson.findOne({ namespace: namespace, title: req.query.lessonName });
		res.json({ message: 'ok', lesson: lesson });
	})
);

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

app.get( '/get_isle_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetIsleFile( req, res ) {
		const namespace = req.query.namespaceName;
		const lesson = req.query.lessonName;
		let file = join( namespacesDirectory, namespace, lesson, '/index.isle' );
		file = resolve( __dirname, file );
		debug( `Retrieve file at: '${file}'` );
		const data = await fs.readFile( file, 'utf8' );
		res.send( data );
	})
);

app.get( '/get_lessons', wrapAsync( async function onGetLessons( req, res ) {
	if ( !isString( req.query.namespaceName ) ) {
		return res.status( 400 ).send( '`namespaceName` has to be a string.' );
	}
	debug( 'Retrieve lessons...' );
	const namespace = await Namespace.findOne({ title: req.query.namespaceName });
	let lessons = await Lesson.find({ namespace: namespace });
	lessons = lessons.map( lesson => {
		lesson = lesson.toObject();

		// Replace ID by namespace title:
		lesson.namespace = req.query.namespaceName;
		return lesson;
	});
	res.json({
		message: 'ok',
		lessons: lessons,
		namespaceName: req.query.namespaceName
	});
}));

app.post( '/get_user_rights',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserRights( req, res ) {
		const { namespaceName } = req.body;
		debug( 'Should retrieve user rights....' );
		const namespace = await Namespace.findOne({ title: namespaceName });
		if ( !namespace ) {
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
			const cohort = await Cohort.findOne({
				namespace: namespace,
				members: {
					$in: [ req.user ]
				},
				startDate: { '$lt': new Date() },
				endDate: { '$gte': new Date() }
			});
			res.json({
				owner: !!owner,
				enrolled: !!cohort,
				cohort: cohort ? cohort.title : null
			});
		}
	})
);

app.get( '/set_write_access',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSetWriteAccess( req, res ) {
		const { token } = req.query;
		const user = req.user;
		debug( 'Should set user write access...' );
		if ( token !== tokens.writeAccess ) {
			return res.status( 401 ).send( 'Incorrect write-access token.' );
		}
		user.writeAccess = true;
		await user.save();
		res.json({
			message: 'User successfully updated.'
		});
	})
);

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
			let sourceDir = join( namespacesDirectory, source, sourceName );
			sourceDir = resolve( __dirname, sourceDir );
			let targetDir = join( namespacesDirectory, target, targetName );
			targetDir = resolve( __dirname, targetDir );
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

app.post( '/create_lesson',
	lessonUpload.single( 'zipped' ),
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;
		debug( 'Should create lesson....' );
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: { $in: [ req.user ]}
		});
		debug( 'Create lesson object:' );
		let lesson = await Lesson.findOne({
			namespace: namespace,
			title: lessonName
		});
		if ( !lesson ) {
			lesson = new Lesson({
				namespace: namespace,
				title: lessonName
			});
			debug( 'Save lesson to database...' );
			await lesson.save();
		}
		unzipLessonFolder( namespaceName, lessonName, req.file.filename );
		res.json({
			message: 'The lesson has been successfully uploaded.'
		});
	})
);

app.get( '/delete_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteLesson( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		const dir = join( namespaceName, lessonName );
		let dirpath = join( namespacesDirectory, dir );
		dirpath = resolve( __dirname, dirpath );
		debug( 'Remove lesson directory: '+dirpath );
		await fs.remove( dirpath );
		await Lesson.deleteOne({ namespace: namespace, title: lessonName });
		res.json({
			message: 'The lesson has been successfully deleted.'
		});
	})
);

app.get( '/update_lesson', passport.authenticate( 'jwt', { session: false }), function onUpdateLesson( req, res ) {
	const { namespaceName, lessonName, newTitle, newDescription } = req.query;
	Namespace.findOne({ title: namespaceName, owners: { $in: [ req.user ] } }, function onFindNamespace( err, namespace ) {
		if ( err ) {
			return debug( 'Encountered an error in namespace query: ' + err.message );
		}
		Lesson.updateOne({ namespace: namespace, title: lessonName }, { title: newTitle, description: newDescription }, onLessonUpdate );
	});

	function onLessonUpdate( err ) {
		if ( err ) {
			return res.status( 404 ).send( 'Lesson update failed.' );
		}
		renameDirectory(
			join( namespaceName, lessonName ),
			join( namespaceName, newTitle ),
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

app.post( '/new_announcement',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function newAnnouncement( req, res ) {
		const { namespaceName, announcement } = req.body;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		namespace.announcements.unshift( announcement );
		await namespace.save();
		res.json({ message: 'Announcement successfully added.' });
	})
);

app.post( '/edit_announcement',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function editAnnouncement( req, res ) {
		const { namespaceName, announcement } = req.body;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		debug( 'Search through announcements for matches...' );
		for ( let i = 0; i < namespace.announcements.length; i++ ) {
			const val = namespace.announcements[ i ];
			if ( val.createdAt === Number( announcement.createdAt ) ) {
				debug( 'Found announcement to be edited...' );
				namespace.announcements[ i ] = announcement;
			}
		}
		await namespace.save();
		res.json({ message: 'Announcement successfully updated.' });
	})
);

app.post( '/delete_announcement',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function deleteAnnouncement( req, res ) {
		const { namespaceName, createdAt } = req.body;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		namespace.announcements = namespace.announcements.filter( x => {
			return x.createdAt !== Number( createdAt );
		});
		await namespace.save();
		res.json({ message: 'Announcement successfully deleted.' });
	})
);

app.get( '/activate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onActivateLesson( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ active: true }
		);
		res.json({
			message: 'The lesson has been successfully activated.'
		});
	})
);

app.get( '/deactivate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeactivateLesson( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ active: false }
		);
		res.json({
			message: 'The lesson has been successfully deactivated.'
		});
	})
);

app.get( '/show_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onShowLesson( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ public: true }
		);
		res.json({
			message: 'The lesson is now visible inside the public gallery.'
		});
	})
);

app.get( '/hide_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onHideLesson( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ public: false }
		);
		res.json({
			message: 'The lesson is now hidden from the public gallery.'
		});
	})
);

app.post( '/create_namespace',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateNamespace( req, res ) {
		if ( !req.body.title || !req.body.description || !req.body.owners ) {
			return res.status( 400 ).send( 404, 'Missing required title, description, and owners fields' );
		}
		const users = await User.find({ 'email': req.body.owners });
		const namespace = new Namespace({
			owners: users,
			title: req.body.title,
			description: req.body.description
		});
		users.forEach( user => {
			user.ownedNamespaces.push( namespace );
			user.save();
		});
		try {
			await namespace.save();
		} catch ( err ) {
			debug( 'Encountered an error when saving namespace: ' + err.message );
			return res.json({
				message: 'The namespace could not be created as it already exists.',
				successful: false
			});
		}
		try {
			await createNamespaceDirectory( namespace.title );
		} catch ( err ) {
			debug( 'Encountered an error when creating namespace directory: ' + err.message );
			return res.json({
				message: err.message,
				successful: false
			});
		}
		res.json({
			message: 'The namespace was successfully created!',
			successful: true,
			namespace: namespace.toObject()
		});
	})
);

app.get( '/delete_namespace',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteNamespace( req, res ) {
		const namespace = await Namespace.findOne({ _id: req.query.id });
		if ( !namespace ) {
			return res.status( 404 ).send( 'Namespace does not exist.' );
		}
		const users = await User.find({ email: namespace.owners });
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
		await deleteNamespaceDirectory( namespace.title );
		await namespace.remove();
		res.json({ message: 'Namespace successfully deleted.' });
	})
);

app.post( '/update_namespace', passport.authenticate( 'jwt', { session: false }), function onUpdateNamespace( req, res ) {
	const ns = req.body.ns;
	const newProps = pick( ns, [ 'owners', 'title', 'description' ]);
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
			let toRemove = namespace.owners.length;
			for ( let i = 0; i < namespace.owners.length; i++ ) {
				const user = namespace.owners[ i ];
				debug( `Removing namespace ${namespace.title} for user ${user.email}` );
				const arr = [];
				for ( let i = 0; i < user.ownedNamespaces.length; i++ ) {
					if ( !user.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
						arr.push( user.ownedNamespaces[ i ] );
					}
				}
				user.ownedNamespaces = arr;
				user.save( onSave );
			}
			function onSave() {
				toRemove -= 1;
				if ( toRemove === 0 ) {
					User.find({ email: newProps.owners }, onFindUser );
				}
			}
			function onFindUser( err, users ) {
				if ( err ) {
					debug( 'Encountered an error: ' + err.message );
					return res.status( 400 ).send( err.message );
				}
				debug( 'Found %d users...', users.length );
				users.forEach( user => {
					let alreadyPresent = false;
					for ( let i = 0; i < user.ownedNamespaces.length; i++ ) {
						if ( user.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
							alreadyPresent = true;
						}
					}
					if ( !alreadyPresent ) {
						debug( `Push namespace to user ${user.email}.` );
						user.ownedNamespaces.push( namespace );
						user.save();
					}
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
				Namespace
					.findOne({ _id: ns._id })
					.populate( 'owners' )
					.exec( ( err, ns ) => {
						if ( err ) {
							return res.status( 403 ).send( err.message );
						}
						res.json({
							message: 'Namespace successfully updated.',
							namespace: ns.toObject()
						});
					});
			}
		});
});

app.post( '/update_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUser( req, res ) {
		const user = req.user;
		if ( req.body.name ) {
			user.name = req.body.name;
		}
		if ( req.body.password ) {
			user.password = req.body.password;
		}
		if ( req.body.organization ) {
			user.organization = req.body.organization;
		}
		const newUser = await user.save();
		res.json({
			message: `User ${newUser.name} successfully updated.`
		});
	})
);

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

app.post( '/login', wrapAsync( async function onLogin( req, res ) {
		const password = req.body.password;
		const email = req.body.email;
		if ( !isString( password ) ) {
			return res.status( 400 ).send( '`password` has to be a string' );
		}
		if ( !isString( email ) ) {
			return res.status( 400 ).send( '`email` has to be a string' );
		}
		const user = await User.findOne({ 'email': email });
		if ( !user ) {
			return res.status( 404 ).json({
				message: 'No user with the given email address found.',
				type: 'no_user'
			});
		}
		user.comparePassword( password, function onComparePassword( err, isMatch ) {
			if ( isMatch === true ) {
				// Identify users by their ID:
				const payload = { id: user.id };
				const token = jwt.sign( payload, jwtOptions.secretOrKey );
				res.json({ message: 'ok', token: token, id: user.id });
			} else {
				res.status( 401 ).json({
					message: 'Password is not correct.',
					type: 'incorrect_password'
				});
			}
		});
	})
);

app.post( '/store_session_element', function onStoreSessionElement( req, res ) {
	debug( 'Should store session element...' );
	if ( req.body ) {
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
			sessionData.save( function onSaveSessionData( err, product ) {
				if ( err ) {
					return res.status( 404 ).send( 'Session data could not be saved.' );
				}
				res.json({
					message: 'User action successfully saved.',
					id: product._id
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

app.post( '/get_namespace_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserActions( req, res ) {
		if ( !req.body.namespaceID ) {
			return res.status( 422 ).send( 'Missing namespaceID.' );
		}
		const lessons = await Lesson.find({ namespace: req.body.namespaceID });
		let results = [];
		for ( let i = 0; i < lessons.length; i++ ) {
			const lesson = lessons[ i ];
			let actions = await SessionData
				.find({ type: 'action', lesson: lesson }, null )
				.sort( '-data.absoluteTime' )
				.exec();
			actions = actions.map( d => {
				const data = d.data;
				data.sessiondataID = d._id;
				data.lesson = lesson.title;
				return data;
			});
			results = results.concat( actions );
		}
		res.json( results );
	})
);

app.get( '/get_fake_users',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( require( './routes/get_fake_users.js' ) )
);

app.post( '/get_current_user_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetCurrentUserActions( req, res ) {
		const actions = await SessionData
			.find({
				type: 'action',
				lesson: req.body.lessonID,
				'data.email': req.user.email
			}, null )
			.sort( '-data.absoluteTime' )
			.exec();
		debug( `Return ${actions.length} actions to the caller` );
		res.json({
			actions: groupBy( actions.map( d => {
				const out = d.data;
				out.sessiondataID = d._id;
				return out;
			}), grouping )
		});
		function grouping( elem ) {
			return elem.id;
		}
	})
);

app.get( '/get_sketchpad_user_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
		const owner = await isOwner( req.user, req.query.namespaceID );
		debug( owner ? 'User is an owner' : 'User is not an owner' );
		const table = owner ? SketchpadOwnerData : SketchpadUserData;
		const val = await table.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID,
			user: req.user
		});
		if ( !val ) {
			return res.json( null );
		}
		res.json( val.data );
	})
);

app.post( '/save_sketchpad_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
		const owner = await isOwner( req.user, req.body.namespaceID );
		if ( owner ) {
			debug( 'Save sketchpad data for owner...' );
			await SketchpadOwnerData.findOneAndUpdate(
				{
					lesson: req.body.lessonID,
					id: req.body.sketchpadID,
					user: req.user
				},
				{ data: req.body.data },
				{ new: true, upsert: true }
			);
			res.json({ message: 'Owner data successfully saved.' });
		} else {
			debug( 'Save sketchpad data for user...' );
			await SketchpadUserData.findOneAndUpdate(
				{
					lesson: req.body.lessonID,
					id: req.body.sketchpadID,
					user: req.user
				},
				{ data: req.body.data },
				{ new: true, upsert: true }
			);
			res.json({ message: 'User data successfully saved.' });
		}
	})
);

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
			endDate: req.body.endDate,
			private: req.body.private,
			emailFilter: req.body.emailFilter
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

app.get( '/get_enrollable_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCohorts( req, res ) {
		const cohorts = await Cohort
			.find({
				startDate: { '$lt': new Date() },
				endDate: { '$gte': new Date() },
				private: false
			})
			.populate({
				path: 'namespace',
				populate: { path: 'owners' }
			})
			.exec();
		res.json({ message: 'ok', cohorts: cohorts });
	})
);

app.get( '/get_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCohorts( req, res ) {
		const memberFields = req.query.memberFields || 'email name picture score spentTime lessonData badges anonEmail anonName';
		const cohorts = await Cohort
			.find({ namespace: req.query.namespaceID })
			.populate( 'members', memberFields )
			.exec();
		res.json({ message: 'ok', cohorts: cohorts });
	})
);

app.get( '/delete_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteCohort( req, res ) {
		const cohort = await Cohort.findOne({ _id: req.query._id });
		if ( !cohort ) {
			return res.status( 404 ).send( 'Cohort does not exist.' );
		}
		const users = await User.find({ _id: { $in: cohort.members }});
		users.forEach( user => {
			const idx = user.enrolledNamespaces.indexOf( cohort.namespace );
			if ( idx !== -1 ) {
				user.enrolledNamespaces.splice( idx, 1 );
				user.save();
			}
		});
		await cohort.remove();
		res.json({ message: 'Cohort successfully deleted.' });
	})
);

app.get( '/add_to_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const cohortID = req.query.cohortID;
		debug( 'Add user to cohort with ID '+cohortID );
		const user = req.user;
		const cohort = await Cohort.findOneAndUpdate(
			{ _id: cohortID },
			{ $push: { members: user }},
			{ new: true });
		debug( `Updated cohort ${cohort.title}...` );
		user.enrolledNamespaces.push( cohort.namespace );
		await user.save();
		res.json({ message: 'User added to cohort.' });
	})
);

app.post( '/update_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const updatedCohort = req.body.cohort;
		debug( 'Updated cohort: '+ JSON.stringify( updatedCohort ) );
		const cohort = Cohort
			.findOne({ _id: updatedCohort._id })
			.populate( 'members' )
			.exec();
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
		const newProps = pick( updatedCohort, [ 'members', 'title', 'startDate', 'endDate', 'private', 'emailFilter' ]);
		if ( newProps.members.includes( ',' ) ) {
			newProps.members = newProps.members.split( ',' );
		}
		const users = await User.find({ email: newProps.members });
		debug( 'Found %d users...', users.length );
		newProps.members = users;
		users.forEach( user => {
			user.enrolledNamespaces.push( cohort.namespace );
			user.save();
		});
		await cohort.update({ $set: newProps });
		res.json({ message: 'Cohort successfully updated.' });
	})
);

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

		if ( isString( req.query.lessonName ) ) {
			Lesson.findOne({ namespace: namespace, title: req.query.lessonName }, onFindLesson );
		} else {
			const query = {
				'namespace': namespace
			};
			if ( req.query.owner === 'true' ) {
				query.owner = true;
			} else if ( req.query.owner === 'false' ) {
				query.owner = { $ne: true };
			}
			File.find( query )
			.lean()
			.exec( onExecute );
		}

		function onFindLesson( err, lesson ) {
			if ( err ) {
				return res.status( 404 ).send( 'Lesson query failed.' );
			}
			const query = {
				'namespace': namespace,
				'lesson': lesson
			};
			if ( req.query.owner === 'true' ) {
				query.owner = true;
			} else if ( req.query.owner === 'false' ) {
				query.owner = { $ne: true };
			}
			File.find( query )
			.lean()
			.exec( onExecute );
		}

		function onExecute( err, files ) {
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
		}
	}
});

app.get( '/get_user_files',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		const files = await File.find({
			'user': req.user
		});
		res.json({
			'files': files
		});
	})
);

app.post( '/upload_file',
	fileUpload.single( 'file' ),
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		const { namespaceName, lessonName, owner } = req.body;
		debug( 'Received a file: ' + JSON.stringify( req.file ) );

		const fileMetaData = {
			user: req.user,
			title: req.file.originalname,
			filename: req.file.filename,
			path: req.file.path,
			type: req.file.mimetype,
			owner: owner
		};
		const stats = await fs.stat( req.file.path );
		const fileSizeInBytes = stats.size;
		const fileSizeInMegabytes = fileSizeInBytes / 1e6;
		fileMetaData.size = fileSizeInMegabytes;
		debug( `Store file for namespace ${namespaceName} and lesson ${lessonName}` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		fileMetaData.namespace = namespace;
		if ( !lessonName ) {
			// Update file if already existing or create new one:
			await File.updateOne(
				{ path: fileMetaData.path },
				fileMetaData,
				{ upsert: true, setDefaultsOnInsert: true }
			);
		} else {
			const lesson = await Lesson.findOne({ title: lessonName, namespace: namespace });
			debug( 'Should save to database... ' );
			fileMetaData.lesson = lesson;

			// Update file if already existing or create new one:
			await File.updateOne(
				{ path: fileMetaData.path },
				fileMetaData,
				{ upsert: true, setDefaultsOnInsert: true }
			);
		}
		res.json({ message: 'File successfully saved.', filename: req.file.filename });
	})
);

app.get( '/delete_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteFile( req, res ) {
		const file = await File.findOne({ _id: req.query._id });
		if ( !file ) {
			return res.status( 404 ).send( 'File does not exist.' );
		}
		await file.remove();
		res.json({ message: 'File successfully deleted.' });
	})
);

app.post( '/upload_profile_pic',
	fileUpload.single( 'avatar' ),
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		req.user.picture = req.file.filename;
		await req.user.save();
		res.json({
			message: 'Profile picture successfully saved.',
			filename: req.file.filename
		});
	})
);

app.post( '/upload_thumbnail_pic', fileUpload.single( 'thumbnail' ), passport.authenticate( 'jwt', { session: false }), function onUploadFile( req, res ) {
	res.status( 200 ).send( 'Operation successful' );
});

app.get( '/get_namespaces',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetNamespaces( req, res ) {
		let namespaces = await Namespace.find({
			owners: {
				$in: [ req.user ]
			}
		});
		const promises = namespaces.map( ns => {
			return User.find({ _id: { $in: ns.owners }});
		});
		const userPerNS = await Promise.all( promises );
		for ( let i = 0; i < namespaces.length; i++ ) {
			let ns = namespaces[ i ];
			ns = ns.toObject();
			ns.owners = userPerNS[ i ].map( user => user.email );
			namespaces[ i ] = ns;
		}
		res.json({ message: 'ok', namespaces });
	})
);

app.post( '/update_user_session', passport.authenticate( 'jwt', { session: false }), function onUpdateUserSession( req, res ) {
	debug( 'Should update the user session...' );
	const user = req.user;
	const { addedScore, elapsed, lessonID, progress, addedChatMessages, addedActionTypes } = req.body;
	const spentTime = user.spentTime + elapsed;
	const score = user.score + addedScore;
	const lessonData = copy( user.lessonData );
	if ( !lessonData[ lessonID ] ) {
		lessonData[ lessonID ] = {};
	}
	const data = lessonData[ lessonID ];
	if ( !data.progress ) {
		data.progress = progress;
	}
	else if ( progress > data.progress ) {
		data.progress = progress;
	}
	if ( data.spentTime ) {
		data.spentTime += elapsed;
	} else {
		data.spentTime = elapsed;
	}
	if ( data.chatMessages ) {
		data.chatMessages += addedChatMessages;
	} else {
		data.chatMessages = addedChatMessages;
	}
	if ( addedActionTypes ) {
		debug( 'Add action types...' );
		if ( !data.actionTypes ) {
			data.actionTypes = {};
		}
		const keys = objectKeys( addedActionTypes );
		for ( let i = 0; i < keys.length; i++ ) {
			const type = keys[ i ];
			const count = addedActionTypes[ type ];
			if ( data.actionTypes[ type ] ) {
				data.actionTypes[ type ] += count;
			} else {
				data.actionTypes[ type ] = count;
			}
		}
	}
	debug( 'New lesson data: '+ JSON.stringify( lessonData ) );
	User.updateOne({ '_id': user._id }, {
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

app.get( '/get_available_badges', function onBadges( req, res ) {
	res.json( badges );
});

app.get( '/get_user_badges',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onBadges( req, res ) {
		const user = req.user.toObject();
		const addedBadges = badgeCheck( user );
		const newUserBadges = user.badges.concat( addedBadges );
		const stats = await User.updateOne({ '_id': user._id }, {
			badges: newUserBadges
		});
		debug( 'Result: ' + JSON.stringify( stats ) );
		const acquiredBadges = badges.map( badge => {
			if ( contains( newUserBadges, badge.name ) ) {
				badge.acquired = true;
			} else {
				badge.acquired = false;
			}
			return badge;
		});
		res.json({
			badges: acquiredBadges,
			addedBadges
		});
	}
));

app.use( ( err, req, res, next ) => {
	const msg = `${req.method} ${req.url}: ${err.message}`;
	debug( `Encountered an error in ${msg}` );
	const date = new Date();
	errorLogStream.write( `${msg} - ${date.toLocaleString()}` );
	errorLogStream.write( '\n' );
	let statusCode = err.statusCode || 404;
	res.status( statusCode ).send( err.message );
});

// Only listen to requests when directly run and not in tests:
if ( require.main === module ) {
	server.listen( 17777, function onStart() {
		console.log( 'Express running' ); // eslint-disable-line no-console
	});
}


// EXPORTS //

module.exports = app;
