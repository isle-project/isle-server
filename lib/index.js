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

const { readFileSync } = require( 'fs' );
const path = require( 'path' );
const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const cookieParser = require( 'cookie-parser' );
const cookieSession = require( 'cookie-session' );
const jwt = require( 'jsonwebtoken' );
const morgan = require( 'morgan' );
const cors = require( 'cors' );
const rfs = require( 'rotating-file-stream' );
const i18nextMiddleware = require( 'i18next-http-middleware' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const i18next = require( './i18n.js' );
const User = require( './models/user.js' );
const fromWithinApp = require( './helpers/from_within.js' );
const socketHandler = require( './sockets/handler.js' );
const ErrorStatus = require( './helpers/error.js' );
const isAdmin = require( './helpers/is_admin.js' );
const institutionName = require( './utils/institution_name.js' );
const config = require( '../etc/config.json' );
const { tokens } = require( './credentials.js' );
const { BACKUP_DIRECTORY, LOCALES_DIRECTORY, LOGS_DIRECTORY, MEDIA_DIRECTORY, NAMESPACES_DIRECTORY } = require( './constants.js' );
const samlFactory = require( 'express-saml2-middleware' );
require( './connect_mongoose.js' );
require( './create_events.js' );
require( './scheduler.js' );


// VARIABLES //

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

const { samlMiddleware, samlRouter, samlRoot } = samlFactory({
	sp: {
		entityID: 'https://echo.kymetis.com',
		signingCert: { file: path.join( __dirname, '..', 'etc', 'saml', 'signing.cert.pem' ) },
		signingKey: { file: path.join( __dirname, '..', 'etc', 'saml', 'signing.key.pem' ) },
		encryptCert: { file: path.join( __dirname, '..', 'etc', 'saml', 'encrypt.cert.pem' ) },
		encryptKey: { file: path.join( __dirname, '..', 'etc', 'saml', 'encrypt.key.pem' ) }
	},
	idp: {
		url: 'https://dev-3274909.okta.com/app/exk2a60squXRy0kvZ5d7/sso/saml/metadata',
		isAssertionEncrypted: false
	},
	exemptPatterns: [
		'echo.kymetis.com'
	],
	altLogin: '/dashboard/#/login',
	getUser: async ( attributes ) => {  // eslint-disable-line require-await
		let user = await User.findOne({ email: attributes.email });
		if ( !user ) {
			try {
				const numUsers = await User.estimatedDocumentCount();
				user = new User({
					email: attributes.email,
					name: attributes.givenName + ' ' + attributes.sn,
					organization: institutionName( attributes.email ),
					writeAccess: numUsers === 0, // Make first registered user an instructor
					administrator: numUsers === 0 // Make first registered user an administrator...
				});
				await user.save();
			} catch ( err ) {
				throw new ErrorStatus( 403, err.message );
			}
		}
		const payload = { id: user.id };
		const jsonWebToken = jwt.sign( payload, tokens.jwtKey );
		return {
			token: jsonWebToken,
			id: user.id
		};
	}
});


// MAIN //

const app = express();

let server;
if ( config[ 'key' ] && config[ 'certificate' ] ) {
	const privateKey = readFileSync( config[ 'key' ] );
	const certificate = readFileSync( config[ 'certificate' ] );
	server = require( 'https' ).createServer({
		key: privateKey,
		cert: certificate
	}, app );
} else {
	throw new Error( 'SSL certificate and key have to be supplied.' );
}

// Attach web socket handling to express:
const io = require( 'socket.io' )( server, {
	allowEIO3: true
});
socketHandler( io );

// Configure CORS (TODO: should be revisited):
app.use( cors({
	'origin': '*',
	'methods': 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
	'preflightContinue': false,
	'optionsSuccessStatus': 204,
	'allowedHeaders': [ 'Range', 'Authorization', 'Content-Type', 'If-Modified-Since', 'X-Context-Level', 'X-Context-Target' ],
	'exposedHeaders': [ 'Content-Range', 'Content-Encoding', 'Content-Length', 'Accept-Ranges' ],
	'credentials': true
}) );

app.use(
	i18nextMiddleware.handle( i18next, {
		ignoreRoutes: [
			'/logs'
		]
	})
);

app.use( cookieParser( tokens.cookieSecret ) );

app.use( cookieSession({
	name: 'session',
	keys: [ tokens.cookieSecret ]
}) );

app.use( samlMiddleware );
app.use( samlRoot, samlRouter );

app.use( '/files/', fromWithinApp );

app.use( express.static( NAMESPACES_DIRECTORY ) );

app.use( express.static( MEDIA_DIRECTORY ) );

app.use( express.static( BACKUP_DIRECTORY ) );

app.use( '/locales/', express.static( LOCALES_DIRECTORY ) );

app.use( morgan( 'common', {
	stream: accessLogStream
}) );

app.use( '/logs/',
	isAdmin,
	express.static( LOGS_DIRECTORY )
);

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

app.use( require('./statistics.js' ) );
app.use( require('./announcements.js' ) );
app.use( require('./backups.js' ) );
app.use( require('./badges.js' ) );
app.use( require('./cohorts.js' ) );
app.use( require('./custom_fields.js' ) );
app.use( require('./events.js' ) );
app.use( require('./files.js' ) );
app.use( require('./lessons.js' ) );
app.use( require('./license.js' ) );
app.use( require('./login.js' ) );
app.use( require('./mail.js' ) );
app.use( require('./namespaces.js' ) );
app.use( require('./roles.js' ) );
app.use( require('./services.js' ) );
app.use( require('./sessiondata.js' ) );
app.use( require('./settings.js' ) );
app.use( require('./sketchpad.js' ) );
app.use( require('./statistics.js' ) );
app.use( require('./sticky_notes.js' ) );
app.use( require('./text_editor_document.js' ) );
app.use( require('./tickets.js' ) );
app.use( require('./two_factor_authentication.js' ) );
app.use( require('./users.js' ) );

app.get( '/', function onDefault( req, res ) {
	req.session.inDashboard = true;
	res.redirect( '/dashboard/' );
});

app.get( '/ping', function onPing( req, res ) {
	debug( 'Send live status...' );
	req.session.inLesson = true;
	res.send( 'live' );
});

app.get( '/robots.txt', function onRobotsTxt( req, res ) {
	res.type( 'text/plain' );
	res.send( 'User-agent: *\nDisallow: /' );
});

app.use( function onError( err, req, res, next ) {
	const msg = `${req.method} ${req.url}: ${err.message}`;
	debug( `Encountered an error in ${msg}` );
	const date = new Date();
	errorLogStream.write( `${msg} - ${date.toLocaleString()}` );
	errorLogStream.write( '\n' );
	const statusCode = err.statusCode || 404;
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
