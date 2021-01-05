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
const { stat } = require( 'fs/promises' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const debug = require( './debug' );
const storage = require( './storage' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const fileOwnerCheck = require( './helpers/file_owner_check.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const File = require( './models/file.js' );
const User = require( './models/user.js' );
const Lesson = require( './models/lesson.js' );
const Namespace = require( './models/namespace.js' );


// VARIABLES //

const singleFileUpload = multer({ storage: storage }).single( 'file' );


// MAIN //

router.get( '/get_files',
	wrapAsync( async function onRequest( req, res ) {
		const { namespaceName } = req.query;
		validateString( namespaceName, 'namespaceName', req.t );
		debug( `Retrieve lessons for namespace ${namespaceName}...` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		let files;
		if ( isString( req.query.lessonName ) ) {
			const lesson = await Lesson.findOne({ namespace: namespace, title: req.query.lessonName });
			const query = {
				'namespace': namespace,
				'lesson': lesson
			};
			if ( req.query.owner === 'true' ) {
				query.owner = true;
			} else if ( req.query.owner === 'false' ) {
				query.owner = { $ne: true };
			}
			files = await File.find( query )
				.lean()
				.exec();
		} else {
			const query = {
				'namespace': namespace
			};
			if ( req.query.owner === 'true' ) {
				query.owner = true;
			} else if ( req.query.owner === 'false' ) {
				query.owner = { $ne: true };
			}
			files = await File.find( query )
				.lean()
				.exec();
		}
		const ids = files.map( x => x.user );
		const users = await User.find({
			'_id': { $in: ids }
		});
		for ( let i = 0; i < files.length; i++ ) {
			for ( let j = 0; j < users.length; j++ ) {
				if ( users[ j ]._id.equals( ids[ i ] ) ) {
					files[ i ].name = users[ j ].name;
					files[ i ].email = users[ j ].email;
				}
			}
		}
		debug( req.t( 'returned-files', {
			nFiles: files.length
		}) );
		res.json({
			'files': files
		});
	})
);

router.get( '/get_all_files',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		validateAdmin( req );

		const files = await File
			.find({})
			.populate( 'namespace', [ 'title' ] )
			.populate( 'lesson', [ 'title' ] )
			.populate( 'user', [ 'name', 'email', 'picture' ])
			.exec();
		res.json({ message: 'ok', files });
	})
);

router.get( '/get_user_files',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		const files = await File.find({
			'user': req.user
		});
		res.json({
			'files': files
		});
	})
);

router.post( '/upload_file',
	fileOwnerCheck,
	singleFileUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		const { namespaceName, lessonName, owner } = req.body;
		validateString( namespaceName, 'namespaceName', req.t );
		validateString( lessonName, 'lessonName', req.t );

		debug( 'Received a file: ' + JSON.stringify( req.file ) );
		const fileMetaData = {
			user: req.user,
			title: req.file.originalname,
			filename: req.file.filename,
			path: req.file.path,
			type: req.file.mimetype,
			owner: owner
		};
		const stats = await stat( req.file.path );
		const fileSizeInBytes = stats.size;
		const fileSizeInMegabytes = fileSizeInBytes / 1e6;
		fileMetaData.size = fileSizeInMegabytes;
		debug( `Store file for namespace ${namespaceName} and lesson ${lessonName}` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		fileMetaData.namespace = namespace;
		if ( !lessonName ) {
			// Update file if already existing or create new one:
			await File.updateOne(
				{ path: fileMetaData.path },
				fileMetaData,
				{ upsert: true, setDefaultsOnInsert: true }
			);
		} else {
			const lesson = await Lesson.findOne({ title: lessonName, namespace: namespace });
			debug( 'Should save to database... ' );
			fileMetaData.lesson = lesson;

			// Update file if already existing or create new one:
			await File.updateOne(
				{ path: fileMetaData.path },
				fileMetaData,
				{ upsert: true, setDefaultsOnInsert: true }
			);
		}
		res.json({ message: req.t( 'file-saved' ), filename: req.file.filename });
	})
);

router.post( '/delete_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteFile( req, res ) {
		validateObjectId( req.body._id, '_id', req.t );
		const file = await File.findOne({ _id: req.body._id });
		if ( !file ) {
			return res.status( 404 ).send( req.t( 'file-nonexistent' ) );
		}
		await file.remove();
		res.json({ message: req.t( 'file-deleted' ) });
	})
);


// EXPORTS //

module.exports = router;
