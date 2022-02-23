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
 *   name: Cohorts
 *   description: Cohort management.
 */


// MODULES //

const router = require( 'express' ).Router();
const pick = require( '@stdlib/utils/pick' );
const trim = require( '@stdlib/string/trim' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const sendCohortInvitations = require( './utils/send_cohort_invitations.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const Namespace = require( './models/namespace.js' );
const mailer = require( './mailer' );
const Cohort = require( './models/cohort.js' );
const User = require( './models/user.js' );


// MAIN //

/**
 * @openapi
 *
 * /create_cohort:
 *   post:
 *     description: Create a new cohort
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Cohort title
 *                 example: "Section A"
 *               namespaceID:
 *                 type: ObjectId
 *                 description: Namespace ID
 *                 example: 5a9b8f8f8f8f8f8f8f8f8f8
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Cohort start date
 *                 example: 2017-01-01T00:00:00.000Z
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Cohort end date
 *                 example: 2017-12-20T00:00:00.000Z
 *               private:
 *                 type: boolean
 *                 description: Whether the cohort is private or can be enrolled into by anyone
 *                 example: true
 *               emailFilter:
 *                 type: string
 *                 description: Email regular expression to filter users who can enroll into the cohort
 *                 example: cmu.edu$
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
 *                   example: "Cohort created"
 *                 successful:
 *                   type: boolean
 *                   description: Whether the cohort was successfully created.
 *                   example: true
 */
router.post( '/create_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateCohort( req, res ) {
		debug( 'POST request: ' + JSON.stringify( req.body ) );
		if ( req.body.title && req.body.namespaceID ) {
			validateString( req.body.title, 'title', req.t );
			validateObjectId( req.body.namespaceID, 'namespaceID', req.t );

			const cohort = new Cohort({
				title: req.body.title,
				namespace: req.body.namespaceID,
				startDate: req.body.startDate,
				endDate: req.body.endDate,
				private: req.body.private,
				emailFilter: req.body.emailFilter,
				members: []
			});
			let students = req.body.students;
			if ( students.includes( ',' ) ) {
				students = students.split( ',' ).map( x => trim( x ) );
			} else if ( students ) {
				students = [ trim( students ) ];
			} else {
				students = [];
			}
			const namespace = await Namespace
				.findOne({
					_id: req.body.namespaceID
				})
				.populate( 'owners' )
				.exec();
			const { users, newEmails } = await sendCohortInvitations( students, cohort, namespace, req );
			cohort.members = users;
			try {
				await cohort.save();
				if ( !mailer.active && newEmails.length > 0 ) {
					return res.json({
						message: req.t( 'cohort-created-without-new-members-due-to-disabled-email', { emails: newEmails } ),
						successful: true
					});
				}
				res.json({
					message: req.t( 'cohort-created' ),
					successful: true
				});
			} catch ( err ) {
				debug( 'Encountered an error when saving cohort: ' + err.message );
				res.status( 401 ).send( err.message );
			}
		}
	})
);

/**
 * @openapi
 *
 * /get_enrollable_cohorts:
 *   get:
 *     summary: Get enrollable cohorts
 *     description: Get all enrollable cohorts.
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cohorts:
 *                   type: array
 *                   description: Array of cohorts that can be enrolled in
 *                   items:
 *                     $ref: '#/components/schemas/Cohort'
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 */
router.get( '/get_enrollable_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCohorts( req, res ) {
		const cohorts = await Cohort
			.find({
				startDate: { '$lt': new Date() },
				endDate: { '$gte': new Date() },
				private: false
			})
			.populate({
				path: 'namespace',
				populate: { path: 'owners' }
			})
			.exec();
		res.json({ message: 'ok', cohorts: cohorts });
	})
);

/**
 * @openapi
 *
 * /get_cohorts:
 *   get:
 *     summary: Get cohorts
 *     description: Get cohorts for a namespace.
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: namespaceID
 *         description: Namespace identifier
 *         schema:
 *           type: ObjectId
 *         example: 5a9b8f8f8f8f8f8f8f8f8f8f
 *       - in: query
 *         name: memberFields
 *         description: Space-separated list of fields to populate for members
 *         schema:
 *           type: string
 *         example: 'email name'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 cohorts:
 *                   type: array
 *                   description: Array of cohorts
 *                   items:
 *                     $ref: '#/components/schemas/Cohort'
 */
router.get( '/get_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCohorts( req, res ) {
		let memberFields = req.query.memberFields || 'email name picture score spentTime lessonData lessonGrades badges anonEmail anonName customFields';
		validateString( memberFields, 'memberFields', req.t );
		validateObjectId( req.query.namespaceID, 'namespaceID', req.t );
		if ( memberFields.includes( 'name' ) ) {
			memberFields += ' firstName lastName preferredName';
		}
		const cohorts = await Cohort
			.find({ namespace: req.query.namespaceID })
			.populate( 'members', memberFields )
			.exec();
		res.json({ message: 'ok', cohorts: cohorts });
	})
);

/**
 * @openapi
 *
 * /get_all_cohorts:
 *   get:
 *     summary: Get all cohorts
 *     description: Get all cohorts for all namespaces.
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: memberFields
 *         description: Space-separated list of fields to populate for members
 *         schema:
 *           type: string
 *         example: 'email name'
 *       - in: query
 *         name: namespaceFields
 *         description: Space-separated list of fields to populate for namespaces
 *         schema:
 *           type: string
 *         example: 'title'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 cohorts:
 *                   type: array
 *                   description: Array of cohorts
 *                   items:
 *                     $ref: '#/components/schemas/Cohort'
 */
router.get( '/get_all_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllCohorts( req, res ) {
		let memberFields = req.query.memberFields || 'email name picture';
		const namespaceFields = req.query.namespaceFields || 'title';

		validateAdmin( req );
		validateString( memberFields, 'memberFields', req.t );
		validateString( namespaceFields, 'namespaceFields', req.t );

		if ( memberFields.includes( 'name' ) ) {
			memberFields += ' firstName lastName preferredName';
		}
		const cohorts = await Cohort
			.find({})
			.populate( 'members', memberFields )
			.populate( 'namespace', namespaceFields )
			.exec();
		res.json({ message: 'ok', cohorts });
	})
);

/**
 * @openapi
 *
 * /delete_cohort:
 *   post:
 *     summary: Delete cohort
 *     description: Delete a cohort associated with a namespace.
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               _id:
 *                 type: ObjectId
 *                 description: Cohort identifier
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Cohort deleted"
 *       403:
 *         description: Access denied for non-administrators or non-owners of the namespace
 */
router.post( '/delete_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteCohort( req, res ) {
		validateObjectId( req.body._id, '_id', req.t );

		const cohort = await Cohort.findOne({
			_id: req.body._id
		});
		if ( !cohort ) {
			return res.status( 404 ).send( req.t( 'cohort-nonexistent' ) );
		}
		if ( !req.user.administrator ) {
			// Check whether user is course owner and thus allowed to delete cohort:
			const namespace = await Namespace.findOne({
				_id: cohort.namespace,
				owners: { $in: [ req.user ]}
			});
			if ( !namespace ) {
				return res.status( 403 ).send( req.t( 'access-denied-no-owner' ) );
			}
		}
		const users = await User.find({ _id: { $in: cohort.members }});
		users.forEach( user => {
			const idx = user.enrolledNamespaces.indexOf( cohort.namespace );
			if ( idx !== -1 ) {
				user.enrolledNamespaces.splice( idx, 1 );
				user.save();
			}
		});
		await cohort.remove();
		res.json({ message: req.t( 'cohort-deleted' ) });
	})
);

/**
 * @openapi
 *
 * /add_to_cohort:
 *   post:
 *     summary: Add user to cohort
 *     description: Add requesting user to the cohort.
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cohortID:
 *                 type: ObjectId
 *                 description: Cohort identifier
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "User added to cohort"
 */
router.post( '/add_to_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const cohortID = req.body.cohortID;
		debug( 'Add user to cohort with ID '+cohortID );

		validateObjectId( cohortID, 'cohortID', req.t );

		const user = req.user;
		const cohort = await Cohort.findOneAndUpdate(
			{ _id: cohortID },
			{ $addToSet: { members: user }},
			{ new: true });
		debug( `Updated cohort ${cohort.title}...` );
		user.enrolledNamespaces.addToSet( cohort.namespace );
		await user.save();
		res.json({ message: req.t( 'user-added-to-cohort' ) });
	})
);

/**
 * @openapi
 *
 * /update_cohort:
 *   post:
 *     summary: Update cohort
 *     description: Update a cohort.
 *     tags: [Cohorts]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cohort:
 *                 description: Cohort object
 *                 $ref: '#/components/schemas/Cohort'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Cohort updated"
 *                 newEmails:
 *                   type: array
 *                   description: Array of email addresses for new users that were added to the cohort
 *                   items:
 *                     type: string
 *                     description: Email address
 *                     format: email
 *                   example: [ "jane.doe@isledocs.com", "john.doe@isledocs.com" ]
 */
router.post( '/update_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const updatedCohort = req.body.cohort;
		const newProps = pick( updatedCohort, [ 'members', 'title', 'startDate', 'endDate', 'private', 'emailFilter' ]);

		debug( 'Updated cohort: '+ JSON.stringify( updatedCohort ) );
		const cohort = await Cohort
			.findOne({ _id: updatedCohort._id })
			.populate( 'members' )
			.populate({
				path: 'namespace',
				populate: { path: 'owners' }
			})
			.exec();
		if ( !cohort ) {
			return res.status( 404 ).send( req.t( 'cohort-nonexistent' ) );
		}
		for ( let i = 0; i < cohort.members.length; i++ ) {
			const user = cohort.members[ i ];
			debug( 'Remove user with email '+user.email+' from cohort' );
			const idx = user.enrolledNamespaces.indexOf( cohort.namespace._id );
			if ( idx !== -1 ) {
				user.enrolledNamespaces.splice( idx, 1 );
				await user.save();
			}
		}
		if ( newProps.members.includes( ',' ) ) {
			newProps.members = newProps.members.split( ',' ).map( x => trim( x ) );
		} else if ( newProps.members ) {
			newProps.members = [ trim( newProps.members ) ];
		} else {
			newProps.members = [];
		}
		const { users, newEmails } = await sendCohortInvitations( newProps.members, cohort, cohort.namespace, req );
		if ( !mailer.active && newEmails.length > 0 ) {
			return res.status( 500 ).send( req.t( 'cohort-update-cannot-invite-new-users-without-email', { emails: newEmails.join( ', ') } ) );
		}
		newProps.members = users;
		await cohort.updateOne({ $set: newProps });
		res.json({
			message: req.t( 'cohort-updated' ),
			newEmails: newEmails
		});
	})
);


// EXPORTS //

module.exports = router;
