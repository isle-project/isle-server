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
const join = require( 'path' ).join;
const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const morgan = require( 'morgan' );
const cors = require( 'cors' );
const rfs = require( 'rotating-file-stream' );
const i18next = require( 'i18next' );
const i18nextMiddleware = require( 'i18next-http-middleware' );
const i18nextBackend = require( 'i18next-fs-backend' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const socketHandler = require( './sockets/handler.js' );
const isAdmin = require( './helpers/is_admin.js' );
const config = require( '../etc/config.json' );
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

app.use( express.static( BACKUP_DIRECTORY ) );

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
app.use( require('./license.js' ) );
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
app.use( require('./services.js' ) );
app.use( require('./sessiondata.js' ) );
app.use( require('./sketchpad.js' ) );
app.use( require('./statistics.js' ) );
app.use( require('./sticky_notes.js' ) );
app.use( require('./text_editor_document.js' ) );
app.use( require('./tickets.js' ) );
app.use( require('./two_factor_authentication.js' ) );
app.use( require('./users.js' ) );

app.get( '/', function onDefault( req, res ) {
	res.redirect( '/dashboard/' );
});

app.get( '/ping', function onPing( req, res ) {
	debug( 'Send live status...' );
	res.send( 'live' );
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
