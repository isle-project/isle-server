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

const path = require( 'path' );
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
	openapi: '3.0.0', // Specification (optional, defaults to swagger: '2.0')
	license: {
		name: 'AGPL-3.0-only',
		url: 'https://raw.githubusercontent.com/isle-project/isle-server/master/LICENSE'
	},
	securityDefinitions: {
		jwt: {
			type: 'JWT',
			name: 'Authorization',
			in: 'header'
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
		path.resolve( __dirname, '..', 'models', '*.js' ),
		path.resolve( __dirname, '..', 'announcements.js' ),
		path.resolve( __dirname, '..', 'badges.js' ),
		path.resolve( __dirname, '..', 'backups.js' ),
		path.resolve( __dirname, '..', 'custom_fields.js' ),
		path.resolve( __dirname, '..', 'events.js' ),
		path.resolve( __dirname, '..', 'license.js' ),
		path.resolve( __dirname, '..', 'roles.js' ),
		path.resolve( __dirname, '..', 'settings.js' )
	]
};

const swaggerSpec = swaggerJSDoc( options );


// MAIN //

router.get( '/docs/swagger.json', ( req, res ) => {
	res.setHeader( 'Content-Type', 'application/json' );
	res.send( swaggerSpec );
});

router.get( '/docs', ( req, res ) => {
	res.sendFile( path.join( __dirname, 'redoc.html' ) );
});


// EXPORTS //

module.exports = router;
