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
 * @typedef {Object} DepCache
 * @property {Object<string,Array>} forest
 * @property {Set} index
 */

'use strict';

// MODULES //

const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const Namespace = require( './../models/namespace' );
const Lesson = require( './../models/lesson' );
const { computeCompletions } = require( './completions.js' );


// VARIABLES //

const CACHE = { forest: {}, index: new Set() };


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
	return {
		lesson,
		namespace
	};
}

/**
 * Computes one tree in the forest for a given component-metric and lesson.
 *
 * @param {string} componentMetric - component metric name
 * @param {Object} lesson - lesson object
 * @param {Object} namespace - namespace object
 * @returns {Array} computation set
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
    const lessonMetrics = lesson.completions.filter( x => x.ref === componentMetric );   // ATTN: change ref -> submetric
    const computationSet = [];
    for ( let i = 0; i < lessonMetrics.length; ++i ) {
        const lessonMetric = lessonMetrics[ i ];
        const namespaceMetrics = namespace.completions.filter( x => x.ref === lessonMetric.name && x.autoCompute );
        if ( namespaceMetrics.length === 0 ) {
            computationSet.push( [ lesson._id, lessonMetric ] );
        } else if ( lessonMetric.autoCompute ) {
            for ( const namespaceMetric of namespaceMetrics ) {
                    computationSet.push( [ namespace._id, namespaceMetric, lesson._id, lessonMetric ] );
            }
        } else {
           for ( const namespaceMetric of namespaceMetrics ) {
                computationSet.push( [ namespace._id, namespaceMetric ] );
            }
        }
     }
    return computationSet;
}

/**
 * Returns the computation set for a given component-metric and lesson.
 *
 * @param {DepCache} cache - cache object with `forest` and `index` properties
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
 * @param {DepCache} cache - cache object
 * @param {Object} user - user object
 * @param {string} componentMetric - component metric name
 * @param {ObjectId} lessonId - lesson id
 * @param {ObjectId} namespaceId - namespace id
 * @returns {Promise} resolves to the updated user object
 */
async function updateAutoComputes( cache, user, componentMetric, lessonId, namespaceId ) {
    const computations = getAssessmentDependencies( cache, componentMetric, lessonId, namespaceId );
    const lastUpdated = Date.now();

    for ( let i = 0; i < computations.length; ++i ) {
        const [ id, metric, ...derived ] = computations[ i ];
        const assessment = await computeCompletions( id, metric, [ user._id ], {} );
        const instance = assessment[ user._id ];

        // Store main assessments
        const mainKey = `${metric.level}-${id}-${metric.name}`;
        user.completions[ mainKey ] = { metricName: metric.name, lastUpdated, instance };
        cache.index.add( mainKey );  // ATTN:QUERY Do this elsewhere? Wasteful?
		const provenance = instance.provenance;

        // Store all derived assessments
        for ( let j = 0; j < derived.length; j += 2 ) {
            const derivedId = derived[ j ];
            const derivedMetric = derived[ j + 1 ];
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
 * @param {DepCache} cache - cache object
 * @param {string} level - level name (e.g. 'lesson' or 'namespace')
 * @param {ObjectId} entityId - id of the level entity
 * @param {string} metricName - metric name
 * @param {boolean} autoCompute - whether the metric is to be auto-computed
 * @param {boolean} containerAutoCompute - whether a parent level metric is to be auto-computed
 * @returns {boolean} boolean indicating whether the cache needs to be updated
 */
function assessmentDepsCacheNeedsUpdate( cache, level, entityId, metricName, autoCompute, containerAutoCompute ) {
    // Make key "level-entityId-metricName"
    // Is key in index?
    // If so, if autoCompute false, return true.
    // If not, if autoCompute true or (level == 'lesson' and "child" namespace is autoCompute), return true
    // Else return false
    const key = `${level}-${entityId}-${metricName}`;
    const inIndex = cache.index.has( key );

    if ( inIndex && !autoCompute ) {
        return true;
    }
    if ( autoCompute || (level === 'lesson' && containerAutoCompute) ) {
        return true;
    }
    return false;
}

function updateAssessmentsDepCache( cache, ATTN ) {
    // If not assessmentDepsCacheNeedsUpdate, return cache.
    // Case 1. Lesson metric has changed with autoCompute on
    //    Subcase 1. A relevant containing namespace metrics is not autoCompute
    //        Add [lessonId, lessonMetric] to the appropriate tree
    //    Subcase 2. A relevant containing namespace metric is autoCompute
    //        Add [namespaceId, namespaceMetric, lessonId, lessonMetric] to appropriate tree
    // Case 2. Lesson metric has changed with autoCompute off
    //    Remove any nodes containing lessonId from appropriate tree
    // Case 3. Namespace metric has changed with autoCompute on
    //    Rebuild appropriate tree?
    // Case 4. Namespace metric has changed with autoCompute off
    //    Promote any nodes containing namespaceId to lesson only nodes.
    // Return updated cache

}

// EXPORTS //

module.exports = {
	updateAutoComputes,
	updateAssessmentsDepCache,
	CACHE
};
