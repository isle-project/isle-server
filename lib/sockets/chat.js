'use strict';

// MODULES //

var debug = require( 'debug' )( 'chat' );


// MAIN //

class Chat {

	constructor({ name, nMessages }) {

		this.name = name;
		this.nMessages = nMessages;
		this.messages = [];
	}

	join( member ) {
		member.socket.join( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully joined the chat '+this.name );
		member.socket.emit( 'chat_history', {
			name: this.name,
			messages: this.messages
		});
	}

	send( socket, msgObj ) {
		socket.to( this.name ).emit( 'chat_message', msgObj );
		this.addMessage( msgObj );
	}

	addMessage( msgObj ) {
		if ( this.messages.length >= this.nMessages ) {
			this.messages.shift();
		}
		this.messages.push( msgObj.msg );
		debug( `The chat history now contains ${this.messages.length} messages` );
	}

	cleanMessages() {
		this.messages = [];
	}

}

// EXPORTS //

module.exports = Chat;
