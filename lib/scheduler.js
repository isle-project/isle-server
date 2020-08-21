'use strict';

// MODULES //

const debug = require( 'debug' )( 'scheduler' );
const Event = require( './models/event.js' );
const Lesson = require( './models/lesson.js' );
const Namespace = require( './models/namespace.js' );
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
		}
		event.done = true;
		event.save();
	}
}



// MAIN //

setInterval( checkEvents, EVENT_SCHEDULER_INTERVAL );
