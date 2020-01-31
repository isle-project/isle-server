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

const debug = require( 'debug' )( 'chat' );
const contains = require( '@stdlib/assert/contains' );


// MAIN //

class Chat {
	constructor({ name, nMessages }) {
		this.name = name;
		this.nMessages = nMessages;
		this.messages = [];
		this.members = [];
	}

	mirrorJoin( member ) {
		debug( 'User is already a member of the chat, just create connection and return messages...' );
		member.socket.join( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully joined the chat '+this.name );
		return member.socket.emit( 'chat_history', {
			name: this.name,
			messages: this.messages,
			members: this.members
		});
	}

	join( member ) {
		debug( `Member ${member.email} is joining the chat...` );
		if ( contains( this.members.map( m => m.email ), member.email ) ) {
			return this.mirrorJoin( member );
		}
		member.socket.join( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully joined the chat '+this.name );
		member.socket.to( this.name ).emit( 'member_has_joined_chat', {
			name: this.name,
			member: member
		});
		this.members.push( member );
		member.socket.emit( 'chat_history', {
			name: this.name,
			messages: this.messages,
			members: this.members
		});
		debug( `The chat now has ${this.members.length} members.` );
	}

	isMember( user ) {
		for ( let i = 0; i < this.members.length; i++ ) {
			if ( this.members[ i ].email === user.email ) {
				return true;
			}
		}
		return false;
	}

	leave( member ) {
		debug( `Member ${member.email} is leaving the chat...` );
		member.socket.to( this.name ).emit( 'member_has_left_chat', {
			name: this.name,
			member: member
		});
		member.socket.leave( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully left the chat '+this.name );
		this.members = this.members.filter( m => m.email !== member.email );
		debug( `The chat now has ${this.members.length} members.` );
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
