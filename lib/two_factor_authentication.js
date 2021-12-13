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
 *   name: TFA
 *   description: Two-factor authentication.
 */

// MODULES //

const router = require( 'express' ).Router();
const speakeasy = require( 'speakeasy' );
const QRCode = require( 'qrcode' );
const jwt = require( 'jsonwebtoken' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const validateString = require( './helpers/validate_string.js' );
const User = require( './models/user.js' );
const { tokens } = require( './credentials.js' );


// MAIN //

/**
 * @openapi
 *
 * /get_tfa_qrcode:
 *   get:
 *     summary: Get TFA QR code
 *     description: Get a QR code for TFA authentication.
 *     tags: [TFA]
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Image tag with data URL of the QR code.
 *       403:
 *         description: Already enabled.
 *         content:
 *           text/plain:
 *             Two-factor authentication is already enabled for the user.
 */
router.get( '/get_tfa_qrcode',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetTfaQRCode( req, res ) {
		if ( req.user.twoFactorAuth ) {
			throw new ErrorStatus( 403, req.t( 'tfa-already-enabled' ) );
		}
		const secret = speakeasy.generateSecret({
			name: `ISLE (${req.user.email})`
		});
		req.user.twoFactorAuthSecret = secret.base32;
		await req.user.save();

		QRCode.toDataURL( secret.otpauth_url, function onDataURL( err, dataURL ) {
			const img = '<img src="' + dataURL + '">';
			res.send( img );
		});
	})
);

/**
 * @openapi
 *
 * /enable_tfa:
 *   post:
 *     summary: Enable TFA
 *     description: Enable two-factor authentication for the user.
 *     tags: [TFA]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: TFA token.
 *     responses:
 *       200:
 *         description: Request successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message indicating if request was successful.
 *                   example: The confirmation code has been successfully validated. Two-factor authentication is now enabled.
 *                 verified:
 *                   type: boolean
 *                   description: Indicates if the token was verified.
 *                   example: true
 */
router.post( '/enable_tfa',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onEnableTfa( req, res ) {
		const base32secret = req.user.twoFactorAuthSecret;
		const verified = speakeasy.totp.verify({
			secret: base32secret,
			encoding: 'base32',
			token: String( req.body.token ),
			window: 10
		});
		if ( verified ) {
			req.user.twoFactorAuth = true;
			await req.user.save();
			res.json({ message: req.t( 'enable-tfa-success' ), verified });
		}
		res.json({ message: req.t( 'enable-tfa-failure' ), verified });
	})
);

/**
 * @openapi
 *
 * /disable_tfa:
 *   post:
 *     summary: Disable TFA
 *     description: Disable two-factor authentication for the user.
 *     tags: [TFA]
 *     responses:
 *       200:
 *         description: Request successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message indicating that request has been successful.
 *                   example: Two-factor authentication has been disabled.
 *                 disabled:
 *                   type: boolean
 *                   description: Indicates that two-factor authentication has been disabled.
 *                   value: true
 */
router.post( '/disable_tfa',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDisableTfa( req, res ) {
		req.user.twoFactorAuth = false;
		req.user.twoFactorAuthSecret = null;
		await req.user.save();
		res.json({ message: req.t( 'tfa-disabled' ), disabled: true });
	})
);

/**
 * @openapi
 *
 * /login_tfa:
 *   post:
 *     summary: Login with TFA
 *     description: Login with two-factor authentication.
 *     tags: [TFA]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address.
 *                 example: jane.doe@isledocs.com
 *               password:
 *                 type: string
 *                 description: Password.
 *                 example: secret-password
 *               token:
 *                 type: string
 *                 description: TFA token.
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Request successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message indicating that request was successful.
 *                   example: ok
 *                 token:
 *                   type: string
 *                   description: JWT token.
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.Et9HFtf9R3GEMA0IICOfFMVXY7kkTX1wr4qCyhIf58U
 *                 id:
 *                   type: string
 *                   description: User ID.
 *                   example: 61b782236ebb6a7edc089755
 *       400:
 *         description: Bad request.
 *         content:
 *           text/plain:
 *             examples:
 *               expect-string-email: Email has to be a string.
 *               expect-string-password: Password has to be a string.
 *               expect-string-token: Token has to be a string.
 *       401:
 *         description: Unauthorized.
 *         content:
 *           text/plain:
 *             examples:
 *               invalid-token: Invalid token.
 *               invalid-password: Invalid password.
 *       404:
 *         description: User not found.
 *         content:
 *           text/plain:
 *             User with the specified email address was not found.
 */
router.post( '/login_tfa',
	wrapAsync( async function onLoginTFA( req, res ) {
		const { email, password, token } = req.body;

		validateString( password, 'password', req.t );
		validateString( email, 'email', req.t );
		validateString( token, 'token', req.t );

		const user = await User.findOne({ 'email': email });
		if ( !user ) {
			return res.status( 404 ).send( req.t( 'user-email-not-found' ) );
		}
		const correctPassword = await user.comparePassword( password );
		const base32secret = user.twoFactorAuthSecret;
		const tokenVerified = speakeasy.totp.verify({
			secret: base32secret,
			encoding: 'base32',
			token: token,
			window: 10
		});
		if ( correctPassword && tokenVerified ) {
			// Identify users by their ID:
			const payload = { id: user.id };
			const token = jwt.sign( payload, tokens.jwtKey );
			res.json({ message: 'ok', token: token, id: user.id });
		} else if ( correctPassword && !tokenVerified ) {
			res.status( 401 ).send( req.t( 'code-incorrect' ) );
		} else {
			res.status( 401 ).send( req.t( 'password-incorrect' ) );
		}
	})
);


// EXPORTS //

module.exports = router;
