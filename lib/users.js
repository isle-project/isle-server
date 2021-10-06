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

const router = require( 'express' ).Router();
const multer = require( 'multer' );
const jwt = require( 'jsonwebtoken' );
const tldjs = require( 'tldjs' );
const rateLimit = require( 'express-rate-limit' );
const isObject = require( '@stdlib/assert/is-object' );
const isEmptyObject = require( '@stdlib/assert/is-empty-object' );
const isUndefinedOrNull = require( '@stdlib/assert/is-undefined-or-null' );
const contains = require( '@stdlib/assert/contains' );
const isArray = require( '@stdlib/assert/is-array' );
const groupBy = require( '@stdlib/utils/group-by' );
const objectKeys = require( '@stdlib/utils/keys' );
const copy = require( '@stdlib/utils/copy' );
const debug = require( './debug' );
const storage = require( './storage' );
const passport = require( './passport.js' );
const sendVerificationEmail = require( './utils/send_verification_email.js' );
const institutionName = require( './utils/institution_name.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const ErrorStatus = require( './helpers/error.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const isOwner = require( './helpers/is_owner.js' );
const User = require( './models/user.js' );
const Cohort = require( './models/cohort.js' );
const Namespace = require( './models/namespace.js' );
const SessionData = require( './models/session_data.js' );
const CustomUserField = require( './models/custom_user_field.js' );
const settings = require( './../etc/settings.json' );
const { tokens } = require( './credentials.js' );


// VARIABLES //

const avatarUpload = multer({ storage: storage }).single( 'avatar' );
const thumbnailUpload = multer({ storage: storage }).single( 'thumbnail' );
const createUserLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // One hour window
	max: settings.rateLimitUserCreation || 30, // Start blocking after thirty requests by default
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-users-created' ) );
	}
});
const updateUserLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10000, // Limit each IP to 10000 requests per windowMs
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-requests' ) );
	}
});


// MAIN //

router.post( '/create_user',
	createUserLimit,
	wrapAsync( async function onCreateUser( req, res ) {
		const { email, password, name } = req.body;

		validateString( email, 'email', req.t );
		validateString( password, 'password', req.t );
		validateString( name, 'name', req.t );

		if ( !settings.allowUserRegistrations ) {
			validateAdmin( req );
		}
		if ( settings.permittedEmailDomains && settings.permittedEmailDomains.length > 0 ) {
			const domain = tldjs.getDomain( email );
			debug( `Check whether ${domain} is in the list of permitted domains: ${settings.permittedEmailDomains.join( ', ')}` );
			if ( !contains( settings.permittedEmailDomains, domain ) ) {
				throw new ErrorStatus( 400, req.t('domain-not-permitted-for-registration') );
			}
		}
		if ( settings.reservedUserNames && settings.reservedUserNames.length > 0 ) {
			if ( contains( settings.reservedUserNames, name ) ) {
				throw new ErrorStatus( 400, req.t('entered-reserved-username') );
			}
		}
		if ( settings.disallowedEmailDomains && settings.disallowedEmailDomains.length > 0 ) {
			const domain = tldjs.getDomain( email );
			debug( `Check whether ${domain} is in the list of disallowed domains: ${settings.disallowedEmailDomains.join( ', ')}` );
			if ( contains( settings.disallowedEmailDomains, domain ) ) {
				throw new ErrorStatus( 400, req.t('domain-disallowed-for-registration') );
			}
		}
		let user;
		try {
			const numUsers = await User.estimatedDocumentCount();
			const userConfig = {
				email,
				name,
				password,
				organization: institutionName( email ),
				writeAccess: numUsers === 0, // Make first registered user an instructor
				administrator: numUsers === 0 // Make first registered user an administrator...
			};
			if ( isObject( req.body.customFields ) ) {
				userConfig.customFields = req.body.customFields;
			}
			user = new User( userConfig );
			await user.save();
		} catch ( err ) {
			throw new ErrorStatus( 403, err.message );
		}
		try {
			sendVerificationEmail( user, req.t );
		} catch ( err ) {
			debug( 'Could not send verification email for '+user.name );
		}
		debug( 'Successfully created user: %s', email );
		res.json({
			message: req.t( 'user-created' )
		});
	})
);

router.get( '/get_users',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUsers( req, res ) {
		validateAdmin( req );
		const users = await User.find({});
		res.json({ message: 'ok', users });
	})
);

router.post( '/delete_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteUser( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const status = await User.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'user-deleted' ), status });
	})
);

router.post( '/update_user_session',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUserSession( req, res ) {
		debug( 'Should update the user session...' );
		const user = req.user;
		const { addedScore, elapsed, lessonID, progress, addedChatMessages, addedActionTypes } = req.body;
		const spentTime = user.spentTime + elapsed;
		const score = user.score + addedScore;
		const lessonData = copy( user.lessonData );
		if ( !lessonData[ lessonID ] ) {
			lessonData[ lessonID ] = {};
		}
		const data = lessonData[ lessonID ];
		if ( !data.progress ) {
			data.progress = progress;
		}
		else if ( progress > data.progress ) {
			data.progress = progress;
		}
		if ( data.spentTime ) {
			data.spentTime += elapsed;
		} else {
			data.spentTime = elapsed;
		}
		if ( data.chatMessages ) {
			data.chatMessages += addedChatMessages;
		} else {
			data.chatMessages = addedChatMessages;
		}
		const date = new Date();
		if ( !data.createdAt ) {
			data.createdAt = date;
		}
		data.updatedAt = date;
		if ( addedActionTypes ) {
			debug( 'Add action types...' );
			if ( !data.actionTypes ) {
				data.actionTypes = {};
			}
			const keys = objectKeys( addedActionTypes );
			for ( let i = 0; i < keys.length; i++ ) {
				const type = keys[ i ];
				const count = addedActionTypes[ type ];
				if ( data.actionTypes[ type ] ) {
					data.actionTypes[ type ] += count;
				} else {
					data.actionTypes[ type ] = count;
				}
			}
		}
		const stats = await User.updateOne({ '_id': user._id }, {
			lessonData,
			score,
			spentTime
		});
		debug( 'Result: ' + JSON.stringify( stats ) );
		res.json({
			score,
			spentTime
		});
	})
);

router.get( '/user_update_check',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUserCheck( req, res ) {
		const { id, updatedAt } = req.query;
		let user;
		if ( id ) {
			debug( 'Find user with a specified id...' );
			validateObjectId( id, 'id', req.t );
			user = await User.findOne({ '_id': id });
		} else {
			debug( 'Check user sending the request...' );
			user = req.user;
		}
		const hasMostRecent = ( updatedAt === user.updatedAt.toISOString() );
		res.json({
			message: req.t( hasMostRecent ? 'user-data-has-most-recent' : 'user-data-has-not-most-recent' ),
			hasMostRecent: hasMostRecent
		});
	})
);

router.post( '/user_adjust_progress',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onProgressAdjustment( req, res ) {
		const { email, lessonID, namespaceID, progress } = req.body;

		validateString( email, 'email', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const user = await User.findOne({ email });
		const lessonData = copy( user.lessonData );
		if ( !lessonData[ lessonID ] ) {
			lessonData[ lessonID ] = {};
		}
		lessonData[ lessonID ].progress = Number( progress ) / 100;
		await user.updateOne({ $set: { lessonData }});
		res.json({ message: req.t( 'user-progress-updated' ) });
	})
);

router.post( '/user_adjust_grades',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onProgressAdjustment( req, res ) {
		const { email, lessonID, namespaceID, grades } = req.body;

		validateString( email, 'email', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const user = await User.findOne({ email });
		const lessonGrades = { ...user.lessonGrades };
		lessonGrades[ lessonID ] = grades;
		await user.updateOne({ $set: { lessonGrades }});
		res.json({ message: req.t( 'user-grades-updated' ) });
	})
);

router.post( '/user_append_grade_message',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGradeMessage( req, res ) {
		const { email, lessonID, namespaceID, componentID, message } = req.body;

		validateString( email, 'email', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		validateString( componentID, 'componentID', req.t );

		const owner = await isOwner( req, namespaceID );
		if ( !owner && !req.user.email === email ) {
			return res.status( 401 ).send( req.t( 'access-denied' ) );
		}
		const user = await User.findOne({ email });
		const lessonGradeMessages = { ...user.lessonGradeMessages };
		if ( !lessonGradeMessages[ lessonID ] ) {
			lessonGradeMessages[ lessonID ] = {};
		}
		if ( isArray( lessonGradeMessages[ lessonID ][ componentID ] ) ) {
			lessonGradeMessages[ lessonID ][ componentID ].push( message );
		} else {
			lessonGradeMessages[ lessonID ][ componentID ] = [
				message
			];
		}
		await user.updateOne({ $set: { lessonGradeMessages }});
		res.json({ message: req.t( 'grade-message-appended' ) });
	})
);

router.post( '/sanitize_user',
	updateUserLimit,
	passport.authenticate( 'jwt', { session: false }),
	function onSanitizeUser( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );
		User
			.findOne({ '_id': req.body.id })
			.exec( async function onFindUser( err, user ) {
				const ownedNamespaces = user.ownedNamespaces;
				debug( `Sanitize user with ${ownedNamespaces.length} owned namespaces...` );
				const newOwnedNamespaces = [];
				let ids = new Set();
				for ( let i = 0; i < ownedNamespaces.length; i++ ) {
					const namespaceExists = await Namespace.exists({ _id: ownedNamespaces[ i ] });
					if ( namespaceExists && !ids.has( ownedNamespaces[ i ] ) ) {
						ids.add( ownedNamespaces[ i ] );
						newOwnedNamespaces.push( ownedNamespaces[ i ] );
					}
				}
				const enrolledNamespaces = user.enrolledNamespaces;
				debug( `Sanitize user with ${enrolledNamespaces.length} enrolled namespaces...` );
				const newEnrolledNamespaces = [];
				ids = new Set();
				for ( let i = 0; i < enrolledNamespaces.length; i++ ) {
					const namespaceExists = await Namespace.exists({ _id: enrolledNamespaces[ i ] });
					if ( namespaceExists && !ids.has( enrolledNamespaces[ i ] ) ) {
						ids.add( enrolledNamespaces[ i ] );
						newEnrolledNamespaces.push( enrolledNamespaces[ i ] );
					}
				}
				const newProps = {};
				if ( newEnrolledNamespaces.length !== enrolledNamespaces.length ) {
					newProps.enrolledNamespaces = newEnrolledNamespaces;
				}
				if ( newOwnedNamespaces.length !== ownedNamespaces.length ) {
					newProps.ownedNamespaces = newOwnedNamespaces;
				}
				if ( !isEmptyObject( newProps ) ) {
					user.updateOne( { $set: newProps }, function onUserUpdate( err ) {
						if ( err ) {
							return res.status( 400 ).send( err.message );
						}
						res.json({ message: req.t( 'user-sanitized' ) });
					});
				} else {
					res.json({ message: req.t( 'user-already-sanitized' ) });
				}
			});
	}
);

router.post( '/update_user',
	updateUserLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUser( req, res ) {
		const user = req.user;
		if ( req.body.password ) {
			user.password = req.body.password;
			user.save();
		}
		const newUser = user.toObject();
		if ( req.body.name ) {
			newUser.name = req.body.name;
		}
		if ( req.body.organization ) {
			newUser.organization = req.body.organization;
		}
		if ( req.body.customFields ) {
			if ( !newUser.customFields ) {
				newUser.customFields = {};
			}
			const fields = await CustomUserField.find().select([ 'name', 'editableOnProfile' ]);
			for ( let i = 0; i < fields.length; i++ ) {
				if ( fields[ i ].editableOnProfile ) {
					const name = fields[ i ].name;
					const value = req.body.customFields[ name ];
					if ( value ) {
						newUser.customFields[ name ] = value;
					}
				}
			}
		}
		const updatedUser = await user.updateOne({ $set: newUser });
		res.json({
			message: req.t( 'user-updated', {
				name: updatedUser.name
			})
		});
	})
);

router.post( '/admin_update_user',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateUser( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const user = await User.findById( req.body.id );
		if ( req.body.password ) {
			user.password = req.body.password;
			await user.save();
		}
		const newUser = user.toObject();
		if ( req.body.name ) {
			newUser.name = req.body.name;
		}
		if ( req.body.organization ) {
			newUser.organization = req.body.organization;
		}
		if ( req.body.writeAccess === true || req.body.writeAccess === false ) {
			newUser.writeAccess = req.body.writeAccess;
		}
		if ( req.body.administrator === true || req.body.administrator === false ) {
			newUser.administrator = req.body.administrator;
		}
		if ( req.body.verifiedEmail === true || req.body.verifiedEmail === false ) {
			newUser.verifiedEmail = req.body.verifiedEmail;
		}
		if ( req.body.twoFactorAuth === true || req.body.twoFactorAuth === false ) {
			newUser.twoFactorAuth = req.body.twoFactorAuth;
		}
		if ( req.body.customFields ) {
			if ( !newUser.customFields ) {
				newUser.customFields = {};
			}
			const fields = await CustomUserField.find().select( 'name' );
			for ( let i = 0; i < fields.length; i++ ) {
				const name = fields[ i ].name;
				const value = req.body.customFields[ name ];
				if ( !isUndefinedOrNull( value ) ) {
					newUser.customFields[ name ] = value;
				}
			}
		}
		const updatedUser = await user.updateOne({ $set: newUser });
		res.json({
			message: req.t( 'user-updated', {
				name: updatedUser.name
			})
		});
	})
);

router.post( '/update_user_password',
	updateUserLimit,
	function onUpdateUserPassword( req, res ) {
		debug( 'Should update user password...' );
		const { newPassword, id } = req.body;

		validateString( newPassword, 'newPassword', req.t );
		validateObjectId( id, 'id', req.t );

		User.findOne({ _id: id }, function onFindUser( err, user ) {
			if ( err || !user ) {
				return res.status( 404 ).send( req.t( 'user-nonexistent' ) );
			}
			user.verifiedEmail = true;
			user.password = newPassword;
			user.save( function onSaveUser( err ) {
				if ( err ) {
					return res.status( 404 ).send( req.t( 'password-update-failed' ) + ':' + err.message );
				}
				res.json({
					message: req.t( 'password-updated' )
				});
			});
		});
	}
);

router.post( '/get_user_rights',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserRights( req, res ) {
		const { namespaceName } = req.body;

		validateString( namespaceName, 'namespaceName', req.t );

		debug( `Should retrieve user rights for ${req.user.name} (${req.user.email})...` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		if ( !namespace ) {
			res.json({
				owner: false,
				enrolled: false
			});
		}
		else {
			debug( 'Namespace owners: ' + JSON.stringify( namespace.owners ) );
			let id = req.user._id.toString();
			let owner = false;
			for ( let i = 0; i < namespace.owners.length; i++ ) {
				if ( namespace.owners[ i ].toString() === id ) {
					owner = true;
				}
			}
			const cohort = await Cohort.findOne({
				namespace: namespace,
				members: {
					$in: [ req.user ]
				},
				startDate: { '$lt': new Date() },
				endDate: { '$gte': new Date() }
			});
			res.json({
				owner: !!owner,
				enrolled: !!cohort,
				cohort: cohort ? cohort.title : null
			});
		}
	})
);

router.get( '/has_write_access', wrapAsync( async function onHasWriteAccess( req, res ) {
	const { email } = req.query;
	validateString( email, 'email', req.t );

	const user = await User.findOne({ email });
	res.json({
		message: req.t( user.writeAccess ? 'user-has-write-access' : 'user-has-no-write-access' ),
		writeAccess: user.writeAccess
	});
}));

router.post( '/set_write_access',
	updateUserLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSetWriteAccess( req, res ) {
		const { token } = req.body;
		const user = req.user;
		debug( 'Should set user write access...' );
		if ( token !== tokens.writeAccess ) {
			return res.status( 401 ).send( req.t( 'incorrect-token' ) );
		}
		user.writeAccess = true;
		await user.save();
		res.json({
			message: req.t( 'user-updated', {
				name: user.name
			})
		});
	})
);

router.get( '/get_fake_users',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function getFakeUsers( req, res ) {
		const { namespaceID } = req.query;

		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const users = await User.find();
		const email = {};
		const name = {};
		for ( let i = 0; i < users.length; i++ ) {
			email[ users[ i ].email ] = users[i].anonEmail;
			name[ users[ i ].name ] = users[i].anonName;
		}
		return res.json({
			email: email,
			name: name
		});
	})
);

router.post( '/get_current_user_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetCurrentUserActions( req, res ) {
		const { lessonID } = req.body;
		validateObjectId( lessonID, 'lessonID', req.t );

		const actions = await SessionData
			.find({
				type: 'action',
				lesson: lessonID,
				'data.email': req.user.email
			}, null )
			.sort( '-data.absoluteTime' )
			.exec();
		debug( `Return ${actions.length} actions to the caller` );
		res.json({
			actions: groupBy( actions.map( d => {
				const out = d.data;
				out.sessiondataID = d._id;
				return out;
			}), grouping )
		});
		function grouping( elem ) {
			return elem.id;
		}
	})
);

router.post( '/upload_profile_pic',
	avatarUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		req.user.picture = req.file.filename;
		await req.user.save();
		res.json({
			message: req.t( 'profile-picture-saved' ),
			filename: req.file.filename
		});
	})
);

router.post( '/upload_thumbnail_pic',
	thumbnailUpload,
	passport.authenticate( 'jwt', { session: false }),
	function onUploadFile( req, res ) {
		res.status( 200 ).send( req.t( 'operation-successful' ) );
	}
);

router.post( '/impersonate',
	passport.authenticate( 'jwt', { session: false }),
	async function onImpersonate( req, res ) {
		const { password, id } = req.body;

		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		validateObjectId( id, 'id', req.t );
		validateString( password, 'password', req.t );

		const correctPassword = await req.user.comparePassword( password );
		if ( !correctPassword ) {
			return res.status( 401 ).send( req.t( 'invalid-credentials' ) );
		}
		const payload = { id };
		const token = jwt.sign( payload, tokens.jwtKey );
		const out = { message: 'ok', token, id };
		res.json( out );
	}
);


// EXPORTS //

module.exports = router;
