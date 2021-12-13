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

const Event = require( './models/event.js' );
const User = require( './models/user.js' );


// MAIN //

/**
* Setup initial event to collect statistics over time on the server instance.
*/
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
