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
 *   name: Backups
 *   description: Backup management for the server instance (filesystem and database).
 */

// MODULES //

const router = require( 'express' ).Router();
const { createWriteStream } = require( 'fs' );
const { rmdir, unlink } = require( 'fs/promises' );
const rateLimit = require( 'express-rate-limit' );
const join = require( 'path' ).join;
const spawn = require('child_process').spawn;
const archiver = require( 'archiver' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const Backup = require( './models/backup.js' );
const mailer = require( './mailer' );
const settings = require( './../etc/settings.json' );
const { BACKUP_DIRECTORY, NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const createBackupLimiter = rateLimit({
	windowMs: 24 * 60 * 60 * 1000, // 24 hour window
	max: settings.rateLimitBackupCreation || 3, // Start blocking after three requests by default
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-backups-created' ) );
	}
});


// MAIN //

/**
 * @openapi
 *
 * /get_backups:
 *   get:
 *     description: Get a list of backups
 *     tags: [Backups]
 *     responses:
 *       200:
 *         description: A JSON object containing a list of backups and an `ok` status message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: A status message
 *                 backups:
 *                   type: array
 *                   description: A list of backups
 *                   items:
 *                     $ref: '#/components/schemas/Backup'
 */
router.get( '/get_backups',
	wrapAsync( async function onGetBackups( req, res ) {
		const backups = await Backup.find();
		res.json({ message: 'ok', backups });
	})
);

/**
 * @openapi
 *
 * /delete_backup:
 *   post:
 *     description: Delete a backup
 *     tags: [Backups]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *              id:
 *                type: ObjectId
 *     responses:
 *       200:
 *         description: A JSON object containing a status `message`
 */
router.post( '/delete_backup',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteBackup( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const backup = await Backup.findById( req.body.id );
		await unlink( backup.path );
		await backup.remove();
		res.json({ message: req.t( 'backup-deleted' ) });
	})
);

/**
 * @openapi
 *
 * /create_backup:
 *   post:
 *     description: Create a backup
 *     tags: [Backups]
 *     responses:
 *       200:
 *         description: A JSON object containing a status `message`
 *       404:
 *         description: Error message indicating that backup directory does not exist or mongodump command failed
 *       500:
 *         description: Error message indicating that email service has not been configured
 *       503:
 *         description: Error message indicating that email service is not available
 */
router.post( '/create_backup',
	passport.authenticate( 'jwt', { session: false }),
	createBackupLimiter,
	function onCreateBackup( req, res ) {
		validateAdmin( req );

		const args = [ '--db', 'isle-db', '--out', BACKUP_DIRECTORY ];
		const dump = spawn( 'mongodump', args );
		dump.stdout.on('data', function onStdOut( data ) {
			debug( 'stdout: ' + data );
		});
		dump.stderr.on( 'data', function onStdErr( data ) {
			debug( 'stderr: ' + data );
		});
		res.json({ message: req.t( 'backup-initialized' ) });
		dump.on( 'exit', function onExit( code ) {
			if ( code !== 0 ) {
				throw new ErrorStatus( 404, 'mongodump exited with code ' + code );
			}
			const date = new Date();
			const filename = `backup_${date.getMonth()+1}_${date.getDate()}_${date.getFullYear()}_${date.getTime()}.zip`;
			const filePath = join( BACKUP_DIRECTORY, filename );
			const output = createWriteStream( filePath );
			const archive = archiver( 'zip', {
				zlib: { level: 9 }
			});

			output.on( 'close', async function onOutputClose() {
				debug( 'archiver has been finalized and the output file descriptor has closed.' );
				const size = archive.pointer();
				const backup = new Backup({
					filename,
					path: filePath,
					size
				});
				await backup.save();
				const mail = {
					'from': NOTIFICATIONS_EMAIL,
					'subject': req.t('backup-created'),
					'to': req.user.email,
					'text': `
					${req.t('backup-created-email', { user: req.user.name })}
					`,
					'link': SERVER_HOST_NAME
				};
				await rmdir( join( BACKUP_DIRECTORY, 'isle-db' ), {
					recursive: true
				});
				debug( 'Send email notification to '+req.user.email );

				if ( !mailer.active ) {
					throw new ErrorStatus( 500, req.t( 'email-service-not-configured' ) );
				}
				/* eslint-disable max-nested-callbacks */
				mailer.send( mail, function onDone( error, response ) {
					if ( !error ) {
						res.json( response );
					} else {
						throw new ErrorStatus( 503, req.t( 'email-service-not-available' ) );
					}
				});
				/* eslint-enable max-nested-callbacks */
			});
			output.on( 'end', function onOutputEnd() {
				debug( 'Data has been drained' );
			});
			archive.on( 'end', function onArchiveEnd() {
				debug( 'Archive wrote %d bytes', archive.pointer() );
			});
			archive.on( 'error', function onArchiveError( err ) {
				debug( 'Encountered an error: '+err.message );
			});
			archive.on( 'warning', function onArchiveWarning( err ) {
				debug( 'Encountered a warning: '+err.message );
			});
			archive.pipe( output );
			archive.directory( join( BACKUP_DIRECTORY, 'isle-db' ), 'isle-db' );
			archive.directory( join( __dirname, '..', 'media' ), 'media' );
			archive.directory( join( __dirname, '..', 'public' ), 'public' );
			archive.finalize();
		});
	}
);


// EXPORTS //

module.exports = router;
