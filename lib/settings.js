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
const fs = require( 'fs/promises' );
const path = require( 'path' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const validateString = require( './helpers/validate_string.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const settings = require( './../etc/settings.json' );
const translations = require( './../etc/custom_translations.json' );
const i18next = require( './i18n.js' );


// MAIN //

/**
 * @openapi
 *
 * tags:
 *   name: Settings
 *   description: ISLE instance settings.
 */

/**
 * @openapi
 *
 * /get_settings:
 *   get:
 *     summary: Get the current settings
 *     description: Get the current settings of the ISLE instance.
 *     tags: [Settings]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The current settings.
 */
router.get( '/get_settings',
	passport.authenticate( 'jwt', { session: false }),
	function onGetSettings( req, res ) {
		res.json( settings );
	}
);

/**
 * @openapi
 *
 * /get_public_settings:
 *   get:
 *     summary: Get public settings
 *     description: Get the current public settings of the ISLE instance.
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The current public settings.
 */
router.get( '/get_public_settings',
	function onGetSettings( req, res ) {
		req.session.inDashboard = true;
		res.json( settings );
	}
);

/**
 * @openapi
 *
 * /get_lesson_settings:
 *   get:
 *     summary: Get lesson settings
 *     description: Get settings of the ISLE instance for a lesson.
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Lesson settings.
 *               properties:
 *                 availableLanguages:
 *                   type: array
 *                   description: List of available languages.
 *                   example: [	"en", "de", "fr", "es", "it", "nl", "pt", "ru", "sv", "zh" ]
 *                 defaultLanguage:
 *                   type: string
 *                   description: Current default language.
 *                   example: "en"
 *                 allowUserRegistrations:
 *                   type: boolean
 *                   description: Whether or not users are allowed to register for an account.
 *                   example: true
 */
router.get( '/get_lesson_settings',
	function onGetSettings( req, res ) {
		res.json({
			availableLanguages: settings.availableLanguages,
			defaultLanguage: settings.defaultLanguage,
			allowUserRegistrations: settings.allowUserRegistrations
		});
	}
);

/**
 * @openapi
 *
 * /get_translations:
 *   get:
 *     summary: Get translations
 *     description: Get the current custom translations of the ISLE instance.
 *     tags: [Settings]
 *     responses:
 *       200:
 *          description: Success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                description: The current custom translations.
 */
router.get( '/get_translations',
	function onGetTranslations( req, res ) {
		res.json( translations );
	}
);

/**
 * @openapi
 *
 * /update_settings:
 *   post:
 *     summary: Update settings
 *     description: Update the settings of the ISLE instance.
 *     tags: [Settings]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: A new setting to update.
 *             required:
 *               - name
 *               - value
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the setting to update.
 *               value:
 *                 type: string
 *                 description: The new value of the setting.
 *     responses:
 *       200:
 *          description: Success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                description: A JSON object containing the updated settings and a message.
 *                properties:
 *                  settings:
 *                    type: object
 *                    description: The updated settings.
 *                    example: {}
 *                  message:
 *                    type: string
 *                    description: A message describing the result of the update.
 *                    example: "You have successfully updated the specified setting."
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/update_settings',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( function onUpdateSettings( req, res ) {
		validateAdmin( req );
		validateString( req.body.name, 'name', req.t );

		settings[ req.body.name ] = req.body.value;
		fs.writeFile( path.join( __dirname, './../etc/settings.json' ), JSON.stringify( settings ) );

		res.json({ message: req.t('successfully-updated-setting'), settings });
	})
);

/**
 * @openapi
 *
 * /add_custom_translation:
 *   post:
 *     summary: Add custom translation
 *     description: Add a custom translation to the ISLE instance.
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: A new custom translation to add.
 *             required:
 *               - language
 *               - ns
 *               - key
 *               - value
 *             properties:
 *               language:
 *                 type: string
 *                 description: Language identifier of the translation.
 *                 example: "en"
 *               ns:
 *                 type: string
 *                 description: Namespace of the translation.
 *                 example: "server"
 *               key:
 *                 type: string
 *                 description: Key of the translation.
 *                 example: "access-denied"
 *               value:
 *                 type: string
 *                 description: Value of the translation.
 *                 example: "Access denied."
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: A JSON object containing the updated translations and a message.
 *               properties:
 *                 translations:
 *                   type: object
 *                   description: The updated translations.
 *                   example: {}
 *                 message:
 *                   type: string
 *                   description: A message describing the result of the update.
 *                   example: "Successfully added custom translation for key `access-denied`."
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/add_custom_translation',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateSettings( req, res ) {
		validateAdmin( req );
		const { language, ns, key, value } = req.body;
		validateString( language, 'language', req.t );
		validateString( ns, 'ns', req.t );
		validateString( key, 'key', req.t );
		validateString( value, 'value', req.t );

		if ( !translations[ language ] ) {
			translations[ language ] = {};
		}
		if ( !translations[ language ][ ns ] ) {
			translations[ language ][ ns ] = {};
		}
		translations[ language ][ ns ][ key ] = value;

		if ( ns === 'server' ) {
			if ( !i18next.store.data[ language ][ ns+'_ORIGINAL' ] ) {
				i18next.store.data[ language ][ ns+'_ORIGINAL' ] = {};
			}
			i18next.store.data[ language ][ ns+'_ORIGINAL' ][ key ] = i18next.store.data[ language ][ ns ][ key ];
			i18next.store.data[ language ][ ns ][ key ] = value;
		}
		await fs.writeFile( path.join( __dirname, './../etc/custom_translations.json' ), JSON.stringify( translations ) );

		res.json({
			message: req.t('successfully-added-translation', {
				key
			}),
			translations
		});
	})
);

/**
 * @openapi
 *
 * /remove_custom_translation:
 *   post:
 *     summary: Remove custom translation
 *     description: Remove a custom translation from the ISLE instance.
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Custom translation to remove.
 *             required:
 *               - language
 *               - ns
 *               - key
 *             properties:
 *               language:
 *                 type: string
 *                 description: Language identifier of the translation.
 *                 example: "en"
 *               ns:
 *                 type: string
 *                 description: Namespace of the translation.
 *                 example: "server"
 *               key:
 *                 type: string
 *                 description: Key of the translation.
 *                 example: "access-denied"
 *     responses:
 *       200:
 *          description: Success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                description: A JSON object containing a message
 *                properties:
 *                  message:
 *                    type: string
 *                    description: A message describing the result of the update.
 *                    example: "Successfully removed custom translation with key `access-denied`."
 *       403:
 *         description: Access denied for non-administrators
 */
router.post( '/remove_custom_translation',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateSettings( req, res ) {
		validateAdmin( req );
		const { language, ns, key } = req.body;
		validateString( language, 'language', req.t );
		validateString( ns, 'ns', req.t );
		validateString( key, 'key', req.t );

		if (
			translations &&
			translations[ language ] &&
			translations[ language ][ ns ] &&
			translations[ language ][ ns ][ key ]
		) {
			delete translations[ language ][ ns ][ key ];
			await fs.writeFile( path.join( __dirname, './../etc/custom_translations.json' ), JSON.stringify( translations ) );

			if ( ns === 'server' ) {
				i18next.store.data[ language ][ ns ][ key ] = i18next.store.data[ language ][ ns+'_ORIGINAL' ][ key ];
			}
			res.json({
				message: req.t('successfully-removed-translation', {
					key
				}),
				translations
			});
		} else {
			res.json({
				message: req.t('translation-already-removed', { key })
			});
		}
	})
);


// EXPORTS //

module.exports = router;
