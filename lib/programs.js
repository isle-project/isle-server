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
 *   name: Programs
 *   description: Program management.
 */

// MODULES //

const router = require( 'express' ).Router();
const rateLimit = require( 'express-rate-limit' );
const trim = require( '@stdlib/string/trim' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const Namespace = require( './models/namespace.js' );
const Program = require( './models/program.js' );
const User = require( './models/user.js' );
const validateStringArray = require( './helpers/validate_string_array.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const settings = require( './../etc/settings.json' );


// VARIABLES //

const createProgramLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // One hour window
	max: settings.rateLimitProgramCreation || 5, // Start blocking after five requests by default
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-courses-created' ) );
	}
});
const updateProgramLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Start blocking after one hundred requests
	handler( req, res ) {
		res.status( 429 ).send( req.t( 'too-many-requests' ) );
	}
});


// MAIN //

/**
 * @openapi
 *
 * /create_program:
 *   post:
 *     summary: Create program
 *     description: Create a program.
 *     tags: [Programs]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - owners
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the program.
 *                 example: Course title
 *               description:
 *                 type: string
 *                 description: Description of the program.
 *                 example: Course description
 *               owners:
 *                 type: array
 *                 description: Array of user ids that will be owners of the program.
 *                 items:
 *                   type: ObjectId
 *                 example: [ 61b776e6a23cf344bf75b3de, 61b776f0e36e1edaaf7d431f ]
 *     responses:
 *       200:
 *         description: Program created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Result message.
 *                   example: Program successfully created.
 *                 program:
 *                   description: Program object.
 *                   $ref: '#/components/schemas/Program'
 *                 successful:
 *                   type: boolean
 *                   description: Whether the operation was successful.
 *                   example: true
 *       400:
 *         description: Missing or invalid parameters.
 *         content:
 *           text/plain:
 *             Missing required title or owners field.
 */
router.post( '/create_program',
	createProgramLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateNamespace( req, res ) {
		validateString( req.body.title, 'title', req.t );
		validateStringArray( req.body.owners, 'owners', req.t );

		const ownerEmails = req.body.owners.map( x => trim( x ) );
		let owners = await User.find({ 'email': ownerEmails });
		const program = new Program({
			owners: owners,
			title: req.body.title,
			description: req.body.description
		});
		try {
			await program.save();
		} catch ( err ) {
			debug( 'Encountered an error when saving program: ' + err.message );
			return res.json({
				message: req.t( 'program-already-exists' ),
				successful: false
			});
		}
	})
);

/**
 * @openapi
 *
 * /delete_program:
 *   post:
 *     tags: [Programs]
 *     summary: Delete program
 *     description: Delete a program.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: Program identifier
 *     responses:
 *       200:
 *         description: Successfully deleted program.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message describing the result.
 *                   example: Program successfully deleted.
 *       403:
 *         description: Permission denied for non-administrators or non-owners of the program.
 */
 router.post( '/delete_program',
 updateProgramLimit,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteNamespace( req, res ) {
		validateObjectId( req.body.id, 'id', req.t );

		const query = {
			_id: req.body.id
		};
		if ( !req.user.administrator ) {
			query.owners = {
				$in: [ req.user ]
			};
		}
		const program = await Program.findOne( query );
		if ( !program ) {
			return res.status( 404 ).send( req.t( 'program-nonexistent' ) );
		}
		const nNamespaces = await Namespace.countDocuments({ program: program });
		if ( nNamespaces > 0 ) {
			return res.status( 405 ).send( req.t( 'delete-namespaces-first' ) );
		}
		await program.remove();
		res.json({ message: req.t( 'program-deleted' ) });
	})
);

/**
 * @openapi
 *
 * /get_programs:
 *   get:
 *     summary: Get programs
 *     description: Get programs owned by the user.
 *     tags: [Programs]
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
 *                   example: 'ok'
 *                 namespaces:
 *                   programs: array
 *                   items:
 *                     $ref: '#/components/schemas/Program'
 */
router.get( '/get_programs',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetPrograms( req, res ) {
		const programs = await Program.find({
			owners: {
				$in: [ req.user ]
			}
		});
		const promises = programs.map( ns => {
			return User.find({ _id: { $in: ns.owners }});
		});
		const userPerNS = await Promise.all( promises );
		for ( let i = 0; i < programs.length; i++ ) {
			let ns = programs[ i ];
			ns = ns.toObject();
			ns.owners = userPerNS[ i ].map( user => user.email );
			programs[ i ] = ns;
		}
		res.json({ message: 'ok', programs });
	})
);

/**
* @openapi
*
* /get_all_programs:
*   get:
*     summary: Get all programs
*     description: Retrieve all programs.
*     tags: [Programs]
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
*                   example: 'ok'
*                 programs:
*                   type: array
*                   items:
*                     $ref: '#/components/schemas/Program'
*       403:
*         description: Access denied for non-administrators
*/
router.get( '/get_all_programs',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetAllPrograms( req, res ) {
		validateAdmin( req );
		const programs = await Program
			.find({})
			.populate( 'owners', [ 'firstName', 'lastName', 'preferredName', 'name', 'email', 'picture' ] )
			.exec();
		res.json({ message: 'ok', programs });
	})
);


// EXPORTS //

module.exports = router;
