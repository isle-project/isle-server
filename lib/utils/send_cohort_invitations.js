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

const debug = require( './../debug' );
const Event = require( './../models/event.js' );
const User = require( './../models/user.js' );
const extractEmailsWithoutAccount = require( './extract_emails_without_account.js' );
const institutionName = require( './institution_name.js' );
const { SERVER_HOST_NAME, NOTIFICATIONS_EMAIL } = require( './../constants.js' );
const mailer = require( './../mailer' );


// FUNCTIONS //

/**
* Extracts users to be added to the cohort from the given array of users.
*
* @param {ObjectArray} users - array of users
* @param {ObjectArray} existingMembers - array of existing cohort members
* @returns {ObjectArray} array of users to be added to the cohort
*/
function extractUsersToBeAdded( users, existingMembers ) {
	const out = [];
	for ( let i = 0; i < users.length; i++ ) {
		let found = false;
		for ( let j = 0; j < existingMembers.length; j++ ) {
			if ( existingMembers[ j ].email === users[ i ].email ) {
				found = true;
			}
		}
		if ( !found ) {
			out.push( users[ i ] );
		}
	}
	return out;
}


// MAIN //

/**
* Sends an email to the cohort members to invite them to the cohort.
*
* @param {StringArray} memberEmails - email addresses of the cohort members
* @param {Object} cohort - cohort object
* @param {Object} namespace - namespace object
* @param {Request} req - request object
*/
async function sendCohortInvitations( memberEmails, cohort, namespace, req ) {
	if ( memberEmails.length > 0 ) {
		const ownerNames = namespace.owners.map( x => x.name ).join( ', ');
		const organization = namespace.owners[ 0 ].organization;
		let users = await User
			.where( 'email' )
			.in( memberEmails )
			.exec();
		const addedUsers = extractUsersToBeAdded( users, cohort.members );
		debug( `Adding ${addedUsers.length} user(s) to cohort...` );
		if ( addedUsers.length > 0 ) {
			const cohortStartTime = cohort.startDate.getTime();
			for ( let i = 0; i < addedUsers.length; i++ ) {
				const user = addedUsers[ i ];
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': req.t('course-invitation'),
					'to': user.email,
					'text': `
						${req.t('course-invitation-email', {
							user: user.name,
							cohort: cohort.title,
							namespace: namespace.title,
							ownerNames,
							organization
						})}
					`,
					'link': SERVER_HOST_NAME
				};
				const event = new Event({
					type: 'send_email',
					time: cohortStartTime,
					data: mail,
					user: req.user
				});
				event.save();
			}
		}
		const newEmails = extractEmailsWithoutAccount( memberEmails, users );
		debug( `Inviting ${newEmails.length} new user(s) to cohort...` );
		if ( newEmails.length > 0 ) {
			const cohortStartTime = cohort.startDate.getTime();
			const newUsers = [];
			if ( !mailer.active ) {
				return { users, newEmails };
			}
			for ( let i = 0; i < newEmails.length; i++ ) {
				const email = newEmails[ i ];
				const user = new User({
					name: email.split( '@' )[ 0 ],
					email: email,
					organization: institutionName( email )
				});
				newUsers.push( user );
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': req.t('course-invitation'),
					'to': user.email,
					'text': `
						${req.t('course-invitation-email-new-users', {
							user: user.name,
							cohort: cohort.title,
							namespace: namespace.title,
							ownerNames,
							organization,
							server: SERVER_HOST_NAME
						})}
					`,
					'link': `${SERVER_HOST_NAME}/dashboard/#/complete-registration/?token=${user._id}`
				};
				const event = new Event({
					type: 'send_email',
					time: cohortStartTime,
					data: mail,
					user: req.user
				});
				event.save();
			}
			users = users.concat( newUsers );
		}
		debug( 'Found %d users...', users.length );
		for ( let i = 0; i < users.length; i++ ) {
			const user = users[ i ];
			user.enrolledNamespaces.addToSet( namespace );
			await user.save();
		}
		return { users, newEmails };
	}
	return { users: [], newEmails: []};
}


// EXPORTS //

module.exports = sendCohortInvitations;
