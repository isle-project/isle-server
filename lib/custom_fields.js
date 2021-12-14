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
 *   name: CustomFields
 *   description: Custom user fields.
 */


// MODULES //

const router = require( 'express' ).Router();
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const validateString = require( './helpers/validate_string.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const CustomUserField = require( './models/custom_user_field.js' );


// MAIN //

/**
 * @openapi
 *
 * /get_custom_fields:
 *   get:
 *    summary: Get custom fields
 *    description: Get all custom fields.
 *    tags: [CustomFields]
 *    security:
 *      - JWT: []
 *    responses:
 *      200:
 *        description: Success
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  description: Success message
 *                fields:
 *                  type: array
 *                  description: Array of custom fields
 *                  items:
 *                    $ref: '#/components/schemas/CustomField'
 */
router.get( '/get_custom_fields',
	wrapAsync( async function onGetCustomFields( req, res ) {
		const fields = await CustomUserField.find().sort({ position: 1 });
		res.json({ message: 'ok', fields });
	})
);

/**
 * @openapi
 *
 * /create_custom_field:
 *   post:
 *     summary: Create custom field
 *     description: Create a custom field.
 *     tags: [CustomFields]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       $ref: '#/components/schemas/CustomField'
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
 *                   example: 'Custom field was successfully created.'
 *                 field:
 *                   $ref: '#/components/schemas/CustomField'
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/create_custom_field',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateCustomField( req, res ) {
		const { name, description, type, options, showOnProfile, editableOnSignup, editableOnProfile, position } = req.body;

		validateAdmin( req );
		validateString( name, 'name', req.t );
		validateString( description, 'description', req.t );

		const config = {
			name, description, type, showOnProfile, editableOnSignup, editableOnProfile, position
		};
		if ( config.type === 'dropdown' ) {
			config.options = options;
		}
		const field = new CustomUserField( config );
		await field.save();
		res.json({ message: req.t( 'custom-field-created' ), field });
	})
);

/**
 * @openapi
 *
 * /delete_custom_field:
 *   post:
 *     summary: Delete custom field
 *     description: Delete a custom field.
 *     tags: [CustomFields]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: ID of the custom field
 *                 required: true
 *     responses:
 *       200:
 *          description: Success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    description: Success message
 *                    example: 'Custom field was successfully deleted.'
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/delete_custom_field',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteCustomField( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const status = await CustomUserField.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'custom-field-deleted' ), status });
	})
);

/**
 * @openapi
 *
 * /increment_field_position:
 *   post:
 *     summary: Increment field position
 *     description: Increment the position of a custom field.
 *     tags: [CustomFields]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: ID of the custom field
 *                 required: true
 *     responses:
 *       200:
 *          description: Success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    description: Success message
 *                    example: 'ok'
 *                  fields:
 *                    type: array
 *                    description: Array of custom fields
 *                    items:
 *                      $ref: '#/components/schemas/CustomField'
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/increment_field_position',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDecrementPosition( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const field = await CustomUserField.findOne({ _id: req.body.id });
		const pos = field.position;
		const otherField = await CustomUserField.findOne({
			position: pos + 1
		});
		otherField.position -= 1;
		await otherField.save();
		field.position += 1;
		await field.save();
		const fields = await CustomUserField.find().sort({ position: 1 });
		res.json({ message: 'ok', fields });
	})
);

/**
 * @openapi
 *
 * /decrement_field_position:
 *   post:
 *     summary: Decrement field position
 *     description: Decrement the position of a custom field.
 *     tags: [CustomFields]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: ObjectId
 *                 description: ID of the custom field
 *                 required: true
 *     responses:
 *       200:
 *          description: Success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    description: Success message
 *                    example: 'ok'
 *                  fields:
 *                    type: array
 *                    description: Array of custom fields
 *                    items:
 *                      $ref: '#/components/schemas/CustomField'
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/decrement_field_position',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDecrementPosition( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const field = await CustomUserField.findOne({ _id: req.body.id });
		const pos = field.position;
		const otherField = await CustomUserField.findOne({
			position: pos - 1
		});
		otherField.position += 1;
		field.position -= 1;
		await field.save();
		await otherField.save();
		const fields = await CustomUserField.find().sort({ position: 1 });
		res.json({ message: 'ok', fields });
	})
);


// EXPORTS //

module.exports = router;
