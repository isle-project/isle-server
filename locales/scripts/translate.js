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

const axios = require( 'axios' );
const glob = require( 'glob' );
const fs = require( 'fs' );
const path = require( 'path' );
const qs = require( 'qs' );
const readJSON = require( '@stdlib/fs/read-json' );
const objectKeys = require( '@stdlib/utils/keys' );
const ENV = require( '@stdlib/process/env' );


// CONSTANTS //

const LANGUAGE_TARGETS = [ 'de', 'es', 'fr', 'it', 'ja', 'nl', 'pl', 'pt', 'ru', 'zh' ];
const deepl = {
	'server': 'https://api.deepl.com/v2/translate',
	'auth_key': ENV.DEEPL_KEY
};
const TOPLEVEL_DIR = path.resolve( __dirname, '..', '..' );


// MAIN //

const options = {
	cwd: TOPLEVEL_DIR
};
glob( 'locales/en/translation.json', options, function onFiles( err, files ) {
	for ( let i = 0; i < files.length; i++ ) {
		const file = path.resolve( TOPLEVEL_DIR, files[ i ] );
		const reference = readJSON.sync( file );
		const refKeys = objectKeys( reference );
		refKeys.sort( ( a, b ) => {
			return a.localeCompare(b);
		});
		const sortedReference = {};
		for ( let i = 0; i < refKeys.length; i++ ) {
			const key = refKeys[ i ];
			sortedReference[ key ] = reference[ key ];
		}
		fs.writeFileSync( file, JSON.stringify( sortedReference, null, '\t' ).concat( '\n' ) );

		for ( let j = 0; j < LANGUAGE_TARGETS.length; j++ ) {
			const lng = LANGUAGE_TARGETS[ j ];
			const filePath = path.join( __dirname, '..', lng, 'translation.json' );
			if ( !fs.existsSync( filePath ) ) {
				fs.writeFileSync( filePath, JSON.stringify({}) );
			}
			const targetJSON = readJSON.sync( filePath );
			const promises = [];
			const promiseKeys = [];
			for ( let k = 0; k < refKeys.length; k++ ) {
				const key = refKeys[ k ];
				if ( !targetJSON[ key ] ) {
					const textToTranslate = reference[ key ];
					console.log( 'Translate `'+textToTranslate+'` to '+lng ); // eslint-disable-line no-console
					promiseKeys.push( key );
					promises.push( axios.post( deepl.server, qs.stringify({
						auth_key: deepl.auth_key,
						source_lang: 'EN',
						text: textToTranslate,
						target_lang: lng === 'pt' ? 'PT-BR' : lng.toUpperCase()
					}) ) );
				}
			}
			Promise.all( promises )
				.then( results => {
					const translations = results.map( x => x.data.translations[ 0 ].text );
					for ( let i = 0; i < promiseKeys.length; i++ ) {
						const key = promiseKeys[ i ];
						targetJSON[ key ] = translations[ i ];
					}
					refKeys.sort( ( a, b ) => {
						return a.localeCompare(b);
					});
					const out = {};
					for ( let i = 0; i < refKeys.length; i++ ) {
						const key = refKeys[ i ];
						out[ key ] = targetJSON[ key ];
					}
					fs.writeFileSync( filePath, JSON.stringify( out, null, '\t' ).concat( '\n' ) );
				})
				.catch( err => {
					console.error( err ); // eslint-disable-line no-console
				});
		}
	}
	console.log( files ); // eslint-disable-line no-console
});
