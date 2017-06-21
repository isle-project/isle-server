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
                    debug( 'User was found...' );
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

        socket.on( 'event', function( data ) {
            if ( currentRoom ) {
                currentRoom.emitToOwners( data, member );
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

        socket.on( 'chat_message', function( msgObj ) {
            const chatroom = msgObj.namespaceName + '/' + msgObj.lessonName + ':' + msgObj.chatroom;
            socket.to( chatroom ).emit( 'chat_message', msgObj );
        });

        socket.on( 'leave', function() {
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
            socket.disconnect( true );
        });

    });
}


// EXPORTS //

module.exports = SocketHandler;






