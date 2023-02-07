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

const debug = require( './../debug' )( 'sockets:chat' );
const contains = require( '@stdlib/assert/contains' );
const copy = require( '@stdlib/utils/copy' );


// VARIABLES //

const DEFAULT_PICTURE = 'anonymous.jpg';


// MAIN //

class Chat {
	constructor({ name, maxNumMessages, roomName }) {
		this.name = name;
		this.roomName = roomName;
		this.maxNumMessages = maxNumMessages;
		this.messages = [];
		this.members = [];
	}

	/**
	* A user already logged in on another browser window or device.
	*
	* @param {Object} member - member object
	*/
	mirrorJoin( member ) {
		debug( 'User is already a member of the chat, just create connection and return messages...' );
		member.socket.join( this.name );
		if ( member.owner ) {
			member.socket.join( this.name+':owners' );
		} else {
			member.socket.join( this.name+':users' );
		}
		member.socket.emit( 'console', 'You, '+member.name+', have successfully joined the chat '+this.name );
		return member.socket.emit( 'chat_history', {
			name: this.name,
			messages: member.owner ? this.messages : this.messages.map( x => {
				if ( x.anonymous ) {
					x.user = 'Anonymous';
					x.picture = DEFAULT_PICTURE;
				}
				return x;
			}),
			members: this.members
		});
	}

	/**
	* A new user is joining the chat.
	*
	* @param {Object} member - member object
	*/
	join( member ) {
		debug( `Member ${member.email} is joining the chat...` );
		if ( contains( this.members.map( m => m.email ), member.email ) ) {
			return this.mirrorJoin( member );
		}
		const socket = member.socket;
		socket.join( this.name );
		if ( member.owner ) {
			socket.join( this.name+':owners' );
		} else {
			socket.join( this.name+':users' );
		}
		socket.emit( 'console', 'You, '+member.name+', have successfully joined the chat '+this.name );
		socket.to( this.name ).emit( 'member_has_joined_chat', {
			name: this.name,
			member: member
		});
		this.members.push( member );
		socket.emit( 'chat_history', {
			name: this.name,
			messages: member.owner ? this.messages : this.messages.map( x => {
				if ( x.anonymous ) {
					x.user = 'Anonymous';
					x.picture = DEFAULT_PICTURE;
				}
				return x;
			}),
			members: this.members
		});
		this.sendStatistics( socket );
		debug( `The chat now has ${this.members.length} members.` );
	}

	/**
	* Checks whether a user is a member of the chat.
	*
	* @param {Object} user - user object
	* @returns {boolean} indicates whether user is a member of the chat
	*/
	isMember( user ) {
		for ( let i = 0; i < this.members.length; i++ ) {
			if ( this.members[ i ].email === user.email ) {
				return true;
			}
		}
		return false;
	}

	/**
	* A member is leaving the chat and should be removed.
	*
	* @param {Object} member - member object
	*/
	leave( member ) {
		debug( `Member ${member.email} is leaving the chat...` );
		const socket = member.socket;
		socket.to( this.name ).emit( 'member_has_left_chat', {
			name: this.name,
			member: member
		});
		socket.leave( this.name );
		socket.emit( 'console', 'You, '+member.name+', have successfully left the chat '+this.name );
		this.members = this.members.filter( m => m.email !== member.email );
		this.sendStatistics( socket );
		debug( `The chat now has ${this.members.length} members.` );
	}

	/**
	* Removes all members from the chat but leaves the chat intact (e.g, for instructors to browse through the message or restore them).
	*
	* @param {Object} socket - instructor socket
	*/
	removeAllMembers( socket ) {
		socket.to( this.name ).emit( 'closed_chat', this.name );
		const members = this.members;
		for ( let i = 0; i < members.length; i++ ) {
			const memberSocket = members[ i ].socket;
			memberSocket.leave( this.name );
		}
		this.members = [];
	}

	/**
	* Sends chat statistics to all members in the room
	*
	* @param {Object} socket - socket of joining user
	*/
	sendStatistics( socket ) {
		const stats = {
			nMessages: this.messages.length,
			nMembers: this.members.length,
			name: this.name
		};
		socket.to( this.roomName ).emit( 'chat_statistics', stats );
		socket.emit( 'chat_statistics', stats );
	}

	/**
	* Sends an incoming chat message to all other members of the chat as well as chat statistics all members in the room.
	*
	* @param {Object} socket - socket of sender
	* @param {Object} data - message object
	*/
	send( socket, data ) {
		debug( `Send message to chat ${this.name}...` );

		// Send unaltered message to owners:
		socket.to( this.name+':owners' ).emit( 'chat_message', {
			chatroom: data.chatroom,
			msg: data.msg
		});

		// If message should be sent anonymously, obscure sender:
		const msg = copy( data.msg );
		if ( msg & msg.anonymous ) {
			msg.user = 'Anonymous';
			msg.picture = DEFAULT_PICTURE;
		}
		socket.to( this.name+':users' ).emit( 'chat_message', {
			chatroom: data.chatroom,
			msg
		});
		this.addMessage( data.msg );
		this.sendStatistics( socket );
	}

	/**
	* Attaches an incoming message to the list of messages.
	*
	* @param {Object} msg - message object
	*/
	addMessage( msg ) {
		if ( this.messages.length >= this.maxNumMessages ) {
			this.messages.shift();
		}
		this.messages.push( msg );
		debug( `The chat history now contains ${this.messages.length} messages` );
	}

	/**
	* Resets all messages in the chat room.
	*/
	cleanMessages() {
		this.messages = [];
	}

	/**
	* @returns {Object} JSON representation of the chat
	*/
	toJSON() {
		return {
			name: this.name,
			roomName: this.roomName,
			maxNumMessages: this.maxNumMessages,
			messages: this.messages
		};
	}
}


// EXPORTS //

module.exports = Chat;
