// MODULES //

const Event = require( './models/event.js' );
const User = require( './models/user.js' );


// MAIN //

async function setup() {
	const count = await Event.countDocuments({ type: 'overview_statistics' });
	if ( count === 0 ) {
		const admin = await User.findOne({
			administrator: true
		});
		const event = new Event({
			type: 'overview_statistics',
			time: new Date(),
			user: admin
		});
		event.save();
	}
}

setup();
