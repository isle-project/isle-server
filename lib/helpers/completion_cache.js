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
 *
 */

/**
 * Methods for maintaining a cache of ATTN
 *
 * @typedef {Object} DepsCache
 * @property {Object<string,Array>} forest
 * @property {Set} index
 *
 * @typedef {Object} Metric
 * @property {string} name
 * @property {EntityLevel} level
 * @property {Array} coverage
 * @property {Array} rule
 * @property {string} ref         // ATTN:CHANGE ref -> submetric
 * @property {Object<string,number>} [tagWeights]
 * @property {Array<number>} [timeFilter]
 * @property {boolean} [autoCompute=false]
 * @property {boolean} [visibleToStudents=false]
 * @property {('last'|'first'|'max'|'pass-through')} [multiples='last']
 *
 * @typedef {Object} ObjectId
 * @typedef {Array<(ObjectId|Metric)>} CacheNodes
 */

'use strict';


// MODULES //

const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const isEmptyObject = require( '@stdlib/assert/is-empty-object' );
const Namespace = require( './../models/namespace' );
const Lesson = require( './../models/lesson' );
const { computeCompletions } = require( './completions.js' );


// MAIN //

/*
 * Input: a (component-metric, lesson, namespace, user) tuple
 *
 * 1. Find all lesson-metrics that refer to component-metric, mark those that are autocompute (separate into two sets)
 * 2. For each such lesson-metric, find all namespace-metrics that refer to the lesson-metric and are autocompute
 *    and keep pairs [namespace-metric, lesson-metric-if-autocompute] in computationSet,
 *    adding [lesson-metric] to set if no namespace-metrics are autocompute and lesson-metric is
 * 3. For each [metric, derived] in computationSet:
 *    - computeCompletions for metric for user
 *    - store aggregate result in user object (key level-entity-metricName)
 *    - If derived is not empty, extract derived results from provenance and store in user object
 *
 * 1 and 2 are cached, 3 is done each time, cache is updated periodically (or when a metric is updated)
 * May not
 *
 * Cache:  forest, index
 * forest maps: (component-metric, lesson) to computationSet
 * index: metric key to boolean (present in any forest value?)
 */

/**
 * Get (lesson, namespace) entities from ids.
 *
 * @param {ObjectId} lessonId - lesson id
 * @param {ObjectId} namespaceId - namespace id
 * @returns {Promise} resolves to an object with the lesson and namespace
 */
async function getLessonNamespacePair( lessonId, namespaceId ) {
	const lesson = await Lesson.findById( lessonId );
	const namespace = await Namespace.findById( namespaceId );
	return { lesson, namespace };
}

/**
 * Returns the namespace with the given id populated with its lessons.
 *
 * @param {ObjectId} namespaceId - namespace id
 * @returns {Promise} resolves to the namespace with the given id populated with its lessons
 */
async function getPopulatedNamespace( namespaceId ) {
	const namespace = await Namespace
		.findById( namespaceId )
		.populate( 'lessons' )
		.exec();
	return namespace;
}

/**
 * Checks whether two `ObjectId` instances or strings are equal.
 *
 * @param {(ObjectId|string)} a - first identifier
 * @param {(ObjectId|string)} b - second identifier
 * @returns {boolean} whether the two identifiers have the same underlying string
 */
function isEqualObjectId( a, b ) {
	return a.toString( ) === b.toString( );
}

/**
 * Computes one tree in the forest for a given component-metric and lesson.
 *
 * @param {string} componentMetric - a component metric name
 * @param {Object} lesson - the lesson object for the lesson containing the component
 * @param {Object} namespace - the namespace object for the namespace containing lesson
 * @returns {Array<Array<ObjectId|Metric>>} computation set
 */
function makeAssessmentDependencies( componentMetric, lesson, namespace ) {
	// 1. Find all lesson-metrics that use componentMetric
	// 2. For all such lesson-metrics
	//    a. Find all namespace-metrics that use lesson-metric
	//    b. If namespace-metric is autoCompute, add to computationSet
	//          [namespace-metric, lesson-metric] if lesson-metric is autoCompute
	//          [namespace-metric]                if not
	//    c. If no namespace-metrics in this set are autoCompute, add
	//       [lesson-metric] to computationSet
	// ATTN:CHANGE ref -> submetric
	const lessonMetrics = lesson.completions.reduce( (map, x) => {
		if ( x.ref === componentMetric ) {
			map.set( x.name, x );
		}
		return map;
	}, new Map() );
	const namespaceMetrics = namespace.completions.reduce( (map, x) => {
		if ( x.autoCompute && lessonMetrics.has( x.ref ) && isCoveredLesson( lesson._id, x.coverage ) ) {
			if ( map.has( x.ref ) ) {
				map.get( x.ref ).push( x );
			} else {
				map.set( x.ref, [ x ] );
			}
		}
		return map;
	}, new Map() );
	const lessonId = lesson._id;
	const namespaceId = namespace._id;

	const computationSet = [];
	for ( const [name, lessonMetric] of lessonMetrics ) {
		if ( !namespaceMetrics.has( name ) ) {
			if ( lessonMetric.autoCompute ) {
				computationSet.push( [ lessonId, lessonMetric ] );
			}
		} else if ( lessonMetric.autoCompute ) {
			for ( const namespaceMetric of namespaceMetrics.get( name ) ) {
				computationSet.push( [ namespaceId, namespaceMetric, lessonId, lessonMetric ] );
			}
		} else {
			for ( const namespaceMetric of namespaceMetrics.get( name ) ) {
				computationSet.push( [ namespaceId, namespaceMetric ] );
			}
		}
	}
	return computationSet;
}

/**
 * Creates an empty assessment dependencies cache.
 */
function makeAssessmentDepsCache( ) {
	return {
		forest: {},
		index: new Set(),
		namespaceToLessons: {}
	};
}

/**
 * Returns the computation set for a given component-metric and lesson.
 *
 * @param {DepsCache} cache - cache object with `forest` and `index` properties
 * @param {string} componentMetric - component metric name
 * @param {ObjectId} lessonId - lesson id
 * @param {ObjectId} namespaceId - namespace id
 * @returns {Promise} resolves to the computation set for the given component-metric and lesson
 */
async function getAssessmentDependencies( cache, componentMetric, lessonId, namespaceId ) {
	// Lookup key in cache forest
	// If present, return computation set
	// Else call makeAssessmentDependencies and insert in forest and index
	if ( hasOwnProp( cache.forest?.[ lessonId ], componentMetric ) ) {
		return cache.forest[ lessonId ][ componentMetric ];
	}
	const { lesson, namespace } = await getLessonNamespacePair( lessonId, namespaceId );
	return setAssessmentDependencies( cache, componentMetric, lesson, namespace );
}

/**
 * Generates the computation set for a given component-metric and lesson and adds it to the cache.
 *
 * @param {DepsCache} cache - cache object with `forest` and `index` properties
 * @param {string} componentMetric - component metric name
 * @param {Object} lesson - lesson object
 * @param {Object} namespace - namespace object
 * @returns {CacheNodes} computation set
 */
function setAssessmentDependencies( cache, componentMetric, lesson, namespace ) {
	const computationSet = makeAssessmentDependencies( componentMetric, lesson, namespace );
	const lessonId = lesson._id;
	const namespaceId = namespace._id;
	if ( !hasOwnProp( cache.forest, lessonId ) ) {
		cache.forest[ lessonId ] = {};
	}
	if ( !hasOwnProp( cache.namespaceToLessons, namespaceId ) ) {
		cache.namespaceToLessons[ namespaceId ] = {};
	}
	console.log( 'computationSet', computationSet );
	console.log( 'namespaceId', namespaceId );
	console.log( 'lessonId', lessonId );
	cache.forest[ lessonId ][ componentMetric ] = computationSet;  // Explicitly shared, only need to modify one!

	if ( !cache.namespaceToLessons[ namespaceId ][ componentMetric ] ) {
		cache.namespaceToLessons[ namespaceId ][ componentMetric ] = new Set();
	}
	cache.namespaceToLessons[ namespaceId ][ componentMetric ].add( lessonId );
	return computationSet;
}

/**
 * Cleans unneeded nodes from assessment deps cache when an autoCompute is removed.
 *
 * @param {DepsCache} cache - cache object with `forest` and `index` properties
 * @param {('namespace'|'lesson')} level - level of metric for which autoCompute is removed
 * @param {ObjectId} entityId - the id of the namespace or lesson of the metric being 'removed'
 * @param {string} metricName - metric name for which autoCompute is removed
 * @returns {DepsCache} updated cache
 */
 function removeAssessmentDependencies( cache, level, entityId, metricName ) {
	const subtree = level === 'lesson' ? cache.forest[ entityId ] : cache.namespaceToLessons[ entityId ];
	if ( !subtree ) {
		return cache;
	}
	if ( level === 'namespace' ) {
		for ( const componentMetric in subtree ) {
			if ( hasOwnProp( subtree, componentMetric ) ) {
				for ( const lessonId of subtree[ componentMetric ] ) {
					const affectedNodes = cache.forest[ lessonId ][ componentMetric ];
					/* eslint-disable max-depth */
					if ( affectedNodes ) {
						for ( let i = affectedNodes.length - 1; i >= 0; --i ) {
							const [ nsId, nsMetric, lsId, lsMetric ] = affectedNodes[ i ];
							const isRelevant = isEqualObjectId( nsId, entityId ) && nsMetric.name === metricName;
							console.log( 'isRelevant', isRelevant );
							console.log( nsId );
							console.log( entityId );
							console.log( nsId === entityId );
							console.log( nsMetric.name );
							console.log( metricName );

							if ( isRelevant && lsId && lsMetric.autoCompute ) {
								affectedNodes[ i ].splice( 0, 2 );
							} else if ( isRelevant ) {
								affectedNodes.splice( i, 1 );
							}
						}
						if ( affectedNodes.length === 0 ) {
							delete cache.forest[ lessonId ][ componentMetric ];
							subtree[ componentMetric ].delete( lessonId );
						}
					}
					/* eslint-enable max-depth */
				}
				if ( subtree[ componentMetric ].size === 0 ) {
					delete cache.namespaceToLessons[ entityId ][ componentMetric ];
				}
			}
		}
	} else {
		// Case: level === 'lesson'
		for ( const componentMetric in subtree ) {
			if ( hasOwnProp( subtree, componentMetric ) ) {
				const affectedNodes = subtree[ componentMetric ];
				if ( affectedNodes ) {
					// Each affected node is of the form []
					for ( let i = affectedNodes.length - 1; i >= 0; --i ) {
						const [ idA, metricA, idB, metricB ] = affectedNodes[ i ];
						if ( isEqualObjectId( idA, entityId ) && metricA.name === metricName ) {
							affectedNodes.splice( i, 1 );
						} else if ( isEqualObjectId( idB, entityId ) && metricB.name === metricName ) {
							affectedNodes[ i ].splice( 2, 2 );
						}
					}
					if ( affectedNodes.length === 0 ) {
						delete subtree[ componentMetric ];
					}
				}
			}
		}
	}
	cache.index.delete( `${level}-${entityId}-${metricName}` );
	if ( isEmptyObject( subtree ) ) {
		delete cache.forest[ entityId ];
	}
	return cache;
}

/**
 * Update assessments for all auto-compute metrics depending on the given component metric for a supplied user.
 *
 * @param {DepsCache} cache - cache object
 * @param {Object} user - user object
 * @param {string} componentMetric - component metric name
 * @param {ObjectId} lessonId - lesson id
 * @param {ObjectId} namespaceId - namespace id
 * @returns {Promise<Object>} resolves to the updated user object
 */
async function updateAutoComputes( cache, user, componentMetric, lessonId, namespaceId ) {
	const computations = await getAssessmentDependencies( cache, componentMetric, lessonId, namespaceId );
	const lastUpdated = Date.now();

	for ( let i = 0; i < computations.length; ++i ) {
		const [ id, metric, derivedId, derivedMetric ] = computations[ i ];
		const assessment = await computeCompletions( id, metric, [ user._id ], {} );
		const instance = assessment[ user._id ];

		// Store main assessment:
		const mainKey = `${metric.level}-${id}-${metric.name}`;
		user.completions[ mainKey ] = { metricName: metric.name, lastUpdated, instance };

		// Store derived assessment; there can be at most one
		if ( derivedId !== void 0 ) {
			const provenance = instance.provenance;
			const derivedKey = `${derivedMetric.level}-${derivedId}-${derivedMetric.name}`;
			const derivedInstance = provenance.find( x => isEqualObjectId( x.entity, derivedId ) );
			user.completions[ derivedKey ] = { metricName: derivedMetric.name, lastUpdated, instance: derivedInstance };
		}
	}
	// Save recorded assessments:
	return user.save();
}

/**
 * Checks whether there is a namespace metric for the given lesson metric that is auto-computed.
 *
 * @param {DepsCache} cache - cache object
 * @param {ObjectId} namespaceId - namespace id
 * @param {ObjectId} lessonId - lesson id
 * @param {Object} lessonMetric - lesson metric
 * @returns {Array<Object>} array of auto-computed namespace metrics using the given lesson metric
 */
function referringAutoComputedMetrics( cache, namespaceId, lessonId, lessonMetric ) {
	const subtree = cache.forest?.[ lessonId ]?.[ lessonMetric.ref ];
	const out = [];
	if ( !subtree ) {
		return out;
	}
	for ( const [ id, metric ] of subtree ) {
		if ( isEqualObjectId( namespaceId, id ) && metric.autoCompute && metric.ref === lessonMetric.name ) {
			out.push( metric );
		}
	}
	return out;
}

/**
 * Checks whether the cache needs to be updated for a given-metric.
 *
 * @param {DepsCache} cache - cache object
 * @param {string} level - level name (e.g. 'lesson' or 'namespace')
 * @param {ObjectId} entityId - id of the level entity
 * @param {string} metricName - metric name
 * @param {boolean?} autoCompute - whether the metric is to be auto-computed
 * @param {boolean?} hasReferringAutoCompute - whether the metric has auto-computed metrics that are referenced by the metric
 * @returns {boolean} indicates whether the cache needs to be updated
 */
function assessmentDepsCacheNeedsUpdate( cache, level, entityId, metricName, autoCompute, hasReferringAutoCompute ) {
	// Make key "level-entityId-metricName"
	// Is key in index?
	// If so, if autoCompute false, return true.
	// If not, if autoCompute true or (level == 'lesson' and "child" namespace is autoCompute), return true
	// Else return false
	const key = `${level}-${entityId}-${metricName}`;
	const inIndex = cache.index.has( key );

	if ( inIndex && autoCompute === false ) {
		// Case: auto-compute of metric has been turned off
		return true;
	}
	if ( autoCompute === true && !inIndex ) {
		// Case: auto-compute of metric has been turned on
		return true;
	}
	if ( level === 'lesson' && hasReferringAutoCompute ) {
		// Case: namespace metric is auto-computed and its sub-metric has changed
		return true;
	}
	return false;
}

/**
 * Returns the lessons that are included in a given coverage.
 *
 * @param {Array<Lesson>} lessons - array of lessons
 * @param {Array<(string|ObjectId)>} coverage - array with first element being 'all', 'include', or 'exclude' and the rest being lesson identifiers
 * @returns {Array<Lesson>} array of lessons
 */
function coveredLessons( lessons, coverage ) {
	if ( !coverage ) {
		return lessons;
	}
	const coverageType = coverage[ 0 ];
	if ( coverageType === 'all' ) {
		return lessons;
	}
	const covered = new Set( coverage.slice( 1 ) );
	let keep;
	if ( coverageType === 'include' ) {
		keep = lesson => covered.has( lesson._id.toString() );
	} else { // CoverageType 'exclude'
		keep = lesson => !covered.has( lesson._id.toString() );
	}
	return lessons.filter( keep );
}

/**
 * Is a lesson covered by a namespace metric?
 *
 * @param {ObjectId} lessonId - the candidate lesson
 * @param {Array} coverage - the coverage array from a namespace metric
 * @returns {boolean} true if the lesson is covered, false otherwise
 */
function isCoveredLesson( lessonId, coverage ) {
	if ( coverage[ 0 ] === 'all' ) return true;
	if ( coverage[ 0 ] === 'include' && coverage.includes( lessonId.toString() ) ) return true;
	if ( coverage[ 0 ] === 'exclude' && !coverage.includes( lessonId.toString() ) ) return true;
	return false;
}

function ensureNode( cache, entityId, componentMetric ) {
	if ( !hasOwnProp( cache.forest, entityId ) ) {
		cache.forest[ entityId ] = {};
	}
	if ( !hasOwnProp( cache.forest[ entityId ], componentMetric ) ) {
		cache.forest[ entityId ][ componentMetric ] = [];
	}
	return cache.forest[ entityId ][ componentMetric ];
}

/**
 * Updates assessment deps cache given update to a particular metric.
 *
 * @param {DepsCache} cache - cache object
 * @param {Object} metric - updated metric object
 * @param {ObjectId} entityId - id of the level entity for the updated metric
 * @param {ObjectId?} namespaceId - id of the containing namespace, only supplied for level 'lesson'
 * @returns {DepsCache} an updated cache.
 */
async function updateAssessmentDepsCache( cache, metric, entityId, namespaceId ) {
	const isLessonLevel = metric.level === 'lesson';
	const referringMetrics = ( namespaceId && isLessonLevel ) ? referringAutoComputedMetrics( cache, namespaceId, entityId, metric ) : [];
	const hasReferringAutoCompute = referringMetrics.length > 0;
	if ( assessmentDepsCacheNeedsUpdate( cache, metric.level, entityId, metric.name, metric.autoCompute, hasReferringAutoCompute ) ) {
		if ( isLessonLevel ) {
			// Case 1. Lesson metric has changed with autoCompute set
			if ( metric.autoCompute && hasReferringAutoCompute ) {
				// Relevant containing metric is autoCompute
				const nodes = ensureNode( cache, entityId, metric.ref );
				for ( const nsMetric of referringMetrics ) {
					// Add computation dependencies for this and parent metrics
					nodes.push( [ namespaceId, nsMetric, entityId, metric ] );
				}
				// Update index:
				cache.index.add( `${metric.level}-${entityId}-${metric.name}` );
			} else if ( metric.autoCompute ) {
				// Relevant containing metric is not autoCompute
				const nodes = ensureNode( cache, entityId, metric.ref );
				nodes.push( [ entityId, metric ] );

				// Update index
				cache.index.add( `${metric.level}-${entityId}-${metric.name}` );
			} else {
				removeAssessmentDependencies( cache, metric.level, entityId, metric.name );
				// Remove any nodes containing lessonId from appropriate tree
				// Update index
				cache.index.delete( `${metric.level}-${entityId}-${metric.name}` );
			}
		} else if ( metric.autoCompute ) {
			// Case 2. Namespace metric has changed with autoCompute set
			// Rebuild appropriate tree
			const namespace = await getPopulatedNamespace( entityId );
			const lessons = coveredLessons( namespace.lessons, metric.coverage );
			console.log( 'Covered lessons', lessons );
			lessons.forEach( lesson => {
				const completions = lesson.completions;
				completions
					.filter( x => x.name === metric.ref )
					.forEach( lessonMetric => {
						setAssessmentDependencies( cache, lessonMetric.ref, lesson, namespace );
					});
			});

			// Update index
			cache.index.add( `${metric.level}-${entityId}-${metric.name}` );
		} else {
			// Case 3. Namespace metric has changed with autoCompute unset
			// Promote any nodes containing namespaceId to lesson only nodes.
			removeAssessmentDependencies( cache, metric.level, entityId, metric.name );
			// Update index
			cache.index.delete( `${metric.level}-${entityId}-${metric.name}` );
		}
	}
	return cache;
}


// EXPORTS //

module.exports = {
	updateAutoComputes,
	updateAssessmentDepsCache,
	makeAssessmentDepsCache,
	removeAssessmentDependencies
};
