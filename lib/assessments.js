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
 *   name: Assessments
 *   description: Assessment management.
 */

// MODULES //

const router = require( 'express' ).Router();
const mongoose = require( 'mongoose' );
const passport = require( './passport.js' );
const isArray = require( '@stdlib/assert/is-array' );
const isBoolean = require( '@stdlib/assert/is-boolean' );
const isPlainObject = require( '@stdlib/assert/is-object' );
const wrapAsync = require( './utils/wrap_async.js' );
const Assessment = require( './models/assessment.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const ObjectId = mongoose.Types.ObjectId;
const User = require( './models/user.js' );
const Lesson = require( './models/lesson.js' );
const AssessmentMetricSchema = require( './models/assessment_metric.js' );
const AssessmentMetric = mongoose.model( 'AssessmentMetric', AssessmentMetricSchema );
const { computeAssessments, levelMapping, ASSESSMENT_RULES } = require( './helpers/assessments.js' );
const { makeAssessmentDepsCache, removeAssessmentDependencies,
	updateAutoComputes, updateAssessmentDepsCache } = require( './helpers/assessment_cache.js' );

const ASSESSMENT_CACHE = makeAssessmentDepsCache();

// FUNCTIONS //

const getAssessments = async ( schema, id ) => {
	const entity = await schema.findById({ _id: id }, { assessments: 1, _id: 0 }).lean();
	if ( !entity ) {
		throw new Error( 'Entity not found.' );
	}
	return entity.assessments;
};


// VARIABLES //

const MUNGE_SEPARATOR = '|%-@|';


// MAIN //

/**
* @openapi
*
* /assessment_tags:
*   post:
*    summary: Retrieve assessment tags
*    description: Retrieve assessment tags associated with a set of lessons.
*    tags: [Assessments]
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
*               description: Array of unique assessment tags associated with the lessons
*               items:
*                 type: string
*/
router.post( '/assessment_tags',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAssessmentTags( req, res ) {
		const lessons = req.body.lessons;
		const tags = await Assessment.distinct( 'tag', {
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
 * /assessment_rules
 *   get:
 *     summary: Retrieve assessment rules
 *     description: Retrieve assessment rules for metrics.
 *     tags: [Assessments]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *           schema:
 *             type: object
 *             description: Object mapping assessment rule names to rule objects.
 */
router.get( '/assessment_rules',
	function onAssessmentRules( req, res ) {
		console.log( 'Return assessment rules...' );
		return res.json( ASSESSMENT_RULES );
	}
);

/**
 * @openapi
 *
 * /assessment_cache:
 *   get:
 *     summary: Retrieve assessment cache
 *     description: Retrieve assessment cache.
 *     tags: [Assessments]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Assessment cache.
 *               properties:
 *                 forest:
 *                   type: object
 *                   description: Object mapping IDs to objects mapping component metrics to computation sets (arrays of arrays containing IDs and metric objects in alternating order).
 *                 index:
 *                   type: array
 *                   description: Array of string of the form `<level='namespace'|'lesson'>-<id>-<metricName>` of things represented in the cache.
 */
router.get( '/assessment_cache',
	function onAssessmentCache( req, res ) {
		console.log( 'Return assessment cache...' );
		return res.json({
			forest: ASSESSMENT_CACHE.forest,
			index: Array.from( ASSESSMENT_CACHE.index ),
			namespaceToLessons: JSON.parse( JSON.stringify( ASSESSMENT_CACHE.namespaceToLessons, ( key, value ) => {
				if ( value instanceof Set ) {
					return Array.from( value );
				}
				return value;
			}, 2 ) )
		});
	}
);

/**
* @openapi
*
* /assessment_components:
*   post:
*     summary: Retrieve assessment component identifiers
*     description: Retrieve component identifiers associated with a set of lessons from the assessment table.
*     tags: [Assessments]
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
router.post( '/assessment_components',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAssessmentComponents( req, res ) {
		const lessons = req.body.lessons;
		const lessonComponents = await Assessment.aggregate([
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
* /assessment_submetrics:
*   post:
*    summary: Retrieve assessment submetrics
*    description: Retrieve assessment submetrics for a set of entities.
*    tags: [Assessments]
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
*               description: Array of unique assessment submetrics associated with the entities
*               items:
*                 type: string
*/
router.post( '/assessment_submetrics',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAssessmentSubmetrics( req, res ) {
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
		const submetrics = await Assessment
			.distinct( 'metricName', query );
		res.json( submetrics );
	})
);

/**
 * @openapi
 *
 * /record_assessment:
 *    post:
 *      summary: Record assessment
 *      description: Record assessment for a component.
*       tags: [Assessments]
*       body:
*         application/json:
*           schema:
*             type: object
*             properties:
*               lesson:
*                 description: Lesson identifier.
*                 type: string
*                 example: '6283ed74dc14303dc81d38e9'
*               component:
*                 description: Component identifier.
*                 type: string
*                 example: 'free-text-question-1'
*               componentType:
*                 description: Component type.
*                 type: string
*                 example: 'FreeTextQuestion'
*               metricName:
*                 description: Metric name.
*                 type: string
*                 example: 'exam-score'
*/
router.post( '/record_assessment',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRecordAssessment( req, res ) {
		const { lesson, user, score, tag, metricName, namespace, component, componentType, time } = req.body;
		const lessonId = ObjectId( lesson );
		const namespaceId = ObjectId( namespace );
		const assessment = new Assessment({
			lesson: lessonId,
			user: ObjectId( user ),
			score,
			...( tag && tag !== '_default_tag' && { tag } ),
			metricName,
			component,
			componentType,
			time
		});
		await assessment.save();
		await updateAutoComputes( ASSESSMENT_CACHE, req.user, metricName, lessonId, namespaceId );
		res.json( assessment );
	}
));

/**
* @openapi
*
* /compute_assessments:
*   post:
*     summary: Compute assessments
*     description: Compute assessments for a metric at a specified node and a set of users.
*     tags: [Assessments]
*     body:
*       application/json:
*         schema:
*           type: object
*           properties:
*             metric:
*               description: Metric to compute assessments for.
*               type: Object
*             id:
*               description: Node ID to compute assessments for.
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
*                   description: Number of assessments inserted.
*                 updatedCount:
*                   type: integer
*                   description: Number of assessments updated.
*                 deletedCount:
*                   type: integer
*                   description: Number of assessments deleted.
*                 metric:
*                   type: object
*                   description: Metric object.
*                 assessments:
*                   type: array
*                   description: Object mapping user IDs to assessment scores.
*                 entityId:
*                   type: ObjectId
*                   description: Entity ID for the node for which assessments were computed (e.g., a namespace or lesson).
*/
router.post( '/compute_assessments',
	passport.authenticate( 'jwt', { session: false }),
	function onComputeAssessments( req, res ) {
		const { ids, metric, users, policyOptions } = req.body;
		const effectiveMetric = isArray( metric ) ? metric : [ metric ];
		const metricName = effectiveMetric[ 0 ].name;  // All metrics have the same name

		// ATTN:TODO: Spawn child process to compute assessments in order to avoid blocking the server
		// ATTN:INVARIANT assume ids and metric have same length
		const promises = effectiveMetric.map( ( metric, index ) => {
				return computeAssessments(ids[index], metric, users, policyOptions);
		});

		// Attach assessments to user's assessment history:
		const lastUpdated = Date.now(); // Stringize format on client
		const operations = [];

		/* eslint-disable max-nested-callbacks */
		Promise.all( promises ).then( async ( assessments ) => {
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
									[`assessments.${ukey}`]: {
										metricName,
										instance: assessments[index][user],
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
				message = req.t('computed-assessments-course', { metricName, users: users.length });
			} else if ( ids.length > 1 ) {
				message = req.t('computed-assessments-lessons', { metricName, users: users.length, num: ids.length });
			} else {
				message = req.t('computed-assessments-course', { metricName, users: users.length });
			}
			res.json({
				message,
				insertedCount: bulkResult.insertedCount,
				modifiedCount: bulkResult.modifiedCount,
				deletedCount: bulkResult.deletedCount,
				assessments: assessments,
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
*     tags: [Assessments]
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
*             submetric:
*               description: Name of the metric that will be used to aggregate the metric at the next lower level.
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
		const { name, id, level, coverage, rule, submetric, tagWeights, autoCompute, visibleToStudent } = req.body;

		validateObjectId( id, 'id', req.t );

		const levelData = levelMapping[ level ];
		if ( !levelData ) {
			throw new Error( `Invalid level: ${level}.` );
		}
		const schema = levelData.schema;
		const assessments = await getAssessments( schema, id );

		// Check if metric already exists in `assessments`:
		const exists = assessments && assessments.some( x => x.name === name );
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
			submetric,
			...( isPlainObject( tagWeights ) && { tagWeights } ),
			...( isBoolean( autoCompute ) && { autoCompute } ),
			...( isBoolean( visibleToStudent ) && { visibleToStudent } ),
			lastUpdated: Date.now()
		};
		await schema.updateOne( { _id: id }, {
			$push: {
				assessments: metric
			}
		});

		if ( autoCompute ) {
			// We created a new metric with autoCompute, so we need to add it to the assessment cache:
			updateAssessmentDepsCache( ASSESSMENT_CACHE, metric, id );
		}
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
*     tags: [Assessments]
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
*             submetric:
*               description: Name of the metric that will be used to aggregate the metric at the next lower level.
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
		const { name, id, level, coverage, rule, submetric, tagWeights, autoCompute, visibleToStudent } = req.body;
		validateObjectId( id, 'id', req.t );

		const levelData = levelMapping[ level ];
		if ( !levelData ) {
			throw new Error( `Invalid level: ${level}.` );
		}
		const schema = levelData.schema;

		// TODO: Add input validation.

		const updateSpec = {};
		updateSpec[ 'assessments.$.name' ] = name;
		if ( coverage ) {
			updateSpec[ 'assessments.$.coverage' ] = coverage;
		}
		if ( rule ) {
			updateSpec[ 'assessments.$.rule' ] = rule;
		}
		if ( submetric !== void 0 ) {
			updateSpec[ 'assessments.$.submetric' ] = submetric;
		}
		if ( isPlainObject( tagWeights ) ) {
			updateSpec[ 'assessments.$.tagWeights' ] = tagWeights;
		}
		const updateAutoCompute = isBoolean( autoCompute );
		if ( updateAutoCompute ) {
			updateSpec[ 'assessments.$.autoCompute' ] = autoCompute;
		}
		if ( isBoolean( visibleToStudent ) ) {
			updateSpec[ 'assessments.$.visibleToStudent' ] = visibleToStudent;
		}
		updateSpec[ 'assessments.$.lastUpdated' ] = Date.now();
		await schema.updateOne( {
			_id: id,
			'assessments.name': name
		}, {
			$set: updateSpec
		});
		if ( updateAutoCompute ) {
			updateAssessmentDepsCache( ASSESSMENT_CACHE, {
				level,
				name,
				autoCompute,
				coverage: coverage || [ 'all' ]
			}, id );
		}
		res.json({
			message: req.t( 'metric-updated' )
		});
	})
);

/**
 * Removes a users assessments from the database for a given metric.
 *
 * @param {string} level - metric level (e.g., 'lesson' or 'namespace')
 * @param {ObjectId} id - ID of the node at the given level holding the metric
 * @param {string} name - metric name
 * @returns {Promise} resolves when the assessments are removed
 */
async function clearUserAssessments( level, id, name ) {
	const metricKey = `${level}-${id}-${name}`;
	const out = await User.updateMany({ [`assessments.${metricKey}`]: {
		$exists: true
	}}, {
		$unset: {
			[`assessments.${metricKey}`]: ''
		}
	});
	return out;
}

/**
 * @openapi
 *
 * /clear_user_assessments:
 *   post:
 *     summary: Clear user assessments
 *     description: Clear user assessments for a metric.
 *     tags: [Assessments]
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
 *                   example: 'User assessments cleared.'
 */
router.post( '/clear_user_assessments',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onClearUserAssessments( req, res ) {
		const { id, level, name } = req.body;
		validateObjectId( id, 'id', req.t );
		validateString( name, 'name', req.t );
		validateString( level, 'level', req.t );

		await clearUserAssessments( id, level, name );
		res.json( { message: req.t( 'assessments-cleared' ) } );
	})
);

/**
* @openapi
*
* /delete_metric:
*   post:
*     summary: Delete metric
*     description: Delete an existing metric.
*     tags: [Assessments]
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

		// Remove metric with supplied `name` from `assessments` from the entity with the supplied `id`:
		await schema.updateOne({ _id: id }, {
			$pull: {
				assessments: {
					name: name
				}
			}
		});
		await clearUserAssessments( level, id, name );
		removeAssessmentDependencies( ASSESSMENT_CACHE, level, id, name );
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
 *     tags: [Assessments]
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
				assessments: { $elemMatch: { 'name': name }}
			};
			if ( lessonMetrics[ id ] === null ) {
				promises.push( Lesson.updateOne( query, { $pull: { 'assessments': { 'name': name }}})
					.then( ( result ) => {
						console.log( `Deleted lesson metric with name: ${name} from lesson ${id}` );
						if ( result.modifiedCount === 1 ) {
							deleted.push( id );
							// Delete metric from user assessments:
							clearUserAssessments( 'lesson', id, name );

							// Delete metric from assessment cache:
							removeAssessmentDependencies( ASSESSMENT_CACHE, 'lesson', id, name );
						}
					})
					.catch( err => {
						console.error( err );
					}) );
			} else {
				console.log( '>> Metric: ' );
				console.log( lessonMetrics[ id ] );
				const metric = new AssessmentMetric( { ...lessonMetrics[ id ], lastUpdated } );
				updateAssessmentDepsCache( ASSESSMENT_CACHE, metric, id, namespaceID );
				console.log( metric );

				// Case: Try updating an existing metric:
				promises.push( Lesson.updateOne( query, {
					$set: { 'assessments.$': metric }
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
											assessments: metric
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
