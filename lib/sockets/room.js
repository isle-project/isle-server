'use strict';


// MAIN //

class Room {

    constructor( io, member, roomName ) {
        this.members = [ member ];
        this.name = roomName;
        this.history = [];

        member.socket.emit( 'console', 'You, '+member.name+', have successfully created room '+this.name );
    }

    join( member ) {
        this.members.push( member );
        member.socket.emit( 'console', 'You, '+member.name+', have successfully joined room '+this.name );
        member.socket.broadcast.emit( 'console', member.name+' has successfully joined room '+this.name );
    }

    leave( member ) {
        this.members = this.members.filter( m => m !== member );
    }

}


// EXPORTS //

module.exports = Room;