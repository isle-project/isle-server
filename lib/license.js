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
 *   name: License
 *   description: Commercial license information.
 */


// MODULES //

const router = require( 'express' ).Router();
const multer = require( 'multer' );
const { readFile, unlink } = require( 'fs/promises' );
const { join } = require( 'path' );
const storage = require( './storage' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const isAdmin = require( './helpers/is_admin.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const ev = require( './ev.js' );
const { MEDIA_DIRECTORY, SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const licenseUpload = multer({ storage: storage }).single( 'license' );


// MAIN //

/**
 * @openapi
 *
 * /get_license:
 *   get:
 *     summary: Get license
 *     description: Get the license file.
 *     tags: [License]
 *     responses:
 *       200:
 *         description: License file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 license:
 *                   type: string
 *                   format: binary
 *                 message:
 *                   type: string
 *                   example:
 *                   description: A message describing the result of the request.
 */
router.get( '/get_license',
	isAdmin,
	passport.authenticate( 'jwt', { session: false }),
	function onGetLicense( req, res ) {
		res.json({ message: 'ok', license: ev.license });
	}
);

/**
 * @openapi
 *
 * /remove_license:
 *   post:
 *    summary: Remove license
 *    description: Remove the license file.
 *    tags: [License]
 *    responses:
 *      200:
 *        description: License file removed
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  example: "ok"
 *                  description: A message describing the result of the request.
 *      403:
 *        description: Access denied for non-administrators
 */
router.post( '/remove_license',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRemoveLicense( req, res ) {
		validateAdmin( req );
		await unlink( join( MEDIA_DIRECTORY, '.isle-license' ) );
		res.json({ message: 'ok' });
	})
);

/**
 * @openapi
 *
 * /upload_license:
 *   post:
 *     summary: Upload license
 *     description: Upload a license file.
 *     tags: [License]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *          schema:
 *            type: object
 *            required:
 *              - license
 *            properties:
 *              license:
 *                type: string
 *                format: binary
 *     responses:
 *       200:
 *         description: License file uploaded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: A message describing the result of the request.
 *                   example: "ok"
 *                 license:
 *                   type: string
 *                   format: binary
 *                   description: The license file.
 */
router.post( '/upload_license',
	isAdmin,
	licenseUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onLicenseUpload( req, res ) {
		let license = await readFile( req.file.path, 'utf8' );
		license = ev.decode( license, SERVER_HOST_NAME );
		res.json({ message: req.t( 'license-uploaded' ), license });
	})
);


// EXPORTS //

module.exports = router;
