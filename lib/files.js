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

/**
 * @openapi
 *
 * tags:
 *   name: Files
 *   description: File management.
 */


// MODULES //

const router = require( 'express' ).Router();
const multer = require( 'multer' );
const { join } = require( 'path' );
const { stat, writeFile } = require( 'fs/promises' );
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const debug = require( './debug' );
const storage = require( './storage' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const isAdmin = require( './helpers/is_admin.js' );
const isOwner = require( './helpers/is_owner.js' );
const fileOwnerCheck = require( './helpers/file_owner_check.js' );
const validateEnum = require( './helpers/validate_enum.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const ErrorStatus = require( './helpers/error.js' );
const File = require( './models/file.js' );
const Lesson = require( './models/lesson.js' );
const Namespace = require( './models/namespace.js' );
const settings = require( './../etc/settings.json' );
const { SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const singleFileUpload = multer({ storage: storage }).single( 'file' );
const singleBrandingUpload = multer({ storage: storage }).single( 'branding' );


// MAIN //

/**
 * @openapi
 *
 * /get_files:
 *   get:
 *     summary: Get files
 *     description: Get all files in a namespace.
 *     tags: [Files]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: namespaceName
 *         schema:
 *           type: string
 *         required: true
 *         description: Namespace name
 *       - in: query
 *         name: lessonName
 *         schema:
 *           type: string
 *         required: false
 *         description: Lesson name
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *           enum: [ true, false ]
 *         required: false
 *         description: Whether to return owner files only
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   description: Array of files
 *                   items:
 *                     $ref: '#/components/schemas/File'
 */
router.get( '/get_files',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		const { namespaceName, lessonName } = req.query;
		validateString( namespaceName, 'namespaceName', req.t );
		debug( `Retrieve lessons for namespace ${namespaceName}...` );
		const namespace = await Namespace.findOne({ title: namespaceName });
		let files;
		if ( isString( lessonName ) ) {
			const lesson = await Lesson.findOne({ namespace: namespace, title: lessonName });
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
				.populate( 'user', [ 'preferredName', 'firstName', 'lastName', 'name', 'email' ])
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
				.populate( 'user', [ 'preferredName', 'firstName', 'lastName', 'name', 'email' ])
				.lean()
				.exec();
		}
		debug( req.t( 'returned-files', {
			nFiles: files.length
		}) );
		res.json({
			'files': files
		});
	})
);

/**
 * @openapi
 *
 * /get_all_files:
 *   get:
 *     summary: Get all files
 *     description: Get all files.
 *     tags: [Files]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: 'ok'
 *                 files:
 *                   type: array
 *                   description: Array of files
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *       403:
 *         description: Access denied for non-administrators
 */
router.get( '/get_all_files',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRequest( req, res ) {
		validateAdmin( req );

		const files = await File
			.find({})
			.populate( 'namespace', [ 'title' ] )
			.populate( 'lesson', [ 'title' ] )
			.populate( 'user', [ 'preferredName', 'firstName', 'lastName', 'name', 'email', 'picture' ])
			.exec();
		res.json({ message: 'ok', files });
	})
);

/**
 * @openapi
 *
 * /get_user_files:
 *   get:
 *     summary: Get user files
 *     description: Get all files owned by a user.
 *     tags: [Files]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   description: Array of files
 *                   items:
 *                     $ref: '#/components/schemas/File'
 */
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

/**
 * @openapi
 *
 * /upload_file:
 *   post:
 *     summary: Upload file
 *     description: Upload a file.
 *     tags: [Files]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - namespaceName
 *               - lessonName
 *             properties:
 *               file:
 *                 type: Object
 *                 description: File to upload
 *               namespaceName:
 *                 type: string
 *                 description: Namespace name
 *                 example: 'my-namespace'
 *               lessonName:
 *                 type: string
 *                 description: Lesson name
 *                 example: 'my-lesson'
 *               owner:
 *                 type: boolean
 *                 description: Whether to create an owner file associated with a namespace
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: 'File uploaded'
 *                 filename:
 *                   type: string
 *                   description: File name
 *                   example: 'my-file.txt'
 */
router.post( '/upload_file',
	fileOwnerCheck,
	singleFileUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUploadFile( req, res ) {
		const { namespaceName, lessonName, owner } = req.body;

		validateString( namespaceName, 'namespaceName', req.t );
		if ( lessonName ) {
			validateString( lessonName, 'lessonName', req.t );
		}

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
		res.json({
			message: req.t( 'file-saved' ),
			filename: req.file.filename
		});
	})
);

/**
 * @openapi
 *
 * /delete_file:
 *   post:
 *     summary: Delete file
 *     description: Delete a file.
 *     tags: [Files]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - "_id"
 *             properties:
 *               "_id":
 *                 type: ObjectId
 *                 description: File identifier
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: 'File successfully deleted'
 */
router.post( '/delete_file',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteFile( req, res ) {
		validateObjectId( req.body._id, '_id', req.t );
		const file = await File.findOne({ _id: req.body._id });
		if ( !file ) {
			return res.status( 404 ).send( req.t( 'file-nonexistent' ) );
		}
		// Deny access if user is not owner of the namespace the file belongs to, not an administrator, and not the user who uploaded the file:
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			if ( file.user.toString() !== req.user._id.toString() ) {
				const owner = await isOwner( req, file.namespace );
				if ( !owner ) {
					throw new ErrorStatus( 401, req.t( 'access-denied' ) );
				}
			}
		}
		res.json({ message: req.t( 'file-deleted' ) });
	})
);

/**
 * @openapi
 *
 * /upload_logo:
 *   post:
 *     summary: Upload logo
 *     description: Upload a logo for the ISLE server instance.
 *     tags: [Files]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *            type: object
 *            properties:
 *              file:
 *                type: file
 *                description: Logo file
 *                format: binary
 *              type:
 *                type: string
 *                description: Logo type
 *                example: brandingLogo
 *                enum: [ brandingLogo, brandingSmallLogo ]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: 'Successfully updated logo'
 *                 settings:
 *                   type: object
 *                   description: Server instance settings
 *                   example: {}
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/upload_logo',
	isAdmin,
	singleBrandingUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( function onUploadLogo( req, res ) {
		validateEnum( req.body.type, [ 'brandingLogo', 'brandingSmallLogo' ], 'type', req.t );

		settings[ req.body.type ] = SERVER_HOST_NAME + '/branding/' + req.file.originalname;
		writeFile( join( __dirname, './../etc/settings.json' ), JSON.stringify( settings ) );

		res.json({ message: req.t('successfully-updated-setting'), settings });
	})
);


// EXPORTS //

module.exports = router;
