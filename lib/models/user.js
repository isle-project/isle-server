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
const mongooseLeanVirtuals = require( 'mongoose-lean-virtuals' );
const bcrypt = require( 'bcrypt' );
const { faker } = require( '@faker-js/faker' );


// VARIABLES //

var RE_BCRYPT_HASH = /\$2[abxy]\$[1-9][0-9]*\$[./A-Za-z0-9]{22}/;


// FUNCTIONS //

/**
 * Checks whether a password has been already hashed.
 *
 * @private
 * @param {string} password - password to check
 * @returns {boolean} true if password has been hashed, false otherwise
 */
function isHashed( password ) {
	return RE_BCRYPT_HASH.test( password );
}


// MAIN //

const Schema = mongoose.Schema;
const SALT_WORK_FACTOR = 10;

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       UserRole:
 *         type: object
 *         properties:
 *           context:
 *             type: string
 *             description: Identifier of the context in which the role applies (e.g., a lessonID).
 *           role:
 *             $ref: '#/components/schemas/Role'
 *             description: Role to be assigned to the user.
 */
const UserRoleSchema = new Schema({
	context: String,
	role: {
		'type': Schema.Types.ObjectId,
		'ref': 'Role'
	}
});

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       UserRoleHash:
 *         type: object
 *         properties:
 *           global:
 *             type: array
 *             description: The global roles associated with the user.
 *             items:
 *               $ref: '#/components/schemas/UserRoleSchema'
 *             default: []
 *           program:
 *             type: array
 *             description: The roles associated with the user for a specific program.
 *             items:
 *               $ref: '#/components/schemas/UserRoleSchema'
 *             default: []
 *           namespace:
 *             type: array
 *             description: The roles associated with the user for a specific namespace.
 *             items:
 *               $ref: '#/components/schemas/UserRoleSchema'
 *             default: []
 *           lesson:
 *             type: array
 *             description: The roles associated with the user for a specific lesson.
 *             items:
 *               $ref: '#/components/schemas/UserRoleSchema'
 *             default: []
 */
const UserRoleHashSchema = new Schema({
	global: {
		'type': [ UserRoleSchema ],
		'default': []
	},
	program: {
		'type': [ UserRoleSchema ],
		'default': []
	},
	namespace: {
		'type': [ UserRoleSchema ],
		'default': []
	},
	lesson: {
		'type': [ UserRoleSchema ],
		'default': []
	}
});


/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       User:
 *         type: object
 *         required:
 *           - email
 *         properties:
 *           email:
 *             type: string
 *             format: email
 *             description: Email address of the user (unique).
 *             example: "administrator@isledocs.com"
 *           verifiedEmail:
 *             type: boolean
 *             description: Whether the email address has been verified.
 *             example: true
 *             default: false
 *           name:
 *             type: string
 *             description: Name of the user.
 *             example: "Jane Doe"
 *           password:
 *             type: string
 *             description: Hashed password of the user.
 *           loginWithoutPassword:
 *             type: boolean
 *             description: Whether the users logs-in without a password.
 *             example: true
 *             default: false
 *           organization:
 *             type: string
 *             description: Organization of the user.
 *             example: "CERN"
 *           ownedNamespaces:
 *             type: array
 *             description: Namespaces owned by the user.
 *             items:
 *               $ref: '#/components/schemas/Namespace'
 *           enrolledNamespaces:
 *             type: array
 *             description: Namespaces the user is enrolled in.
 *             items:
 *               $ref: '#/components/schemas/Namespace'
 *           picture:
 *             type: string
 *             description: URL of the user's profile picture.
 *             default: anonymous.jpg
 *           writeAccess:
 *             type: boolean
 *             description: Whether the user has rights to create new namespaces.
 *             example: true
 *             default: false
 *           administrator:
 *             type: boolean
 *             description: Whether the user is an administrator.
 *             example: true
 *             default: false
 *           score:
 *             type: integer
 *             description: Score of the user.
 *             example: 121
 *             default: 0
 *           spentTime:
 *             type: integer
 *             description: Total time spent by the user.
 *             example: 1109
 *             default: 0
 *           lessonData:
 *             type: object
 *             description: object with keys being lesson identifiers holding lesson-specific user data (e.g., progress & time spent per lesson).
 *             example: { "lesson-1": { "progress": 0, "timeSpent": 0 } }
 *             default: {}
 *           lessonGrades:
 *             type: object
 *             description: object with keys being lesson IDs, each of which points to an object of key-value pairs, with the keys being IDs of questions in the respective lessons and the values corresponding to the awarded points for said questions.
 *             example: { "lesson-1": { "question-1": 7, "question-2": 10 } }
 *             default: {}
 *           lessonGradeMessages:
 *             type: object
 *             description: object with keys being lesson IDs, each of which points to an object of key-value pairs, with the keys being IDs of questions in the respective lessons and the values corresponding to an array of message objects.
 *             example: { "lesson-1": { "question-1": [ {...}, {...} ] } }
 *             default: {}
 *           badges:
 *             type: Array
 *             description: Array of badges the user has earned.
 *             default: []
 *           anonEmail:
 *             type: string
 *             description: Automatically generated random email address used to anonymize user.
 *             example: "max-manifold@outlook.com"
 *           anonName:
 *             type: string
 *             description: Automatically generated random name used to anonymize user.
 *             example: "Max Manifold"
 *           customFields:
 *             type: object
 *             description: Object with keys corresponding to the CustomUserFields and their values (if assigned to the respective user).
 *             example: { "custom-field-1": "value-1", "custom-field-2": "value-2" }
 *           twoFactorAuth:
 *             type: boolean
 *             description: Whether two-factor authentication is enabled for the user.
 *             example: true
 *             default: false
 *           twoFactorAuthSecret:
 *             type: string
 *             description: Base-32 encoded user-specific secret used to generate the two-factor authentication token.
 *             example: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
 *             default: null
 *           roles:
 *             $ref: '#/components/schemas/UserRoleHash'
 *             description: Roles associated with the user.
 *             default: { global: [], namespace: [], lesson: [] }
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the user was created.
 *             example: "2019-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the user was last updated.
 *             example: "2019-01-01T00:00:00.000Z"
 */
const UserSchema = new Schema({
	email: {
		'type': String,
		'required': true,
		'unique': true,
		'lowercase': true
	},
	verifiedEmail: {
		'type': Boolean,
		'default': false
	},
	lastName: {
		'type': String,
		'required': false,
		'default': ''
	},
	firstName: {
		'type': String,
		'required': false,
		'default': ''
	},
	preferredName: {
		'type': String,
		'required': false,
		'default': ''
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
			'program': [],
			'namespace': [],
			'lesson': []
		}
	},
	pronouns: {
		'type': String,
		'default': null
	}
}, {
	timestamps: true,
	toObject: { virtuals: true },
	toJSON: { virtuals: true }
});

/**
 * Capitalizes the first letter of a string.
 *
 * @private
 * @param {string} str - string to capitalize
 * @returns {string} capitalized string
 */
const capitalize = ( s ) => s[ 0 ].toUpperCase() + s.slice( 1 ).toLowerCase();

/**
 * Splits a name into first, last, and preferred names.
 *
 * @private
 * @param {string} name - name to split
 * @returns {Array} a three-element array with 'first', 'preferred', and 'last' names
 */
const splitName = ( name ) => {
	if ( name === void 0 ) {
		return [ void 0, void 0, void 0 ];
	}
	const getNickname = name => capitalize( /^\((.*)\)$/.exec( name )[ 1 ] );
	const parts = name.trim().split( /\s+/ );
	const nicks = parts.findIndex( p => p.startsWith( '(' ) );
	const n = parts.length;
	const nick = ( nicks >= 0 ) ?
		getNickname( parts.splice( nicks, 1 )[ 0 ]) :
		void 0;
	if ( !nick && n === 2 ){
		return [ capitalize( parts[0] ), void 0, capitalize( parts[1] ) ];
	} else if ( n === 1 ) {
		const atIndex = parts[0].indexOf('@');

		/* eslint-disable no-nested-ternary */
		return ( atIndex ) >= 0 ? [parts[0].substring(0, atIndex), void 0, void 0] : (
			/^[A-Z]/.test(parts[0]) ?
			[capitalize(parts[0]), void 0, void 0] :
			[void 0, parts[0], void 0]
		);
		/* eslint-enable no-nested-ternary */
	} else if ( nick && n <= 2 ) {
		return [ capitalize( parts[0] ), nick, capitalize( parts[1] ) ];
	} else if ( nick && n > 2 ) {
		return [ capitalize( parts[0] ), nick, parts.slice( 1 ).join( ' ' ) ];
	}
	const start = /[A-Z]\.?/.test( parts[1] ) ? 2 : 1;
	return [ capitalize( parts[0] ), void 0, parts.slice( start ).join( ' ' ) ];
};

UserSchema.virtual( 'name' )
	.get( function getName() {
		const firstName = this.firstName || '';
		const lastName = this.lastName ? ( ' ' + this.lastName ) : '';
		const pronouns = this.pronouns ? ( ' (' + this.pronouns + ')' ) : '';
		if ( this.preferredName ) {
			if ( !firstName && !lastName ) {
				return this.preferredName + pronouns;
			}
			return firstName + ' (' + this.preferredName + ')' + lastName + pronouns;
		}
		return firstName + lastName + pronouns;
	})
	.set( function setName( name ) {
		let [ firstName, preferredName, lastName ] = splitName( name );
		firstName = firstName || '';
		preferredName = preferredName || '';
		lastName = lastName || '';
		this.set({ firstName, lastName, preferredName });
	});

UserSchema.plugin( mongooseLeanVirtuals );

UserSchema.methods.comparePassword = async function compare( candidatePassword ) {
	const out = await bcrypt.compare( candidatePassword, this.password );
	return out;
};

UserSchema.pre( 'save', function save( next ) {
	const user = this; //eslint-disable-line
	if ( user.isNew ) {
		console.log( 'Creating new user...' );
		mongoose.models.User.countDocuments({
			email: user.email
		}, function onResult( err, count ) {
			if ( err ) {
				return next( err );
			}
			if ( count >= 1 ) {
				return next( new Error( 'A user with this email address already exists.' ) );
			}
			const firstName = faker.name.firstName();
			const lastName = faker.name.lastName();
			user.anonName = firstName + ' ' + lastName;
			user.anonEmail = faker.internet.email( firstName, lastName );

			// Generate a salt and hash the password if set:
			if ( user.password ) {
				return bcrypt.genSalt( SALT_WORK_FACTOR, onSalt );
			}
			next();
		});
	} else {
		console.log( 'Updating user...' );

		// Only hash the password if it has been set and is not already hashed:
		if ( user.password && !isHashed( user.password ) ) {
			// Generate a salt:
			return bcrypt.genSalt( SALT_WORK_FACTOR, onSalt );
		}
		next();
	}

	function onSalt( err, salt ) {
		if ( err ) {
			return next( err );
		}

		console.log( 'Hash the password along with our new salt...' );
		bcrypt.hash( user.password, salt, function hashpw( err, hash ) {
			if ( err ) {
				return next( err );
			}

			console.log( 'Override the cleartext password with the hashed one...' );
			user.password = hash;
			next();
		});
	}
});

const User = mongoose.model( 'User', UserSchema );


// EXPORTS //

module.exports = User;
