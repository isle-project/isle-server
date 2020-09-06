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
const axios = require( 'axios' );
const qs = require( 'qs' );
const ncp = require( 'ncp' ).ncp;
const url = require( 'url' );
const path = require( 'path' );
const join = require( 'path' ).join;
const resolve = require( 'path' ).resolve;
const crypto = require( 'crypto' );
const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const jwt = require( 'jsonwebtoken' );
const multer = require( 'multer' );
const debug = require( 'debug' )( 'server' );
const swot = require( 'swot-simple' );
const rfs = require( 'rotating-file-stream' );
const morgan = require( 'morgan' );
const passport = require( 'passport' );
const passportJWT = require( 'passport-jwt' );
const cors = require( 'cors' );
const isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
const i18next = require( 'i18next' );
const i18nextMiddleware = require( 'i18next-http-middleware' );
const i18nextBackend = require( 'i18next-fs-backend' );
const createTemplateFunction = require( 'lodash.template' );
const exists = require( '@stdlib/fs/exists' );
const contains = require( '@stdlib/assert/contains' );
const pick = require( '@stdlib/utils/pick' );
const groupBy = require( '@stdlib/utils/group-by' );
const objectKeys = require( '@stdlib/utils/keys' );
const copy = require( '@stdlib/utils/copy' );
const replace = require( '@stdlib/string/replace' );
const trim = require( '@stdlib/string/trim' );
const ceil = require( '@stdlib/math/base/special/ceil' );
const isObject = require( '@stdlib/assert/is-object' );
const isJSON = require( '@stdlib/assert/is-json' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const isEmptyObject = require( '@stdlib/assert/is-empty-object' );
const isAbsolutePath = require( '@stdlib/assert/is-absolute-path' );
const isNull = require( '@stdlib/assert/is-null' );
const roundn = require( '@stdlib/math/base/special/roundn' );
const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;
const Event = require( './models/event.js' );
const User = require( './models/user.js' );
const Cohort = require( './models/cohort.js' );
const File = require( './models/file.js' );
const Lesson = require( './models/lesson.js' );
const Namespace = require( './models/namespace.js' );
const Session = require( './models/session.js' ); // eslint-disable-line
const SessionData = require( './models/session_data.js' );
const SketchpadUserData = require( './models/sketchpad_user_data.js' );
const SketchpadOwnerData = require( './models/sketchpad_owner_data.js' );
const OverviewStatistics = require( './models/overview_statistics.js' );
const mailer = require( './mailer' );
const socketHandler = require( './sockets/handler.js' );
const config = require( './../etc/config.json' );
const {
	namespacesDirectory, mediaDirectory, localesDirectory, logsDirectory, server: serverHostName
} = config;
const tokens = require( './../credentials/tokens.json' );
const jitsi = require( './../credentials/jitsi.json' );
const deepl = require( './../credentials/deepl.json' );
const badges = require( './badge_check/badges.json' );
const unzipLessonFolder = require( './unzip_lesson_folder.js' );
const badgeCheck = require( './badge_check' );
const isOwner = require( './helpers/is_owner.js' );
const isAdmin = require( './helpers/is_admin.js' );
const harmonizeSketchpadElements = require( './harmonize_sketchpad_elements.js' );
const ErrorStatus = require( './helpers/error.js' );
const openRooms = require( './sockets/open_rooms.js' );
const mongooseConnection = require( './connect_mongoose.js' );
require( './create_events.js' );
require( './scheduler.js' );


// VARIABLES //

const NAMESPACES_DIRECTORY = isAbsolutePath( namespacesDirectory ) ? namespacesDirectory : resolve( __dirname, namespacesDirectory );
const MEDIA_DIRECTORY = isAbsolutePath( mediaDirectory ) ? mediaDirectory : resolve( __dirname, mediaDirectory );
const LOCALES_DIRECTORY = isAbsolutePath( localesDirectory ) ? localesDirectory : resolve( __dirname, localesDirectory );
const LOGS_DIRECTORY = isAbsolutePath( logsDirectory ) ? logsDirectory : resolve( __dirname, logsDirectory );
const MEDIA_BASE_DIR = path.basename( mediaDirectory );
const MEDIA_AVATAR_DIR = join( MEDIA_BASE_DIR, 'avatar' );
const MEDIA_THUMBNAIL_DIR = join( MEDIA_BASE_DIR, 'thumbnail' );
const createShibbolethToken = createTemplateFunction( tokens.shibbolethTemplate || '' );
const RE_PREAMBLE = /^(---[\S\s]*?---)/;
const SHIBBOLETH_TOLERANCE = 30; // thirty seconds
const NOTIFICATIONS_EMAIL = {
	name: 'ISLE Messenger',
	address: `notifications@${url.parse( serverHostName ).host}`
};

// Settings fo lesson data upload from the ISLE editor using `multer` library:
const lessonUpload = multer({
	dest: NAMESPACES_DIRECTORY,
	limits: {
		fieldNameSize: 100,
		fileSize: 30 * 1024 * 1024, // 30MB
		files: 99
	}
});

// Settings for storing user and owner files in the `media` directory:
const storage = multer.diskStorage({
	destination: function onDestination( req, file, cb ) {
		const body = req.body;
		if ( body.owner === 'true' && body.namespaceName ) {
			exists( MEDIA_DIRECTORY, ( bool ) => {
				if ( bool ) {
					return cb( null, MEDIA_BASE_DIR );
				}
				debug( `Create ${MEDIA_DIRECTORY} directory...` );
				fs.mkdir( MEDIA_DIRECTORY, () => {
					cb( null, MEDIA_BASE_DIR );
				});
			});
		}
		else if ( file.fieldname === 'avatar' ) {
			return cb( null, MEDIA_AVATAR_DIR );
		}
		else if ( file.fieldname === 'thumbnail' ) {
			return cb( null, MEDIA_THUMBNAIL_DIR );
		} else {
			return cb( null, MEDIA_BASE_DIR );
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
const MAX_NUM_ACTIONS = 50000; // Maximum number of actions retrieved by instructors when opening a lesson
const THREE_HOURS_IN_SECONDS = 3 * 60 * 60; // Expiration time for token

// Error and access logging using a rotating file once size or time interval is exceeded:
const errorLogStream = rfs.createStream( 'errors.log', {
	interval: '30d', // Monthly interval for error logging...
	maxSize: '10M', // Rotate every 10 MegaBytes written...
	path: LOGS_DIRECTORY
});
errorLogStream.on( 'error', debug );
errorLogStream.on( 'warning', debug );

const accessLogStream = rfs.createStream( 'access.log', {
	interval: '1d', // Ten-day interval for access logging...
	maxSize: '50M', // Rotate every 50 MegaBytes written...
	path: LOGS_DIRECTORY
});
accessLogStream.on( 'error', debug );
accessLogStream.on( 'warning', debug );

i18next
	.use( i18nextMiddleware.LanguageDetector )
	.use( i18nextBackend )
	.init({
		preload: [ 'en', 'de', 'es' ],
		debug: debug.enabled,
		lng: 'en',
		fallbackLng: 'en',
		backend: {
			loadPath: join( LOCALES_DIRECTORY, '{{lng}}/{{ns}}.json' )
		}
	});


// FUNCTIONS //

/**
* Creates a namespace directory where lessons will be saved on disk.
*
* @param {string} dir - directory name
* @returns {Promise} mkdir call
*/
function createNamespaceDirectory( dir ) {
	const dirpath = join( NAMESPACES_DIRECTORY, dir );
	debug( 'Create namespace directory: '+dirpath );
	return fs.mkdir( dirpath );
}

/**
* Deletes a namespace directory storing lessons on disk.
*
* @param {string} dir - directory name
* @returns {Promise} rmdir call
*/
function deleteNamespaceDirectory( dir ) {
	const dirpath = join( NAMESPACES_DIRECTORY, dir );
	debug( 'Remove namespace directory: '+dirpath );
	return fs.rmdir( dirpath );
}

/**
* Renames the directory for storing lessons of a namespace in case of a name change for the namespace.
*
* @param {string} oldDir - old namespace name
* @param {string} newDir - new namespace name
* @param {Function} clbk - callback function
*/
function renameDirectory( oldDir, newDir, clbk ) {
	const oldDirPath = join( NAMESPACES_DIRECTORY, oldDir );
	const newDirPath = join( NAMESPACES_DIRECTORY, newDir );
	fs.rename( oldDirPath, newDirPath, clbk );
}

/**
* Extracts the institution name for an educational email address.
*
* @param {string} email - email address
* @returns {string} institution name or `Other` if not found
*/
function institutionName( email ) {
	const name = swot.getInstitutionName( email );
	return name || 'Other';
}

/**
* Helper function which wraps async functions and forwards them to error handling if an error is thrown.
*
* @param {Function} fn - async function
* @returns {Function} wrapped function
*/
function wrapAsync( fn ) {
	return ( req, res, next ) => {
		// `.catch()` any errors and pass them along to the `next()` middleware in the chain
		fn( req, res, next ).catch( next );
	};
}

function decodeBase64String( data ) {
	const buffer = Buffer.from( data, 'base64' );
	let text = buffer.toString( 'utf-8' );
	text = replace( text, '-', '+' );
	text = replace( text, '_', '/' );
	return text;
}

function recreateShibbolethToken({ eppn, name, affil, time, salt }) {
	const template = createShibbolethToken({
		eppn,
		name,
		affil,
		time,
		salt,
		secret: tokens.shibbolethSecret
	});
	return crypto.createHash( 'sha256' )
		.update( template )
		.digest( 'hex' );
}

function sendVerificationEmail( user ) {
	const mail = {
		'from': NOTIFICATIONS_EMAIL,
		'subject': 'Verify your email address',
		'to': user.email,
		'text': `
			Dear ${user.name}, welcome to ISLE! Please click on the link below to confirm your email address.
		`,
		'link': `${serverHostName}/dashboard/#/confirm-email/?token=${user._id}`
	};
	debug( 'Mail: ' + JSON.stringify( mail ) );
	mailer.send( mail, function onDone( error ) {
		if ( error ) {
			throw new ErrorStatus( 503, 'Email service currently not available' );
		}
	});
}

function extractEmailsWithoutAccount( memberEmails, users ) {
	const out = [];
	for ( let i = 0; i < memberEmails.length; i++ ) {
		let found = false;
		for ( let j = 0; j < users.length; j++ ) {
			if ( users[ j ].email === memberEmails[ i ] ) {
				found = true;
			}
		}
		if ( !found ) {
			out.push( memberEmails[ i ] );
		}
	}
	return out;
}

function extractUsersToBeAdded( users, existingMembers ) {
	const out = [];
	for ( let i = 0; i < users.length; i++ ) {
		let found = false;
		for ( let j = 0; j < existingMembers.length; j++ ) {
			if ( existingMembers[ j ].email === users[ i ].email ) {
				found = true;
			}
		}
		if ( !found ) {
			out.push( users[ i ] );
		}
	}
	return out;
}

function extractOwnersToRemove( newOwnerEmails, existingOwners ) {
	const out = [];
	for ( let i = 0; i < existingOwners.length; i++ ) {
		let found = false;
		for ( let j = 0; j < newOwnerEmails.length; j++ ) {
			if ( newOwnerEmails[ j ] === existingOwners[ i ].email ) {
				found = true;
			}
		}
		if ( !found ) {
			out.push( existingOwners[ i ] );
		}
	}
	return out;
}

async function sendCohortInvitations( memberEmails, cohort, namespace, reqUser ) {
	if ( memberEmails.length > 0 ) {
		const ownerNames = namespace.owners.map( x => x.name ).join( ', ');
		const organization = namespace.owners[ 0 ].organization;
		let users = await User
			.where( 'email' )
			.in( memberEmails )
			.exec();
		const addedUsers = extractUsersToBeAdded( users, cohort.members );
		debug( `Adding ${addedUsers.length} user(s) to cohort...` );
		if ( addedUsers.length > 0 ) {
			const cohortStartTime = cohort.startDate.getTime();
			for ( let i = 0; i < addedUsers.length; i++ ) {
				const user = addedUsers[ i ];
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': 'Course Invitation',
					'to': user.email,
					'text': `
						Dear ${user.name}, you were added to ${cohort.title} of course "${namespace.title}" by ${ownerNames} at ${organization}.<br />
						Please click the link below to login into your ISLE dashboard to review the materials of the course.
					`,
					'link': serverHostName
				};
				const event = new Event({
					type: 'send_email',
					time: cohortStartTime,
					data: mail,
					user: reqUser
				});
				event.save();
			}
		}
		const newEmails = extractEmailsWithoutAccount( memberEmails, users );
		debug( `Inviting ${newEmails.length} new user(s) to cohort...` );
		if ( newEmails.length > 0 ) {
			const cohortStartTime = cohort.startDate.getTime();
			const newUsers = [];
			for ( let i = 0; i < newEmails.length; i++ ) {
				const email = newEmails[ i ];
				const user = new User({
					name: email.split( '@' )[ 0 ],
					email: email,
					organization: institutionName( email )
				});
				newUsers.push( user );
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': 'Course Invitation',
					'to': user.email,
					'text': `
						Dear ${user.name}, you are invited to join ${cohort.title} of course "${namespace.title}" by ${ownerNames} at ${organization}.<br />
						Please click the link below to complete the registration processing by choosing a password of your liking.<br />
						You can then login with your email address and password at <a href="${serverHostName}">${serverHostName}</a>.
						We are looking forward for you to join the course!
					`,
					'link': `${serverHostName}/dashboard/#/complete-registration/?token=${user._id}`
				};
				const event = new Event({
					type: 'send_email',
					time: cohortStartTime,
					data: mail,
					user: reqUser
				});
				event.save();
			}
			users = users.concat( newUsers );
		}
		debug( 'Found %d users...', users.length );
		for ( let i = 0; i < users.length; i++ ) {
			const user = users[ i ];
			user.enrolledNamespaces.addToSet( namespace );
			await user.save();
		}
		return { users, newEmails };
	}
	return { users: [], newEmails: [] };
}


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
	throw new Error( 'SSL certificate and key have to be supplied.' );
}

// Attach web socket handling to express:
const io = require( 'socket.io' )( server );
socketHandler( io );

app.use(
	i18nextMiddleware.handle( i18next, {
		ignoreRoutes: [
			'/logs'
		]
	})
);

app.use( morgan( 'common', {
	stream: accessLogStream
}) );

// Configure CORS (TODO: should be revisited):
app.use( cors({
	'origin': '*',
	'methods': 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
	'preflightContinue': false,
	'optionsSuccessStatus': 204,
	'allowedHeaders': [ 'Range', 'Authorization', 'Content-Type', 'If-Modified-Since' ],
	'exposedHeaders': [ 'Content-Range', 'Content-Encoding', 'Content-Length', 'Accept-Ranges' ],
	'credentials': true
}) );

app.use( express.static( NAMESPACES_DIRECTORY ) );

app.use( express.static( MEDIA_DIRECTORY ) );

app.use( '/logs/',
	isAdmin,
	express.static( LOGS_DIRECTORY )
);

// JSON Web Token options for user authentication:
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
	limit: '20mb'
}) );

// Parse application/json:
app.use( bodyParser.json({
	limit: '20mb'
}) );

app.get( '/', function onDefault( req, res ) {
	res.redirect( '/dashboard/' );
});

app.post( '/credentials',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCredentials( req, res ) {
		if ( !isValidObjectId( req.body.id ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		const user = await User
			.findOne({ '_id': req.body.id })
			.populate( 'enrolledNamespaces' )
			.populate( 'ownedNamespaces' )
			.exec();
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
	})
);

app.get( '/user_update_check',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUserCheck( req, res ) {
		const { id, updatedAt } = req.query;
		const user = await User.findOne({ '_id': id });
		const hasMostRecent = updatedAt === user.updatedAt.toISOString();
		res.json({
			message: req.t( hasMostRecent ? 'user-data-has-most-recent' : 'user-data-has-not-most-recent' ),
			hasMostRecent: hasMostRecent
		});
	})
);

app.post( '/user_adjust_progress',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onProgressAdjustment( req, res ) {
		const { email, lessonID, namespaceID, progress } = req.body;
		const owner = await isOwner( req.user, namespaceID );
		if ( !owner ) {
			return res.status( 401 ).send( req.t( 'access-denied-no-owner' ) );
		}
		const user = await User.findOne({ email });
		const lessonData = copy( user.lessonData );
		if ( !lessonData[ lessonID ] ) {
			lessonData[ lessonID ] = {};
		}
		lessonData[ lessonID ].progress = Number( progress ) / 100;
		await user.updateOne({ $set: { lessonData }});
		res.json({ message: req.t( 'user-progress-updated' ) });
	})
);

app.post( '/credentials_dashboard',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCredentials( req, res ) {
		if ( !isValidObjectId( req.body.id ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		const user = await User
			.findOne({ '_id': req.body.id })
			.populate( 'enrolledNamespaces' )
			.populate( 'ownedNamespaces' )
			.exec();
		debug( 'Retrieve user credentials...' );
		Namespace.populate( user.ownedNamespaces, { path: 'owners' }, function onDone( err ) {
			res.json({
				id: req.body.id,
				email: user.email,
				verifiedEmail: user.verifiedEmail,
				name: user.name,
				organization: user.organization,
				enrolledNamespaces: user.enrolledNamespaces,
				ownedNamespaces: user.ownedNamespaces,
				writeAccess: user.writeAccess,
				administrator: user.administrator,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				picture: user.picture,
				score: user.score,
				spentTime: user.spentTime,
				lessonData: user.lessonData
			});
		});
	})
);

app.post( '/sanitize_user', passport.authenticate( 'jwt', { session: false }), function onSanitizeUser( req, res ) {
	if ( !isValidObjectId( req.body.id ) ) {
		return res.status( 400 ).send( req.t( 'invalid-id' ) );
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
				user.updateOne( { $set: newProps }, function onUserUpdate( err ) {
					if ( err ) {
						return res.status( 400 ).send( err.message );
					}
					res.json({ message: req.t( 'user-sanitized' ) });
				});
			} else {
				res.json({ message: req.t( 'user-already-sanitized' ) })
			}
		});
});

app.get( '/ping', function onPing( req, res ) {
	debug( 'Send live status...' );
	res.send( 'live' );
});

app.post( '/create_user', wrapAsync( async function onCreateUser( req, res ) {
	if ( !req.body.email || !req.body.password ) {
		throw new ErrorStatus( 403, req.t( 'password-and-email-required' ) );
	}
	let user;
	try {
		const numUsers = await User.estimatedDocumentCount();
		user = new User({
			email: req.body.email,
			name: req.body.name,
			password: req.body.password,
			organization: institutionName( req.body.email ),
			writeAccess: numUsers === 0, // Make first registered user an instructor
			administrator: numUsers === 0 // Make first registered user an administrator...
		});
		await user.save();
	} catch ( err ) {
		throw new ErrorStatus( 403, err.message );
	}
	sendVerificationEmail( user );
	debug( 'Successfully created user: %s', req.body.email );
	res.json({
		message: req.t( 'user-created' )
	});
}));

app.post( '/resend_confirm_email',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onResend( req, res ) {
		try {
			sendVerificationEmail( req.user );
			res.json({ successful: true });
		} catch ( err ) {
			throw new ErrorStatus( 503, err.message );
		}
	})
);

app.post( '/confirm_email', wrapAsync( async function onConfirm( req, res ) {
	debug( 'Should confirm user email address...' );
	const user = await User.findOne({ _id: req.body.token });
	if ( !user ) {
		throw new ErrorStatus( 404, req.t( 'user-nonexistent' ) );
	}
	if ( user.verifiedEmail ) {
		throw new ErrorStatus( 409, req.t('email-already-verified') );
	}
	await user.updateOne({ $set: { verifiedEmail: true }});
	const out = { message: req.t('email-confirmation-success') };
	res.json( out );
}) );

app.get( '/forgot_password', wrapAsync( async function onForgotPassword( req, res ) {
	debug( 'Forgot Password GET Request...' );
	const user = await User.findOne({ email: req.query.email });
	if ( !user ) {
		throw new ErrorStatus( 404, req.t( 'user-email-not-found' ) );
	}
	const mail = {
		'from': NOTIFICATIONS_EMAIL,
		'subject': 'New Password Requested',
		'to': req.query.email,
		'text': `
			Dear ${user.name}, you have indicated that you have forgotten your password. You can choose a new password by clicking on this link:
		`,
		'link': `${serverHostName}/dashboard/#/new-password/?token=${user._id}`
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

app.get( '/get_lesson_info',
	wrapAsync( async function onGetLessonInfo( req, res ) {
		const { namespaceName, lessonName } = req.query;
		const namespace = await Namespace.findOne({ title: namespaceName });
		const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
		if ( !isObject( lesson ) ) {
			return res.status( 410 ).send( req.t( 'lesson-not-found' ) );
		}
		const metadata = lesson.metadata || {};
		if ( !metadata.revealer ) {
			metadata.revealer = {};
		}
		const info = {
			lessonID: lesson._id,
			namespaceID: namespace._id,
			active: lesson.active,
			time: new Date().getTime(),
			metadata: metadata
		};
		debug( 'Send lesson info: ' + JSON.stringify( info ) );
		res.json( info );
	})
);

app.post( '/update_metadata',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function updateMetadata( req, res ) {
		const lessonID = req.body.lessonID;
		const namespaceID = req.body.namespaceID;
		if ( !isValidObjectId( lessonID ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		if ( !isValidObjectId( namespaceID ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		const owner = await isOwner( req.user, namespaceID );
		if ( !owner ) {
			return res.status( 401 ).send( req.t( 'access-denied-no-owner' ) );
		}
		if ( !isString( req.body.type ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'type'
			}) );
		}
		if ( !isString( req.body.key ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'key'
			}) );
		}
		const lesson = await Lesson.findById( lessonID );
		const metadata = copy( lesson.metadata || {} );
		const type = req.body.type;
		if ( !metadata[ type ] ) {
			metadata[ type ] = {};
		}
		metadata[ type ][ req.body.key ] = req.body.value;
		const result = await lesson.updateOne({ $set: { metadata }});
		res.json({ message: 'ok', metadata });
	})
);

app.get( '/get_lesson',
	wrapAsync( async function onGetLesson( req, res ) {
		if ( !isString( req.query.namespaceName ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'namespaceName'
			}) );
		}
		if ( !isString( req.query.lessonName ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'lessonName'
			}) );
		}
		const namespace = await Namespace.findOne({ title: req.query.namespaceName });
		if ( isNull( namespace )) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}
		const lesson = await Lesson.findOne({ namespace: namespace, title: req.query.lessonName });
		res.json({ message: 'ok', lesson: lesson });
	})
);

app.get( '/get_public_lessons',
	wrapAsync( async function onGetPublicLesson( req, res ) {
		const lessons = await Lesson.find({ public: true });
		for ( let i = 0; i < lessons.length; i++ ) {
			let lesson = lessons[ i ];
			lesson = lesson.toObject();

			// Replace ID by namespace title:
			const namespace = await Namespace.findOne({ _id: lesson.namespace });
			lesson.namespace = namespace.title;
			lessons[ i ] = lesson;
		}
		res.json({
			message: 'ok',
			lessons: lessons
		});
	})
);

app.get( '/get_isle_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetIsleFile( req, res ) {
		const namespace = req.query.namespaceName;
		const lesson = req.query.lessonName;
		let file = join( NAMESPACES_DIRECTORY, namespace, lesson, '/index.isle' );
		file = resolve( __dirname, file );
		debug( `Retrieve file at: '${file}'` );
		const data = await fs.readFile( file, 'utf8' );
		res.send( data );
	})
);

app.get( '/get_lessons', wrapAsync( async function onGetLessons( req, res ) {
	if ( !isString( req.query.namespaceName ) ) {
		return res.status( 400 ).send( req.t( 'field-expect-string', {
			field: 'namespaceName'
		}) );
	}
	debug( 'Retrieve lessons...' );
	const namespace = await Namespace.findOne({ title: req.query.namespaceName });
	let lessons = await Lesson
		.find({ namespace: namespace })
		.populate( 'lockUntil', 'time' )
		.exec();
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

app.get( '/get_all_lessons',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllLessons( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'all-lessons-only-admin' ) );
		}
		const namespaceFields = req.query.namespaceFields || 'title';
		const lessons = await Lesson
			.find({})
			.populate( 'namespace', namespaceFields )
			.exec();
		res.json({ message: 'ok', lessons });
	})
);

app.get( '/get_open_rooms',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetOpenRooms( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'rooms-only-admin' ) );
		}
		const rooms = openRooms.map( ( room ) => {
			return {
				name: room.name,
				startTime: room.startTime,
				members: room.members,
				chats: room.chats,
				groups: room.groups
			};
		});
		res.json({ message: 'ok', rooms });
	})
);

app.post( '/get_user_rights',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserRights( req, res ) {
		const { namespaceName } = req.body;
		debug( `Should retrieve user rights for ${req.user.name} (${req.user.email})...` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		if ( !namespace ) {
			res.json({
				owner: false,
				enrolled: false
			});
		}
		else {
			debug( 'Namespace owners: ' + JSON.stringify( namespace.owners ) );
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

app.post( '/set_write_access',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSetWriteAccess( req, res ) {
		const { token } = req.body;
		const user = req.user;
		debug( 'Should set user write access...' );
		if ( token !== tokens.writeAccess ) {
			return res.status( 401 ).send( req.t( 'incorrect-token' ) );
		}
		user.writeAccess = true;
		await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: user.name
			})
		});
	})
);

app.post( '/send_mail', function onSendMail( req, res ) {
	mailer.send( req.body, function onDone( error, response ) {
		if ( !error ) {
			res.json( response );
		} else {
			debug( 'Mail could not be sent...' );
			res.json( error );
		}
	});
});

app.post( '/copy_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCopyLesson( req, res ) {
		const { source, target, sourceName, targetName } = req.body;
		debug( 'Should copy lesson....' );
		const namespace = await Namespace.findOne({ title: target, owners: { $in: [ req.user ]}} );
		debug( 'Create lesson object: ' );
		let lesson = new Lesson({
			namespace: namespace,
			title: targetName,
			public: false
		});
		debug( 'Save lesson to database...' );
		let sourceDir = join( NAMESPACES_DIRECTORY, source, sourceName );
		sourceDir = resolve( __dirname, sourceDir );
		let targetDir = join( NAMESPACES_DIRECTORY, target, targetName );
		targetDir = resolve( __dirname, targetDir );
		ncp( sourceDir, targetDir, onNcp );
		async function onNcp( error ) {
			if ( error ) {
				debug( 'Encountered an error: ' + error );
				return res.status( 405 ).send( req.t( 'lesson-copy-failed' ) );
			}
			try {
				await lesson.save();
				res.json({
					message: req.t( 'lesson-copied' )
				});
			} catch ( err ) {
				return res.status( 409 ).send( req.t( 'lesson-save-failed' ) );
			}
		}
	})
);

app.post( '/translate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onTranslateLesson( req, res ) {
		/* eslint-disable camelcase */
		const isInstructor = req.user.writeAccess;
		if ( !isInstructor ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		let { text, target_lang } = req.body;
		const match = text.match( RE_PREAMBLE );
		if ( match[ 1 ] ) {
			text = replace( text, RE_PREAMBLE, '' );
		}
		debug( 'Should translate lesson text to: '+ target_lang );
		const result = await axios.post( deepl.server, qs.stringify({
			auth_key: deepl.auth_key,
			text,
			target_lang,
			tag_handling: 'xml'
		}) );
		const data = result.data;
		let translatedText = data.translations[ 0 ].text;
		translatedText = match[ 1 ] + translatedText;
		res.json({
			text: translatedText
		});
		/* eslint-enable camelcase */
	})
);

app.post( '/create_lesson',
	lessonUpload.single( 'zipped' ),
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateLesson( req, res ) {
		const { namespaceName, lessonName, description, metadata } = req.body;
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
			const data = {
				namespace: namespace,
				title: lessonName,
			};
			if ( isString( description ) ) {
				data.description = description;
			}
			if ( isJSON( metadata ) ) {
				data.metadata = JSON.parse( metadata );
			}
			lesson = new Lesson( data );
			debug( 'Save lesson to database...' );
			await lesson.save();
		} else {
			lesson.updatedAt = new Date();
			if ( isString( description ) && lesson.description === 'No description supplied.' ) {
				lesson.description = description;
			}
			if ( isJSON( metadata ) ) {
				lesson.metadata = JSON.parse( metadata );
			}
			lesson.save({
				timestamps: true
			});
		}
		unzipLessonFolder( namespaceName, lessonName, req.file.filename );
		res.json({
			message: req.t( 'lesson-uploaded' )
		});
	})
);

app.post( '/delete_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;
		const query = {
			title: namespaceName
		};
		if ( !req.user.administrator ) {
			query.owners = {
				$in: [ req.user ]
			};
		}
		const namespace = await Namespace.findOne( query );
		if ( !namespace ) {
			throw new ErrorStatus( 403, req.t( 'namespace-nonexistent' ) );
		}
		const dir = join( namespaceName, lessonName );
		const dirpath = join( NAMESPACES_DIRECTORY, dir );
		debug( 'Remove lesson directory: '+dirpath );
		await fs.remove( dirpath );
		await Lesson.deleteOne({ namespace: namespace, title: lessonName });
		res.json({
			message: req.t( 'lesson-deleted' )
		});
	})
);

app.post( '/update_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateLesson( req, res ) {
		const { namespaceName, lessonName, newTitle, newDescription, lockUntil } = req.body;
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: { $in: [ req.user ]}
		});
		const existingLesson = await Lesson.findOne({
			namespace: namespace, title: newTitle
		})
		if ( existingLesson ) {
			throw new ErrorStatus( 405, req.t( 'lesson-title-already-chosen' ) );
		}
		const lesson = await Lesson
			.findOne({ namespace: namespace, title: lessonName })
			.populate( 'lockUntil' )
			.exec();
		try {
			lesson.title = newTitle;
			lesson.description = newDescription;
			const oldEvent = lesson.lockUntil;
			if ( lockUntil ) {
				let createEvent;
				if ( oldEvent ) {
					if ( oldEvent.time !== lockUntil ) {
						debug( 'Unlock event time has changed...' );
						oldEvent.done = true;
						await oldEvent.save();
						createEvent = true;
					} else {
						createEvent = false;
					}
				} else {
					createEvent = true;
				}
				if ( createEvent ) {
					const event = new Event({
						type: 'unlock_lesson',
						time: lockUntil,
						data: {
							namespaceName,
							lessonName: newTitle
						},
						user: req.user
					})
					await event.save();
					lesson.active = false;
					lesson.lockUntil = event;
				}
			} else {
				if ( oldEvent ) {
					debug( 'Unlock event should be removed...' );
					oldEvent.done = true;
					await oldEvent.save();
					lesson.lockUntil = null;
				}
			}
			lesson.save();
			renameDirectory(
				join( namespaceName, lessonName ),
				join( namespaceName, newTitle ),
				onRename
			);
		} catch ( err ) {
			return res.status( 404 ).send( err.message );
		}
		function onRename( err ) {
			if ( err ) {
				return res.status( 403 ).send( err.message );
			}
			res.json({
				message: req.t( 'lesson-updated' )
			});
		}
	})
);

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
		res.json({ message: req.t( 'announcement-added' ) });
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
		res.json({ message: req.t( 'announcement-updated' ) });
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
		res.json({ message: req.t( 'announcement-deleted' ) });
	})
);

app.post( '/activate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onActivateLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;
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
			message: req.t( 'lesson-activated' )
		});
	})
);

app.post( '/deactivate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeactivateLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;
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
			message: req.t( 'lesson-deactivated' )
		});
	})
);

app.post( '/show_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onShowLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;
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
			message: req.t( 'lesson-visible-gallery' )
		});
	})
);

app.post( '/hide_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onHideLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;
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
			message: req.t( 'lesson-hidden-gallery' )
		});
	})
);

app.post( '/create_namespace',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateNamespace( req, res ) {
		if ( !req.body.title || !req.body.description || !req.body.owners ) {
			return res.status( 400 ).send( 404, req.t( 'namespace-create-missing-fields' ) );
		}
		const users = await User.find({ 'email': req.body.owners });
		const namespace = new Namespace({
			owners: users,
			title: req.body.title,
			description: req.body.description
		});
		for ( let i = 0; i < users.length; i++ ) {
			const user = users[ i ];
			user.ownedNamespaces.addToSet( namespace );
			await user.save();
		}
		try {
			await namespace.save();
		} catch ( err ) {
			debug( 'Encountered an error when saving namespace: ' + err.message );
			return res.json({
				message: req.t( 'namespace-already-exists' ),
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
			message: req.t( 'namespace-created' ),
			successful: true,
			namespace: namespace.toObject()
		});
	})
);

app.post( '/delete_namespace',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteNamespace( req, res ) {
		const query = {
			_id: req.body.id
		};
		if ( !req.user.administrator ) {
			query.owners = {
				$in: [ req.user ]
			};
		}
		const namespace = await Namespace.findOne( query );
		if ( !namespace ) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}
		const nLessons = await Lesson.count({ namespace: namespace });
		if ( nLessons > 0 ) {
			return res.status( 405 ).send( req.t( 'delete-lessons-first' ) );
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
		res.json({ message: req.t( 'namespace-deleted' ) });
	})
);

app.post( '/update_namespace',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateNamespace( req, res ) {
		const ns = req.body.ns;
		const newProps = pick( ns, [ 'owners', 'title', 'description' ]);
		const namespace = await Namespace
			.findOne({ _id: ns._id })
			.populate( 'owners' )
			.exec();
		if ( !namespace ) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}
		newProps.owners = newProps.owners.map( x => trim( x ) );
		const toRemove = extractOwnersToRemove( newProps.owners, namespace.owners );
		debug( `Removing namespace from ${toRemove.length} owners...` );
		for ( let i = 0; i < toRemove.length; i++ ) {
			const user = toRemove[ i ];
			debug( `Removing namespace ${namespace.title} for user ${user.email}` );
			const arr = [];
			for ( let i = 0; i < user.ownedNamespaces.length; i++ ) {
				if ( !user.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
					arr.push( user.ownedNamespaces[ i ] );
				}
			}
			user.ownedNamespaces = arr;
			await user.save();
		}
		let owners = await User.find({ email: newProps.owners });
		debug( 'Found %d users...', owners.length );
		const organization = owners[ 0 ].organization;
		owners.forEach( owner => {
			let alreadyPresent = false;
			for ( let i = 0; i < owner.ownedNamespaces.length; i++ ) {
				if ( owner.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
					alreadyPresent = true;
				}
			}
			if ( !alreadyPresent ) {
				debug( `Designate ${owner.email} as owner of namespace.` );
				owner.ownedNamespaces.addToSet( namespace );
				owner.save();
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': 'Course Invitation',
					'to': owner.email,
					'text': `
						Dear ${owner.name}, you were added as an instructor to the course "${namespace.title}" at ${organization}.<br />
						Please click the link below to login into your ISLE dashboard to view and configure the materials of the course.
					`,
					'link': serverHostName
				};
				debug( 'Send email notification to '+owner.email );
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, 'Email service currently not available' );
					}
				});
			}
		});
		const newEmails = extractEmailsWithoutAccount( newProps.owners, owners );
		if ( newEmails.length > 0 ) {
			const newOwners = [];
			for ( let i = 0; i < newEmails.length; i++ ) {
				const email = newEmails[ i ];
				const user = new User({
					name: email.split( '@' )[ 0 ],
					email: email,
					organization: institutionName( email ),
					ownedNamespaces: [ namespace ]
				});
				await user.save();
				newOwners.push( user );
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': 'Course Invitation',
					'to': user.email,
					'text': `
						Dear ${user.name}, you are invited to join course "${namespace.title}" at ${organization} as an instructor.<br />
						Please click the link below to complete the registration processing by choosing a password of your liking.<br />
						You can then login with your email address and password at <a href="${serverHostName}">${serverHostName}</a> to view and configure the materials of the course.
					`,
					'link': `${serverHostName}/dashboard/#/complete-registration/?token=${user._id}`
				};
				debug( 'Mail: ' + JSON.stringify( mail ) );
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, 'Email service currently not available' );
					}
				});
			}
			owners = owners.concat( newOwners );
		}
		newProps.owners = owners;
		await namespace.updateOne({ $set: newProps });
		renameDirectory( namespace.title, ns.title, async () => {
			const newNamespace = await Namespace
				.findOne({ _id: ns._id })
				.populate( 'owners' )
				.exec();
			res.json({
				message: req.t( 'namespace-updated' ),
				namespace: newNamespace.toObject()
			});
		});
	})
);

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
		const updatedUser = await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: updatedUser.name
			})
		});
	})
);

app.post( '/admin_update_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUser( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const user = await User.findById( req.body.id );
		if ( req.body.name ) {
			user.name = req.body.name;
		}
		if ( req.body.password ) {
			user.password = req.body.password;
		}
		if ( req.body.organization ) {
			user.organization = req.body.organization;
		}
		if ( req.body.writeAccess === true || req.body.writeAccess === false ) {
			user.writeAccess = req.body.writeAccess;
		}
		if ( req.body.administrator === true || req.body.administrator === false ) {
			user.administrator = req.body.administrator;
		}
		if ( req.body.verifiedEmail === true || req.body.verifiedEmail === false ) {
			user.verifiedEmail = req.body.verifiedEmail;
		}
		const updatedUser = await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: updatedUser.name
			})
		});
	})
);

app.get( '/admin_overview_statistics',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onOverviewStatistics( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const nUsers = await User.estimatedDocumentCount();
		const nLessons = await Lesson.estimatedDocumentCount();
		const nCohorts = await Cohort.estimatedDocumentCount();
		const nNamespaces = await Namespace.estimatedDocumentCount();
		const nEvents = await Event.estimatedDocumentCount();
		const nFiles = await File.estimatedDocumentCount();
		const nSessionData = await SessionData.estimatedDocumentCount();
		const database = await mongooseConnection.db.stats();
		res.json({
			message: 'ok',
			statistics: {
				nUsers,
				nLessons,
				nCohorts,
				nNamespaces,
				nSessionData,
				nEvents,
				nFiles,
				database
			}
		});
	})
);

app.get( '/admin_historical_overview_statistics',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onOverviewStatistics( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const statistics = await OverviewStatistics.find();
		res.json({
			message: 'ok',
			statistics
		});
	})
);

app.post( '/update_user_password', function onUpdateUserPassword( req, res ) {
	debug( 'Should update user password...' );
	const newPassword = req.body.newPassword;
	const id = req.body.id;
	if ( !isString( newPassword ) ) {
		return res.status( 400 ).send( req.t( 'field-expect-string', {
			field: 'newPassword'
		}) );
	}
	if ( !isValidObjectId( id ) ) {
		return res.status( 400 ).send( req.t( 'invalid-id' ) );
	}
	User.findOne({ _id: id }, function onFindUser( err, user ) {
		if ( err || !user ) {
			return res.status( 404 ).send( req.t( 'user-nonexistent' ) );
		}
		user.verifiedEmail = true;
		user.password = newPassword;
		user.save( function onSaveUser( err ) {
			if ( err ) {
				return res.status( 404 ).send( req.t( 'password-update-failed' ) );
			}
			res.json({
				message: req.t( 'password-updated' )
			});
		});
	});
});

app.post( '/complete_registration',
	wrapAsync( async function onCompleteRegistration( req, res ) {
		debug( 'Should set name and user password...' );
		const newPassword = req.body.newPassword;
		const newName = req.body.newName;
		const id = req.body.id;
		if ( !isString( newPassword ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'newPassword'
			}) );
		}
		if ( !isString( newName ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'newName'
			}) );
		}
		if ( !isValidObjectId( id ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		const user = await User.findOne({ _id: id });
		if ( user.verifiedEmail ) {
			return res.status( 403 ).send( req.t( 'registration-already-completed' ) );
		}
		user.verifiedEmail = true;
		user.password = newPassword;
		user.name = newName;
		await user.save();
		res.json({
			message: req.t( 'registration-completed' )
		});
	})
);

app.post( '/login',
	wrapAsync( async function onLogin( req, res ) {
		const password = req.body.password;
		const email = req.body.email;
		if ( !isString( password ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'password'
			}) );
		}
		if ( !isString( email ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'email'
			}) );
		}
		const user = await User.findOne({ 'email': email });
		if ( !user ) {
			return res.status( 404 ).send( req.t( 'user-email-not-found' ) );
		}
		if ( !user.password ) {
			const mail = {
				'from': NOTIFICATIONS_EMAIL,
				'subject': 'Complete Registration',
				'to': user.email,
				'text': `
					Dear ${user.name}, please click the link below to complete the registration processing by entering your name and choosing a password of your liking.<br />
					You can then login with your email address and password at <a href="${serverHostName}">${serverHostName}</a>.
					Welcome to ISLE!
				`,
				'link': `${serverHostName}/dashboard/#/complete-registration/?token=${user._id}`
			};
			mailer.send( mail, function onDone( error ) {
				if ( error ) {
					throw new ErrorStatus( 503, 'Email service currently not available' );
				}
			});
			return res.status( 401 ).send( req.t( 'user-not-activated' ) );
		}
		const isMatch = await user.comparePassword( password );
		if ( isMatch ) {
			// Identify users by their ID:
			const payload = { id: user.id };
			const token = jwt.sign( payload, jwtOptions.secretOrKey );
			res.json({ message: 'ok', token: token, id: user.id });
		} else {
			res.status( 401 ).send( req.t( 'password-incorrect' ) );
		}
	})
);

app.post( '/shibboleth',
	wrapAsync( async function onLogin( req, res ) {
		let { eppn, name, affil, time, salt, token } = req.body;
		eppn = decodeBase64String( eppn );
		name = decodeBase64String( name );
		affil = decodeBase64String( affil );

		const roundedTime = roundn( Number( time ), 1 );
		const currentTime = roundn( new Date().getTime() / 1000, 1 );
		if ( currentTime - roundedTime >= SHIBBOLETH_TOLERANCE ) {
			return res.status( 401 ).send( req.t( 'token-expired' ) );
		}
		const recreatedToken = recreateShibbolethToken({ eppn, name, affil, time, salt });
		if ( recreatedToken !== token ) {
			return res.status( 401 ).send( req.t( 'invalid-credentials' ) );
		}
		let user = await User.findOne({ email: eppn });
		if ( !user ) {
			try {
				const numUsers = await User.estimatedDocumentCount();
				user = new User({
					email: eppn,
					name,
					organization: institutionName( eppn ),
					writeAccess: numUsers === 0, // Make first registered user an instructor
					administrator: numUsers === 0 // Make first registered user an administrator...
				});
				await user.save();
			} catch ( err ) {
				throw new ErrorStatus( 403, err.message );
			}
		}
		const payload = { id: user.id };
		const jsonWebToken = jwt.sign( payload, jwtOptions.secretOrKey );
		res.json({ message: 'ok', token: jsonWebToken, id: user.id });
	})
);

app.post( '/impersonate',
	passport.authenticate( 'jwt', { session: false }),
	async function onImpersonate( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const correctPassword = await req.user.comparePassword( req.body.password );
		if ( !correctPassword ) {
			return res.status( 401 ).send( req.t( 'invalid-credentials' ) );
		}
		const payload = { id: req.body.id };
		const token = jwt.sign( payload, jwtOptions.secretOrKey );
		const out = { message: 'ok', token: token, id: req.body.id };
		res.json( out );
	}
);

app.post( '/store_session_element', function onStoreSessionElement( req, res ) {
	debug( 'Should store session element...' );
	if ( req.body ) {
		const formData = req.body;
		if ( formData.type === 'action' ) {
			let sessionData;
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
					return res.status( 404 ).send( req.t( 'session-data-save-failed' ) );
				}
				res.json({
					message: req.t( 'user-action-saved' ),
					id: product._id
				});
			});
		}
	}
});

// TODO: Convert to POST request in next major update
app.get( '/delete_session_element', passport.authenticate( 'jwt', { session: false }), function onDeleteSessionElement( req, res ) {
	debug( 'Should delete session element...' );
	SessionData.findById( req.query._id, onFindSessionData );

	function onFindSessionData( err, sessionData ) {
		if ( err || !sessionData ) {
			return res.status( 404 ).send( req.t( 'session-data-nonexistent' ) );
		}

		Lesson.findById( sessionData.lesson, function onFindLesson( err, lesson ) {
			Namespace.findOne({ _id: lesson.namespace, owners: { $in: [ req.user ]}}, onNamespace );
		});

		function onNamespace( err, namespace ) {
			if ( err ) {
				return res.status( 403 ).send( req.t( 'access-denied-no-owner' ) );
			}
			if ( namespace ) {
				sessionData.remove( onRemove );
			}
		}
	}

	function onRemove( err ) {
		if ( err ) {
			return res.status( 400 ).send( req.t( 'session-data-removal-failed' ) );
		}
		res.json({ message: req.t( 'session-data-removed' ) });
	}
});

app.post( '/get_user_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserActions( req, res ) {
		if ( !req.body.lessonID ) {
			return res.status( 422 ).send( req.t( 'missing-field', {
				field: 'lessonID'
			}) );
		}
		const actions = await SessionData
			.find({ type: 'action', lesson: req.body.lessonID }, null )
			.sort( '-data.absoluteTime' )
			.limit( MAX_NUM_ACTIONS )
			.exec();
		debug( `Return ${actions.length} actions to the caller` );
		res.json({
			actions: actions.map( d => {
				const out = d.data;
				out.sessiondataID = d._id;
				return out;
			})
		});
	})
);

app.get( '/get_namespace_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserActions( req, res ) {
		if ( !req.query.namespaceID ) {
			return res.status( 422 ).send( req.t( 'missing-field', {
				field: 'namespaceid'
			}) );
		}
		const lessons = await Lesson.find({ namespace: req.query.namespaceID });
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

app.get( '/get_sketchpad_shared_data',
	wrapAsync( async function onGetSketchpadSharedData( req, res ) {
		debug( 'Return owner annotations to visitor...' );
		const ownerTable = await SketchpadOwnerData.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID
		});
		let sharedElements;
		let ownerState;
		let noPages;
		if ( !ownerTable ) {
			return res.json( null );
		}
		ownerState = ownerTable.data.state;
		noPages = ownerState.noPages;
		sharedElements = new Array( noPages );
		for ( let i = 0; i < noPages; i++ ) {
			sharedElements[ i ] = [];
			const { data } = ownerTable;
			const ownerElements = data.elements[ i ];
			const len = ownerElements.length - ownerTable.data.nUndos[ i ];
			for ( let j = 0; j < len; j++ ) {
				sharedElements[ i ].push( ownerElements[ j ] );
			}
		}
		const out = {
			state: ownerState,
			sharedElements: sharedElements
		};
		res.json( out );
	})
);

app.get( '/get_sketchpad_user_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
		const owner = await isOwner( req.user, req.query.namespaceID );
		debug( owner ? 'User is an owner' : 'User is not an owner' );
		if ( owner ) {
			// Case: User is an owner...
			const val = await SketchpadOwnerData.findOne({
				lesson: req.query.lessonID,
				id: req.query.sketchpadID
			});
			if ( !val ) {
				return res.json( null );
			}
			return res.json( val.data );
		}
		// Case: User is not an owner:
		const userTable = await SketchpadUserData.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID,
			user: req.user
		});
		const ownerTable = await SketchpadOwnerData.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID
		});
		let sharedElements;
		let ownerState;
		let noPages;
		if ( ownerTable ) {
			ownerState = ownerTable.data.state;
			noPages = ownerState.noPages;
			sharedElements = new Array( noPages );
			for ( let i = 0; i < noPages; i++ ) {
				sharedElements[ i ] = [];
				const { data } = ownerTable;
				const ownerElements = data.elements[ i ];
				const len = ownerElements.length - ownerTable.data.nUndos[ i ];
				for ( let j = 0; j < len; j++ ) {
					sharedElements[ i ].push( ownerElements[ j ] );
				}
			}
		}
		if ( !sharedElements && !userTable ) {
			return res.json( null );
		}
		const out = {};
		if ( userTable ) {
			out.elements = userTable.data.elements;
			out.state = ownerState || userTable.data.state;
			out.nUndos = userTable.data.nUndos;
			out.sharedElements = sharedElements || null;
			if ( out.sharedElements && out.elements ) {
				out.state.noPages = noPages;
				out.state.insertedPages = ownerTable.data.state.insertedPages;
				harmonizeSketchpadElements(
					out.elements,
					out.nUndos,
					userTable.data.state.insertedPages,
					ownerTable.data.state.insertedPages
				);
			}
		} else {
			out.state = ownerState;
			out.sharedElements = sharedElements;
		}
		res.json( out );
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
					id: req.body.sketchpadID
				},
				{ data: req.body.data },
				{ new: true, upsert: true }
			);
			res.json({ message: req.t( 'owner-data-saved' ) });
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
			res.json({ message: req.t( 'user-data-saved' ) });
		}
	})
);

app.post( '/retrieve_data',
	wrapAsync( async function onRetrieveData( req, res ) {
		debug( 'Should retrieve data...' );
		if ( req.body ) {
			let query = req.body.query;
			const data = await SessionData.find({ 'data.id': query.componentID });
			debug( 'Return found data...' );
			res.json( data );
		}
	})
);

app.post( '/create_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateCohort( req, res ) {
		debug( 'POST request: ' + JSON.stringify( req.body ) );
		if ( req.body.title && req.body.namespaceID ) {
			const cohort = new Cohort({
				title: req.body.title,
				namespace: req.body.namespaceID,
				startDate: req.body.startDate,
				endDate: req.body.endDate,
				private: req.body.private,
				emailFilter: req.body.emailFilter,
				members: []
			});
			let students = req.body.students;
			if ( students.includes( ',' ) ) {
				students = students.split( ',' ).map( x => trim( x ) );
			} else if ( students ) {
				students = [ trim( students ) ];
			} else {
				students = [];
			}
			const namespace = await Namespace.findOne({
				_id: req.body.namespaceID
			}).populate( 'owners' ).exec();
			const { users, newEmails } = await sendCohortInvitations( students, cohort, namespace, req.user );
			cohort.members = users;
			try {
				await cohort.save();
				res.json({
					message: req.t( 'cohort-created' ),
					successful: true,
					newEmails: newEmails
				});
			} catch ( err ) {
				debug( 'Encountered an error when saving cohort: ' + err.message );
				res.status( 401 ).send( err.message );
			}
		}
	})
);

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

app.get( '/get_all_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllCohorts( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'all-cohorts-only-admin' ) );
		}
		const memberFields = req.query.memberFields || 'email name picture';
		const namespaceFields = req.query.namespaceFields || 'title';
		const cohorts = await Cohort
			.find({})
			.populate( 'members', memberFields )
			.populate( 'namespace', namespaceFields )
			.exec();
		res.json({ message: 'ok', cohorts });
	})
);

app.post( '/delete_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteCohort( req, res ) {
		const cohort = await Cohort.findOne({
			_id: req.body._id
		});
		if ( !cohort ) {
			return res.status( 404 ).send( req.t( 'cohort-nonexistent' ) );
		}
		if ( !req.user.administrator ) {
			// Check whether user is course owner and thus allowed to delete cohort:
			const namespace = await Namespace.findOne({
				_id: cohort.namespace,
				owners: { $in: [ req.user ]}
			});
			if ( !namespace ) {
				return res.status( 403 ).send( req.t( 'access-denied-no-owner' ) );
			}
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
		res.json({ message: req.t( 'cohort-deleted' ) });
	})
);

app.post( '/add_to_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const cohortID = req.body.cohortID;
		debug( 'Add user to cohort with ID '+cohortID );
		const user = req.user;
		const cohort = await Cohort.findOneAndUpdate(
			{ _id: cohortID },
			{ $addToSet: { members: user }},
			{ new: true });
		debug( `Updated cohort ${cohort.title}...` );
		user.enrolledNamespaces.addToSet( cohort.namespace );
		await user.save();
		res.json({ message: req.t( 'user-added-to-cohort' ) });
	})
);

app.post( '/update_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const updatedCohort = req.body.cohort;
		const newProps = pick( updatedCohort, [ 'members', 'title', 'startDate', 'endDate', 'private', 'emailFilter' ]);

		debug( 'Updated cohort: '+ JSON.stringify( updatedCohort ) );
		const cohort = await Cohort
			.findOne({ _id: updatedCohort._id })
			.populate( 'members' )
			.populate({
				path: 'namespace',
				populate: { path: 'owners' }
			})
			.exec();
		if ( !cohort ) {
			return res.status( 404 ).send( req.t( 'cohort-nonexistent' ) );
		}
		for ( let i = 0; i < cohort.members.length; i++ ) {
			const user = cohort.members[ i ];
			const idx = user.enrolledNamespaces.indexOf( cohort.namespace );
			if ( idx !== -1 ) {
				user.enrolledNamespaces.splice( idx, 1 );
				await user.save();
			}
		}
		if ( newProps.members.includes( ',' ) ) {
			newProps.members = newProps.members.split( ',' ).map( x => trim( x ) );
		} else if ( newProps.members ) {
			newProps.members = [ trim( newProps.members ) ];
		} else {
			newProps.members = [];
		}
		const { users, newEmails } = await sendCohortInvitations( newProps.members, cohort, cohort.namespace, req.user );
		newProps.members = users;
		await cohort.updateOne({ $set: newProps });
		res.json({
			message: req.t( 'cohort-updated' ),
			newEmails: newEmails
		});
	})
);

app.get( '/get_files',
	wrapAsync( async function onRequest( req, res ) {
		if ( !isString( req.query.namespaceName ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'namespaceName'
			}) );
		}
		debug( `Retrieve lessons for namespace ${req.query.namespaceName}...` );
		const namespace = await Namespace.findOne({ title: req.query.namespaceName });
		let files;
		if ( isString( req.query.lessonName ) ) {
			const lesson = await Lesson.findOne({ namespace: namespace, title: req.query.lessonName });
			const query = {
				'namespace': namespace,
				'lesson': lesson
			};
			if ( req.query.owner === 'true' ) {
				query.owner = true;
			} else if ( req.query.owner === 'false' ) {
				query.owner = { $ne: true };
			}
			files = await File.find( query )
				.lean()
				.exec();
		} else {
			const query = {
				'namespace': namespace
			};
			if ( req.query.owner === 'true' ) {
				query.owner = true;
			} else if ( req.query.owner === 'false' ) {
				query.owner = { $ne: true };
			}
			files = await File.find( query )
				.lean()
				.exec();
		}
		const ids = files.map( x => x.user );
		const users = await User.find({
			'_id': { $in: ids }
		});
		for ( let i = 0; i < files.length; i++ ) {
			for ( let j = 0; j < users.length; j++ ) {
				if ( users[ j ]._id.equals( ids[ i ] ) ) {
					files[ i ].name = users[ j ].name;
					files[ i ].email = users[ j ].email;
				}
			}
		}
		debug( req.t( 'returned-files', {
			nFiles: files.length
		}) );
		res.json({
			'files': files
		});
	})
);

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
		res.json({ message: req.t( 'file-saved' ), filename: req.file.filename });
	})
);

app.post( '/delete_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteFile( req, res ) {
		const file = await File.findOne({ _id: req.body._id });
		if ( !file ) {
			return res.status( 404 ).send( req.t( 'file-nonexistent' ) );
		}
		await file.remove();
		res.json({ message: req.t( 'file-deleted' ) });
	})
);

app.post( '/upload_profile_pic',
	fileUpload.single( 'avatar' ),
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		req.user.picture = req.file.filename;
		await req.user.save();
		res.json({
			message: req.t( 'profile-picture-saved' ),
			filename: req.file.filename
		});
	})
);

app.post( '/upload_thumbnail_pic',
	fileUpload.single( 'thumbnail' ),
	passport.authenticate( 'jwt', { session: false }),
	function onUploadFile( req, res ) {
		res.status( 200 ).send( req.t( 'operation-successful' ) );
	}
);

app.get( '/get_jitsi_token',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function getJitsiToken( req, res ) {
			if ( !jitsi.server ) {
				return res.status( 501 ).send( req.t( 'jitsi-not-available' ) );
			}
			const owner = await isOwner( req.user, req.query.namespaceID );
			const payload = {
				user: {
					avatar: serverHostName + '/avatar/' + req.user.picture,
					name: req.user.name,
					email: req.user.email
				},
				aud: 'jitsi',
				iss: jitsi.appId,
				sub: jitsi.server,
				moderator: owner,
				room: '*',
				exp: ceil( ( new Date().getTime() / 1000 ) + THREE_HOURS_IN_SECONDS )
			};
			const token = jwt.sign( payload, jitsi.appSecret );
			res.json({ message: 'ok', token: token, server: jitsi.server });
	})
);

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

app.get( '/get_all_namespaces',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllNamespaces( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'all-namespaces-only-admin' ) );
		}
		const namespaces = await Namespace
			.find({})
			.populate( 'owners', [ 'name', 'email', 'picture' ] )
			.exec();
		res.json({ message: 'ok', namespaces });
	})
);

app.get( '/get_users',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUsers( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'all-users-only-admin' ) );
		}
		const users = await User.find({});
		res.json({ message: 'ok', users });
	})
);

app.post( '/delete_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUsers( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'user-delete-only-admin') );
		}
		const status = await User.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'user-deleted' ), status });
	})
);

app.post( '/update_user_session',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUserSession( req, res ) {
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
		const stats = await User.updateOne({ '_id': user._id }, {
			lessonData,
			score,
			spentTime
		});
		debug( 'Result: ' + JSON.stringify( stats ) );
		res.json({
			score,
			spentTime
		});
	})
);

app.get( '/get_events',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetEvents( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'all-events-only-admin' ) );
		}
		const events = await Event
			.find({})
			.populate( 'user', [ 'name', 'email', 'picture' ] )
			.exec();
		res.json({ message: 'ok', events });
	})
);

app.post( '/delete_event',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteEvent( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'even-delete-only-admin' ) );
		}
		const status = await Event.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'event-deleted' ), status });
	})
);

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
