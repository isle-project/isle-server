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
 *   name: Completions
 *   description: Completion management.
 */

// MODULES //

const router = require( 'express' ).Router();
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const Completion = require( './models/completion.js' );
const User = require( './models/user.js' );
const { computeCompletions } = require( './helpers/completions.js' );


// MAIN //

/**
* @openapi
*
* /completion_tags:
*   post:
*    summary: Retrieve completion tags
*    description: Retrieve completion tags associated with a set of lessons.
*    tags: [Completions]
*    body:
*      application/json:
*        schema:
*          type: object
*          properties:
*            lessons:
*              description: Array of lesson IDs.
*              type: array
*              items:
*                $ref: '#/components/schemas/Lesson'
*     responses:
*       200:
*         description: Success
*         content:
*           application/json:
*             schema:
*               type: array
*               description: Array of unique completion tags associated with the lessons
*               items:
*                 type: string
*/
router.post( '/completion_tags',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCompletionTags( req, res ) {
		const lessons = req.body.lessons;
		const tags = await Completion
			.distinct( 'tag', {
				'lesson': {
					'$in': lessons
				}
			});
		tags.sort();

		// Check if last element is null, if so replace with default completion tag (relying on the fact that the array is sorted and will have `null` at the end)
		if ( tags[ tags.length - 1 ] === null ) {
			tags[ tags.length - 1 ] = '_default_tag';
		} else {
			tags.push( '_default_tag' );
		}
		res.json( tags );
	})
);

/**
* @openapi
*
* /compute_completions:
*   post:
*     summary: Compute completions
*     description: Compute completions for a metric at a specified node and a set of users
*     tags: [Completions]
*     body:
*       application/json:
*         schema:
*           type: object
*           properties:
*             metric:
*               description: Metric to compute completions for.
*               type: Object
*             id:
*               description: Node ID to compute completions for.
*               type: ObjectId
*             users:
*               description: Array of user IDs.
*               type: array
*               items:
*                 $ref: '#/components/schemas/User'
*             policyOptions:
*               description: Policy options.
*               type: object
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
*                   description: Message indicating success.
*                 insertedCount:
*                   type: integer
*                   description: Number of completions inserted.
*                 updatedCount:
*                   type: integer
*                   description: Number of completions updated.
*                 deletedCount:
*                   type: integer
*                   description: Number of completions deleted.
*/
router.post( '/compute_completions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onComputeCompletions( req, res ) {
		const { id, metric, users, policyOptions } = req.body;
		const completions = await computeCompletions( id, metric, users, policyOptions ); // TODO: Spawn child process to compute completions in order to avoid blocking the server

		// Attach completions to user's completion history:
		const bulkResult = await User.bulkWrite( users.map( x => {
			const ukey = `${metric.level}-${id}-${metric.name}`;
			return {
				updateOne: {
					filter: {
						_id: x._id
					},
					update: {
						[`completions.${ukey}`]: {
							level: metric.level,
							entityId: id,
							metricName: metric.name,
							lastUpdated: String( new Date() ),
							score: completions[ x._id ]
						}
					},
					upsert: true
				}
			};
		}) );
		res.json({
			message: req.t( 'completions-computed' ),
			insertedCount: bulkResult.insertedCount,
			modifiedCount: bulkResult.modifiedCount,
			deletedCount: bulkResult.deletedCount
		});
	})
);
