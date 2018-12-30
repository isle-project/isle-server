'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var bcrypt = require( 'bcrypt' );
var uniqueValidator = require( 'mongoose-unique-validator' );
var faker = require( 'faker' );
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
	ownedNamespaces: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'Namespace' }
	],
	enrolledNamespaces: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'Namespace' }
	],
	picture: {
		'type': String,
		'default': 'anonymous.jpg'
	},
	writeAccess: {
		'type': Boolean,
		'default': false,
		'required': false
	},
	score: {
		'type': Number,
		'default': 0
	},
	spentTime: {
		'type': Number,
		'default': 0
	},
	anonEmail: {
		'type': String,
		'required': false
	},
	anonName: {
		'type': String,
		'required': false
	}
}, { timestamps: true });

UserSchema.methods.comparePassword = function compare( candidatePassword, clbk ) {
	bcrypt.compare( candidatePassword, this.password, function comp( err, isMatch ) {
		if ( err ) return clbk( err );
		clbk( null, isMatch );
	});
};

UserSchema.pre( 'save', function save( next ) {
	var firstName;
	var lastName;
	var user;

	user = this; //eslint-disable-line
	if ( !user.anonEmail && !user.anonNam ) {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		user.anonName = firstName + ' ' + lastName;
		user.anonEmail = faker.internet.email( firstName, lastName );
	}

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

UserSchema.plugin( uniqueValidator );

var User = mongoose.model( 'User', UserSchema );


// EXPORTS //

module.exports = User;
