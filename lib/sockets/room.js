'use strict';

// MODULES //

var debug = require( 'debug' )( 'socket' );
var contains = require( '@stdlib/assert/contains' );


// MAIN //

class Room {

    constructor( io, member, roomName ) {
        this.members = [ member ];
        this.owners = [];
        if ( member.owner ) {
            this.owners.push( member );
        }
        this.name = roomName;
        this.history = [];
        this.chats = [];

        member.socket.join( this.name );
        member.socket.emit( 'console', 'You, '+member.name+', have successfully created room '+this.name );
        this.sendUserList( member );
    }
    
    joinChat( name, member ) {
        const chatName = this.name + ':' + name;
        member.socket.join( chatName );
        if ( !contains( this.chats, chatName ) ) {
            this.chats.push( chatName );
        }
        member.socket.emit( 'console', 'You, '+member.name+', have successfully joined the chat '+chatName );
    }

    join( member ) {
        if ( !contains( this.members.map( m => m.email ), member.email ) ) {
            this.members.push( member );
            if ( member.owner ) {
                this.owners.push( member );
            }
            member.socket.join( this.name );
            member.socket.emit( 'console', 'You, '+member.name+', have successfully joined room '+this.name );
            member.socket.to( this.name ).emit( 'console', member.name+' has successfully joined room '+this.name );
            member.socket.to( this.name ).emit( 'user_joins', JSON.stringify( member ) );
            member.socket.emit( 'user_joins', JSON.stringify( member ) );
        } else {
            debug( 'User who is already a member tried to join: ' + JSON.stringify( member ) );
        }
        this.sendUserList( member );
    }

    leave( member ) {
        if ( !member ) {
            return debug( 'Member is not valid anymore...' );
        }
        debug( 'A user is leaving the room: ' + JSON.stringify( member ) );
        if ( contains( this.members.map( m => m.email ), member.email ) ) {
            debug( 'Remove user from room members...' );
            this.members = this.members.filter( m => m !== member );
            member.setExitTime();
            member.socket.to( this.name ).emit( 'user_leaves', JSON.stringify( member ) );
            member.socket.emit( 'user_leaves', JSON.stringify( member ) );
            member.socket.leave( this.name );
        }
    }

    emitToOwners( data, member ) {
        data.email = member.email;
        data.name = member.name;
        debug( 'Should emit the following message to all room owners: ' + JSON.stringify( data ) );
        this.owners.forEach( owner => {
            owner.socket.emit( 'memberAction', data );
        });

        // Send member action to incoming socket (useful for lesson development within the ISLE editor):
        member.socket.emit( 'memberAction', data );
    }

    emitToMembers( data, member ) {
        data.email = member.email;
        data.name = member.name;
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