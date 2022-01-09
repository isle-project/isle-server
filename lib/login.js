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
 *   name: Users
 *   description: User management.
 */

// MODULES //

const router = require( 'express' ).Router();
const jwt = require( 'jsonwebtoken' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const sendVerificationEmail = require( './utils/send_verification_email.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const CustomUserField = require( './models/custom_user_field.js' );
const Namespace = require( './models/namespace.js' );
const User = require( './models/user.js' );
const { tokens } = require( './credentials.js' );
const mailer = require( './mailer' );
const ev = require( './ev.js' );
const { NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './constants.js' );


// MAIN //

/**
 * @openapi
 *
 * /login:
 *   post:
 *     summary: Login user.
 *     description: Login user and return a JWT token.
 *     tags: [Users]
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
 *                 example: MySuperSecretPassword
 *     responses:
 *       200:
 *         description: A JSON object containing a JWT token and an `ok` status message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.Et9HFtf9R3GEMA0IICOfFMVXY7kkTX1wr4qCyhIf58U
 *       401:
 *         description: Invalid password / User not being verified
 *       404:
 *         description: No user found with the specified email address
 *       405:
 *         description: Users signing in via SSO cannot be logged in via the API
 *       503:
 *         description: Email service is not available
 */
router.post( '/login',
	wrapAsync( async function onLogin( req, res ) {
		const password = req.body.password;
		const email = req.body.email;

		validateString( password, 'password', req.t );
		validateString( email, 'email', req.t );

		const user = await User.findOne({ 'email': email });
		if ( !user ) {
			return res.status( 404 ).send( req.t( 'user-email-not-found' ) );
		}
		if ( user.loginWithoutPassword ) {
			return res.status( 405 ).send( req.t( 'user-login-without-password' ) );
		}
		if ( !user.password ) {
			const mail = {
				'from': NOTIFICATIONS_EMAIL,
				'subject': req.t('complete-registration'),
				'to': user.email,
				'text': `
					${req.t('complete-registration-email', { user: user.name, server: SERVER_HOST_NAME })}
				`,
				'link': `${SERVER_HOST_NAME}/dashboard/complete-registration/?token=${user._id}`
			};
			mailer.send( mail, function onDone( error ) {
				if ( error ) {
					throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
				}
			});
			return res.status( 401 ).send( req.t( 'user-not-activated' ) );
		}
		const isMatch = await user.comparePassword( password );
		if ( isMatch ) {
			if ( user.twoFactorAuth ) {
				return res.json({ message: 'finish-login-via-tfa', email, password });
			}
			// Identify users by their ID:
			const payload = { id: user.id };
			const token = jwt.sign( payload, tokens.jwtKey );
			res.json({ message: 'ok', token: token, id: user.id });
		} else {
			res.status( 401 ).send( req.t( 'password-incorrect' ) );
		}
	})
);

/**
 * @openapi
 *
 * /credentials:
 *   post:
 *     summary: User Credentials
 *     description: Return user credentials.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: User ID.
 *                 example: 5b9f8f8f8f8f8f8f8f8f8f8
 *     responses:
 *        200:
 *          description: A JSON object containing user information
 *          content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: ObjectId
 *                     description: User ID.
 *                     example: 5b9f8f8f8f8f8f8f8f8f8f8
 *                   name:
 *                     type: string
 *                     description: User name.
 *                     example: Jane Doe
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: User email address.
 *                     example: jane.doe@isledocs.com
 *                   organization:
 *                     type: string
 *                     description: User organization.
 *                     example: ISLE
 *                   writeAccess:
 *                     type: boolean
 *                     description: User write access.
 *                     example: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     description: Date and time when the user was created.
 *                     example: 2019-01-01T00:00:00.000Z
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     description: Date and time when the user was last updated.
 *                     example: 2019-01-01T00:00:00.000Z
 *                   lessonGrades:
 *                     type: object
 *                     description: object with keys being lesson IDs, each of which points to an object of key-value pairs, with the keys being IDs of questions in the respective lessons and the values corresponding to the awarded points for said questions.
 *                     example: { "lesson-1": { "question-1": 7, "question-2": 10 } }
 *                   lessonGradeMessages:
 *                     type: object
 *                     description: object with keys being lesson IDs, each of which points to an object of key-value pairs, with the keys being IDs of questions in the respective lessons and the values corresponding to an array of message objects.
 *                     example: { "lesson-1": { "question-1": [ {...}, {...} ] } }
 *                   picture:
 *                     type: string
 *                     description: URL of the user's profile picture.
 *                   score:
 *                     type: integer
 *                     description: Score of the user.
 *                     example: 121
 *                   spentTime:
 *                     type: integer
 *                     description: Total time spent by the user.
 *                     example: 1109
 *                   licensed:
 *                     type: boolean
 *                     description: Whether the ISLE instance is licensed.
 *                     example: true
 *                   twoFactorAuth:
 *                     type: boolean
 *                     description: Whether two-factor authentication is enabled for the user.
 *                     example: true
 */
router.post( '/credentials',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCredentials( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );
		req.session.inLesson = true;
		req.session.loggedIn = true;
		const user = await User
			.findOne({ '_id': req.body.id })
			.exec();
		debug( 'Retrieve user credentials...' );
		res.json({
			id: req.body.id,
			email: user.email,
			name: user.name,
			organization: user.organization,
			writeAccess: user.writeAccess,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			lessonGrades: user.lessonGrades,
			lessonGradeMessages: user.lessonGradeMessages,
			picture: user.picture,
			score: user.score,
			spentTime: user.spentTime,
			licensed: ev.license && ev.license.valid,
			twoFactorAuth: user.twoFactorAuth
		});
	})
);

/**
 * @openapi
 *
 * /credentials_dashboard:
 *   post:
 *     summary: User Credentials
 *     description: Return user credentials for the ISLE user dashboard.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: User ID.
 *                 example: 5b9f8f8f8f8f8f8f8f8f8f8
 *     responses:
 *       200:
 *         description: A JSON object containing user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: ObjectId
 *                   description: User ID.
 *                   example: 5b9f8f8f8f8f8f8f8f8f8f8
 *                 name:
 *                   type: string
 *                   description: User name.
 *                   example: Jane Doe
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User email address.
 *                   example: jane.doe@isledocs.com
 *                 verifiedEmail:
 *                   type: boolean
 *                   description: Whether the email address has been verified.
 *                   example: true
 *                 organization:
 *                   type: string
 *                   description: User organization.
 *                   example: ISLE
 *                 ownedNamespaces:
 *                   type: array
 *                   description: Namespaces owned by the user.
 *                   items:
 *                     $ref: '#/components/schemas/Namespace'
 *                 enrolledNamespaces:
 *                   type: array
 *                   description: Namespaces the user is enrolled in.
 *                   items:
 *                     $ref: '#/components/schemas/Namespace'
 *                 writeAccess:
 *                   type: boolean
 *                   description: User write access.
 *                   example: true
 *                 administrator:
 *                   type: boolean
 *                   description: Whether the user is an administrator.
 *                   example: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: Date and time when the user was created.
 *                   example: 2019-01-01T00:00:00.000Z
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Date and time when the user was last updated.
 *                   example: 2019-01-01T00:00:00.000Z
 *                 lessonGrades:
 *                   type: object
 *                   description: object with keys being lesson IDs, each of which points to an object of key-value pairs, with the keys being IDs of questions in the respective lessons and the values corresponding to the awarded points for said questions.
 *                   example: { "lesson-1": { "question-1": 7, "question-2": 10 } }
 *                 lessonGradeMessages:
 *                   type: object
 *                   description: object with keys being lesson IDs, each of which points to an object of key-value pairs, with the keys being IDs of questions in the respective lessons and the values corresponding to an array of message objects.
 *                   example: { "lesson-1": { "question-1": [ {...}, {...} ] } }
 *                 picture:
 *                   type: string
 *                   description: URL of the user's profile picture.
 *                 score:
 *                   type: integer
 *                   description: Score of the user.
 *                   example: 121
 *                 spentTime:
 *                   type: integer
 *                   description: Total time spent by the user.
 *                   example: 1109
 *                 lessonData:
 *                   type: object
 *                   description: object with keys being lesson identifiers holding lesson-specific user data (e.g., progress & time spent per lesson).
 *                   example: { "lesson-1": { "progress": 0, "timeSpent": 0 } }
 *                 licensed:
 *                   type: boolean
 *                   description: Whether the ISLE instance is licensed.
 *                   example: true
 *                 customFields:
 *                   type: object
 *                   description: Object with keys corresponding to the CustomUserFields and their values (if assigned to the respective user).
 *                   example: { "custom-field-1": "value-1", "custom-field-2": "value-2" }
 *                 availableCustomFields:
 *                   type: array
 *                   description: Array of custom fields enabled on the instance.
 *                   items:
 *                     $ref: '#/components/schemas/CustomField'
 *                 twoFactorAuth:
 *                   type: boolean
 *                   description: Whether two-factor authentication is enabled for the user.
 *                   example: true
 */
router.post( '/credentials_dashboard',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCredentials( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );
		req.session.inDashboard = true;
		req.session.loggedIn = true;
		const user = await User
			.findOne({ '_id': req.body.id })
			.populate( 'enrolledNamespaces' )
			.populate( 'ownedNamespaces' )
			.exec();
		debug( 'Retrieve user credentials...' );
		await Namespace.populate( user.ownedNamespaces, { path: 'owners' });
		const availableCustomFields = await CustomUserField.find();
		res.json({
			id: req.body.id,
			email: user.email,
			verifiedEmail: user.verifiedEmail,
			name: user.name,
			organization: user.organization,
			enrolledNamespaces: user.enrolledNamespaces,
			ownedNamespaces: user.ownedNamespaces,
			writeAccess: user.writeAccess,
			administrator: user.administrator,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			picture: user.picture,
			score: user.score,
			spentTime: user.spentTime,
			lessonData: user.lessonData,
			licensed: ev.license && ev.license.valid,
			customFields: user.customFields,
			availableCustomFields,
			twoFactorAuth: user.twoFactorAuth
		});
	})
);

/**
 * @openapi
 *
 * /complete_registration:
 *   post:
 *     summary: Complete registration
 *     description: Complete registration of a user by providing name and password.
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newName:
 *                 type: string
 *                 description: Full name of the user
 *                 example: John Doe
 *               newPassword:
 *                 type: string
 *                 description: Password of the user
 *                 example: myPassword
 *               id:
 *                 type: ObjectId
 *                 description: ID of the user
 *                 example: 5a9b8f8f8f8f8f8f8f8f8f8
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: Registration completed
 *       403:
 *         description: Registration already completed
 */
router.post( '/complete_registration',
	wrapAsync( async function onCompleteRegistration( req, res ) {
		debug( 'Should set name and user password...' );
		const newPassword = req.body.newPassword;
		const newName = req.body.newName;
		const id = req.body.id;

		validateString( newPassword, 'newPassword', req.t );
		validateString( newName, 'newName', req.t );
		validateObjectId( id, 'id', req.t );

		const user = await User.findOne({ _id: id });
		if ( user.verifiedEmail ) {
			return res.status( 403 ).send( req.t( 'registration-already-completed' ) );
		}
		user.verifiedEmail = true;
		user.password = newPassword;
		user.name = newName;
		await user.save();
		res.json({
			message: req.t( 'registration-completed' )
		});
	})
);

/**
 * @openapi
 *
 * /resend_confirmation_email:
 *   post:
 *     summary: Resend confirmation email
 *     description: Resend confirmation email.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 successful:
 *                   type: boolean
 *                   description: Whether the email was successfully sent.
 *                   example: true
 *       500:
 *         description: Email service not configured.
 *         content:
 *           text/plain:
 *             Email service not configured.
 *       503:
 *         description: Email service not available.
 *         content:
 *           text/plain:
 *             Email service not available.
 */
router.post( '/resend_confirm_email',
	passport.authenticate( 'jwt', { session: false }),
	function onResend( req, res ) {
		sendVerificationEmail( req.user, req.t );
		res.json({ successful: true });
	}
);

/**
 * @openapi
 *
 * /confirm_email:
 *   post:
 *     summary: Confirm email
 *     description: Confirm email by sending a verification token.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Verification token.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Confirmation message.
 *                   example: Email address has been confirmed.
 */
router.post( '/confirm_email', wrapAsync( async function onConfirm( req, res ) {
	debug( 'Should confirm user email address...' );

	validateObjectId( req.body.token, 'token', req.t );

	const user = await User.findOne({ _id: req.body.token });
	if ( !user ) {
		throw new ErrorStatus( 404, req.t( 'user-nonexistent' ) );
	}
	if ( user.verifiedEmail ) {
		throw new ErrorStatus( 409, req.t('email-already-verified') );
	}
	await user.updateOne({ $set: { verifiedEmail: true }});
	const out = { message: req.t('email-confirmation-success') };
	res.json( out );
}) );

/**
 * @openapi
 *
 * /forgot_password:
 *   get:
 *     summary: Forgot password
 *     description: Send a password reset email.
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: email
 *         description: Email address.
 *         schema:
 *           type: string
 *           format: email
 *         required: true
 *         example: jane.doe@isledocs.com
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Response object from sending the email.
 *       404:
 *         description: User with given email address not found.
 *       500:
 *         description: Error message indicating that email service has not been configured
 *       503:
 *         description: Error message indicating that email service is not available
 */
router.get( '/forgot_password', wrapAsync( async function onForgotPassword( req, res ) {
	debug( 'Forgot Password GET Request...' );

	validateString( req.query.email, 'email', req.t );

	const user = await User.findOne({ email: req.query.email });
	if ( !user ) {
		throw new ErrorStatus( 404, req.t( 'user-email-not-found' ) );
	}
	if ( !mailer.active ) {
		throw new ErrorStatus( 500, req.t( 'email-service-not-configured-password-reset' ) );
	}
	const mail = {
		'from': NOTIFICATIONS_EMAIL,
		'subject': req.t('new-password-requested'),
		'to': req.query.email,
		'text': `
			${req.t('new-password-requested-email', { user: user.name })}
		`,
		'link': `${SERVER_HOST_NAME}/dashboard/new-password?token=${user._id}`
	};
	debug( 'Mail: ' + JSON.stringify( mail ) );
	mailer.send( mail, function onDone( error, response ) {
		if ( !error ) {
			res.json( response );
		} else {
			throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
		}
	});
}));


// EXPORTS //

module.exports = router;
