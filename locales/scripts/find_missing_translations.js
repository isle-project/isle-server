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

const { execSync } = require( 'child_process' );
const { resolve } = require( 'path' );
const translations = require( './../en/server.json' );


// VARIABLES //

const TOPLEVEL_DIR = resolve( __dirname, '..', '..' );


// MAIN //

const identifiers = execSync( 'grep -hroP "req.t\\( ?\'\\K[^\']*(?=\' ?\\))" lib/* ', {
	cwd: TOPLEVEL_DIR
})
	.toString()
	.split( '\n' );
const unique = new Set( identifiers );

unique.forEach( value => {
	if ( value && !translations[ value ] ) {
		console.log( 'Missing translation: '+value ); // eslint-disable-line no-console
	}
});

console.log( 'Finished.' ); // eslint-disable-line no-console
