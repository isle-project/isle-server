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
 */

'use strict';


// MODULES //

const hasOwnProp = require( '@stdlib/assert/has-own-property' );
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
 * Computes one tree in the forest for a given component-metric and lesson.
 *
 * @param {string} componentMetric - a component metric name
 * @param {Object} lesson - the lesson object for the lesson containing the component
 * @param {Object} namespace - the namespace object for the namespace containing lesson
 * @returns {Array<ObjectId|Metric>} computation set
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
		if ( x.autoCompute && lessonMetrics.has( x.ref ) ) {
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
	return { forest: {}, index: new Set() };
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
	const key = `${lessonId}-${componentMetric}`;
	if ( hasOwnProp( cache.forest, key ) ) {
		return cache.forest[ key ];
	}
	const { lesson, namespace } = await getLessonNamespacePair( lessonId, namespaceId );
	const computationSet = makeAssessmentDependencies( componentMetric, lesson, namespace );
	cache.forest[ key ] = computationSet;
	return computationSet;
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
    const computations = getAssessmentDependencies( cache, componentMetric, lessonId, namespaceId );
    const lastUpdated = Date.now();

    for ( let i = 0; i < computations.length; ++i ) {
        const [ id, metric, derivedId, derivedMetric ] = computations[ i ];
        const assessment = await computeCompletions( id, metric, [ user._id ], {} );
        const instance = assessment[ user._id ];

        // Store main assessments
        const mainKey = `${metric.level}-${id}-${metric.name}`;
        user.completions[ mainKey ] = { metricName: metric.name, lastUpdated, instance };
        cache.index.add( mainKey );  // ATTN:QUERY Do this elsewhere? Wasteful?
		const provenance = instance.provenance;

        // Store derived assessment; there can be at most one
        if ( derivedId !== void 0 ) {
            const derivedKey = `${derivedMetric.level}-${derivedId}-${derivedMetric.name}`;
            const derivedInstance = provenance.find( x => x.entity === derivedId );
            user.completions[ derivedKey ] = { metricName: derivedMetric.name, lastUpdated, instance: derivedInstance };
            cache.index.add( derivedKey );
        }
    }
    // Save recorded assessments
    return user.save();
}


/**
 * Checks whether the cache needs to be updated for a given component-metric and lesson.
 *
 * @param {DepsCache} cache - cache object
 * @param {string} level - level name (e.g. 'lesson' or 'namespace')
 * @param {ObjectId} entityId - id of the level entity
 * @param {string} metricName - metric name
 * @param {boolean?} autoCompute - whether the metric is to be auto-computed; this should
 *     only be supplied if the autoCompute property has been updated
 * @param {boolean?} containerAutoCompute - whether a parent level metric is to be auto-computed;
 *     this should only be supplied if at the lesson level.
 * @returns {boolean} Does the cache needs to be updated?
 */
function assessmentDepsCacheNeedsUpdate( cache, level, entityId, metricName, autoCompute, containerAutoCompute ) {
    // Make key "level-entityId-metricName"
    // Is key in index?
    // If so, if autoCompute false, return true.
    // If not, if autoCompute true or (level == 'lesson' and "child" namespace is autoCompute), return true
    // Else return false
    const key = `${level}-${entityId}-${metricName}`;
    const inIndex = cache.index.has( key );

    if ( inIndex && autoCompute === false ) {
        return true;
    }
    if ( autoCompute || (level === 'lesson' && containerAutoCompute) ) {
        return true;
    }
    return false;
}

/**
 * Cleans unneeded nodes from assessment deps cache when an autoCompute is removed.
 * 
 */
function removeAssessmentDeps( cache, id, metricName ) {

}

/**
 * Updates assessment deps cache given update to a particular metric.
 *
 * @param {DepsCache} cache - cache object
 * @param {string} level - level name (e.g. 'lesson' or 'namespace') of the updated metric
 * @param {ObjectId} entityId - id of the level entity for the updated metric
 * @param {string} metricName - name of the updated metric
 * @param {boolean?} autoCompute - whether the updated metric is to be auto-computed; this should
 *     only be supplied if the autoCompute property has been updated
 * @param {boolean?} containerAutoCompute - whether a relevant parent level metric is to be
 *     auto-computed; this should only be supplied if at the lesson level.
 * @returns {DepsCache} an updated cache.
 */
function updateAssessmentDepsCache( cache, level, entityId, metricName, autoCompute, containerAutoCompute ) {
    const isLessonLevel = level === 'lesson';
	if ( assessmentDepsCacheNeedsUpdate( cache, level, entityId, metricName, autoCompute, containerAutoCompute ) ) {
		if ( isLessonLevel ) {
            // Case 1. Lesson metric has changed with autoCompute set
			if ( autoCompute && containerAutoCompute) {
				// Relevant containing metric is autoCompute

                // Add [namespaceId, namespaceMetric, lessonId, lessonMetric] to appropriate tree
                // Update index
			} else if ( autoCompute ) {
				// Relevant containing metric is not autoCompute

                // Add [lessonId, lessonMetric] to the appropriate tree
                // Update index
			} else {

                // Remove any nodes containing lessonId from appropriate tree
                // Update index
			}
		} else {
            // Cases 2. Namespace metric has changed with autoCompute set
			if ( autoCompute ) {

                // Rebuild appropriate tree
                // Update index
			} else {

				// Promote any nodes containing namespaceId to lesson only nodes.
			}

		}
	}
	return cache;
}


// EXPORTS //

module.exports = {
	updateAutoComputes,
	updateAssessmentDepsCache,
	makeAssessmentDepsCache
};
