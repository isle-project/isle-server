'use strict';

// MODULES //

var debug = require( 'debug' )( 'socket' );
var Member = require( './member.js' );
var Room = require( './room.js' );
var User = require( './../user.js' );
var Namespace = require( './../namespace.js' );


// VARIABLES //

var openRooms = [];


// MAIN //

function SocketHandler( io ) {
	io.on( 'connection', function( socket ) {
		debug( 'Someone has connected via socket.io' );
		let currentRoom;
		let member;

		socket.on( 'join', function( data ) {
			const roomName = data.namespaceName + '/' + data.lessonName;
			debug( 'Should join room: ' + roomName );
			debug( 'Received data: ' + JSON.stringify( data ) );

			User.findOne( { _id: data.userID }, function( err, user ) {
				if ( err ) {
					debug( 'Encountered an error: ' + err.message );
				}
				else if ( user ) {
					debug( 'User was found in the database...' );
					Namespace.findOne({ 'title': data.namespaceName, 'owners': { $in: [ user ] } }, function( err, namespace ) {
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
							debug( 'Room has been created...' );
						}
					});
				}
			});
		});

		socket.on( 'event', function( data, to ) {
			if ( currentRoom ) {
				switch ( to ) {
				case 'members':
					debug( 'Event should be emitted to all room members...' );
					currentRoom.emitToMembers( data, member );
					break;
				case 'owners':
				default:
					debug( 'Default case is to emit event to all room owners...' );
					currentRoom.emitToOwners( data, member );
				break;
				}
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'join_chat', function( name ) {
			if ( currentRoom ) {
				currentRoom.joinChat( name, member );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'leave_chat', function( name ) {
			if ( currentRoom ) {
				currentRoom.leaveChat( name, member );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		socket.on( 'chat_message', function( msgObj ) {
			if ( currentRoom ) {
				const chatroom = msgObj.namespaceName + '/' + msgObj.lessonName + ':' + msgObj.chatroom;
				currentRoom.chats[ chatroom ].send( socket, msgObj );
			} else {
				debug( 'Warning: current room does not exist anymore...' );
			}
		});

		function leaveRoom() {
			debug( 'Should remove member from rooms...' );
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

		socket.on( 'leave', function() {
			if ( member ) {
				debug( `User ${member.name} has logged out.` );
				leaveRoom();
				socket.disconnect( true );
			}
		});

		socket.on( 'disconnect', function() {
			if ( member ) {
				debug( `User ${member.name} has disconnected.` );
				leaveRoom();
			}
		});

	});
}


// EXPORTS //

module.exports = SocketHandler;






