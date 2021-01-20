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

const router = require( 'express' ).Router();
const axios = require( 'axios' );
const jwt = require( 'jsonwebtoken' );
const i18next = require( 'i18next' );
const ceil = require( '@stdlib/math/base/special/ceil' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const { apixu, github, jitsi } = require( './credentials.js' );
const isOwner = require( './helpers/is_owner.js' );
const { SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const RE_GITHUB_ACCESS_TOKEN = /access_token=([^&]+)&scope/;
const THREE_HOURS_IN_SECONDS = 3 * 60 * 60; // Expiration time for token


// MAIN //

router.get( '/get_jitsi_token',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function getJitsiToken( req, res ) {
			if ( !jitsi.server ) {
				return res.status( 501 ).send( req.t( 'jitsi-not-available' ) );
			}
			const owner = await isOwner( req, req.query.namespaceID );
			const payload = {
				user: {
					avatar: SERVER_HOST_NAME + '/avatar/' + req.user.picture,
					name: req.user.name,
					email: req.user.email
				},
				aud: 'jitsi',
				iss: jitsi.appId,
				sub: jitsi.server,
				moderator: owner,
				room: '*',
				exp: ceil( ( new Date().getTime() / 1000 ) + THREE_HOURS_IN_SECONDS )
			};
			const token = jwt.sign( payload, jitsi.appSecret );
			res.json({ message: 'ok', token: token, server: jitsi.server });
	})
);

router.get( '/github_oauth_url', function getOAuthURL( req, res ) {
	const githubUrl = `https://${github.hostname}/login/oauth/authorize`;
	const url = `${githubUrl}?client_id=${github.clientId}&scope=${github.scope}`;
	res.send( url );
});

router.post( '/github_access_token', passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function getAccessToken( req, res ) {
		const url = `https://${github.hostname}/login/oauth/access_token`;
		const result = await axios.post( url, {
			client_id: github.clientId,
			client_secret: github.clientSecret,
			code: req.body.code
		});
		const match = RE_GITHUB_ACCESS_TOKEN.exec( String( result.data ) );
		if ( match && match[ 1 ] ) {
			res.json({ message: 'ok', token: match[ 1 ] });
		} else {
			throw new Error( req.t( 'access-token-could-not-be-retrieved' ) );
		}
	})
);

router.get( '/weather',
	wrapAsync( async function getWeather( req, res ) {
		const lang = i18next.language;
		const url = `${apixu.server}?appid=${apixu.auth_key}&q=${req.query.location}&lang=${lang}`;
		const result = await axios.get( url );
		res.json( result.data );
	})
);


// EXPORTS //

module.exports = router;
