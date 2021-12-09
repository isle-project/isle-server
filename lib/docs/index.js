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


// VARIABLES //

const swaggerDefinition = {
	info: {
		title: 'ISLE Server API',
		version: '1.0.0',
		description: 'ISLE Server REST API documentation'
	},
	host: 'localhost:3000',
	basePath: '/'
};

const options = {
	swaggerDefinition,
	apis: [
		path.resolve( __dirname, '..', 'backups.js' )
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
