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
const { Step } = require( 'prosemirror-transform' );
const isNonNegativeInteger = require( '@stdlib/assert/is-nonnegative-integer' );
const objectKeys = require( '@stdlib/utils/keys' );
const Member = require( './member.js' );
const Room = require( './room.js' );
const User = require( '../models/user.js' );
const Namespace = require( '../models/namespace.js' );
const { getInstance, removeFromInstances } = require( './document/instance.js' );
const schema = require( './document/schema.js' );
const openRooms = require( './open_rooms.js' );


// VARIABLES //

const ANONYMOUS_USER_PICTURE = 'anonymous_inverted.jpg';

// Ensure console.log is used for debugging:
debug.log = console.log.bind( console );


// MAIN //

/**
* Handles web socket communication.
*
* @param {SocketIO} io - socket.io object
*/
function SocketHandler( io ) {
	io.on( 'connection', function connect( socket ) {
		let currentRoom;
		let member;

		socket.on( 'join', function join( data ) {
			const roomName = data.namespaceName + '/' + data.lessonName;
			debug( 'Should join room: ' + roomName );
			debug( 'Received data: ' + JSON.stringify( data ) );

			User.findOne( { _id: data.userID }, function find( err, user ) {
				if ( err ) {
					debug( 'Encountered an error: ' + err.message );
				}
				else if ( user ) {
					debug( 'User was found in the database...' );
					data.picture = user.picture;
					Namespace.findOne({
						'title': data.namespaceName,
						'owners': { $in: [ user ]}
					}, onFind );
				} else {
					data.picture = ANONYMOUS_USER_PICTURE;
					onFind( null, null );
				}
			});

			function onFind( err, namespace ) {
				if ( err ) {
					debug( 'Encountered an error: ' + err.message );
				}
				else if ( namespace ) {
					debug( 'User is an owner...' );
					data.owner = true;
				} else {
					debug( 'User is not an owner...' );
					data.owner = false;
				}
				data.socket = socket;
				member = new Member( data );
				debug( 'Created a member: ' + JSON.stringify( member ) );

				let found = false;
				openRooms.forEach( ( room ) => {
					if ( room.name === roomName ) {
						found = true;
						room.join( member );
						currentRoom = room;
					}
				});
				if ( !found ) {
					let room = new Room( io, member, roomName );
					openRooms.push( room );
					currentRoom = room;
					debug( `Room ${room.name} has been created...` );
				}
			}
		});

		socket.on( 'progress', function onProgress( progress ) {
			if ( currentRoom ) {
				currentRoom.emitProgress( progress, member );
			}
		});

		socket.on( 'event', function onEvent( data, to ) {
			if ( currentRoom ) {
				switch ( to ) {
				case 'members':
					debug( 'Event should be emitted to all room members...' );
					currentRoom.emitToMembers( member, 'memberAction', data );
					break;
				case 'owners':
					debug( 'Event should be emitted to all to all room owners...' );
					currentRoom.emitToOwners( member, 'memberAction', data );
					break;
				default:
					debug( 'Event should be emitted to a specified user....' );
					currentRoom.emitToEmail( to, 'memberAction', data );
				break;
				}
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'join_chat', function onJoinChat( name ) {
			if ( currentRoom ) {
				currentRoom.joinChat( name, member );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'chat_invitation', function onChatInvite( data, to ) {
			if ( currentRoom ) {
				currentRoom.emitToEmail( to, 'chat_invitation', data );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'leave_chat', function onLeaveChat( name ) {
			if ( currentRoom ) {
				currentRoom.leaveChat( name, member );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'close_chat', function onClose( name ) {
			if ( currentRoom ) {
				currentRoom.closeChatForAll( socket, name );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'chat_message', function onChatMessage( msgObj ) {
			if ( currentRoom ) {
				const chatroom = msgObj.namespaceName + '/' + msgObj.lessonName + ':' + msgObj.chatroom;
				const chat = currentRoom.chats[ chatroom ];
				if ( chat ) {
					chat.send( socket, msgObj );
				}
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'video_invitation', function onVideoInvite( data, to ) {
			if ( currentRoom ) {
				currentRoom.emitToEmail( to, 'video_invitation', data );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'create_groups', function onCreateGroups( groups ) {
			if ( member && member.owner && currentRoom ) {
				currentRoom.createGroups( groups, member );
			}
		});

		socket.on( 'delete_groups', function onDeleteGroups() {
			if ( member && member.owner && currentRoom ) {
				currentRoom.deleteGroups( member );
			}
		});

		socket.on( 'add_question', function onAddQuestion( question ) {
			if ( member && currentRoom ) {
				currentRoom.addQuestion( question, member );
			}
		});

		socket.on( 'remove_question', function onRemoveQuestion( question ) {
			if ( member && currentRoom ) {
				currentRoom.removeQuestion( question, member );
			}
		});

		/**
		* Someones wants to join a collaborative editing session for a given document.
		*/
		socket.on( 'join_collaborative_editing', async function onJoining( docID, doc ) {
			if ( member ) {
				let inst = await getInstance( docID, member, currentRoom.memberHasActiveSocket, doc );
				debug( `Return collaborative document with id ${docID} and ${inst.userCount} users (version: ${inst.version}, commentVersion: ${inst.comments.version})` );
				const json = {
					doc: inst.doc.toJSON(),
					users: inst.userCount,
					version: inst.version,
					comments: inst.comments.comments,
					commentVersion: inst.comments.version,
					cursors: inst.cursors.cursors,
					cursorVersion: inst.cursors.version
				};
				member.socket.emit( 'joined_collaborative_editing', docID, json );
			}
		});

		/**
		* The current member sends a set of collaborative editing steps to the server.
		*
		* @param {string} docID - document identifier
		* @param {Object} data - data object
		* @param {Array} data.steps - array of steps to be applied
		* @param {Object} data.cursor - latest cursor position of the current member in the document
		*/
		socket.on( 'send_collaborative_editing_events', async function onEvents({ docID, data }) {
			if ( member ) {
				const version = data.version;
				if ( !isNonNegativeInteger( version ) ) {
					return member.socket.emit( 'sent_collaborative_editing_events', docID, 'invalid version' );
				}
				const steps = data.steps.map( s => Step.fromJSON( schema, s ) );
				const inst = await getInstance( docID, member, currentRoom.memberHasActiveSocket );
				let result = inst.addEvents( version, steps, data.comment, data.clientID );
				if ( !result ) {
					return member.socket.emit( 'sent_collaborative_editing_events', docID, 'version not current' );
				}
				inst.updateCursors( data.clientID, data.cursor );
				member.socket.emit( 'sent_collaborative_editing_events', docID, { ...data, ...result } );

				// Send to all other users editing the same document:
				const users = objectKeys( inst.users );
				debug( `Send polling instructions to ${users.length} users: ${users.join( ', ' )}` );
				for ( let i = 0; i < users.length; i++ ) {
					if ( users[ i ] !== member.email ) {
						// Other users will have to poll for the new events that were just sent:
						currentRoom.emitToEmail( users[ i ], 'collaborative_editing_events', docID, result );
					}
				}
			}
		});

		/**
		* Returns all events between a given version and the server's current version of the document.
		*
		* @param {string} docID - document identifier
		* @param {Object} data - data object
		* @param {number} data.version - version of the document
		* @param {number} data.commentVersion - version of the comments
		* @param {number} data.cursorVersion - version of the cursors
		*/
		socket.on( 'poll_collaborative_editing_events', async function onEvents({ docID, data }) {
			if ( member ) {
				let version = data.version;
				let commentVersion = data.commentVersion;
				let cursorVersion = data.cursorVersion;
				if ( !isNonNegativeInteger( version ) ) {
					return member.socket.emit( 'polled_collaborative_editing_events', docID, 'invalid version' );
				}
				let inst = await getInstance( docID, member, currentRoom.memberHasActiveSocket );
				let result = inst.getEvents( version, commentVersion, cursorVersion );
				if ( result === false ) {
					return member.socket.emit( 'polled_collaborative_editing_events', docID, 'history no longer available' );
				}
				// If the server version is greater than the given version, return the data immediately:
				if ( result.steps.length || result.comment.length || result.cursors ) {
					const msg = {
						version: inst.version,
						commentVersion: inst.comments.version,
						cursorVersion: inst.cursors.version,
						steps: result.steps.map( s => s.toJSON() ),
						cursors: result.cursors,
						clientIDs: result.steps.map( step => step.clientID ),
						comment: result.comment,
						users: result.users
					};
					debug( `Server version is greater for ${docID}, so return events (version: ${inst.version}, commentVersion: ${inst.comments.version}, cursorVersion: ${inst.cursors.version})` );
					return member.socket.emit( 'polled_collaborative_editing_events', docID, msg );
				}
			}
		});

		function leaveAllRooms() {
			if ( member && openRooms ) {
				debug( `Should remove user ${member.name} from all rooms...` );
				let i = openRooms.length;
				while ( i-- ) {
					let room = openRooms[ i ];
					room.leave( member );
					if ( room.members.length === 0 ) {
						debug( 'Should remove room: '+i );
						openRooms.splice( i, 1 );
					}
				}
				debug( `The remaining ${openRooms.length} open rooms are: ` + openRooms.map( r => r.name ).join( ', ' ) );
			}
		}

		function leaveRoom( room ) {
			if ( room && member ) {
				debug( `User ${member.name} is leaving the current room ${room.name}` );
				room.leave( member );
			}
		}

		socket.on( 'leave', function onLeave() {
			if ( member ) {
				debug( `User ${member.name} has logged out.` );
				leaveAllRooms();
				socket.disconnect( true );
				removeFromInstances( member );
			}
		});

		socket.on( 'disconnect', function onDisconnect( reason ) {
			if ( member ) {
				debug( `User ${member.name} has disconnected. Reason: ${reason}.` );
				leaveRoom( currentRoom );
				removeFromInstances( member );
			}
		});

		socket.on( 'disconnecting', function onDisconnecting( reason ) {
			if ( member ) {
				debug( `User ${member.name} is disconnecting. Reason: ${reason}.` );
			}
		});

		socket.on( 'error', function onError( error ) {
			debug( `Encountered an error: ${error.message}` );
		});
	});
}


// EXPORTS //

module.exports = SocketHandler;
