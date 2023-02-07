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

const contains = require( '@stdlib/assert/contains' );
const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const objectKeys = require( '@stdlib/utils/keys' );
const debug = require( './../debug' )( 'sockets:rooms' );
const Chat = require( './chat.js' );


// MAIN //

/**
* Room class manages communications of students logged into one lesson.
*/
class Room {
	constructor( _, member, roomName ) {
		debug( `Construct ${roomName} room...` );

		// List of all currently logged-in users:
		this.members = [ member ];

		// List of socket identifiers for each user:
		this.sockets = {};
		this.sockets[ member.email ] = [ member.socket ];

		// List of course owners / instructors:
		this.owners = [];
		if ( member.owner ) {
			this.owners.push( member );
			member.socket.join( this.name+':owners' );
		}

		// Room name:
		this.name = roomName;

		// Start time:
		this.startTime = new Date().getTime();

		// List of chats
		this.chats = {};

		// List of breakout rooms / groups:
		this.groups = [];

		// Questions in queue:
		this.questions = [];

		member.socket.join( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully created room '+this.name );
		this.sendUserList( member );

		this.memberHasActiveSocket = this.memberHasActiveSocket.bind( this );
	}

	/**
	* A member is joining one of the chats for the room.
	*
	* ## Notes
	*
	* -   If a chat with the designated name does not already exist for this room, it is created the moment the first user tries to join it.
	*
	* @param {string} name - chat identifier
	* @param {Object} member - member joining the chat
	*/
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

	/**
	* Closes a designated chat for all its members (used e.g. when an instructor closes all groups and their associated chats)
	*
	* @param {Name} socket - socket of user initiating the closing
	* @param {string} name - chat name
	*/
	closeChatForAll( socket, name ) {
		const chatName = this.name + ':' + name;
		const chat = this.chats[ chatName ];
		if ( chat ) {
			chat.removeAllMembers( socket );
			chat.cleanMessages();
		}
	}

	/**
	* A user leaves a chat.
	*
	* @param {string} name - chat name
	* @param {Object} member - member object
	*/
	leaveChat( name, member ) {
		const chatName = this.name + ':' + name;
		debug( `User is leaving ${chatName} chat...` );
		this.chats[ chatName ].leave( member );
	}

	/**
	* A users leaves all chats (e.g., when the user is logging out and not just leaving a specific chat).
	*
	* @param {Object} member - member object
	*/
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

	/**
	* Sends statistics (number of chat members, number of messages and the name) of all chats to a user (triggered when logging in).
	*
	* @param {Object} socket - socket of user
	*/
	sendChatStatistics( socket ) {
		const keys = objectKeys( this.chats );
		for ( let i = 0; i < keys.length; i++ ) {
			const chat = this.chats[ keys[ i ] ];
			chat.sendStatistics( socket );
		}
	}

	/**
	* Joining chats for user already logged in on another browser window or device.
	*
	* @param {Object} member - member object
	*/
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

	/**
	* Joining room for user already logged in on another browser window or device.
	*
	* @param {Object} member - member object
	*/
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
		this.sendGroups( socket );
		this.sendQuestions( socket );
	}

	/**
	* A new member is joining the room for a given lesson.
	*
	* @param {Object} member - member object
	*/
	join( member ) {
		const socket = member.socket;

		if ( this.sockets[ member.email ] ) {
			this.sockets[ member.email ].push( socket );
		} else {
			this.sockets[ member.email ] = [ socket ];
		}

		debug( 'Remove re-connecting member from members scheduled to leave...' );
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
		this.sendGroups( socket );
		this.sendQuestions( socket );
		this.sendUserList( member );
	}

	/**
	* A member is leaving the room for a given lesson.
	*
	* @param {Object} member - member object
	*/
	leave( member ) {
		if ( !member ) {
			return debug( 'Member is not valid anymore...' );
		}
		if ( this.sockets[ member.email ] ) {
			this.sockets[ member.email ] = this.sockets[ member.email ].filter( socket => {
				return socket.id !== member.socket.id;
			});
		}

		debug( 'A user is leaving the room: ' + JSON.stringify( member ) );
		if (
			contains( this.members.map( m => m.email ), member.email ) &&
			( !this.sockets[ member.email ] || this.sockets[ member.email ].length === 0 )
		) {
			debug( 'Remove user from all chats...' );
			this.leaveAllChats( member );
			this.members = this.members.filter( m => m.email !== member.email );
			debug( 'Removed user from room members. No of remaining members: '+this.members.length );
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

	/**
	* Sends groups information to the given member when logging in (if already existing) or when groups are created.
	*
	* @param {Object} socket - user socket
	*/
	sendGroups( socket ) {
		if ( this.groups.length > 0 ) {
			socket.emit( 'created_groups', this.groups );
		}
	}

	/**
	* Sends a message to all room members with the newly created breakout rooms / groups.
	*
	* ## Notes
	*
	* -   Users will receive information on all groups and their members
	*
	* @param {Object} socket - user socket
	*/
	createGroups( groups, member ) {
		member.socket.to( this.name ).emit( 'created_groups', groups );
		member.socket.emit( 'created_groups', groups );
		this.groups = groups;
	}

	/**
	* Resets the `groups` after the instructor has closed the group mode.
	*
	* @param {Object} member - member object
	*/
	deleteGroups( member ) {
		member.socket.to( this.name ).emit( 'deleted_groups' );
		member.socket.emit( 'deleted_groups' );
		this.groups = [];
	}

	/**
	* Sends questions in queue to the given member.
	*
	* @param {Object} socket - user socket
	*/
	sendQuestions( socket ) {
		if ( this.questions.length > 0 ) {
			socket.emit( 'queue_questions', this.questions );
		}
	}

	/**
	* Adds a question to the list of questions.
	*
	* @param {Object} question - question object
	* @param {Object} member - member object
	*/
	addQuestion( question, member ) {
		this.questions.push( question );
		member.socket.to( this.name ).emit( 'queue_questions', this.questions );
		member.socket.emit( 'queue_questions', this.questions );
	}

	/**
	* Removes a question from the list of questions.
	*
	* @param {Object} question - question object
	* @param {Object} member - member object
	*/
	removeQuestion( question, member ) {
		const questions = [];
		for ( let i = 0; i < this.questions.length; i++ ) {
			const q = this.questions[ i ];
			if ( q.email !== question.email || q.value !== question.value ) {
				questions.push( q );
			}
		}
		this.questions = questions;
		member.socket.to( this.name ).emit( 'queue_questions', this.questions );
		member.socket.emit( 'queue_questions', this.questions );
	}

	/**
	* Emits a member action to a room member with the designated email address.
	*
	* @param {string} to - receiver email address
	* @param {string} type - action type
	* @param {*} ...args - action data
	*/
	emitToEmail( to, type, ...args ) {
		debug( 'Sending message to user with email `'+to+'`...' );
		const sockets = this.sockets[ to ];
		if ( sockets ) {
			sockets.forEach( socket => {
				socket.emit( type, ...args );
			});
		}
	}

	/**
	* Emits the user progress of the given member to the instructors in the room.
	*
	* @param {number} progress - user progress of the lesson (between 0-1)
	* @param {Object} member - member object
	*/
	emitProgress( progress, member ) {
		member.socket.to( this.name+':owners' ).emit( 'progress', {
			email: member.email,
			progress: progress
		});
	}

	/**
	* Emits a member action to all logged-in instructors of the room.
	*
	* @param {Object} member - member sending the action
	* @param {string} type - action type
	* @param {Object} data - action data
	*/
	emitToOwners( member, type, data ) {
		if ( data.anonymous ) {
			data.email = 'anonymous';
			data.name = 'anonymous';
		} else {
			data.email = member.email;
			data.name = member.name;
		}
		debug( 'Should emit the following message to all room owners: ' + JSON.stringify( data ) );
		member.socket.to( this.name+':owners' ).emit( type, data );

		// Send member action to incoming socket (useful for lesson development within the ISLE editor):
		member.socket.emit( type, data );
	}

	/**
	* Emits a member action to all logged-in users of the room.
	*
	* @param {Object} member - member sending the action
	* @param {string} type - action type
	* @param {Object} data - action data
	*/
	emitToMembers( member, type, data ) {
		if ( data.anonymous ) {
			data.email = 'anonymous';
			data.name = 'anonymous';
		} else {
			data.email = member.email;
			data.name = member.name;
		}
		debug( 'Should emit the following message to all room members in '+this.name+': ' + JSON.stringify( data ) );
		member.socket.to( this.name ).emit( type, data );
		member.socket.emit( type, data );
	}

	/**
	* Sends the list of room members to the newly arriving user.
	*
	* @param {Object} member - member joining the room
	*/
	sendUserList( member ) {
		debug( 'Send member list to incoming socket.' );
		member.socket.emit( 'userlist', JSON.stringify( this.members ) );
	}

	/**
	* Checks whether a user with the email address has an active socket.
	*
	* @param {string} email - member's email address
	* @returns {boolean} whether a user with the email address has an active socket
	*/
	memberHasActiveSocket( email ) {
		return this.sockets[ email ] && this.sockets[ email ].length > 0;
	}
}


// EXPORTS //

module.exports = Room;
