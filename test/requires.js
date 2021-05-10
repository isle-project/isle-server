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

const path = require( 'path' );
const proxyquire = require( 'proxyquire' );
const noop = require( '@stdlib/utils/noop' );


// VARIABLES //

const WRITE_ACCESS_TOKEN = 'no_restrictions';
const FIXTURES_DIRECTORY = path.join( __dirname, 'fixtures' );
const LOCALES_DIRECTORY = path.join( __dirname, '..', 'locales' );
const credentials = {
	'tokens': {
		'writeAccess': WRITE_ACCESS_TOKEN,
		'jwtKey': 'json_web_token_key'
	},
	'apixu': {},
	'deepl': {},
	'jitsi': {},
	'github': {},
	'mailgun': {},
	'mapbox': {},
	'opencpu': {}
};
const passport = proxyquire.noCallThru()( './../lib/passport.js', {
	'./credentials.js': credentials
});
const mailer = {
	'send': function send( mail, clbk ) {
		clbk( null, 'Mail sent' );
	},
	'active': true
};
const fileOwnerCheck = () => ( req, res, next ) => next();
const isAdmin = () => ( req, res, next ) => next();
const sendCohortInvitations = () => {
	return {
		users: [],
		newEmails: []
	};
};


// MAIN //

const requires = {
	'./../etc/config.json': {
		'namespacesDirectory': FIXTURES_DIRECTORY,
		'mediaDirectory': FIXTURES_DIRECTORY,
		'logsDirectory': FIXTURES_DIRECTORY,
		'localesDirectory': LOCALES_DIRECTORY,
		'server': 'http://localhost',
		'certificate': path.join( FIXTURES_DIRECTORY, 'keys', 'ourcustomisleserver.com.cert' ),
		'key': path.join( FIXTURES_DIRECTORY, 'keys', 'ourcustomisleserver.com.key' )
	},
	'./connect_mongoose.js': noop,
	'./mailer': mailer,
	'./create_events': noop,
	'./scheduler.js': noop,
	'./announcements.js': proxyquire.noCallThru()( './../lib/announcements.js', {
		'./passport.js': passport
	}),
	'./backups.js': proxyquire.noCallThru()( './../lib/backups.js', {
		'./passport.js': passport,
		'./mailer': mailer
	}),
	'./badges.js': proxyquire.noCallThru()( './../lib/badges.js', {
		'./passport.js': passport
	}),
	'./cohorts.js': proxyquire.noCallThru()( './../lib/cohorts.js', {
		'./passport.js': passport,
		'./mailer': mailer,
		'./utils/send_cohort_invitations.js': sendCohortInvitations
	}),
	'./custom_fields.js': proxyquire.noCallThru()( './../lib/custom_fields.js', {
		'./passport.js': passport
	}),
	'./events.js': proxyquire.noCallThru()( './../lib/events.js', {
		'./passport.js': passport,
		'./scheduler.js': {
			triggerEvent: noop
		}
	}),
	'./files.js': proxyquire.noCallThru()( './../lib/files.js', {
		'./passport.js': passport,
		'./helpers/file_owner_check.js': fileOwnerCheck
	}),
	'./passport.js': passport,
	'./lessons.js': proxyquire.noCallThru()( './../lib/lessons.js', {
		'./credentials.js': credentials,
		'./passport.js': passport
	}),
	'./license.js': proxyquire.noCallThru()( './../lib/license.js', {
		'./passport.js': passport,
		'./helpers/is_admin.js': isAdmin
	}),
	'./login.js': proxyquire.noCallThru()( './../lib/login.js', {
		'./credentials.js': credentials,
		'./mailer': mailer,
		'./passport.js': passport,
		'./utils/send_verification_email.js': mailer.send
	}),
	'./mail.js': proxyquire.noCallThru()( './../lib/mail.js', {
		'./mailer': mailer
	}),
	'./namespaces.js': proxyquire.noCallThru()( './../lib/namespaces.js', {
		'./passport.js': passport,
		'./mailer': mailer
	}),
	'./roles.js': proxyquire.noCallThru()( './../lib/roles.js', {
		'./passport.js': passport
	}),
	'./services.js': proxyquire.noCallThru()( './../lib/services.js', {
		'./credentials.js': credentials,
		'./passport.js': passport
	}),
	'./sessiondata.js': proxyquire.noCallThru()( './../lib/sessiondata.js', {
		'./passport.js': passport
	}),
	'./settings.js': proxyquire.noCallThru()( './../lib/settings.js', {
		'./passport.js': passport
	}),
	'./sketchpad.js': proxyquire.noCallThru()( './../lib/sketchpad.js', {
		'./passport.js': passport
	}),
	'./statistics.js': proxyquire.noCallThru()( './../lib/statistics.js', {
		'./passport.js': passport
	}),
	'./sticky_notes.js': proxyquire.noCallThru()( './../lib/sticky_notes.js', {
		'./passport.js': passport
	}),
	'./text_editor_document.js': proxyquire.noCallThru()( './../lib/text_editor_document.js', {
		'./passport.js': passport
	}),
	'./tickets.js': proxyquire.noCallThru()( './../lib/tickets.js', {
		'./passport.js': passport,
		'./mailer': mailer
	}),
	'./two_factor_authentication.js': proxyquire.noCallThru()( './../lib/two_factor_authentication.js', {
		'./credentials.js': credentials,
		'./passport.js': passport
	}),
	'./users.js': proxyquire.noCallThru()( './../lib/users.js', {
		'./credentials.js': credentials,
		'./passport.js': passport,
		'./utils/send_verification_email.js': noop
	}),
	'./helpers/is_instructor.js': () => ( req, res, next ) => next(),
	'./helpers/is_admin.js': isAdmin,
	'./helpers/file_owner_check.js': fileOwnerCheck
};


// EXPORTS //

module.exports = requires;
