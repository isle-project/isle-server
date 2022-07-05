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
const mongoose = require( 'mongoose' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const Completion = require( './models/completion.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const ObjectId = mongoose.Types.ObjectId;
const User = require( './models/user.js' );
const Lesson = require( './models/lesson.js' );
const CompletionMetricSchema = require( './models/completion_metric.js' );
const CompletionMetric = mongoose.model( 'CompletionMetric', CompletionMetricSchema );
const { computeCompletions, levelMapping } = require( './helpers/completions.js' );


// FUNCTIONS //

const getCompletions = async ( schema, id ) => {
	const entity = await schema.findById({ _id: id }, { completions: 1, _id: 0 }).lean();
	if ( !entity ) {
		throw new Error( 'Entity not found.' );
	}
	return entity.completions;
};


// VARIABLES //

const MUNGE_SEPARATOR = '|%-@|';


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
* /completion_components:
*   post:
*     summary: Retrieve completion component identifiers
*     description: Retrieve component identifiers associated with a set of lessons from the completion table.
*     tags: [Completions]
* 	  body:
*       application/json:
*         schema:
*           type: object
*           properties:
*             lessons:
*               description: Array of lesson identifiers.
*               type: array
*               items:
*                 $ref: '#/components/schemas/Lesson'
*     responses:
*       200:
*         description: Success
*         content:
*           application/json:
*             schema:
*               type: object
*               description: Object mapping lesson identifiers to component lists
*               properties:
*                 <lesson_id>:
*                     description: Array of objects
*                     type: array
*                     items:
*                       type: object
*                       properties:
*                         component:
*                           type: string
*                         componentType:
*                           type: string
*/
router.post( '/completion_components',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCompletionComponents( req, res ) {
		const lessons = req.body.lessons;
		const lessonComponents = await Completion.aggregate([
			{
				$match: {
					'lesson': {
						'$in': lessons.map( lesson => ObjectId( lesson ) )
					}
				}
			},
			{
				$group: {
					_id: '$lesson',
					components: {
						$addToSet: {
							$concat: [ '$component', MUNGE_SEPARATOR, '$componentType' ]
						}
					}
				}
			}
		]);
		const componentsByLesson = lessonComponents.reduce( ( acc, lesson ) => {
			acc[ lesson._id ] = lesson.components.map( component => {
				const [ componentId, componentType ] = component.split( MUNGE_SEPARATOR );
				return {
					component: componentId,
					componentType
				};
			});
			return acc;
		}, {} );
		res.json( componentsByLesson );
	})
);

/**
* @openapi
*
* /completion_refs:
*   post:
*    summary: Retrieve completion refs
*    description: Retrieve completion refs for a set of entities.
*    tags: [Completions]
*    body:
*      application/json:
*        schema:
*          type: object
*          properties:
*            entities:
*              description: Array of entity IDs or a single entity ID
*              type: [ Array, string ]
*              example: [ '6283ed74dc14303dc81d38e9', '1283ed74dc14303dc81d38e9' ]
*            target:
*              description: Target field name.
*              type: string
*              example: 'lesson'
*     responses:
*       200:
*         description: Success
*         content:
*           application/json:
*             schema:
*               type: array
*               description: Array of unique completion refs associated with the entities
*               items:
*                 type: string
*/
router.post( '/completion_refs',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCompletionRefs( req, res ) {
		const { entities, target } = req.body;
		let query;
		if ( Array.isArray( entities ) ) {
			query = {
				[target]: {
					'$in': entities
				}
			};
		} else {
			query = {
				[target]: entities
			};
		}
		const refs = await Completion
			.distinct( 'completion', query );
		res.json( refs );
	})
);

/**
* @openapi
*
* /compute_completions:
*   post:
*     summary: Compute completions
*     description: Compute completions for a metric at a specified node and a set of users.
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
		const operations = users.map( x => {
			const ukey = `${metric.level}-${id}-${metric.name}`;
			return {
				updateOne: {
					filter: {
						_id: ObjectId( x )
					},
					update: {
						$set: {
							[`completions.${ukey}`]: {
								level: metric.level,
								entityId: id,
								metricName: metric.name,
								lastUpdated: String( new Date() ),
								score: completions[ x ]
							}
						}
					},
					upsert: true
				}
			};
		});
		console.log( 'operations', JSON.stringify( operations, null, 2 ) );
		const bulkResult = await User.bulkWrite( operations );
		res.json({
			message: req.t( 'completions-computed' ),
			insertedCount: bulkResult.insertedCount,
			modifiedCount: bulkResult.modifiedCount,
			deletedCount: bulkResult.deletedCount
		});
	})
);

/**
* @openapi
*
* /create_metric:
*   post:
*     summary: Create metric
*     description: Create a new metric.
*     tags: [Completions]
*     body:
*       application/json:
*         schema:
*           type: object
*           properties:
*             name:
*               description: Metric name.
*               type: string
*               example: 'lab-score'
*             level:
*               description: Metric level.
*               type: string
*               example: 'lesson'
*             id:
*               description: ID of the node at the given level that will hold the metric.
*               type: ObjectId
*             coverage:
*               description: Coverage of the metric.
*               type: Array
*               example: [ 'all' ], [ 'include', <objectId>, ... ], [ 'exclude', <objectId>, ... ]
*             rule:
*               description: Name of the rule that will be used to compute the metric followed by appropriate parameters (which can be empty).
*               type: Array
*               example: [ 'avg' ], [ 'dropLowestN', 3 ]
*             ref:
*               description: Name of the reference metric that will be used to aggregate the metric at the next lower level.
*               type: string
*               example: 'completed'
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
*                   example: 'Metric created'
*                 metric:
*                   $ref: '#/components/schemas/Metric'
*/
router.post( '/create_metric',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateMetric( req, res ) {
		const { name, id, level, coverage, rule, ref } = req.body;

		validateObjectId( id, 'id', req.t );

		const levelData = levelMapping[ level ];
		if ( !levelData ) {
			throw new Error( `Invalid level: ${level}.` );
		}
		const schema = levelData.schema;
		const completions = await getCompletions( schema, id );

		// Check if metric already exists in `completions`:
		const exists = completions && completions.some( x => x.name === name );
		if ( exists ) {
			throw new Error( req.t( 'metric-already-exists' ) );
		}
		for ( let i = 1; i < coverage.length; i++ ) {
			coverage[ i ] = mongoose.Types.ObjectId( coverage[ i ] );
		}
		const metric = {
			name,
			level,
			coverage,
			rule,
			ref
		};
		await schema.updateOne( { _id: id }, {
			$push: {
				completions: metric
			}
		});
		res.json({
			message: req.t( 'metric-created' ),
			metric
		});
	})
);

/**
* @openapi
*
* /update_metric:
*   post:
*     summary: Update metric
*     description: Update an existing metric.
*     tags: [Completions]
*     body:
*       application/json:
*         schema:
*           type: object
*           properties:
*             name:
*               description: Metric name.
*               type: string
*               example: 'lab-score'
*             level:
*               description: Metric level.
*               type: string
*               example: 'lesson'
*             id:
*               description: ID of the node at the given level that will hold the metric.
*               type: ObjectId
*             coverage:
*               description: Coverage of the metric.
*               type: Array
*               example: [ 'all' ], [ 'include', <objectId>, ... ], [ 'exclude', <objectId>, ... ]
*             rule:
*               description: Name of the rule that will be used to compute the metric followed by appropriate parameters (which can be empty).
*               type: Array
*               example: [ 'avg' ], [ 'dropLowestN', 3 ]
*             ref:
*               description: Name of the reference metric that will be used to aggregate the metric at the next lower level.
*               type: string
*               example: 'completed'
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
*                   example: 'Metric updated.'
*/
router.post( '/update_metric',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateMetric( req, res ) {
		const { name, id, level, coverage, rule, ref } = req.body;
		validateObjectId( id, 'id', req.t );

		const levelData = levelMapping[ level ];
		if ( !levelData ) {
			throw new Error( `Invalid level: ${level}.` );
		}
		const schema = levelData.schema;

		// TODO: Add input validation.

		const updateRule = {};
		if ( name ) {
			updateRule[ 'completions.$.name' ] = name;
		}
		if ( coverage ) {
			updateRule[ 'completions.$.coverage' ] = coverage;
		}
		if ( rule ) {
			updateRule[ 'completions.$.rule' ] = rule;
		}
		if ( ref !== void 0 ) {
			updateRule[ 'completions.$.ref' ] = ref;
		}
		await schema.updateOne( {
			_id: id,
			'completions.name': name
		}, {
			$set: updateRule
		});
		res.json({
			message: req.t( 'metric-updated' )
		});
	})
);

/**
* @openapi
*
* /delete_metric:
*   post:
*     summary: Delete metric
*     description: Delete an existing metric.
*     tags: [Completions]
*     body:
*       application/json:
*         schema:
*           type: object
*           properties:
*             name:
*               description: Metric name.
*               type: string
*               example: 'lab-score'
*             level:
*               description: Metric level.
*               type: string
*               example: 'lesson'
*             id:
*               description: ID of the node at the given level that will hold the metric.
*               type: ObjectId
*     response:
*       200:
*         description: Metric deleted.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 message:
*                   type: string
*                   description: Message indicating success.
*                   example: 'Metric deleted.'
*/
router.post( '/delete_metric',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteMetric( req, res ) {
		const { id, level, name } = req.body;
		validateObjectId( id, 'id', req.t );
		const { schema } = levelMapping[ level ];

		// Remove metric with supplied `name` from `completions` from the entity with the supplied `id`:
		await schema.updateOne({ _id: id }, {
			$pull: {
				completions: {
					name: name
				}
			}
		});
		res.json( { message: req.t( 'metric-deleted' ) } );
	})
);

/**
 * @openapi
 *
 * /save_lesson_metrics:
 *   post:
 *     summary: Save lesson metrics
 *     description: Saves (creation, updating, or deletion) of lesson metrics.
 *     tags: [Completions]
 *     body:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               description: Metric name.
 *               type: string
 *               example: 'watched-video'
 *             namespaceID:
 *               description: ID of the namespace containing the lesson(s) to which the metric will be applied.
 *               type: ObjectId
 *               example: '5c8f8f8f8f8f8f8f8f8f8f8f'
 *             lessonMetrics:
 *               description: Object mapping lesson IDs to metric objects.
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
 *                   example: 'Lesson metrics saved.'
 *                 lessons:
 *                   type: array
 *                   description: Array of lessons for which the metric was saved or deleted.
 *                   items:
 *                     $ref: '#/components/schemas/Lesson'
 */
router.post( '/save_lesson_metrics',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSaveLessonMetrics( req, res ) {
		const { namespaceID, name, lessonMetrics } = req.body;
		const lessonIDs = Object.keys( lessonMetrics );
		await validateOwner( req, namespaceID );
		const changedLessons = [];
		const promises = [];
                console.log('>> Request body: ',  JSON.stringify(req.body, null, 2) );
                console.log('>> Lesson IDs: ',  JSON.stringify(lessonIDs, null, 2) );
		for ( let i = 0; i < lessonIDs.length; i++ ) {
			const id = lessonIDs[ i ];
			const query = {
				_id: ObjectId( id ),
				completions: { $elemMatch: { 'name': name }}
			};
			if ( lessonMetrics[ id ] === null ) {
				promises.push( Lesson.updateOne( query, { $pull: { 'completions': { 'name': name }}})
					.then( ( res ) => {
						console.log( `Deleted lesson metric with name: ${name} from lesson ${id}` );
						if ( res.modifiedCount === 1 ) {
							changedLessons.push( id );
						}
					})
					.catch( err => {
						console.error( err );
					}) );
			} else {
				// Case: Updating an existing metric or creating a new one.
				promises.push( Lesson.updateOne( query, {
					$set: { 'completions.$': new CompletionMetric( lessonMetrics[ id ] ) }
				}, {
					upsert: true
				})
					.then( () => {
						console.log( `Saved lesson metric with name ${name} to lesson ${id}` );
						if ( res.modifiedCount === 1 ) {
							changedLessons.push( id );
						}
					})
					.catch( err => {
						console.error( err );
					}) );
			}
		}
                console.log('>> Promises: ',  JSON.stringify(promises, null, 2) );
		Promise.all( promises ).then( () => {
			Lesson.find({ _id: { $in: changedLessons }} ).then( lessons => {
				res.json({
					message: req.t( 'lesson-metrics-saved' ),
					lessons: lessons
				});
			});
		}).catch( err => {
                    console.log('Error from save_lesson_metrics promise: ',  err);
                    throw `error in save_lesson_metrics ${err}`;
                });
	})
);


// EXPORTS //

module.exports = router;
