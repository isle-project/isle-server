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
const contains = require( '@stdlib/assert/contains' );
const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const objectKeys = require( '@stdlib/utils/keys' );
const Chat = require( './chat.js' );


// MAIN //

class Room {
	constructor( _, member, roomName ) {
		debug( `Construct ${roomName} room...` );
		this.members = [ member ];
		this.owners = [];
		if ( member.owner ) {
			this.owners.push( member );
			member.socket.join( this.name+':owners' );
		}
		this.name = roomName;
		this.history = [];
		this.chats = {};

		member.socket.join( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully created room '+this.name );
		this.sendUserList( member );
	}

	joinChat( name, member ) {
		const chatName = this.name + ':' + name;
		debug( `User is joining ${chatName} chat...` );
		if ( !hasOwnProp( this.chats, chatName ) ) {
			let chat = new Chat({
				name: chatName,
				maxNumMessages: 250,
				roomName: this.name
			});
			this.chats[ chatName ] = chat;
		}
		this.chats[ chatName ].join( member );
	}

	closeChatForAll( name ) {
		const chatName = this.name + ':' + name;
		const chat = this.chats[ chatName ];
		chat.removeAllMembers();
	}

	leaveChat( name, member ) {
		const chatName = this.name + ':' + name;
		debug( `User is leaving ${chatName} chat...` );
		this.chats[ chatName ].leave( member );
	}

	leaveAllChats( member ) {
		const keys = objectKeys( this.chats );
		for ( let i = 0; i < keys.length; i++ ) {
			const chat = this.chats[ keys[ i ] ];
			if ( chat.isMember( member ) ) {
				debug( 'Need to leave chat with name: '+keys[ i ] );
				chat.leave( member );
			}
		}
		debug( 'Left all chats...' );
	}

	sendChatStatistics( socket ) {
		const keys = objectKeys( this.chats );
		for ( let i = 0; i < keys.length; i++ ) {
			const chat = this.chats[ keys[ i ] ];
			chat.sendStatistics( socket );
		}
	}

	mirrorJoinChats( member ) {
		debug( 'Mirror join chats when user is logging in from other device...' );
		const keys = objectKeys( this.chats );
		for ( let i = 0; i < keys.length; i++ ) {
			const chat = this.chats[ keys[ i ] ];
			if ( chat.isMember( member ) ) {
				chat.mirrorJoin( member );
			}
		}
	}

	mirrorJoin( member ) {
		debug( 'Mirror join when user is logging in from other device...' );
		const socket = member.socket;
		if ( member.owner ) {
			member.socket.join( this.name+':owners' );
		}
		socket.join( this.name );
		socket.emit( 'console', 'You, '+member.name+', have successfully joined room '+this.name );
		socket.to( this.name ).emit( 'console', member.name+' has successfully joined room '+this.name );
		socket.to( this.name ).emit( 'user_joins', JSON.stringify( member ) );
		socket.emit( 'user_joins', JSON.stringify( member ) );
		this.sendChatStatistics( socket );
	}

	join( member ) {
		const socket = member.socket;
		if ( !contains( this.members.map( m => m.email ), member.email ) ) {
			this.members.push( member );
			if ( member.owner ) {
				this.owners.push( member );
				socket.join( this.name+':owners' );
			}
			socket.join( this.name );
			socket.emit( 'console', 'You, '+member.name+', have successfully joined room '+this.name );
			socket.to( this.name ).emit( 'console', member.name+' has successfully joined room '+this.name );
			socket.to( this.name ).emit( 'user_joins', JSON.stringify( member ) );
			socket.emit( 'user_joins', JSON.stringify( member ) );
		} else {
			debug( 'User who is already a member tried to join: ' + JSON.stringify( member ) );
			this.mirrorJoinChats( member );
			this.mirrorJoin( member );
		}
		this.sendChatStatistics( socket );
		this.sendUserList( member );
	}

	leave( member ) {
		if ( !member ) {
			return debug( 'Member is not valid anymore...' );
		}
		debug( 'A user is leaving the room: ' + JSON.stringify( member ) );
		if ( contains( this.members.map( m => m.email ), member.email ) ) {
			debug( 'Remove user from all chats...' );
			this.leaveAllChats( member );
			debug( 'Remove user from room members...' );
			this.members = this.members.filter( m => m !== member );
			member.setExitTime();
			member.socket.to( this.name ).emit( 'user_leaves', JSON.stringify( member ) );
			member.socket.emit( 'user_leaves', JSON.stringify( member ) );
			member.socket.leave( this.name );
			if ( member.owner ) {
				this.owners = this.owners.filter( o => o !== member );
				member.socket.leave( this.name+':owners' );
			}
		}
	}

	emitToEmail( to, data ) {
		for ( let i = 0; i < this.members.length; i++ ) {
			if ( this.members[ i ].email === to ) {
				debug( 'Sending message to user with email `'+to+'`...' );
				this.members[ i ].socket.emit( 'memberAction', data );
				break;
			}
		}
	}

	emitProgress( progress, member ) {
		member.socket.to( this.name+':owners' ).emit( 'progress', {
			email: member.email,
			progress: progress
		});
	}

	emitToOwners( data, member ) {
		if ( data.anonymous ) {
			data.email = 'anonymous';
			data.name = 'anonymous';
		} else {
			data.email = member.email;
			data.name = member.name;
		}
		debug( 'Should emit the following message to all room owners: ' + JSON.stringify( data ) );
		member.socket.to( this.name+':owners' ).emit( 'memberAction', data );

		// Send member action to incoming socket (useful for lesson development within the ISLE editor):
		member.socket.emit( 'memberAction', data );
	}

	emitToMembers( data, member ) {
		if ( data.anonymous ) {
			data.email = 'anonymous';
			data.name = 'anonymous';
		} else {
			data.email = member.email;
			data.name = member.name;
		}
		debug( 'Should emit the following message to all room members in '+this.name+': ' + JSON.stringify( data ) );
		member.socket.to( this.name ).emit( 'memberAction', data );
		member.socket.emit( 'memberAction', data );
	}

	sendUserList( member ) {
		debug( 'Send member list to incoming socket.' );
		member.socket.emit( 'userlist', JSON.stringify( this.members ) );
	}
}


// EXPORTS //

module.exports = Room;
