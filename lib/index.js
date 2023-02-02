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

/**
 * @openapi
 *
 * tags:
 *   name: Basic
 *   description: General endpoints.
 */

// MODULES //

const { readFileSync } = require( 'fs' );
const express = require( 'express' );
const { join } = require( 'path' );
const bodyParser = require( 'body-parser' );
const tldjs = require( 'tldjs' );
const cookieParser = require( 'cookie-parser' );
const cookieSession = require( 'cookie-session' );
const morgan = require( 'morgan' );
const cors = require( 'cors' );
const rfs = require( 'rotating-file-stream' );
const { instrument } = require( '@socket.io/admin-ui' );
const i18nextMiddleware = require( 'i18next-http-middleware' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const i18next = require( './i18n.js' );
const fromWithinApp = require( './helpers/from_within.js' );
const socketHandler = require( './sockets/handler.js' );
const isAdmin = require( './helpers/is_admin.js' );
const config = require( '../etc/config.json' );
const pkgJSON = require( './../package.json' );
const { tokens } = require( './credentials.js' );
const registerSAML = require( './saml.js' );
const { BACKUP_DIRECTORY, LOCALES_DIRECTORY, LOGS_DIRECTORY, MEDIA_DIRECTORY, NAMESPACES_DIRECTORY } = require( './constants.js' );
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

let hasSocketInstrumentation = false;


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
	allowEIO3: true,
	cors: {
		origin: [ 'https://admin.socket.io' ],
		credentials: true
	}
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
		ignoreRoutes: []
	})
);

app.use( cookieParser( tokens.cookieSecret ) );

app.use( cookieSession({
	name: 'session',
	domain: '.' + tldjs.cleanHostValue( config.server ),
	keys: [ tokens.cookieSecret ],
	sameSite: 'none',
	maxAge: 7 * 24 * 60 * 60 * 1000 // Seven days...
}) );

/**
 * @openapi
 *
 * /ping:
 *   get:
 *     summary: Ping the server.
 *     description: Should return a 200 OK response.
 *     tags: [Basic]
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           text/plain:
 *             example: live
 */
app.get( '/ping', function onPing( req, res ) {
	debug( 'Send live status...' );
	req.session.inLesson = true;
	res.send( 'live' );
});

/**
 * @openapi
 *
 * /socket.io-admin:
 *   post:
 *     summary: Socket.io admin dashboard UI
 *     description: Redirects to the Socket.io admin dashboard UI.
 *     tags: [Basic]
 */
app.get( '/socket.io-admin',
	isAdmin,
	function onSocketIOAdmin( req, res ) {
		if ( !hasSocketInstrumentation ) {
			instrument( io, {
				auth: false
			});
			hasSocketInstrumentation = true;
		}
		res.sendFile( join( __dirname, '..', 'node_modules', '@socket.io/admin-ui', 'ui', 'dist', 'index.html' ) );
	}
);

/**
 * @openapi
 *
 * /version:
 *   get:
 *     summary: Get the server version
 *     description: Returns the version of the server.
 *     tags: [Basic]
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           text/plain:
 *             example: 1.0.0
 */
app.get( '/version', function onVersion( req, res ) {
	debug( 'Send version...' );
	res.send( pkgJSON.version );
});

app.get( '/robots.txt', function onRobotsTxt( req, res ) {
	res.type( 'text/plain' );
	res.send( 'User-agent: *\nDisallow: /' );
});

app.get( '/favicon.ico', function onFavicon( req, res ) {
	res.redirect( '/dashboard/favicon.ico' );
});

app.use( '/logs/',
	isAdmin,
	express.static( LOGS_DIRECTORY )
);

registerSAML( app );

app.use( '/files/', fromWithinApp );

app.use( express.static( NAMESPACES_DIRECTORY ) );

app.use( express.static( MEDIA_DIRECTORY ) );

app.use( express.static( BACKUP_DIRECTORY ) );

app.use( '/locales/', express.static( LOCALES_DIRECTORY ) );

app.use( morgan( 'common', {
	stream: accessLogStream
}) );


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
app.use( require('./docs' ) );

app.get( '/', function onDefault( req, res ) {
	req.session.inDashboard = true;
	res.redirect( '/dashboard/' );
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
