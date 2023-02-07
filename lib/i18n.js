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

const join = require( 'path' ).join;
const i18next = require( 'i18next' );
const i18nextBackend = require( 'i18next-fs-backend' );
const i18nextMiddleware = require( 'i18next-http-middleware' );
const objectKeys = require( '@stdlib/utils/keys' );
const customTranslations = require( './../etc/custom_translations.json' );
const { LOCALES_DIRECTORY } = require( './constants.js' );
const debug = require( './debug' )( 'server:i18n' );


// FUNCTIONS //

/**
 * Callback invoked when a namespace of translation keys has been loaded.
 *
 * ## Notes
 *
 * -   On the current ISLE server instance, the callback function replaces default translations for the given language / namespace pair for which custom translations are available.
 *
 * @param {string} lng - language identifier
 * @param {string} ns - namespace key
 */
function onLoaded( lng, ns ) {
	const custom = customTranslations[ lng ][ ns ];
	if ( custom ) {
		const keys = objectKeys( custom );
		if ( !i18next.store.data[ lng ][ ns+'_ORIGINAL' ] ) {
			i18next.store.data[ lng ][ ns+'_ORIGINAL' ] = {};
		}
		for ( let i = 0; i < keys.length; i++ ) {
			const key = keys[ i ];
			i18next.store.data[ lng ][ ns+'_ORIGINAL' ][ key ] = i18next.store.data[ lng ][ ns ][ key ];
			i18next.store.data[ lng ][ ns ][ key ] = custom[ key ];
		}
	}
}


// MAIN //

// Initialize internationalization via backend loading from locales directory:
i18next
	.use( i18nextMiddleware.LanguageDetector )
	.use( i18nextBackend )
	.init({
		preload: [ 'en', 'de', 'es' ],
		debug: debug.enabled,
		ns: [ 'server' ],
		defaultNS: 'server',
		lng: 'en',
		fallbackLng: 'en',
		backend: {
			loadPath: join( LOCALES_DIRECTORY, '{{lng}}/{{ns}}.json' )
		}
	});

i18next.store.on( 'added', onLoaded );


// EXPORTS //

module.exports = i18next;
