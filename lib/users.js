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
const multer = require( 'multer' );
const jwt = require( 'jsonwebtoken' );
const tldjs = require( 'tldjs' );
const rateLimit = require( 'express-rate-limit' );
const isObject = require( '@stdlib/assert/is-object' );
const isEmptyObject = require( '@stdlib/assert/is-empty-object' );
const isUndefinedOrNull = require( '@stdlib/assert/is-undefined-or-null' );
const contains = require( '@stdlib/assert/contains' );
const isArray = require( '@stdlib/assert/is-array' );
const groupBy = require( '@stdlib/utils/group-by' );
const objectKeys = require( '@stdlib/utils/keys' );
const copy = require( '@stdlib/utils/copy' );
const lowercase = require( '@stdlib/string/lowercase' );
const debug = require( './debug' );
const storage = require( './storage' );
const passport = require( './passport.js' );
const sendVerificationEmail = require( './utils/send_verification_email.js' );
const institutionName = require( './utils/institution_name.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const ErrorStatus = require( './helpers/error.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const isOwner = require( './helpers/is_owner.js' );
const User = require( './models/user.js' );
const Cohort = require( './models/cohort.js' );
const Namespace = require( './models/namespace.js' );
const SessionData = require( './models/session_data.js' );
const CustomUserField = require( './models/custom_user_field.js' );
const settings = require( './../etc/settings.json' );
const { tokens } = require( './credentials.js' );


// VARIABLES //

const avatarUpload = multer({ storage: storage }).single( 'avatar' );
const thumbnailUpload = multer({ storage: storage }).single( 'thumbnail' );
const createUserLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // One hour window
	max: settings.rateLimitUserCreation || 30, // Start blocking after thirty requests by default
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-users-created' ) );
	}
});
const updateUserLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10000, // Limit each IP to 10000 requests per windowMs
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-requests' ) );
	}
});


// MAIN //

/**
 * @openapi
 *
 * /create_user:
 *   post:
 *     summary: Create new user
 *     description: Create a new user.
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email address of the user
 *                 example: jane.doe@cmu.edu
 *               password:
 *                 type: string
 *                 description: Password of the user
 *                 example: my-super-secret-password
 *               name:
 *                 type: string
 *                 description: Name of the user
 *                 example: Jane Doe
 *     responses:
 *       200:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User created successfully
 */
router.post( '/create_user',
	createUserLimit,
	wrapAsync( async function onCreateUser( req, res ) {
		const { password, name } = req.body;
		let email = req.body.email;

		validateString( email, 'email', req.t );
		validateString( password, 'password', req.t );
		validateString( name, 'name', req.t );

		email = lowercase( req.body.email );
		if ( !settings.allowUserRegistrations ) {
			validateAdmin( req );
		}
		if ( settings.permittedEmailDomains && settings.permittedEmailDomains.length > 0 ) {
			const domain = tldjs.getDomain( email );
			debug( `Check whether ${domain} is in the list of permitted domains: ${settings.permittedEmailDomains.join( ', ')}` );
			if ( !contains( settings.permittedEmailDomains, domain ) ) {
				throw new ErrorStatus( 400, req.t('domain-not-permitted-for-registration') );
			}
		}
		if ( settings.reservedUserNames && settings.reservedUserNames.length > 0 ) {
			if ( contains( settings.reservedUserNames, name ) ) {
				throw new ErrorStatus( 400, req.t('entered-reserved-username') );
			}
		}
		if ( settings.disallowedEmailDomains && settings.disallowedEmailDomains.length > 0 ) {
			const domain = tldjs.getDomain( email );
			debug( `Check whether ${domain} is in the list of disallowed domains: ${settings.disallowedEmailDomains.join( ', ')}` );
			if ( contains( settings.disallowedEmailDomains, domain ) ) {
				throw new ErrorStatus( 400, req.t('domain-disallowed-for-registration') );
			}
		}
		let user;
		try {
			const numUsers = await User.estimatedDocumentCount();
			const userConfig = {
				email,
				name,
				password,
				organization: institutionName( email ),
				writeAccess: numUsers === 0, // Make first registered user an instructor
				administrator: numUsers === 0 // Make first registered user an administrator...
			};
			if ( isObject( req.body.customFields ) ) {
				userConfig.customFields = req.body.customFields;
			}
			user = new User( userConfig );
			await user.save();
		} catch ( err ) {
			throw new ErrorStatus( 403, err.message );
		}
		try {
			sendVerificationEmail( user, req.t );
		} catch ( err ) {
			debug( 'Could not send verification email for '+user.name );
		}
		debug( 'Successfully created user: %s', email );
		res.json({
			message: req.t( 'user-created' )
		});
	})
);

/**
 * @openapi
 *
 * /get_users:
 *   get:
 *     summary: Get users
 *     description: Returns a list of users on the ISLE instance.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 users:
 *                   type: array
 *                   description: List of users
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Access denied for non-administrators
 */
router.get( '/get_users',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUsers( req, res ) {
		validateAdmin( req );
		const users = await User.find({});
		res.json({ message: 'ok', users });
	})
);

/**
 * @openapi
 *
 * /delete_user:
 *   post:
 *     summary: Delete user
 *     description: Deletes a user from the ISLE instance.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: ID of the user to delete
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User deleted
 *                 status:
 *                   type: string
 *                   description: Database operation status
 *                   example: ok
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/delete_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteUser( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const status = await User.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'user-deleted' ), status });
	})
);

/**
 * @openapi
 *
 * /update_user_session:
 *   post:
 *     summary: Update user session
 *     description: Updates the session of a user.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addedScore:
 *                 type: number
 *                 description: Score to add to the user's current score
 *                 example: 10
 *               elapsed:
 *                 type: number
 *                 description: Elapsed time to add to the user's current time (in milliseconds)
 *                 example: 1000
 *               lessonID:
 *                 type: ObjectId
 *                 description: ID of the lesson the user is currently in
 *                 example: 5e7f8f8f8f8f8f8f8f8f8f8
 *               progress:
 *                 type: number
 *                 description: Current progress of the user in the lesson
 *                 example: 0.5
 *               addedChatMessages:
 *                 description: Chat messages to add to the user's chat history
 *               addedActionTypes:
 *                 description: Action types to add to the user's action history
 *                 type: object
 *                 example: { 'LESSON_SUBMIT': 1 }
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 score:
 *                   type: number
 *                   description: Updated score
 *                   example: 10
 *                 spentTime:
 *                   type: number
 *                   description: Updated time spent
 *                   example: 93000
 */
router.post( '/update_user_session',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUserSession( req, res ) {
		debug( 'Should update the user session...' );
		const user = req.user;
		const { addedScore, elapsed, lessonID, progress, addedChatMessages, addedActionTypes } = req.body;
		const spentTime = user.spentTime + elapsed;
		const score = user.score + addedScore;
		const lessonData = copy( user.lessonData );
		if ( !lessonData[ lessonID ] ) {
			lessonData[ lessonID ] = {};
		}
		const data = lessonData[ lessonID ];
		if ( !data.progress ) {
			data.progress = progress;
		}
		else if ( progress > data.progress ) {
			data.progress = progress;
		}
		if ( data.spentTime ) {
			data.spentTime += elapsed;
		} else {
			data.spentTime = elapsed;
		}
		if ( data.chatMessages ) {
			data.chatMessages += addedChatMessages;
		} else {
			data.chatMessages = addedChatMessages;
		}
		const date = new Date();
		if ( !data.createdAt ) {
			data.createdAt = date;
		}
		data.updatedAt = date;
		if ( addedActionTypes ) {
			debug( 'Add action types...' );
			if ( !data.actionTypes ) {
				data.actionTypes = {};
			}
			const keys = objectKeys( addedActionTypes );
			for ( let i = 0; i < keys.length; i++ ) {
				const type = keys[ i ];
				const count = addedActionTypes[ type ];
				if ( data.actionTypes[ type ] ) {
					data.actionTypes[ type ] += count;
				} else {
					data.actionTypes[ type ] = count;
				}
			}
		}
		const stats = await User.updateOne({ '_id': user._id }, {
			lessonData,
			score,
			spentTime
		});
		debug( 'Result: ' + JSON.stringify( stats ) );
		res.json({
			score,
			spentTime
		});
	})
);

/**
 * @openapi
 *
 * /user_update_check:
 *   get:
 *     summary: Check if user data needs to be updated on the client
 *     description: Checks if the user data have been updated after the queried date.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     parameters:
 *       - in: query
 *         name: id
 *         description: ID of the user to check (current user if not provided)
 *         example: 5e9f8f8f8f8f8f8f8f8f8f8
 *         type: ObjectId
 *       - in: query
 *         name: updatedAt
 *         description: Date of the last update of the user on the client
 *         example: 2020-01-01T00:00:00.000Z
 *         type: string
 *         format: date-time
 *         required: true
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User data is up to date
 *                 hasMostRecent:
 *                   type: boolean
 *                   description: Whether the user data is up to date
 *                   example: true
 */
router.get( '/user_update_check',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUserCheck( req, res ) {
		const { id, updatedAt } = req.query;
		let user;
		if ( id ) {
			debug( 'Find user with a specified id...' );
			validateObjectId( id, 'id', req.t );
			user = await User.findOne({ '_id': id });
		} else {
			debug( 'Check user sending the request...' );
			user = req.user;
		}
		const hasMostRecent = ( updatedAt === user.updatedAt.toISOString() );
		res.json({
			message: req.t( hasMostRecent ? 'user-data-has-most-recent' : 'user-data-has-not-most-recent' ),
			hasMostRecent: hasMostRecent
		});
	})
);

/**
 * @openapi
 *
 * /user_adjust_progress:
 *   post:
 *     summary: Adjust progress of user
 *     description: Adjust the progress of a user.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email of the user for which to adjust the progress
 *                 example: jane.doe@cmu.edu
 *               lessonID:
 *                 type: ObjectId
 *                 description: ID of the lesson for which to adjust the progress
 *                 example: 5e9f8f8f8f8f8f8f8f8f8f8
 *               namespaceID:
 *                 type: ObjectId
 *                 description: ID of the namespace containing the lesson for which to adjust the progress
 *                 example: 9e9f8f8f8f8f8f8f8f8f8f8
 *               progress:
 *                 type: number
 *                 description: New progress of the user
 *                 example: 0.5
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User progress updated
 */
router.post( '/user_adjust_progress',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onProgressAdjustment( req, res ) {
		const { email, lessonID, namespaceID, progress } = req.body;

		validateString( email, 'email', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const user = await User.findOne({ email });
		const lessonData = copy( user.lessonData );
		if ( !lessonData[ lessonID ] ) {
			lessonData[ lessonID ] = {};
		}
		lessonData[ lessonID ].progress = Number( progress ) / 100;
		await user.updateOne({ $set: { lessonData }});
		res.json({ message: req.t( 'user-progress-updated' ) });
	})
);

/**
 * @openapi
 *
 * /user_adjust_grades:
 *   post:
 *     summary: Adjust grades of user
 *     description: Adjust the grades of a user for a lesson.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email of the user for which to adjust the grades
 *                 example: jane.doe@cmu.edu
 *               lessonID:
 *                 type: ObjectId
 *                 description: ID of the lesson for which to adjust the grades
 *                 example: 5e9f8f8f8f8f8f8f8f8f8f8
 *               namespaceID:
 *                 type: ObjectId
 *                 description: ID of the namespace containing the lesson for which to adjust the grades
 *                 example: 9e9f8f8f8f8f8f8f8f8f8f8
 *               grades:
 *                 type: object
 *                 description: New grades of the user
 *                 example: { 'free-text-question-1': 90, 'free-text-question-2': 95 }
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User grades updated
 */
router.post( '/user_adjust_grades',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onProgressAdjustment( req, res ) {
		const { email, lessonID, namespaceID, grades } = req.body;

		validateString( email, 'email', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const user = await User.findOne({ email });
		const lessonGrades = { ...user.lessonGrades };
		lessonGrades[ lessonID ] = grades;
		await user.updateOne({ $set: { lessonGrades }});
		res.json({ message: req.t( 'user-grades-updated' ) });
	})
);

/**
 * @openapi
 *
 * /user_append_grade_message:
 *   post:
 *     summary: Append grade message to user
 *     description: Append a message to a user's grade for a question in a lesson.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email of the user for which to append the grade message
 *                 example: jane.doe@cmu.edu
 *               lessonID:
 *                 type: ObjectId
 *                 description: ID of the lesson for which to append the grade message
 *                 example: 5e9f8f8f8f8f8f8f8f8f8f8
 *               namespaceID:
 *                 type: ObjectId
 *                 description: ID of the namespace containing the lesson for which to append the grade message
 *                 example: 9e9f8f8f8f8f8f8f8f8f8f8
 *               componentID:
 *                 type: string
 *                 description: ID of the component for which to append the grade message
 *                 example: free-text-question-1
 *               message:
 *                 type: string
 *                 description: Message to append to the user's grade for the component
 *                 example: Great job!
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: Grade message appended
 */
router.post( '/user_append_grade_message',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGradeMessage( req, res ) {
		const { email, lessonID, namespaceID, componentID, message } = req.body;

		validateString( email, 'email', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		validateString( componentID, 'componentID', req.t );

		const owner = await isOwner( req, namespaceID );
		if ( !owner && !req.user.email === email ) {
			return res.status( 401 ).send( req.t( 'access-denied' ) );
		}
		const user = await User.findOne({ email });
		const lessonGradeMessages = { ...user.lessonGradeMessages };
		if ( !lessonGradeMessages[ lessonID ] ) {
			lessonGradeMessages[ lessonID ] = {};
		}
		if ( isArray( lessonGradeMessages[ lessonID ][ componentID ] ) ) {
			lessonGradeMessages[ lessonID ][ componentID ].push( message );
		} else {
			lessonGradeMessages[ lessonID ][ componentID ] = [
				message
			];
		}
		await user.updateOne({ $set: { lessonGradeMessages }});
		res.json({ message: req.t( 'grade-message-appended' ) });
	})
);

/**
 * @openapi
 *
 * /sanitize_user:
 *   post:
 *     summary: Sanitize user
 *     description: Sanitize a user's data.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: ID of the user to sanitize
 *                 example: 5e9f8f8f8f8f8f8f8f8f8f8
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User sanitized
 *       400:
 *         description: Bad request
 *         content:
 *           text/plain:
 *             User could not be sanitized
 */
router.post( '/sanitize_user',
	updateUserLimit,
	passport.authenticate( 'jwt', { session: false }),
	function onSanitizeUser( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );
		User
			.findOne({ '_id': req.body.id })
			.exec( async function onFindUser( err, user ) {
				const ownedNamespaces = user.ownedNamespaces;
				debug( `Sanitize user with ${ownedNamespaces.length} owned namespaces...` );
				const newOwnedNamespaces = [];
				let ids = new Set();
				for ( let i = 0; i < ownedNamespaces.length; i++ ) {
					const namespaceExists = await Namespace.exists({ _id: ownedNamespaces[ i ] });
					if ( namespaceExists && !ids.has( ownedNamespaces[ i ] ) ) {
						ids.add( ownedNamespaces[ i ] );
						newOwnedNamespaces.push( ownedNamespaces[ i ] );
					}
				}
				const enrolledNamespaces = user.enrolledNamespaces;
				debug( `Sanitize user with ${enrolledNamespaces.length} enrolled namespaces...` );
				const newEnrolledNamespaces = [];
				ids = new Set();
				for ( let i = 0; i < enrolledNamespaces.length; i++ ) {
					const namespaceExists = await Namespace.exists({ _id: enrolledNamespaces[ i ] });
					if ( namespaceExists && !ids.has( enrolledNamespaces[ i ] ) ) {
						ids.add( enrolledNamespaces[ i ] );
						newEnrolledNamespaces.push( enrolledNamespaces[ i ] );
					}
				}
				const newProps = {};
				if ( newEnrolledNamespaces.length !== enrolledNamespaces.length ) {
					newProps.enrolledNamespaces = newEnrolledNamespaces;
				}
				if ( newOwnedNamespaces.length !== ownedNamespaces.length ) {
					newProps.ownedNamespaces = newOwnedNamespaces;
				}
				if ( !isEmptyObject( newProps ) ) {
					user.updateOne( { $set: newProps }, function onUserUpdate( err ) {
						if ( err ) {
							return res.status( 400 ).send( err.message );
						}
						res.json({ message: req.t( 'user-sanitized' ) });
					});
				} else {
					res.json({ message: req.t( 'user-already-sanitized' ) });
				}
			});
	}
);

/**
 * @openapi
 *
 * /update_user:
 *   post:
 *     summary: Update user
 *     description: Update a user.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: User's new password
 *                 example: new-password
 *               name:
 *                 type: string
 *                 description: User's new name
 *                 example: John Doe
 *               organization:
 *                 type: string
 *                 description: User's new organization
 *                 example: Example Inc.
 *               customFields:
 *                 type: object
 *                 description: User's custom fields
 *                 example: { 'custom-field-1': 'value-1', 'custom-field-2': 'value-2' }
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User updated
 */
router.post( '/update_user',
	updateUserLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUser( req, res ) {
		const user = req.user;
		if ( req.body.password ) {
			user.password = req.body.password;
		}
		if ( req.body.name ) {
			user.name = req.body.name;
		}
		if ( req.body.organization ) {
			user.organization = req.body.organization;
		}
		if ( req.body.customFields ) {
			if ( !user.customFields ) {
				user.customFields = {};
			}
			const fields = await CustomUserField.find().select([ 'name', 'editableOnProfile' ]);
			for ( let i = 0; i < fields.length; i++ ) {
				if ( fields[ i ].editableOnProfile ) {
					const name = fields[ i ].name;
					const value = req.body.customFields[ name ];
					if ( value ) {
						user.customFields[ name ] = value;
					}
				}
			}
		}
		await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: user.name
			})
		});
	})
);

/**
 * @openapi
 *
 * /admin_update_user:
 *   post:
 *     summary: Update user
 *     description: Update a user by admin.
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
 *                 description: ID of the user to update
 *                 example: 5e9f8f8f8f8f8f8f8f8f8f8
 *               password:
 *                 type: string
 *                 description: User's new password
 *                 example: new-password
 *               name:
 *                 type: string
 *                 description: User's new name
 *                 example: John Doe
 *               organization:
 *                 type: string
 *                 description: User's new organization
 *                 example: Example Inc.
 *               writeAccess:
 *                 type: boolean
 *                 description: User's write access
 *                 example: true
 *               administrator:
 *                 type: boolean
 *                 description: Boolean indicating if the user is an administrator
 *                 example: false
 *               verifiedEmail:
 *                 type: boolean
 *                 description: Boolean indicating if the user's email has been verified
 *                 example: false
 *               twoFactorAuth:
 *                 type: boolean
 *                 description: Boolean indicating if the user has two factor authentication enabled
 *                 example: false
 *               loginWithoutPassword:
 *                 type: boolean
 *                 description: Boolean indicating if the user logs in without a password
 *                 example: false
 *               customFields:
 *                 type: object
 *                 description: User's custom fields
 *                 example: { 'custom-field-1': 'value-1', 'custom-field-2': 'value-2' }
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User updated
 */
router.post( '/admin_update_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUser( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const user = await User.findById( req.body.id );
		if ( req.body.password ) {
			user.password = req.body.password;
		}
		if ( req.body.name ) {
			user.name = req.body.name;
		}
		if ( req.body.organization ) {
			user.organization = req.body.organization;
		}
		if ( req.body.writeAccess === true || req.body.writeAccess === false ) {
			user.writeAccess = req.body.writeAccess;
		}
		if ( req.body.administrator === true || req.body.administrator === false ) {
			user.administrator = req.body.administrator;
		}
		if ( req.body.verifiedEmail === true || req.body.verifiedEmail === false ) {
			user.verifiedEmail = req.body.verifiedEmail;
		}
		if ( req.body.twoFactorAuth === true || req.body.twoFactorAuth === false ) {
			user.twoFactorAuth = req.body.twoFactorAuth;
		}
		if ( req.body.loginWithoutPassword === true || req.body.loginWithoutPassword === false ) {
			user.loginWithoutPassword = req.body.loginWithoutPassword;
		}
		if ( req.body.customFields ) {
			if ( !user.customFields ) {
				user.customFields = {};
			}
			const fields = await CustomUserField.find().select( 'name' );
			for ( let i = 0; i < fields.length; i++ ) {
				const name = fields[ i ].name;
				const value = req.body.customFields[ name ];
				if ( !isUndefinedOrNull( value ) ) {
					user.customFields[ name ] = value;
				}
			}
		}
		await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: user.name
			})
		});
	})
);

/**
 * @openapi
 *
 * /update_user_password:
 *   post:
 *     summary: Update user password
 *     description: Set new password for user.
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: User identifier
 *                 example: 5c9b9f9f8b8f8b8f8b8f8b8f
 *               newPassword:
 *                 type: string
 *                 description: New password
 *                 example: newPassword
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    description: Success message
 *                    example: Password updated
 */
router.post( '/update_user_password',
	updateUserLimit,
	function onUpdateUserPassword( req, res ) {
		debug( 'Should update user password...' );
		const { newPassword, id } = req.body;

		validateString( newPassword, 'newPassword', req.t );
		validateObjectId( id, 'id', req.t );

		User.findOne({ _id: id }, function onFindUser( err, user ) {
			if ( err || !user ) {
				return res.status( 404 ).send( req.t( 'user-nonexistent' ) );
			}
			user.verifiedEmail = true;
			user.password = newPassword;
			user.save( function onSaveUser( err ) {
				if ( err ) {
					return res.status( 404 ).send( req.t( 'password-update-failed' ) + ': ' + err.message );
				}
				res.json({
					message: req.t( 'password-updated' )
				});
			});
		});
	}
);

/**
 * @openapi
 *
 * /get_user_rights:
 *   post:
 *     summary: Get user rights
 *     description: Get a user's rights for a specific namespace.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namespaceName:
 *                 type: string
 *                 description: Namespace name
 *                 example: namespace-1
 *     responses:
 *       200:
 *         description: User rights retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 owner:
 *                   type: boolean
 *                   description: Boolean indicating if the user is the owner of the namespace
 *                   example: true
 *                 enrolled:
 *                   type: boolean
 *                   description: Boolean indicating if the user is enrolled in the namespace
 *                   example: false
 *                 cohort:
 *                   type: string
 *                   description: Cohort of the user in the namespace if enrolled; otherwise, null
 *                   example: cohort-1
 */
router.post( '/get_user_rights',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserRights( req, res ) {
		const { namespaceName } = req.body;

		validateString( namespaceName, 'namespaceName', req.t );

		debug( `Should retrieve user rights for ${req.user.name} (${req.user.email})...` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		if ( !namespace ) {
			res.json({
				owner: false,
				enrolled: false
			});
		}
		else {
			debug( 'Namespace owners: ' + JSON.stringify( namespace.owners ) );
			let id = req.user._id.toString();
			let owner = false;
			for ( let i = 0; i < namespace.owners.length; i++ ) {
				if ( namespace.owners[ i ].toString() === id ) {
					owner = true;
				}
			}
			const cohort = await Cohort.findOne({
				namespace: namespace,
				members: {
					$in: [ req.user ]
				},
				startDate: { '$lt': new Date() },
				endDate: { '$gte': new Date() }
			});
			res.json({
				owner: !!owner,
				enrolled: !!cohort,
				cohort: cohort ? cohort.title : null
			});
		}
	})
);

/**
 * @openapi
 *
 * /has_write_access:
 *   get:
 *     summary: Check if user has write access
 *     description: Check if user has write access to create namespaces
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: email
 *         description: User email
 *         schema:
 *           type: string
 *           format: email
 *         example: jane.doe@cmu.edu
 *     responses:
 *       200:
 *         description: Success message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User has write access
 *                 writeAccess:
 *                   type: boolean
 *                   description: User has write access
 *                   example: true
 */
router.get( '/has_write_access', wrapAsync( async function onHasWriteAccess( req, res ) {
	const { email } = req.query;
	validateString( email, 'email', req.t );

	const user = await User.findOne({ email });
	res.json({
		message: req.t( user.writeAccess ? 'user-has-write-access' : 'user-has-no-write-access' ),
		writeAccess: user.writeAccess
	});
}));

/**
 * @openapi
 *
 * /set_write_access:
 *   post:
 *     summary: Set write access
 *     description: Set write access for user.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Write access token
 *                 example: <write-access-token>
 *     responses:
 *       200:
 *         description: Write access established
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: User updated
 *       401:
 *         description: Unauthorized
 *         content:
 *           text/plain:
 *             Incorrect write access token
 */
router.post( '/set_write_access',
	updateUserLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSetWriteAccess( req, res ) {
		const { token } = req.body;
		const user = req.user;
		debug( 'Should set user write access...' );
		if ( token !== tokens.writeAccess ) {
			return res.status( 401 ).send( req.t( 'incorrect-token' ) );
		}
		user.writeAccess = true;
		await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: user.name
			})
		});
	})
);

/**
 * @openapi
 *
 * /get_fake_users:
 *   get:
 *     summary: Get fake users
 *     description: Get email and name mapping from users to corresponding fake users.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: namespaceID
 *         description: Namespace identifier
 *         required: true
 *         type: ObjectId
 *     responses:
 *       200:
 *         description: Users retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: object
 *                   description: Object mapping email addresses to fake email addresses
 *                   example: { "jane.doe@cmu.edu": "jane.huffington.phd@gmail.com" }
 *                 name:
 *                   type: object
 *                   description: Object mapping names to fake names
 *                   example: { "Jane Doe": "Jane Huffington PhD" }
 */
router.get( '/get_fake_users',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function getFakeUsers( req, res ) {
		const { namespaceID } = req.query;

		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const users = await User.find();
		const email = {};
		const name = {};
		for ( let i = 0; i < users.length; i++ ) {
			email[ users[ i ].email ] = users[i].anonEmail;
			name[ users[ i ].name ] = users[i].anonName;
		}
		return res.json({
			email: email,
			name: name
		});
	})
);

/**
 * @openapi
 *
 * /get_current_user_actions:
 *   post:
 *     summary: Get current user actions
 *     description: Get the current user's actions.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonID:
 *                 type: ObjectId
 *                 description: Lesson identifier
 *                 example: 5b9f8f8f8f8f8f8f8f8f8f8
 *     responses:
 *       200:
 *         description: Actions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 actions:
 *                   type: array
 *                   description: Array of actions
 *                   items:
 *                     type: object
 */
router.post( '/get_current_user_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetCurrentUserActions( req, res ) {
		const { lessonID } = req.body;
		validateObjectId( lessonID, 'lessonID', req.t );

		const actions = await SessionData
			.find({
				type: 'action',
				lesson: lessonID,
				'data.email': req.user.email
			}, null )
			.sort( '-data.absoluteTime' )
			.exec();
		debug( `Return ${actions.length} actions to the caller` );
		res.json({
			actions: groupBy( actions.map( d => {
				const out = d.data;
				out.sessiondataID = d._id;
				return out;
			}), grouping )
		});
		function grouping( elem ) {
			return elem.id;
		}
	})
);

/**
 * @openapi
 *
 * /upload_profile_pic:
 *   post:
 *     summary: Upload profile picture
 *     description: Upload a user's profile picture.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: Object
 *                 description: Picture to upload
 *     responses:
 *       200:
 *         description: Picture uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message to display to the user
 *                   example: Profile picture saved
 *                 filename:
 *                   type: string
 *                   description: Name of the file
 *                   example: profile.png
 */
router.post( '/upload_profile_pic',
	avatarUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		req.user.picture = req.file.filename;
		await req.user.save();
		res.json({
			message: req.t( 'profile-picture-saved' ),
			filename: req.file.filename
		});
	})
);

/**
 * @openapi
 *
 * /upload_thumbnail_pic:
 *   post:
 *     summary: Upload thumbnail picture
 *     description: Upload a user's thumbnail picture.
 *     tags: [Users]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: Object
 *                 description: Picture to upload
 *     responses:
 *       200:
 *         description: Thumbnail uploaded
 *         content:
 *           text/plain:
 *             Operation successful
 */
router.post( '/upload_thumbnail_pic',
	thumbnailUpload,
	passport.authenticate( 'jwt', { session: false }),
	function onUploadFile( req, res ) {
		res.status( 200 ).send( req.t( 'operation-successful' ) );
	}
);

/**
 * @openapi
 *
 * /impersonate:
 *   post:
 *     summary: Impersonate user
 *     description: Impersonate a user.
 *     tags: [Users]
 *     security:
 *       - jwt: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - password
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: ID of the user to impersonate
 *                 example: 5b9f9f9f9f9f9f9f9f9f9f9
 *               password:
 *                 type: string
 *                 description: User's password to authenticate the impersonation
 *                 example: password
 *     responses:
 *       200:
 *         description: Successfully impersonated
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
 *                   description: JWT token
 *                 id:
 *                   type: ObjectId
 *                   description: ID of the impersonated user
 *                   example: 5b9f9f9f9f9f9f9f9f9f9f9
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/impersonate',
	passport.authenticate( 'jwt', { session: false }),
	async function onImpersonate( req, res ) {
		const { password, id } = req.body;

		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		validateObjectId( id, 'id', req.t );
		validateString( password, 'password', req.t );

		const correctPassword = await req.user.comparePassword( password );
		if ( !correctPassword ) {
			return res.status( 401 ).send( req.t( 'invalid-credentials' ) );
		}
		const payload = { id };
		const token = jwt.sign( payload, tokens.jwtKey );
		const out = { message: 'ok', token, id };
		res.json( out );
	}
);


// EXPORTS //

module.exports = router;
