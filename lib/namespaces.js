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
const { join } = require( 'path' );
const { mkdir, rmdir } = require( 'fs/promises' );
const trim = require( '@stdlib/string/trim' );
const pick = require( '@stdlib/utils/pick' );
const rateLimit = require( 'express-rate-limit' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
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
const { NAMESPACES_DIRECTORY, NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const createNamespaceLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // One hour window
	max: 3, // Start blocking after three requests
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-courses-created' ) );
	}
});
const updateNamespaceLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // Start blocking after ten requests
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

router.post( '/create_namespace',
	createNamespaceLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateNamespace( req, res ) {
		if ( !req.body.title || !req.body.description || !req.body.owners ) {
			return res.status( 400 ).send( 404, req.t( 'namespace-create-missing-fields' ) );
		}
		validateNamespaceName( req.body.title, 'title', req.t );
		validateStringArray( req.body.owners, 'owners', req.t );
		validateString( req.body.description, 'description', req.t );

		const users = await User.find({ 'email': req.body.owners });
		const namespace = new Namespace({
			owners: users,
			title: req.body.title,
			description: req.body.description
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
		for ( let i = 0; i < users.length; i++ ) {
			const user = users[ i ];
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
		res.json({
			message: req.t( 'namespace-created' ),
			successful: true,
			namespace: namespace.toObject()
		});
	})
);

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

router.post( '/update_namespace',
	updateNamespaceLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateNamespace( req, res ) {
		const ns = req.body.ns;
		const newProps = pick( ns, [ 'owners', 'title', 'description', 'enableTicketing' ]);

		validateNamespaceName( newProps.title, 'title', req.t );
		validateString( newProps.description, 'description', req.t );

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
		const toRemove = extractOwnersToRemove( newProps.owners, namespace.owners );
		debug( `Removing namespace from ${toRemove.length} owners...` );

		await removeOwnedNamespaceFromUsers( namespace, toRemove );
		let owners = await User.find({ email: newProps.owners });
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
					'subject': 'Course Invitation',
					'to': owner.email,
					'text': `
						Dear ${owner.name}, you were added as an instructor to the course "${namespace.title}" at ${organization}.<br />
						Please click the link below to login into your ISLE dashboard to view and configure the materials of the course.
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
		const newEmails = extractEmailsWithoutAccount( newProps.owners, owners );
		if ( newEmails.length > 0 ) {
			const newOwners = [];
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
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': 'Course Invitation',
					'to': user.email,
					'text': `
						Dear ${user.name}, you are invited to join course "${namespace.title}" at ${organization} as an instructor.<br />
						Please click the link below to complete the registration processing by choosing a password of your liking.<br />
						You can then login with your email address and password at <a href="${SERVER_HOST_NAME}">${SERVER_HOST_NAME}</a> to view and configure the materials of the course.
					`,
					'link': `${SERVER_HOST_NAME}/dashboard/#/complete-registration/?token=${user._id}`
				};
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

router.get( '/get_all_namespaces',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllNamespaces( req, res ) {
		validateAdmin( req );

		const namespaces = await Namespace
			.find({})
			.populate( 'owners', [ 'name', 'email', 'picture' ] )
			.exec();
		res.json({ message: 'ok', namespaces });
	})
);

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
