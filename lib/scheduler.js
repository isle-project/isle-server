'use strict';

// MODULES //

const debug = require( 'debug' )( 'scheduler' );
const Event = require( './models/event.js' );
const User = require( './models/user.js' );
const File = require( './models/file.js' );
const Cohort = require( './models/cohort.js' );
const SessionData = require( './models/session_data.js' );
const Lesson = require( './models/lesson.js' );
const Namespace = require( './models/namespace.js' );
const OverviewStatistics = require( './models/overview_statistics.js' );
const mailer = require( './mailer' );


// VARIABLES //

const EVENT_SCHEDULER_INTERVAL = 60 * 1000;


// FUNCTIONS //

async function checkEvents() {
	const date = new Date().getTime();
	const openEvents = await Event.find({
		time: { $lt: date },
		done: false
	});
	debug( `Processing ${openEvents.length} due events...` );
	for ( let i = 0; i < openEvents.length; i++ ) {
		const event = openEvents[ i ];
		const timeString = new Date( event.time ).toLocaleString();
		switch ( event.type ) {
			case 'unlock_lesson':
				const { lessonName, namespaceName } = event.data;
				debug( `Unlock lesson ${lessonName} of course ${namespaceName} scheduled at ${timeString} (actual time: ${date})...` );
				const namespace = await Namespace.findOne({ title: namespaceName });
				const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
				lesson.active = true;
				lesson.lockUntil = null;
				await lesson.save();
			break;
			case 'send_email':
				const mail = event.data;
				debug( `Sending email to ${mail.to} scheduled at ${timeString} (actual time: ${date})...` );
				mailer.send( mail, debug );
			break;
			case 'overview_statistics':
				const nUsers = await User.estimatedDocumentCount();
				const nLessons = await Lesson.estimatedDocumentCount();
				const nCohorts = await Cohort.estimatedDocumentCount();
				const nNamespaces = await Namespace.estimatedDocumentCount();
				const nEvents = await Event.estimatedDocumentCount();
				const nFiles = await File.estimatedDocumentCount();
				const nSessionData = await SessionData.estimatedDocumentCount();
				const stats = new OverviewStatistics({
					nUsers,
					nLessons,
					nCohorts,
					nNamespaces,
					nSessionData,
					nEvents,
					nFiles
				});
				await stats.save();
				const admin = await User.findOne({
					administrator: true
				});
				const overviewStatsEvent = new Event({
					type: 'overview_statistics',
					time: new Date().setHours( 24, 1, 0, 0 ), // calculate statistics one minute after next midnight
					user: admin
				});
				await overviewStatsEvent.save();
			break;
		}
		event.done = true;
		event.save();
	}
}



// MAIN //

setInterval( checkEvents, EVENT_SCHEDULER_INTERVAL );
