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
 *   name: Namespaces
 *   description: Course / namespace management.
 */


// MODULES //

const router = require( 'express' ).Router();
const { join } = require( 'path' );
const { mkdir, rmdir } = require( 'fs/promises' );
const rateLimit = require( 'express-rate-limit' );
const isWhitespace = require( '@stdlib/assert/is-whitespace' );
const trim = require( '@stdlib/string/trim' );
const pick = require( '@stdlib/utils/pick' );
const contains = require( '@stdlib/assert/contains' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const { isCustomTag } = require( './helpers/completions.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateStringArray = require( './helpers/validate_string_array.js' );
const validateObjectIdArray = require( './helpers/validate_object_id_array.js' );
const validateNamespaceName = require( './helpers/validate_namespace_name.js' );
const Namespace = require( './models/namespace.js' );
const Lesson = require( './models/lesson.js' );
const User = require( './models/user.js' );
const extractEmailsWithoutAccount = require( './utils/extract_emails_without_account.js' );
const renameDirectory = require( './utils/rename_directory.js' );
const institutionName = require( './utils/institution_name.js' );
const mailer = require( './mailer' );
const settings = require( './../etc/settings.json' );
const { NAMESPACES_DIRECTORY, NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const createNamespaceLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // One hour window
	max: settings.rateLimitNamespaceCreation || 30, // Start blocking after thirty requests by default
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-courses-created' ) );
	}
});
const updateNamespaceLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 1000, // Start blocking after one thousand requests
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-requests' ) );
	}
});


// FUNCTIONS //

async function removeOwnedNamespaceFromUsers( namespace, users ) {
	for ( let i = 0; i < users.length; i++ ) {
		const user = users[ i ];
		debug( `Removing namespace ${namespace.title} (id: ${namespace._id}) for user ${user.email}...` );
		const arr = [];
		for ( let j = 0; j < user.ownedNamespaces.length; j++ ) {
			const ownedNamespace = user.ownedNamespaces[ j ];
			debug( `Checking namespace ${namespace.title} (id: ${ownedNamespace._id})...` );
			if ( !ownedNamespace._id.equals( namespace._id ) ) {
				arr.push( ownedNamespace );
			}
			else {
				debug( `Namespace is removed for user ${user.email}...` );
			}
		}
		await user.updateOne({ $set: { ownedNamespaces: arr }});
	}
	return true;
}

/**
* Creates a namespace directory where lessons will be saved on disk.
*
* @param {string} dir - directory name
* @returns {Promise} mkdir call
*/
function createNamespaceDirectory( dir ) {
	const dirpath = join( NAMESPACES_DIRECTORY, dir );
	debug( 'Create namespace directory: '+dirpath );
	return mkdir( dirpath );
}

/**
* Deletes a namespace directory storing lessons on disk.
*
* @param {string} dir - directory name
* @returns {Promise} rmdir call
*/
function deleteNamespaceDirectory( dir ) {
	const dirpath = join( NAMESPACES_DIRECTORY, dir );
	debug( 'Remove namespace directory: '+dirpath );
	return rmdir( dirpath );
}

function extractOwnersToRemove( newOwnerEmails, existingOwners ) {
	const out = [];
	for ( let i = 0; i < existingOwners.length; i++ ) {
		let found = false;
		for ( let j = 0; j < newOwnerEmails.length; j++ ) {
			if ( newOwnerEmails[ j ] === existingOwners[ i ].email ) {
				found = true;
			}
		}
		if ( !found ) {
			out.push( existingOwners[ i ] );
		}
	}
	return out;
}


// MAIN //

/**
 * @openapi
 *
 * /create_namespace:
 *   post:
 *     summary: Create namespace
 *     description: Create a namespace.
 *     tags: [Namespaces]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - owners
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the namespace.
 *                 example: Course title
 *               description:
 *                 type: string
 *                 description: Description of the namespace.
 *                 example: Course description
 *               owners:
 *                 type: array
 *                 description: Array of user ids that will be owners of the namespace.
 *                 items:
 *                   type: ObjectId
 *                 example: [ 61b776e6a23cf344bf75b3de, 61b776f0e36e1edaaf7d431f ]
 *               enableTicketing:
 *                 type: boolean
 *                 description: Whether to enable ticketing for this namespace.
 *                 example: true
 *               tag:
 *                 type: string
 *                 description: A completion category to associate with this namespace.
 *                 example: "exam"
 *     responses:
 *       200:
 *         description: Namespace created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Result message.
 *                   example: Namespace successfully created.
 *                 namespace:
 *                   description: Namespace object.
 *                   $ref: '#/components/schemas/Namespace'
 *                 successful:
 *                   type: boolean
 *                   description: Whether the operation was successful.
 *                   example: true
 *       400:
 *         description: Missing or invalid parameters.
 *         content:
 *           text/plain:
 *             Missing required title, description, or owners fields.
 *       503:
 *         description: Email service not available.
 *         content:
 *           text/plain:
 *             Email service not available.
 */
router.post( '/create_namespace',
	createNamespaceLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateNamespace( req, res ) {
		if ( !req.body.title || !req.body.description || !req.body.owners ) {
			return res.status( 400 ).send( req.t( 'namespace-create-missing-fields' ) );
		}
		validateNamespaceName( req.body.title, 'title', req.t );
		validateStringArray( req.body.owners, 'owners', req.t );
		validateString( req.body.description, 'description', req.t );

		const ownerEmails = req.body.owners.map( x => trim( x ) );
		let owners = await User.find({ 'email': ownerEmails });
		const namespace = new Namespace({
			owners: owners,
			title: req.body.title,
			description: req.body.description,
                        ...( isCustomTag( req.body?.tag ) && { tag: req.body.tag } )
		});
		try {
			await namespace.save();
		} catch ( err ) {
			debug( 'Encountered an error when saving namespace: ' + err.message );
			return res.json({
				message: req.t( 'namespace-already-exists' ),
				successful: false
			});
		}
		for ( let i = 0; i < owners.length; i++ ) {
			const user = owners[ i ];
			user.ownedNamespaces.addToSet( namespace._id );
			await user.save();
		}
		try {
			await createNamespaceDirectory( namespace.title );
		} catch ( err ) {
			debug( 'Encountered an error when creating namespace directory: ' + err.message );
			return res.json({
				message: err.message,
				successful: false
			});
		}
		const organization = owners[ 0 ].organization;
		owners.forEach( owner => {
			if ( owner.email !== req.user.email ) {
				debug( `Send invitation email to ${owner.email}...` );
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': req.t('course-invitation'),
					'to': owner.email,
					'text': `
						${req.t('course-owner-invitation-email', {
							user: owner.name,
							namespace: namespace.title,
							organization
						})}
					`,
					'link': SERVER_HOST_NAME
				};
				debug( 'Send email notification to '+owner.email );
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
					}
				});
			}
		});
		const newEmails = extractEmailsWithoutAccount( ownerEmails, owners );
		if ( newEmails.length > 0 ) {
			const newOwners = [];
			const samlEmailDomains = settings.samlEmailDomains || [];
			for ( let i = 0; i < newEmails.length; i++ ) {
				const email = newEmails[ i ];
				const user = new User({
					name: email.split( '@' )[ 0 ],
					email: email,
					organization: institutionName( email ),
					ownedNamespaces: [ namespace ]
				});
				await user.save();
				newOwners.push( user );
				let mail;
				const emailOptions = {
					user: user.name,
					namespace: namespace.title,
					organization,
					server: SERVER_HOST_NAME
				};
				if ( samlEmailDomains.some( x => contains( email, x ) ) ) {
					mail = {
						'from': NOTIFICATIONS_EMAIL,
						'subject': req.t('course-invitation'),
						'to': user.email,
						'text': `
							${req.t('course-owner-invitation-email-sso-users', emailOptions )}
						`,
						'link': `${SERVER_HOST_NAME}/dashboard/lessons/${namespace.title}`
					};
				} else {
					mail = {
						'from': NOTIFICATIONS_EMAIL,
						'subject': req.t('course-invitation'),
						'to': user.email,
						'text': `
							${req.t('course-owner-invitation-email-new-users', emailOptions )}
						`,
						'link': `${SERVER_HOST_NAME}/dashboard/complete-registration?token=${user._id}`
					};
				}
				debug( 'Mail: ' + JSON.stringify( mail ) );
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
					}
				});
			}
			owners = owners.concat( newOwners );
		}
		await namespace.updateOne({
			$set: {
				owners: owners
			}
		});
		res.json({
			message: req.t( 'namespace-created' ),
			successful: true,
			namespace: namespace.toObject()
		});
	})
);

/**
 * @openapi
 *
 * /delete_namespace:
 *   post:
 *     tags: [Namespaces]
 *     summary: Delete namespace
 *     description: Delete a namespace.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: Namespace identifier
 *     responses:
 *       200:
 *         description: Successfully deleted namespace.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message describing the result.
 *                   example: Namespace successfully deleted.
 *       403:
 *         description: Permission denied for non-administrators or non-owners of the namespace.
 *       404:
 *         description: Namespace not found among the user's namespaces.
 *         content:
 *           text/plain:
 *             Namespace not found.
 *       405:
 *         description: Namespace is not empty.
 *         content:
 *           text/plain:
 *             Your course still contains lessons.You can only delete it after you have removed them.
 */
router.post( '/delete_namespace',
	updateNamespaceLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteNamespace( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );

		const query = {
			_id: req.body.id
		};
		if ( !req.user.administrator ) {
			query.owners = {
				$in: [ req.user ]
			};
		}
		const namespace = await Namespace.findOne( query );
		if ( !namespace ) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}
		const nLessons = await Lesson.countDocuments({ namespace: namespace });
		if ( nLessons > 0 ) {
			return res.status( 405 ).send( req.t( 'delete-lessons-first' ) );
		}
		const users = await User.find({ _id: namespace.owners });
		debug( `Deleting namespace from ${users.length} users...` );
		await removeOwnedNamespaceFromUsers( namespace, users );
		await deleteNamespaceDirectory( namespace.title );
		await namespace.remove();
		res.json({ message: req.t( 'namespace-deleted' ) });
	})
);

/**
 * @openapi
 *
 * /update_namespace:
 *   post:
 *     summary: Update namespace
 *     description: Update a namespace.
 *     tags: [Namespaces]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ns
 *             properties:
 *               ns:
 *                 type: object
 *                 description: The namespace object.
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: The new title of the namespace.
 *                     example: New title
 *                   description:
 *                     type: string
 *                     description: The new description of the namespace.
 *                     example: New description
 *                   owners:
 *                     type: array
 *                     description: Array of user ids that will be owners of the namespace.
 *                     items:
 *                       type: ObjectId
 *                     example: [ 61b776e6a23cf344bf75b3de, 61b776f0e36e1edaaf7d431f ]
 *                   enableTicketing:
 *                     type: boolean
 *                     description: Whether to enable ticketing for this namespace.
 *                     example: true
 *                   tag:
 *                     type: string
 *                     description: A completion category to associate with this namespace.
 *                     example: "exam"
 *     responses:
 *       200:
 *         description: Successfully updated namespace.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message describing the result.
 *                   example: Namespace successfully updated.
 *                 namespace:
 *                   description: The updated namespace.
 *                   $ref: '#/components/schemas/Namespace'
 *       404:
 *         description: Namespace not found among the user's namespaces.
 *         content:
 *           text/plain:
 *             Course does not exist.
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
router.post( '/update_namespace',
	updateNamespaceLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateNamespace( req, res ) {
		const ns = req.body.ns;
		const newProps = pick( ns, [ 'owners', 'title', 'description', 'enableTicketing' ]);

		validateNamespaceName( newProps.title, 'title', req.t );
		validateString( newProps.description, 'description', req.t );

                if ( isCustomTag( ns.tag, true ) ) {
                    newProps.tag = isWhitespace( ns.tag ) ? void 0 : ns.tag;
                }
		const namespace = await Namespace
			.findOne({ _id: ns._id })
			.populate( 'owners' )
			.exec();
		if ( !namespace ) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}

		debug( 'Check whether namespace has lessons array...' );
		if ( !namespace.lessons || namespace.lessons.length === 0 ) {
			debug( 'Attaching lessons to namespace...' );
			const lessons = await Lesson.find({ namespace: namespace });
			newProps.lessons = lessons;
		}

		newProps.owners = newProps.owners.map( x => trim( x ) );
		let owners = await User.find({ email: newProps.owners });
		const newEmails = extractEmailsWithoutAccount( newProps.owners, owners );
		if ( newEmails.length > 0 && !mailer.active ) {
			throw new ErrorStatus( 500, req.t( 'email-service-not-configured-add-owners', { emails: newEmails.join( ', ') } ) );
		}

		const toRemove = extractOwnersToRemove( newProps.owners, namespace.owners );
		debug( `Removing namespace from ${toRemove.length} owners...` );

		await removeOwnedNamespaceFromUsers( namespace, toRemove );
		debug( 'Found %d users...', owners.length );
		const organization = owners[ 0 ].organization;
		owners.forEach( owner => {
			let alreadyPresent = false;
			for ( let i = 0; i < owner.ownedNamespaces.length; i++ ) {
				if ( owner.ownedNamespaces[ i ]._id.equals( namespace._id ) ) {
					alreadyPresent = true;
				}
			}
			if ( !alreadyPresent ) {
				debug( `Designate ${owner.email} as owner of namespace.` );
				owner.ownedNamespaces.addToSet( namespace );
				owner.save();
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': req.t('course-invitation'),
					'to': owner.email,
					'text': `
						${req.t('course-owner-invitation-email', {
							user: owner.name,
							namespace: namespace.title,
							organization
						})}
					`,
					'link': SERVER_HOST_NAME
				};
				debug( 'Send email notification to '+owner.email );
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
					}
				});
			}
		});
		if ( newEmails.length > 0 ) {
			const newOwners = [];
			const samlEmailDomains = settings.samlEmailDomains || [];
			for ( let i = 0; i < newEmails.length; i++ ) {
				const email = newEmails[ i ];
				const user = new User({
					name: email.split( '@' )[ 0 ],
					email: email,
					organization: institutionName( email ),
					ownedNamespaces: [ namespace ]
				});
				await user.save();
				newOwners.push( user );
				const emailOptions = {
					user: user.name,
					namespace: namespace.title,
					organization,
					server: SERVER_HOST_NAME
				};
				let mail;
				if ( samlEmailDomains.some( x => contains( email, x ) ) ) {
					mail = {
						'from': NOTIFICATIONS_EMAIL,
						'subject': req.t('course-invitation'),
						'to': user.email,
						'text': `
							${req.t('course-owner-invitation-email-sso-users', emailOptions )}
						`,
						'link': `${SERVER_HOST_NAME}/dashboard/lessons/${namespace.title}`
					};
				} else {
					mail = {
						'from': NOTIFICATIONS_EMAIL,
						'subject': req.t('course-invitation'),
						'to': user.email,
						'text': `
							${req.t('course-owner-invitation-email-new-users', emailOptions )}
						`,
						'link': `${SERVER_HOST_NAME}/dashboard/complete-registration?token=${user._id}`
					};
				}
				debug( 'Mail: ' + JSON.stringify( mail ) );
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
					}
				});
			}
			owners = owners.concat( newOwners );
		}
		newProps.owners = owners;
		await namespace.updateOne({ $set: newProps });
		renameDirectory( namespace.title, ns.title, async () => {
			const newNamespace = await Namespace
				.findOne({ _id: ns._id })
				.populate( 'owners' )
				.exec();
			res.json({
				message: req.t( 'namespace-updated' ),
				namespace: newNamespace.toObject()
			});
		});
	})
);

/**
 * @openapi
 *
 * /get_namespaces:
 *   get:
 *     summary: Get namespaces
 *     description: Get namespaces owned by the user.
 *     tags: [Namespaces]
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
 *                   example: 'ok'
 *                 namespaces:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Namespace'
 */
router.get( '/get_namespaces',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetNamespaces( req, res ) {
		let namespaces = await Namespace.find({
			owners: {
				$in: [ req.user ]
			}
		});
		const promises = namespaces.map( ns => {
			return User.find({ _id: { $in: ns.owners }});
		});
		const userPerNS = await Promise.all( promises );
		for ( let i = 0; i < namespaces.length; i++ ) {
			let ns = namespaces[ i ];
			ns = ns.toObject();
			ns.owners = userPerNS[ i ].map( user => user.email );
			namespaces[ i ] = ns;
		}
		res.json({ message: 'ok', namespaces });
	})
);

/**
 * @openapi
 *
 * /get_all_namespaces:
 *   get:
 *     summary: Get all namespaces
 *     description: Retrieve all namespaces.
 *     tags: [Namespaces]
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
 *                   example: 'ok'
 *                 namespaces:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Namespace'
 *       403:
 *         description: Access denied for non-administrators
 */
router.get( '/get_all_namespaces',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllNamespaces( req, res ) {
		validateAdmin( req );

		const namespaces = await Namespace
			.find({})
			.populate( 'owners', [ 'firstName', 'lastName', 'preferredName', 'name', 'email', 'picture' ] )
			.exec();
		res.json({ message: 'ok', namespaces });
	})
);

/**
 * @openapi
 *
 * /set_lesson_order:
 *   post:
 *     summary: Set lesson order
 *     description: Set the order of lessons in a namespace inside the dashboard by their ids.
 *     tags: [Namespaces]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - lessons
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: The id of the namespace.
 *                 example: 5c9f8f8f8f8f8f8f8f8f8f
 *               lessons:
 *                 type: array
 *                 description: The ids of the lessons.
 *                 items:
 *                   type: ObjectId
 *                 example: [ 61b77614086885fdc69b7819, 61b77619f08eda6c9ebd4fd2 ]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: 'ok'
 *                 namespace:
 *                   description: Updated namespace
 *                   $ref: '#/components/schemas/Namespace'
 */
router.post( '/set_lesson_order',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSetLessonOrder( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );
		validateObjectIdArray( req.body.lessons, 'lessons', req.t );

		const namespace = await Namespace.findOne({
			_id: req.body.id
		});
		if ( !namespace ) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}
		if ( !namespace.lessons || namespace.lessons.length === 0 ) {
			debug( 'Attaching lessons to namespace...' );
			const lessons = await Lesson.find({ namespace: namespace });
			namespace.lessons = lessons;
		}
		if ( namespace.lessons.length !== req.body.lessons.length ) {
			return res.status( 409 ).send( req.t( 'client-data-outdated' ) );
		}
		namespace.lessons = req.body.lessons;
		await namespace.save();
		res.json({ message: 'ok', namespace });
	})
);


// EXPORTS //

module.exports = router;
