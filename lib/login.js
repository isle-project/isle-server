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
const crypto = require( 'crypto' );
const jwt = require( 'jsonwebtoken' );
const isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
const createTemplateFunction = require( 'lodash.template' );
const roundn = require( '@stdlib/math/base/special/roundn' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const debug = require( './debug' );
const passport = require( './passport' );
const sendVerificationEmail = require( './utils/send_verification_email.js' );
const decodeBase64String = require( './utils/decode_base64_string.js' );
const institutionName = require( './utils/institution_name.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const CustomUserField = require( './models/custom_user_field.js' );
const Namespace = require( './models/namespace.js' );
const User = require( './models/user.js' );
const tokens = require( './../credentials/tokens.json' );
const mailer = require( './mailer' );
const ev = require( './ev.js' );
const { NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const createShibbolethToken = createTemplateFunction( tokens.shibbolethTemplate || '' );
const SHIBBOLETH_TOLERANCE = 30; // Thirty seconds


// FUNCTIONS //

function recreateShibbolethToken({ eppn, name, affil, time, salt }) {
	const template = createShibbolethToken({
		eppn,
		name,
		affil,
		time,
		salt,
		secret: tokens.shibbolethSecret
	});
	return crypto.createHash( 'sha256' )
		.update( template )
		.digest( 'hex' );
}


// MAIN //

router.post( '/login',
	wrapAsync( async function onLogin( req, res ) {
		const password = req.body.password;
		const email = req.body.email;
		if ( !isString( password ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'password'
			}) );
		}
		if ( !isString( email ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'email'
			}) );
		}
		const user = await User.findOne({ 'email': email });
		if ( !user ) {
			return res.status( 404 ).send( req.t( 'user-email-not-found' ) );
		}
		if ( !user.password ) {
			const mail = {
				'from': NOTIFICATIONS_EMAIL,
				'subject': 'Complete Registration',
				'to': user.email,
				'text': `
					Dear ${user.name}, please click the link below to complete the registration processing by entering your name and choosing a password of your liking.<br />
					You can then login with your email address and password at <a href="${SERVER_HOST_NAME}">${SERVER_HOST_NAME}</a>.
					Welcome to ISLE!
				`,
				'link': `${SERVER_HOST_NAME}/dashboard/#/complete-registration/?token=${user._id}`
			};
			mailer.send( mail, function onDone( error ) {
				if ( error ) {
					throw new ErrorStatus( 503, 'Email service currently not available' );
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

router.post( '/shibboleth',
	wrapAsync( async function onLogin( req, res ) {
		let { eppn, name, affil, time, salt, token } = req.body;
		eppn = decodeBase64String( eppn );
		name = decodeBase64String( name );
		affil = decodeBase64String( affil );

		const roundedTime = roundn( Number( time ), 1 );
		const currentTime = roundn( new Date().getTime() / 1000, 1 );
		if ( currentTime - roundedTime >= SHIBBOLETH_TOLERANCE ) {
			return res.status( 401 ).send( req.t( 'token-expired' ) );
		}
		const recreatedToken = recreateShibbolethToken({ eppn, name, affil, time, salt });
		if ( recreatedToken !== token ) {
			return res.status( 401 ).send( req.t( 'invalid-credentials' ) );
		}
		let user = await User.findOne({ email: eppn });
		if ( !user ) {
			try {
				const numUsers = await User.estimatedDocumentCount();
				user = new User({
					email: eppn,
					name,
					organization: institutionName( eppn ),
					writeAccess: numUsers === 0, // Make first registered user an instructor
					administrator: numUsers === 0 // Make first registered user an administrator...
				});
				await user.save();
			} catch ( err ) {
				throw new ErrorStatus( 403, err.message );
			}
		}
		const payload = { id: user.id };
		const jsonWebToken = jwt.sign( payload, tokens.jwtKey );
		res.json({ message: 'ok', token: jsonWebToken, id: user.id });
	})
);

router.post( '/credentials',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCredentials( req, res ) {
		if ( !isValidObjectId( req.body.id ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
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

router.post( '/credentials_dashboard',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCredentials( req, res ) {
		if ( !isValidObjectId( req.body.id ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
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

router.post( '/complete_registration',
	wrapAsync( async function onCompleteRegistration( req, res ) {
		debug( 'Should set name and user password...' );
		const newPassword = req.body.newPassword;
		const newName = req.body.newName;
		const id = req.body.id;
		if ( !isString( newPassword ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'newPassword'
			}) );
		}
		if ( !isString( newName ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-string', {
				field: 'newName'
			}) );
		}
		if ( !isValidObjectId( id ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
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

router.post( '/resend_confirm_email',
	passport.authenticate( 'jwt', { session: false }),
	function onResend( req, res ) {
		try {
			sendVerificationEmail( req.user );
			res.json({ successful: true });
		} catch ( err ) {
			throw new ErrorStatus( 503, err.message );
		}
	}
);

router.post( '/confirm_email', wrapAsync( async function onConfirm( req, res ) {
	debug( 'Should confirm user email address...' );
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

router.get( '/forgot_password', wrapAsync( async function onForgotPassword( req, res ) {
	debug( 'Forgot Password GET Request...' );
	const user = await User.findOne({ email: req.query.email });
	if ( !user ) {
		throw new ErrorStatus( 404, req.t( 'user-email-not-found' ) );
	}
	const mail = {
		'from': NOTIFICATIONS_EMAIL,
		'subject': 'New Password Requested',
		'to': req.query.email,
		'text': `
			Dear ${user.name}, you have indicated that you have forgotten your password. You can choose a new password by clicking on this link:
		`,
		'link': `${SERVER_HOST_NAME}/dashboard/#/new-password/?token=${user._id}`
	};
	debug( 'Mail: ' + JSON.stringify( mail ) );
	mailer.send( mail, function onDone( error, response ) {
		if ( !error ) {
			res.json( response );
		} else {
			throw new ErrorStatus( 503, 'Email service currently not available' );
		}
	});
}));


// EXPORTS //

module.exports = router;