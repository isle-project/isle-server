'use strict';

// MODULES //

const Event = require( './models/event.js' );
const Lesson = require( './models/lesson.js' );


// VARIABLES //

const EVENT_SCHEDULER_INTERVAL = 60 * 1000;


// FUNCTIONS //

async function checkEvents() {
	const date = new Date().getTime();
	const openEvents = await Event.find({
		time: { $lt: date },
		done: false
	});
	console.log( 'Process events...' );
	for ( let i = 0; i < openEvents.length; i++ ) {
		const event = openEvents[ i ];
		switch ( event.type ) {
			case 'unlock_lesson':
				const { lessonName, namespaceName } = event.data;
				const namespace = await Namespace.findOne({ title: namespaceName });
				const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
				lesson.active = true;
				lesson.lockUntil = null;
				await lesson.save();
				event.done = true;
				event.save();
			break;
		}
	}
}



// MAIN //

setInterval( checkEvents, EVENT_SCHEDULER_INTERVAL );
