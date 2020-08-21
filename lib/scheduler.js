'use strict';

// MODULES //

const Event = require( './models/event.js' );


// VARIABLES //

const EVENT_SCHEDULER_INTERVAL = 60 * 1000;


// FUNCTIONS //

async function checkEvents() {
	const date = new Date().getTime();
	const openEvents = await Event.find({
		time: { $lt: date },
		done: false
	});
	console.log( 'Open events:' );
	console.log( openEvents );
}



// MAIN //

setInterval( checkEvents, EVENT_SCHEDULER_INTERVAL );
