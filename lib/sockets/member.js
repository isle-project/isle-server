'use strict';


// MAIN //

class Member {

    constructor({ userEmail, userName, socket }) {
        
        this.email = userEmail;
        this.name = userName;
        this.socket = socket;

        return this;
    }

}


// EXPORTS //

module.exports = Member;