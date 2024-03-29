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

const resolve = require( 'path' ).resolve;
const join = require( 'path' ).join;
const router = require( 'express' ).Router();
const swaggerJSDoc = require( 'swagger-jsdoc' );
const { SERVER_HOST_NAME } = require( './../constants.js' );
const pkg = require( './../../package.json' );


// VARIABLES //

const swaggerDefinition = {
	info: {
		title: 'ISLE Server API',
		version: pkg.version,
		description: 'ISLE Server REST API documentation'
	},
	openapi: '3.0.1', // Specification (optional, defaults to swagger: '2.0')
	license: {
		name: 'AGPL-3.0-only',
		url: 'https://raw.githubusercontent.com/isle-project/isle-server/master/LICENSE'
	},
	components: {
		securitySchemes: {
			JWT: {
				description: 'Prefix the JSON web token with "JWT" in the "Authorization" header to indicate the custom authorization type.',
				type: 'http',
				name: 'Authorization',
				scheme: 'JWT',
				in: 'header'
			}
		}
	},
	contact: {
		name: 'Philipp Burckhardt',
		url: 'http://isledocs.com',
		email: 'pgb@andrew.cmu.edu'
	},
	host: SERVER_HOST_NAME,
	basePath: '/'
};

const options = {
	swaggerDefinition,
	apis: [
		resolve( __dirname, '..', 'index.js' ),
		resolve( __dirname, '..', 'models', '*.js' ),
		resolve( __dirname, '..', 'announcements.js' ),
		resolve( __dirname, '..', 'badges.js' ),
		resolve( __dirname, '..', 'backups.js' ),
		resolve( __dirname, '..', 'cohorts.js' ),
		resolve( __dirname, '..', 'custom_fields.js' ),
		resolve( __dirname, '..', 'events.js' ),
		resolve( __dirname, '..', 'files.js' ),
		resolve( __dirname, '..', 'lessons.js' ),
		resolve( __dirname, '..', 'license.js' ),
		resolve( __dirname, '..', 'login.js' ),
		resolve( __dirname, '..', 'namespaces.js' ),
		resolve( __dirname, '..', 'roles.js' ),
		resolve( __dirname, '..', 'settings.js' ),
		resolve( __dirname, '..', 'services.js' ),
		resolve( __dirname, '..', 'session_data.js' ),
		resolve( __dirname, '..', 'sketchpad.js' ),
		resolve( __dirname, '..', 'statistics.js' ),
		resolve( __dirname, '..', 'sticky_notes.js' ),
		resolve( __dirname, '..', 'text_editor_document.js' ),
		resolve( __dirname, '..', 'tickets.js' ),
		resolve( __dirname, '..', 'two_factor_authentication.js' ),
		resolve( __dirname, '..', 'users.js' )
	],
	failOnErrors: true,
	verbose: true
};

const swaggerSpec = swaggerJSDoc( options );


// MAIN //

router.get( '/docs/swagger.json', ( req, res ) => {
	res.setHeader( 'Content-Type', 'application/json' );
	res.send( swaggerSpec );
});

router.get( '/docs', ( req, res ) => {
	res.sendFile( join( __dirname, 'redoc.html' ) );
});


// EXPORTS //

module.exports = router;
