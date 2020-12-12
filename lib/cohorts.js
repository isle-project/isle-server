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
const pick = require( '@stdlib/utils/pick' );
const trim = require( '@stdlib/string/trim' );
const debug = require( './debug' );
const passport = require( './passport' );
const wrapAsync = require( './utils/wrap_async.js' );
const sendCohortInvitations = require( './utils/send_cohort_invitations.js' );
const ErrorStatus = require( './helpers/error.js' );
const Namespace = require( './models/namespace.js' );
const Cohort = require( './models/cohort.js' );
const User = require( './models/user.js' );


// MAIN //

router.post( '/create_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateCohort( req, res ) {
		debug( 'POST request: ' + JSON.stringify( req.body ) );
		if ( req.body.title && req.body.namespaceID ) {
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
			const { users, newEmails } = await sendCohortInvitations( students, cohort, namespace, req.user );
			cohort.members = users;
			try {
				await cohort.save();
				res.json({
					message: req.t( 'cohort-created' ),
					successful: true,
					newEmails: newEmails
				});
			} catch ( err ) {
				debug( 'Encountered an error when saving cohort: ' + err.message );
				res.status( 401 ).send( err.message );
			}
		}
	})
);

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

router.get( '/get_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCohorts( req, res ) {
		const memberFields = req.query.memberFields || 'email name picture score spentTime lessonData lessonGrades badges anonEmail anonName customFields';
		const cohorts = await Cohort
			.find({ namespace: req.query.namespaceID })
			.populate( 'members', memberFields )
			.exec();
		res.json({ message: 'ok', cohorts: cohorts });
	})
);

router.get( '/get_all_cohorts',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllCohorts( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'all-cohorts-only-admin' ) );
		}
		const memberFields = req.query.memberFields || 'email name picture';
		const namespaceFields = req.query.namespaceFields || 'title';
		const cohorts = await Cohort
			.find({})
			.populate( 'members', memberFields )
			.populate( 'namespace', namespaceFields )
			.exec();
		res.json({ message: 'ok', cohorts });
	})
);

router.post( '/delete_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteCohort( req, res ) {
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

router.post( '/add_to_cohort',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateCohort( req, res ) {
		const cohortID = req.body.cohortID;
		debug( 'Add user to cohort with ID '+cohortID );
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
		const { users, newEmails } = await sendCohortInvitations( newProps.members, cohort, cohort.namespace, req.user );
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
