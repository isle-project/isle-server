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

const debug = require( 'debug' )( 'socket' );


// MAIN //

class Member {
	constructor({ userEmail, userName, socket, owner, picture }) {
		this.email = userEmail;
		this.name = userName;
		this.socket = socket;
		this.owner = owner;
		this.joinTime = new Date();
		this.exitTime = null;
		this.picture = picture;
		return this;
	}

	setExitTime() {
		this.exitTime = new Date();
		debug( this.exitTime );
	}

	toJSON() {
		return {
			email: this.email,
			name: this.name,
			owner: this.owner,
			joinTime: this.joinTime.toLocaleTimeString(),
			exitTime: this.exitTime ? this.exitTime.toLocaleTimeString() : null,
			picture: this.picture
		};
	}
}


// EXPORTS //

module.exports = Member;
