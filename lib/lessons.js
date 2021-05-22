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
const ncp = require( 'ncp' ).ncp;
const { join, resolve } = require( 'path' );
const { readFile, rmdir } = require( 'fs/promises' );
const axios = require( 'axios' );
const qs = require( 'qs' );
const isUndefined = require( '@stdlib/assert/is-undefined' );
const isObject = require( '@stdlib/assert/is-object' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const isJSON = require( '@stdlib/assert/is-json' );
const isNull = require( '@stdlib/assert/is-null' );
const replace = require( '@stdlib/string/replace' );
const copy = require( '@stdlib/utils/copy' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const validateNamespaceName = require( './helpers/validate_namespace_name.js' );
const validateLessonName = require( './helpers/validate_lesson_name.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const ErrorStatus = require( './helpers/error.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const Namespace = require( './models/namespace.js' );
const Cohort = require( './models/cohort.js' );
const Event = require( './models/event.js' );
const Lesson = require( './models/lesson.js' );
const { deepl } = require( './credentials.js' );
const renameDirectory = require( './utils/rename_directory.js' );
const openRooms = require( './sockets/open_rooms.js' );
const unzipLessonFolder = require( './unzip_lesson_folder.js' );
const { NAMESPACES_DIRECTORY } = require( './constants.js' );


// VARIABLES //

const RE_PREAMBLE = /^(---[\S\s]*?---)/;
// Settings fo lesson data upload from the ISLE editor using `multer` library:
const lessonUpload = multer({
	dest: NAMESPACES_DIRECTORY,
	limits: {
		fieldNameSize: 100,
		fileSize: 30 * 1024 * 1024, // 30MB
		files: 99
	}
});


// MAIN //

router.post( '/create_lesson',
	lessonUpload.single( 'zipped' ),
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateLesson( req, res ) {
		const { namespaceName, lessonName, description, metadata, showInGallery, active } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		debug( 'Should create lesson....' );
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: { $in: [ req.user ]}
		});
		debug( 'Create lesson object:' );
		let lesson = await Lesson.findOne({
			namespace: namespace,
			title: lessonName
		});
		if ( !lesson ) {
			const data = {
				namespace: namespace,
				title: lessonName
			};
			if ( isString( description ) ) {
				data.description = description;
			}
			if ( isJSON( metadata ) ) {
				data.metadata = JSON.parse( metadata );
			}
			if ( isString( active ) ) {
				data.active = ( active === 'true' );
			}
			if ( isString( showInGallery ) ) {
				data.public = ( showInGallery === 'true' );
			}
			lesson = new Lesson( data );
			debug( 'Save lesson to database...' );
			await lesson.save();

			if ( !namespace.lessons || namespace.lessons.length === 0 ) {
				debug( 'Attach all lessons to namespace...' );
				const lessons = await Lesson.find({ namespace: namespace });
				namespace.lessons = lessons;
			} else {
				debug( 'Attach new lesson to namespace...' );
				namespace.lessons.push( lesson._id );
			}
			await namespace.save();
		} else {
			lesson.updatedAt = new Date();
			if ( isString( description ) && lesson.description === 'No description supplied.' ) {
				lesson.description = description;
			}
			if ( isJSON( metadata ) ) {
				lesson.metadata = JSON.parse( metadata );
			}
			if ( isString( active ) ) {
				lesson.active = ( active === 'true' );
			}
			if ( isString( showInGallery ) ) {
				lesson.public = ( showInGallery === 'true' );
			}
			lesson.save({
				timestamps: true
			});
		}
		unzipLessonFolder( namespaceName, lessonName, req.file.filename );
		res.json({
			message: req.t( 'lesson-uploaded' )
		});
	})
);

router.post( '/delete_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		const query = {
			title: namespaceName
		};
		if ( !req.user.administrator ) {
			query.owners = {
				$in: [ req.user ]
			};
		}
		const namespace = await Namespace.findOne( query );
		if ( !namespace ) {
			throw new ErrorStatus( 403, req.t( 'namespace-nonexistent' ) );
		}
		const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
		namespace.lessons.pull( lesson._id );
		await namespace.save();

		const dir = join( namespaceName, lessonName );
		const dirpath = join( NAMESPACES_DIRECTORY, dir );
		debug( 'Remove lesson directory: '+dirpath );
		await rmdir( dirpath, {
			recursive: true
		});
		await Lesson.deleteOne({ namespace: namespace, title: lessonName });
		res.json({
			message: req.t( 'lesson-deleted' )
		});
	})
);

router.post( '/update_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateLesson( req, res ) {
		const { namespaceName, lessonName, newTitle, newDescription, lockUntil, template } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );
		validateLessonName( newTitle, 'newTitle', req.t );
		validateString( newDescription, 'newDescription', req.t );

		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: { $in: [ req.user ]}
		});
		if ( newTitle !== lessonName ) {
			const existingLesson = await Lesson.findOne({
				namespace: namespace, title: newTitle
			});
			if ( existingLesson ) {
				throw new ErrorStatus( 405, req.t( 'lesson-title-already-chosen' ) );
			}
		}
		if ( !isUndefined( template ) ) {
			validateAdmin( req );
		}
		const lesson = await Lesson
			.findOne({ namespace: namespace, title: lessonName })
			.populate( 'lockUntil' )
			.exec();
		try {
			lesson.title = newTitle;
			lesson.description = newDescription;
			if ( !isUndefined( template ) ) {
				lesson.template = template;
			}
			const oldEvent = lesson.lockUntil;
			if ( lockUntil ) {
				let createEvent;
				if ( oldEvent ) {
					if ( oldEvent.time !== lockUntil ) {
						debug( 'Unlock event time has changed...' );
						oldEvent.done = true;
						await oldEvent.save();
						createEvent = true;
					} else {
						createEvent = false;
					}
				} else {
					createEvent = true;
				}
				if ( createEvent ) {
					const event = new Event({
						type: 'unlock_lesson',
						time: lockUntil,
						data: {
							namespaceName,
							lessonName: newTitle
						},
						user: req.user
					});
					await event.save();
					lesson.active = false;
					lesson.lockUntil = event;
				}
			} else if ( oldEvent ) {
				debug( 'Unlock event should be removed...' );
				oldEvent.done = true;
				await oldEvent.save();
				lesson.lockUntil = null;
			}
			await lesson.save();
			renameDirectory(
				join( namespaceName, lessonName ),
				join( namespaceName, newTitle ),
				onRename
			);
		} catch ( err ) {
			return res.status( 404 ).send( err.message );
		}
		function onRename( err ) {
			if ( err ) {
				return res.status( 403 ).send( err.message );
			}
			res.json({
				message: req.t( 'lesson-updated' )
			});
		}
	})
);

router.get( '/get_lesson_info',
	wrapAsync( async function onGetLessonInfo( req, res ) {
		const { namespaceName, lessonName } = req.query;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		const namespace = await Namespace.findOne({ title: namespaceName });
		const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
		if ( !isObject( lesson ) ) {
			return res.status( 410 ).send( req.t( 'lesson-not-found' ) );
		}
		const metadata = lesson.metadata || {};
		if ( !metadata.revealer ) {
			metadata.revealer = {};
		}
		if ( !metadata.grades ) {
			metadata.grades = {};
		}
		const info = {
			lessonID: lesson._id,
			namespaceID: namespace._id,
			active: lesson.active,
			time: new Date().getTime(),
			enableTicketing: namespace.enableTicketing,
			metadata: metadata
		};
		debug( 'Send lesson info: ' + JSON.stringify( info ) );
		res.json( info );
	})
);

router.post( '/update_metadata',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function updateMetadata( req, res ) {
		const { lessonID, namespaceID, type, key, value } = req.body;

		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );
		validateString( type, 'type', req.t );
		validateString( key, 'key', req.t );

		const lesson = await Lesson.findById( lessonID );
		const metadata = copy( lesson.metadata || {} );
		if ( !metadata[ type ] ) {
			metadata[ type ] = {};
		}
		metadata[ type ][ key ] = value;
		await lesson.updateOne({ $set: { metadata }});
		res.json({ message: 'ok', metadata });
	})
);

router.get( '/get_lesson',
	wrapAsync( async function onGetLesson( req, res ) {
		validateNamespaceName( req.query.namespaceName, 'namespaceName', req.t );
		validateLessonName( req.query.lessonName, 'lessonName', req.t );

		const namespace = await Namespace.findOne({ title: req.query.namespaceName });
		if ( isNull( namespace )) {
			return res.status( 404 ).send( req.t( 'namespace-nonexistent' ) );
		}
		const lesson = await Lesson.findOne({ namespace: namespace, title: req.query.lessonName });
		res.json({ message: 'ok', lesson: lesson });
	})
);

router.get( '/get_public_lessons',
	wrapAsync( async function onGetPublicLesson( req, res ) {
		const lessons = await Lesson.find({ public: true });
		for ( let i = 0; i < lessons.length; i++ ) {
			let lesson = lessons[ i ];
			lesson = lesson.toObject();

			// Replace ID by namespace title:
			const namespace = await Namespace.findOne({ _id: lesson.namespace });
			lesson.namespace = namespace.title;
			lessons[ i ] = lesson;
		}
		res.json({
			message: 'ok',
			lessons: lessons
		});
	})
);

router.get( '/get_isle_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetIsleFile( req, res ) {
		const namespaceName = req.query.namespaceName;
		const lessonName = req.query.lessonName;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		let file = join( NAMESPACES_DIRECTORY, namespaceName, lessonName, '/index.isle' );
		file = resolve( __dirname, file );
		debug( `Retrieve file at: '${file}'` );
		const data = await readFile( file, 'utf8' );
		res.send( data );
	})
);

router.get( '/get_lessons', wrapAsync( async function onGetLessons( req, res ) {
	validateNamespaceName( req.query.namespaceName, 'namespaceName', req.t );

	debug( 'Retrieve lessons...' );
	const namespace = await Namespace
		.findOne({ title: req.query.namespaceName })
		.populate({
			path: 'lessons',
			populate: {
				path: 'lockUntil',
				model: 'Event'
			}
		});
	let lessons;
	if ( !namespace.lessons || namespace.lessons.length === 0 ) {
		debug( 'Lessons not attached to namespace, do manual query...' );
		lessons = await Lesson
			.find({ namespace: namespace })
			.populate( 'lockUntil', 'time' )
			.exec();
	} else {
		debug( 'Return lessons that are part of namespace...' );
		lessons = namespace.lessons;
	}
	lessons = lessons.map( ( lesson, pos ) => {
		lesson = lesson.toObject();

		// Replace ID by namespace title:
		lesson.namespace = req.query.namespaceName;
		lesson.pos = pos;
		return lesson;
	});
	res.json({
		message: 'ok',
		lessons: lessons,
		namespaceName: req.query.namespaceName
	});
}));

router.get( '/get_all_lessons',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllLessons( req, res ) {
		const namespaceFields = req.query.namespaceFields || 'title';

		validateAdmin( req );
		validateString( namespaceFields, 'namespaceFields', req.t );

		const lessons = await Lesson
			.find({})
			.populate( 'namespace', namespaceFields )
			.exec();
		res.json({ message: 'ok', lessons });
	})
);

router.get( '/get_template_lessons',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetTemplateLessons( req, res ) {
		const lessons = await Lesson
			.find({
				template: true
			})
			.populate( 'namespace', 'title' )
			.exec();
		res.json({ message: 'ok', lessons });
	})
);

router.post( '/translate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onTranslateLesson( req, res ) {
		/* eslint-disable camelcase */
		const isInstructor = req.user.writeAccess;
		if ( !isInstructor ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		let { text, target_lang } = req.body;

		validateString( text, 'text', req.t );
		validateString( target_lang, 'target_lang', req.t );

		const match = text.match( RE_PREAMBLE );
		if ( match && match[ 1 ] ) {
			text = replace( text, RE_PREAMBLE, '' );
		}
		debug( 'Should translate lesson text to: '+ target_lang );
		const result = await axios.post( deepl.server, qs.stringify({
			auth_key: deepl.auth_key,
			text,
			target_lang,
			tag_handling: 'xml'
		}) );
		const data = result.data;
		let translatedText = data.translations[ 0 ].text;
		if ( match ) {
			translatedText = match[ 1 ] + translatedText;
		}
		res.json({
			text: translatedText
		});
		/* eslint-enable camelcase */
	})
);

router.post( '/activate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onActivateLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ active: true }
		);
		res.json({
			message: req.t( 'lesson-activated' )
		});
	})
);

router.post( '/deactivate_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeactivateLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ active: false }
		);
		res.json({
			message: req.t( 'lesson-deactivated' )
		});
	})
);

router.post( '/show_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onShowLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ public: true }
		);
		res.json({
			message: req.t( 'lesson-visible-gallery' )
		});
	})
);

router.post( '/hide_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onHideLesson( req, res ) {
		const { namespaceName, lessonName } = req.body;

		validateNamespaceName( namespaceName, 'namespaceName', req.t );
		validateLessonName( lessonName, 'lessonName', req.t );

		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		await Lesson.updateOne(
			{ namespace: namespace, title: lessonName },
			{ public: false }
		);
		res.json({
			message: req.t( 'lesson-hidden-gallery' )
		});
	})
);

router.post( '/copy_lesson',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCopyLesson( req, res ) {
		const { source, target, sourceName, targetName } = req.body;

		validateNamespaceName( source, 'source', req.t );
		validateNamespaceName( target, 'target', req.t );
		validateLessonName( sourceName, 'sourceName', req.t );
		validateLessonName( targetName, 'targetName', req.t );

		debug( 'Should copy lesson....' );
		const namespace = await Namespace.findOne({ title: target, owners: { $in: [ req.user ]}} );
		debug( 'Create lesson object: ' );
		let lesson = new Lesson({
			namespace: namespace,
			title: targetName,
			public: false
		});
		debug( 'Save lesson to database...' );
		let sourceDir = join( NAMESPACES_DIRECTORY, source, sourceName );
		sourceDir = resolve( __dirname, sourceDir );
		let targetDir = join( NAMESPACES_DIRECTORY, target, targetName );
		targetDir = resolve( __dirname, targetDir );
		ncp( sourceDir, targetDir, onNcp );
		async function onNcp( error ) {
			if ( error ) {
				debug( 'Encountered an error: ' + error );
				return res.status( 405 ).send( req.t( 'lesson-copy-failed' ) );
			}
			try {
				await lesson.save();
				if ( !namespace.lessons || namespace.lessons.length === 0 ) {
					debug( 'Attach all lessons to namespace...' );
					const lessons = await Lesson.find({ namespace: namespace });
					namespace.lessons = lessons;
				} else {
					debug( 'Attach new lesson to namespace...' );
					namespace.lessons.push( lesson._id );
				}
				await namespace.save();
				res.json({
					message: req.t( 'lesson-copied' )
				});
			} catch ( err ) {
				return res.status( 409 ).send( req.t( 'lesson-save-failed' ) );
			}
		}
	})
);

router.post( '/copy_namespace_lessons',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCopyLessons( req, res ) {
		const { source, target } = req.body;

		validateNamespaceName( source, 'source', req.t );
		validateNamespaceName( target, 'target', req.t );

		const sourceNamespace = await Namespace
			.findOne({ title: source })
			.populate( 'lessons' )
			.exec();
		const targetNamespace = await Namespace.findOne({ title: target });

		await validateOwner( req, sourceNamespace._id );
		await validateOwner( req, targetNamespace._id );

		const sourceLessons = sourceNamespace.lessons;

		debug( 'Copying '+sourceLessons.length+' lessons to target namespace...' );
		const lessons = [];
		for ( let i = 0; i < sourceLessons.length; i++ ) {
			const { title, description } = sourceLessons[ i ];
			lessons.push({
				namespace: targetNamespace,
				title,
				description,
				public: false
			});
		}
		const inserted = await Lesson.insertMany( lessons );

		debug( inserted.length+' lessons were successfully inserted into the database...' );
		if ( !targetNamespace.lessons || targetNamespace.lessons.length === 0 ) {
			debug( 'Attach all lessons to namespace...' );
			const lessons = await Lesson.find({ namespace: targetNamespace });
			targetNamespace.lessons = lessons;
		} else {
			debug( 'Attach new lesson to namespace...' );
			for ( let i = 0; i < inserted.length; i++ ) {
				targetNamespace.lessons.push( inserted._id );
			}
		}
		await targetNamespace.save();
		let idx = 0;
		function copyFiles( error ) {
			if ( error ) {
				debug( 'Encountered an error: ' + error );
				return res.status( 405 ).send( req.t( 'lesson-copy-failed' ) );
			}
			if ( idx >= inserted.length ) {
				res.json({
					message: req.t( 'lessons-copied' )
				});
			} else {
				let sourceDir = join( NAMESPACES_DIRECTORY, source, inserted[ idx ].title );
				sourceDir = resolve( __dirname, sourceDir );
				let targetDir = join( NAMESPACES_DIRECTORY, target, inserted[ idx ].title );
				targetDir = resolve( __dirname, targetDir );
				idx += 1;
				ncp( sourceDir, targetDir, copyFiles );
			}
		}
		copyFiles();
	})
);

router.get( '/get_lesson_grades',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onLessonGrades( req, res ) {
		const { lessonID, namespaceID } = req.query;

		validateObjectId( namespaceID, 'namespaceID', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		await validateOwner( req, namespaceID );

		const cohorts = await Cohort
			.find({ namespace: namespaceID })
			.populate( 'members', 'email lessonGrades' );
		const grades = {};
		for ( let i = 0; i < cohorts.length; i++ ) {
			for ( let j = 0; j < cohorts[ i ].members.length; j++ ) {
				const member = cohorts[ i ].members[ j ];
				if ( member.lessonGrades[ lessonID ] ) {
					grades[ member.email ] = member.lessonGrades[ lessonID ];
				}
			}
		}
		res.json({ message: 'ok', grades: grades });
	})
);

router.get( '/get_lesson_grade_messages',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onLessonGradeMessages( req, res ) {
		const { lessonID, namespaceID } = req.query;

		validateObjectId( namespaceID, 'namespaceID', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		await validateOwner( req, namespaceID );

		const cohorts = await Cohort
			.find({ namespace: namespaceID })
			.populate( 'members', 'email lessonGradeMessages' );
		const gradeMessages = {};
		for ( let i = 0; i < cohorts.length; i++ ) {
			for ( let j = 0; j < cohorts[ i ].members.length; j++ ) {
				const member = cohorts[ i ].members[ j ];
				if ( member.lessonGradeMessages[ lessonID ] ) {
					gradeMessages[ member.email ] = member.lessonGradeMessages[ req.query.lessonID ];
				}
			}
		}
		res.json({ message: 'ok', gradeMessages: gradeMessages });
	})
);

router.get( '/get_open_rooms',
	passport.authenticate( 'jwt', { session: false }),
	function onGetOpenRooms( req, res ) {
		validateAdmin( req );

		const rooms = openRooms.map( ( room ) => {
			return {
				name: room.name,
				startTime: room.startTime,
				members: room.members,
				chats: room.chats,
				groups: room.groups
			};
		});
		res.json({ message: 'ok', rooms });
	}
);


// EXPORTS //

module.exports = router;
