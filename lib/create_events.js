// MODULES //

const Event = require( './models/event.js' );


// MAIN //

const event = new Event({
	type: 'overview_statistics',
	time: new Date()
});
event.save();
