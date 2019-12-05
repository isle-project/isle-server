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
