'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var bcrypt = require( 'bcrypt' );
var debug = require( 'debug' )( 'isle-server' );


// MAIN //

var Schema = mongoose.Schema;
var SALT_WORK_FACTOR = 10;

var UserSchema = new Schema({
	email: {
		'type': String,
		'required': true,
		'unique': true
	},
	name: {
		'type': String,
		'required': false
	},
	password: {
		'type': String,
		'required': true
	},
	organization: {
		'type': String,
		'required': false
	},
	writeAccess: {
		'type': Boolean,
		'default': false,
		'required': false
	}
});

UserSchema.methods.comparePassword = function compare( candidatePassword, clbk ) {
	bcrypt.compare( candidatePassword, this.password, function comp( err, isMatch ) {
		if ( err ) return clbk( err );
		clbk( null, isMatch );
	});
};

UserSchema.pre( 'save', function save( next ) {
	var user = this; //eslint-disable-line

	// Only hash the password if it has been modified (or is new)
	if ( !user.isModified( 'password' ) ) {
		return next();
	}
	// Generate a salt
	bcrypt.genSalt( SALT_WORK_FACTOR, function gen( err, salt ) {
		if ( err ) return next( err );

		// Hash the password along with our new salt
		bcrypt.hash( user.password, salt, function hashpw( err, hash ) {
			if ( err ) return next( err );

			// Override the cleartext password with the hashed one
			user.password = hash;
			next();
		});
	});
});


// EXPORTS //

module.exports = mongoose.model( 'User', UserSchema );
