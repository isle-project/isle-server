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

const mongoose = require( 'mongoose' );
const bcrypt = require( 'bcrypt' );
const faker = require( 'faker' );


// MAIN //

const Schema = mongoose.Schema;
const SALT_WORK_FACTOR = 10;

const UserRoleSchema = new Schema({
	context: String,
	role: {
		'type': Schema.Types.ObjectId,
		'ref': 'Role'
	}
});

const UserRoleHashSchema = new Schema({
	global: {
		'type': [ UserRoleSchema ]
	},
	namespace: {
		'type': [ UserRoleSchema ]
	},
	lesson: {
		'type': [ UserRoleSchema ]
	}
});

const UserSchema = new Schema({
	email: {
		'type': String,
		'required': true,
		'unique': true
	},
	verifiedEmail: {
		'type': Boolean,
		'default': false
	},
	name: {
		'type': String,
		'required': false
	},
	password: {
		'type': String,
		'required': false
	},
	loginWithoutPassword: {
		'type': Boolean,
		'default': false
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
		'default': false
	},
	administrator: {
		'type': Boolean,
		'default': false
	},
	score: {
		'type': Number,
		'default': 0
	},
	spentTime: {
		'type': Number,
		'default': 0
	},
	lessonData: {
		'type': Object,
		'default': {}
	},
	lessonGrades: {
		'type': Object,
		'default': {}
	},
	lessonGradeMessages: {
		'type': Object,
		'default': {}
	},
	badges: {
		'type': Array,
		'default': []
	},
	anonEmail: {
		'type': String,
		'required': false
	},
	anonName: {
		'type': String,
		'required': false
	},
	customFields: {
		'type': Object,
		'default': {}
	},
	twoFactorAuth: {
		'type': Boolean,
		'default': false
	},
	twoFactorAuthSecret: {
		'type': String,
		'default': null
	},
	roles: {
		'type': UserRoleHashSchema,
		'default': {
			'global': [],
			'namespace': [],
			'lesson': []
		}
	}
}, { timestamps: true });

UserSchema.methods.comparePassword = async function compare( candidatePassword ) {
	const out = await bcrypt.compare( candidatePassword, this.password );
	return out;
};

UserSchema.pre( 'save', function save( next ) {
	const user = this; //eslint-disable-line
	if ( user.isNew ) {
		mongoose.models.User.countDocuments({
			email: user.email
		}, function onResult( err, count ) {
			if ( err ) {
				return next( err );
			}
			if ( count >= 1 ) {
				return next( new Error( 'A user with this email address already exists.' ) );
			}
		});
	}
	if ( !user.anonEmail && !user.anonNam ) {
		const firstName = faker.name.firstName();
		const lastName = faker.name.lastName();
		user.anonName = firstName + ' ' + lastName;
		user.anonEmail = faker.internet.email( firstName, lastName );
	}

	// Only hash the password if it has been modified (or is new):
	if ( !user.password || !user.isModified( 'password' ) ) {
		return next();
	}

	// Generate a salt:
	bcrypt.genSalt( SALT_WORK_FACTOR, function gen( err, salt ) {
		if ( err ) return next( err );

		// Hash the password along with our new salt:
		bcrypt.hash( user.password, salt, function hashpw( err, hash ) {
			if ( err ) return next( err );

			// Override the cleartext password with the hashed one:
			user.password = hash;
			next();
		});
	});
});

const User = mongoose.model( 'User', UserSchema );


// EXPORTS //

module.exports = User;
