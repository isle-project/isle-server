'use strict';

// MODULES //

var debug = require( 'debug' )( 'socket' );
var Member = require( './member.js' );
var Room = require( './room.js' );


// VARIABLES //

var openRooms = [];


// MAIN //

function SocketHandler( io ) {
    io.on( 'connection', function( socket ) {
        debug( 'Someone has connected via socket.io' );
        let member;

        socket.on( 'join', function( data ) {
            const roomName = data.namespaceName + '/' + data.lessonName;
            debug( 'Should join room: ' + roomName );
            debug( 'Received data: ' + JSON.stringify( data ) );
            data.socket = socket;
            member = new Member( data );
            let found = false;
            openRooms.forEach( ( room ) => {
                if ( room.name === roomName ) {
                    found = true;
                    room.join( member );
                }
            });
            if ( !found ) {
                let room = new Room( io, member, roomName );
                openRooms.push( room );
                debug( 'Room has been created...' );
            }
        });

        socket.on( 'leave', function() {
            debug( 'Should remove member from rooms...' );
            let i = openRooms.length;
            while ( i-- ) {
                let room = openRooms[ i ];
                room.leave( member );
                if ( room.members.length === 0 ) {
                    debug( 'Should remove room: '+i );
                }
            }
        });

    });
}


// EXPORTS //

module.exports = SocketHandler;






