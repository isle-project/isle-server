'use strict';

// MODULES //

const debug = require( 'debug' )( 'socket' );
const Member = require( './member.js' );
const Room = require( './room.js' );
const User = require( './../user.js' );
const Namespace = require( './../namespace.js' );
const { getInstance } = require( './document/instance.js' );


// VARIABLES //

const openRooms = [];


// MAIN //

function SocketHandler( io ) {
	io.on( 'connection', function connect( socket ) {
		debug( 'Someone has connected via socket.io' );
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

		socket.on( 'event', function onEvent( data, to ) {
			if ( currentRoom ) {
				switch ( to ) {
				case 'members':
					debug( 'Event should be emitted to all room members...' );
					currentRoom.emitToMembers( data, member );
					break;
				case 'owners':
					debug( 'Event should be emitted to all to all room owners...' );
					currentRoom.emitToOwners( data, member );
					break;
				default:
					debug( 'Event should be emitted to a specified user....' );
					currentRoom.emitToEmail( to, data );
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

		socket.on( 'leave_chat', function onLeaveChat( name ) {
			if ( currentRoom ) {
				currentRoom.leaveChat( name, member );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'chat_message', function onChatMessage( msgObj ) {
			if ( currentRoom ) {
				const chatroom = msgObj.namespaceName + '/' + msgObj.lessonName + ':' + msgObj.chatroom;
				currentRoom.chats[ chatroom ].send( socket, msgObj );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'join_collaborative_editing', function onJoining( docID ) {
			let inst = getInstance( docID, member );
			const json = {
				doc: inst.doc.toJSON(),
				users: inst.userCount,
				version: inst.version,
				comments: inst.comments.comments,
				commentVersion: inst.comments.version
			};
			member.socket.emit( 'joined_collaborative_editing', json );
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
			}
		});

		socket.on( 'disconnect', function onDisconnect() {
			if ( member ) {
				debug( `User ${member.name} has disconnected.` );
				leaveRoom( currentRoom );
			}
		});
	});
}


// EXPORTS //

module.exports = SocketHandler;
