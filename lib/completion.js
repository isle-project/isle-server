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
const isArray = require( '@stdlib/assert/is-array' );
const isBoolean = require( '@stdlib/assert/is-boolean' );
const isPlainObject = require( '@stdlib/assert/is-object' );
const wrapAsync = require( './utils/wrap_async.js' );
const Completion = require( './models/completion.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const ObjectId = mongoose.Types.ObjectId;
const User = require( './models/user.js' );
const Lesson = require( './models/lesson.js' );
const CompletionMetricSchema = require( './models/completion_metric.js' );
const CompletionMetric = mongoose.model( 'CompletionMetric', CompletionMetricSchema );
const { computeCompletions, levelMapping, COMPLETION_RULES } = require( './helpers/completions.js' );


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
		const tags = await Completion.distinct( 'tag', {
			'lesson': { '$in': lessons }
		});
		tags.sort();

		// Ensure DEFAULT_TAG is represented.
				// Check if last element is null/undefined/blank, if so replace with the default tag.
				// This relies on the fact that the array is sorted and will have `null` at the end.
		if ( !tags[ tags.length - 1 ] ) {
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
 * /completion_rules
 *   get:
 *     summary: Retrieve completion rules
 *     description: Retrieve completion rules for metrics.
 *     tags: [Completions]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *           schema:
 *             type: object
 *             description: Object mapping completion rule names to rule objects.
 */
router.get( '/completion_rules',
	function onCompletionRules( req, res ) {
		console.log( 'Return completion rules...' );
		return res.json( COMPLETION_RULES );
	}
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
			.distinct( 'metricName', query );
		res.json( refs );
	})
);

/**
 * @openapi
 *
 * /record_completion:
 *    post:
 *      summary: Record completion
 *      description: Record completion for a component.
*       tags: [Completions]
*       body:
*         application/json:
*           schema:
*             type: object
*             properties:
*/
router.post( '/record_completion',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRecordCompletion( req, res ) {
		const { lesson, user, score, tag, metricName, component, componentType, time } = req.body;
		const completion = new Completion({
			lesson: ObjectId( lesson ),
			user: ObjectId( user ),
			score,
			...( tag && tag !== '_default_tag' && { tag } ),
			metricName,
			component,
			componentType,
			time
		});
		await completion.save();
		res.json( completion );
	}
));

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
*                 metric:
*                   type: object
*                   description: Metric object.
*                 completions:
*                   type: array
*                   description: Object mapping user IDs to completion scores.
*                 entityId:
*                   type: ObjectId
*                   description: Entity ID for the node for which completions were computed (e.g., a namespace or lesson).
*/
router.post( '/compute_completions',
	passport.authenticate( 'jwt', { session: false }),
	function onComputeCompletions( req, res ) {
		const { ids, metric, users, policyOptions } = req.body;
		const effectiveMetric = isArray( metric ) ? metric : [ metric ];
		const metricName = effectiveMetric[ 0 ].name;  // All metrics have the same name

		// ATTN:TODO: Spawn child process to compute completions in order to avoid blocking the server
		// ATTN:INVARIANT assume ids and metric have same length
		const promises = effectiveMetric.map( ( metric, index ) => {
				return computeCompletions(ids[index], metric, users, policyOptions);
		});

		// Attach completions to user's completion history:
		const lastUpdated = Date.now(); // Stringize format on client
		const operations = [];

		/* eslint-disable max-nested-callbacks */
		Promise.all( promises ).then( async ( completions ) => {
			users.forEach(user => {
				ids.forEach( ( entityId, index ) => {
					const level = effectiveMetric[index].level;
					const ukey = `${level}-${entityId}-${metricName}`;
					operations.push({
						updateOne: {
							filter: {
								_id: ObjectId(user)
							},
							update: {
								$set: {
									[`completions.${ukey}`]: {
										metricName,
										instance: completions[index][user],
										lastUpdated
									}
								}
							},
							upsert: true
						}
					});
				});
			});
			/* eslint-enable max-nested-callbacks */

			console.log('operations', JSON.stringify(operations, null, 2));
			const bulkResult = await User.bulkWrite(operations);
			let message;
			if ( effectiveMetric[ 0 ].level === 'namespace' ) {
				message = req.t('computed-completions-course', { metricName, users: users.length });
			} else if ( ids.length > 1 ) {
				message = req.t('computed-completions-lessons', { metricName, users: users.length, num: ids.length });
			} else {
				message = req.t('computed-completions-course', { metricName, users: users.length });
			}
			res.json({
				message,
				insertedCount: bulkResult.insertedCount,
				modifiedCount: bulkResult.modifiedCount,
				deletedCount: bulkResult.deletedCount,
				completions: completions,
				metrics: effectiveMetric,
				entityIds: ids,
				lastUpdated
			});
		});
	}
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
*             tagWeights:
*               description: Object mapping tags to weights for aggregating reduced scores.
*               type: Object<string,number>
*               default: null
*               example: {"exams": 0.5, "homework": 0.5}
*             autoCompute:
*               description: If true, recompute scores automatically when triggered by certain events.
*               type: boolean
*               default: false
*             visibleToStudent:
*               description: If true, computed score can be seen by the student with whom it is associated.
*               type: boolean
*               default: false
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
		const { name, id, level, coverage, rule, ref, tagWeights, autoCompute, visibleToStudent } = req.body;

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
			ref,
			...( isPlainObject( tagWeights ) && { tagWeights } ),
			...( isBoolean( autoCompute ) && { autoCompute } ),
			...( isBoolean( visibleToStudent ) && { visibleToStudent } ),
			lastUpdated: Date.now()
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
*             tagWeights:
*               description: Object mapping tags to weights for aggregating reduced scores.
*               type: Object<string,number>
*               default: null
*               example: {"exams": 0.5, "homework": 0.5}
*             autoCompute:
*               description: If true, recompute scores automatically when triggered by certain events.
*               type: boolean
*               default: false
*             visibleToStudent:
*               description: If true, computed score can be seen by the student with whom it is associated.
*               type: boolean
*               default: false
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
		const { name, id, level, coverage, rule, ref, tagWeights, autoCompute, visibleToStudent } = req.body;
		validateObjectId( id, 'id', req.t );

		const levelData = levelMapping[ level ];
		if ( !levelData ) {
			throw new Error( `Invalid level: ${level}.` );
		}
		const schema = levelData.schema;

		// TODO: Add input validation.

		const updateSpec = {};
		if ( name ) {
			updateSpec[ 'completions.$.name' ] = name;
		}
		if ( coverage ) {
			updateSpec[ 'completions.$.coverage' ] = coverage;
		}
		if ( rule ) {
			updateSpec[ 'completions.$.rule' ] = rule;
		}
		if ( ref !== void 0 ) {
			updateSpec[ 'completions.$.ref' ] = ref;
		}
		if ( isPlainObject( tagWeights ) ) {
			updateSpec[ 'completions.$.tagWeights' ] = tagWeights;
		}
		if ( isBoolean( autoCompute ) ) {
			updateSpec[ 'completions.$.autoCompute' ] = autoCompute;
		}
		if ( isBoolean( visibleToStudent ) ) {
			updateSpec[ 'completions.$.visibleToStudent' ] = visibleToStudent;
		}
		updateSpec[ 'completions.$.lastUpdated' ] = Date.now();
		await schema.updateOne( {
			_id: id,
			'completions.name': name
		}, {
			$set: updateSpec
		});
		res.json({
			message: req.t( 'metric-updated' )
		});
	})
);

async function clearUserCompletions( level, id, name ) {
	const metricKey = `${level}-${id}-${name}`;
	await User.updateMany({ [`completions.${metricKey}`]: {
		$exists: true
	}}, {
		$unset: {
			[`completions.${metricKey}`]: ''
		}
	});
}

/**
 * @openapi
 *
 * /clear_user_completions:
 *   post:
 *     summary: Clear user completions
 *     description: Clear user completions for a metric.
 *     tags: [Completions]
 *     body:
 *       application/json:
 *       schema:
 *         type: object
 *         properties:
 *           level:
 *             description: Metric level.
 *             type: string
 *             example: 'lesson'
 *           id:
 *             description: ID of the node at the given level holding the metric.
 *             type: ObjectId
 *             example: '5c8f8f8f8f8f8f8f8f8f8f8f'
 *           name:
 *             description: Metric name.
 *             type: string
 *             example: 'lab-score'
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
 *                   example: 'User completions cleared.'
 */
router.post( '/clear_user_completions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onClearUserCompletions( req, res ) {
		const { id, level, name } = req.body;
		validateObjectId( id, 'id', req.t );
		validateString( name, 'name', req.t );
		validateString( level, 'level', req.t );

		await clearUserCompletions( id, level, name );
		res.json( { message: req.t( 'completions-cleared' ) } );
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
		await clearUserCompletions( level, id, name );
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
		const changed = [];
		const deleted = [];
		const created = [];
		const promises = [];
		const createdLessonPromises = [];
		const lastUpdated = Date.now();
		for ( let i = 0; i < lessonIDs.length; i++ ) {
			const id = lessonIDs[ i ];
			const query = {
				_id: ObjectId( id ),
				completions: { $elemMatch: { 'name': name }}
			};
			if ( lessonMetrics[ id ] === null ) {
				promises.push( Lesson.updateOne( query, { $pull: { 'completions': { 'name': name }}})
					.then( ( result ) => {
						console.log( `Deleted lesson metric with name: ${name} from lesson ${id}` );
						if ( result.modifiedCount === 1 ) {
							deleted.push( id );
							// Delete metric from user completions:
							clearUserCompletions( 'lesson', id, name );
						}
					})
					.catch( err => {
						console.error( err );
					}) );
			} else {
				console.log( '>> Metric: ' );
				console.log( lessonMetrics[ id ] );
				const metric = new CompletionMetric( {...lessonMetrics[ id ], lastUpdated} );
				console.log( metric );

				// Case: Try updating an existing metric:
				promises.push( Lesson.updateOne( query, {
					$set: { 'completions.$': metric }
				})
					.then( updated => {
						console.log( `Saved lesson metric with name ${name} to lesson ${id}`, JSON.stringify(updated, null, 2));
						if ( updated.modifiedCount === 1 ) {
							console.log('>> Changed lesson: ', id);
							changed.push( id );
						}
						else if ( updated.matchedCount === 0 ) {
							// Case: Metric not found in lesson, so create it:
							createdLessonPromises.push(
								Lesson.updateOne(
									{ _id: ObjectId( id ) },
									{
										$push: {
											completions: metric
										}
									}
								)
									.then( ( updated ) => {
										console.log( `Created lesson metric with name ${name} to lesson ${id}`, JSON.stringify(updated, null, 2));
										if ( updated.modifiedCount === 1 ) {
											console.log('>> Created lesson: ', id);
											created.push( id );
										}
									})
									.catch( err => {
										console.error( 'Error creating lesson metric: ', err.message );
									})
							);
						}
					})
					.catch( err => {
						console.error( 'Error saving lesson metric: ', err.message );
					}) );
			}
		}
		console.log('>> Promises: ', JSON.stringify(promises, null, 2) );
		Promise.all( promises ).then( () => {
						const onSuccess = lessons => {
				const idsToLessons = {};
				lessons.forEach( lesson => {
					idsToLessons[ lesson._id ] = lesson;
				});
				res.json({
					message: req.t( 'lesson-metrics-updated' ),
					lessons: {
						changed: changed.map( id => idsToLessons[ id ] ),
						created: created.map( id => idsToLessons[ id ] ),
						deleted: deleted.map( id => idsToLessons[ id ] )
					}
				});
			};

			if ( createdLessonPromises.length > 0 ) {
				// Case: New lesson metrics were created, so query both the new and changes ones:
				console.log( '>> CreatedLessons: ', JSON.stringify(created, null, 2) );
				console.log( '>> ChangedLessons: ', JSON.stringify(changed, null, 2) );
				Promise.all( createdLessonPromises ).then( () => {
					const query = { _id: { $in: changed.concat( created ).concat( deleted ) } };
					Lesson.find( query ).then( onSuccess ).catch( err => {
						throw new Error( `error in save_lesson_metrics when new lesson metrics were created: ${err.message}` );
					});
				});
			} else {
				// Case: no new lesson metrics were created, so we can just query the changed lessons:
				console.log( 'Retrieve changed lessons for lessons with ids:', changed );
				Lesson.find({ _id: { $in: changed.concat( deleted ) }} )
									  .then( onSuccess )
									  .catch( err => {
								  throw new Error( `error in save_lesson_metrics when no new lesson metrics were created: ${err.message}` );
									  });
			}
		}).catch( err => {
			throw new Error( `error in save_lesson_metrics ${err.message}` );
		});
	})
);


// EXPORTS //

module.exports = router;
