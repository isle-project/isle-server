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
const jwt = require( 'jsonwebtoken' );
const debug = require( 'debug' )( 'saml' );
const objectKeys = require( '@stdlib/utils/keys' );
const config = require( '../etc/config.json' );
const samlAudiences = require( '../etc/saml/audiences.json' );
const samlCustomOptions = require( '../etc/saml/options.json' );
const institutionName = require( './utils/institution_name.js' );
const User = require( './models/user.js' );
const ErrorStatus = require( './helpers/error.js' );
const { tokens } = require( './credentials.js' );


// VARIABLES //

const choiceExtraStyles = `<style type="text/css">
.footer {
	background-color: #dcdcdc;
	bottom: 0;
	left: 0;
	box-shadow: 0 0 2px #2f4f4f;
	height: 24px;
	position: fixed;
	width: 100%;
	z-index: 999;
}

.isle-logo {
	float: left;
	height: 100%;
	margin-right: 4px;
	padding-left: 6px;
}

.isle-logo img {
	float: left;
	height: 80%;
	padding-top: 2px;
	width: auto;
}

.isle-terms {
	float: left;
}

.isle-terms a {
	text-decoration: none;
}

.isle-terms a:hover {
	text-decoration: underline;
}
</style>`;

const options = {
	sp: {
		entityID: config.server,
		signingCert: { file: path.join( __dirname, '..', 'etc', 'saml', 'signing.cert.pem' ) },
		signingKey: { file: path.join( __dirname, '..', 'etc', 'saml', 'signing.key.pem' ) },
		encryptCert: { file: path.join( __dirname, '..', 'etc', 'saml', 'encrypt.cert.pem' ) },
		encryptKey: { file: path.join( __dirname, '..', 'etc', 'saml', 'encrypt.key.pem' ) }
	},
	exemptPatterns: [
		'credentials_dashboard',
		'/get_translations$',
		'/get_public_settings$',
		'/get_namespaces$',
		'/get_lesson',
		'/locales/[a-z]{2}/[a-z_]+.json$',
		'favicon.ico',
		'service-worker.js',
		'isle_logo.svg',
		'/avatar/',
		'terms$',
		'privacy$'
	],
	choiceFooter: '<div class="isle-logo"><img src="./../dashboard/img/isle_logo.svg" alt="ISLE Logo"><div class="footer-bar-copyright">© 2016-2021 The ISLE Authors. All rights reserved.</div></div><div class="isle-terms"> | <a target="_blank" href="./../dashboard/terms">Terms</a> | <a target="_blank" href="./../dashboard/privacy">Privacy</a></div><div>',
	choiceExtraStyles,
	altLogin: '/dashboard/login',
	getUser: async ( attributes ) => {  // eslint-disable-line require-await
		debug( 'Get user for attributes: '+JSON.stringify( attributes ) );
		if ( !attributes.email ) {
			// Handle Shibboleth oid URNs:
			const { oidURNNames } = require( '@isle-project/express-saml2-middleware' );
			const attributeMap = oidURNNames();
			const keys = objectKeys( attributeMap );
			for ( let i = 0; i < keys.length; i++ ) {
				const key = keys[ i ];
				attributes[ attributeMap[ key ] ] = attributes[ key ];
			}
		}
		let user = await User.findOne({ email: attributes.email });
		if ( !user ) {
			try {
				const numUsers = await User.estimatedDocumentCount();
				user = new User({
					email: attributes.email,
					name: attributes.givenName + ' ' + attributes.sn,
					organization: institutionName( attributes.email ),
					writeAccess: numUsers === 0, // Make first registered user an instructor
					administrator: numUsers === 0, // Make first registered user an administrator...
					loginWithoutPassword: true,
					verifiedEmail: true
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
	},
	...samlCustomOptions
};


// MAIN //

/**
* Registers a SAML authentication strategy and middleware.
*
* @param {object} app - application instance
* @returns {void}
*/
function registerSAML( app ) {
	let out;
	if ( !config.saml ) {
		return;
	}
	// Dynamically load proprietary package for SAML authentication:
	const { samlFactory, samlMultiFactory } = require( '@isle-project/express-saml2-middleware' );
	if ( samlAudiences.length > 1 ) {
		// Multiple audiences:
		out = samlMultiFactory( samlAudiences, options );
	}
	else {
		// Single audience:
		out = samlFactory({
			...options, ...samlAudiences[ 0 ]
		});
	}
	const { samlMiddleware, samlRouter, samlRoot } = out;
	app.use( samlMiddleware );
	app.use( samlRoot, samlRouter );
}


// EXPORTS //

module.exports = registerSAML;
