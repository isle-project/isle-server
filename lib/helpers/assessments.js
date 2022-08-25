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
 * Entry Points
 * ============
 *
 * The public entry point for computing assessment results at every level
 * is @see {@link computeAssessments}.
 *
 * Terminology and Data Model
 * ==========================
 *
 * An entity refers to an organizational level such as program,
 * course/namespace, lesson, and component. Entities are arranged
 * hierarchically in a tree. A node refers to a single entity at a
 * given level in the entity tree, which implicitly roots a subtree
 * of contained lower-level entities. The id of a node is the ObjectId
 * of the corresponding entity.
 *
 *
 * Several data structures/types are recurring in these methods:
 *
 * + metric: an object specifying how to compute assessments at a given node
 *
 * + score: a number in the range 0-100, or -999 where the latter
 *     denotes a missing value.
 *
 * + time: a unix-time marking when a assessment is recorded,
 *     or undefined (void 0) if not available.
 *
 * + tag: a string label that can be assigned to an entity
 *
 * + instance: an object {level, entity, score, time, provenance, tag} where
 *     - provenance is either null (at leaf/component level) or an array
 *       of child instances that were used to compute this score
 *     - tag is only included if it is not the default tag; it is a string
 *       for a non-default custom tag giving the tag of that entity.
 *     - an instance is considered a missing value if it's score is the
 *       missing score
 *
 * + userAssessments: an object mapping user ids to an array of instances.
 *             {
 *                 [userId]: [Instances...],
 *                 ...
 *             },
 *
 * + taggedUserAssessments: an object mapping tags to userAssessments objects
 *             {
 *                 [tag]: {
 *                     [userId]: [Instances...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *
 * + aggregateAssessments: an object mapping each user id to an aggregate instance
 *             {
 *                 [tag]: { [userId]: Instance, ... },
 *                 ...
 *             },
 *
 * + reducedAssessments: an object mapping tags to an aggregateAssessments object
 *             {
 *                 [tag]: { [userId]: Instance, ... },
 *                 ...
 *             },
 *
 *
 *
 * @typedef {number} Score
 * @typedef {number|undefined} Time
 * @typedef {string} Tag
 * @typedef {('program'|'namespace'|'lesson'|'component')} EntityLevel
 * @typedef {string} EntityId
 * @typedef {string} UserId
 *
 * @typedef {Object} Metric
 * @property {string} name
 * @property {EntityLevel} level
 * @property {Array} coverage
 * @property {Array} rule
 * @property {string} ref
 * @property {Object<string,number>} [tagWeights]
 * @property {Array<number>} [timeFilter]
 * @property {boolean} [autoCompute=false]
 * @property {boolean} [visibleToStudents=false]
 * @property {('last'|'first'|'max'|'pass-through')} [multiples='last']
 *
 * @typedef {Object} Instance
 * @property {EntityLevel} level
 * @property {EntityId} entity
 * @property {Score} score
 * @property {Time} time
 * @property {Array<Instance>} provenance
 * @property {string|undefined} tag
 *
 * @typedef {Object<UserId, Array<Instance>>} UserAssessments
 * @typedef {Object<Tag, UserAssessments>} TaggedUserAssessments
 * @typedef {Object<UserId, Instance>} AggregateAssessments
 * @typedef {Object<Tag, AggregateAssessments>} ReducedAssessments
 *
 */

/* eslint-disable guard-for-in, no-multi-spaces */

'use strict';


// MODULES //

const isPositiveNumber  = require( '@stdlib/assert/is-positive-number' );
const isString          = require( '@stdlib/assert/is-string' ).isPrimitive;
const isUndefinedOrNull = require( '@stdlib/assert/is-undefined-or-null' );
const isWhitespace      = require( '@stdlib/assert/is-whitespace' );

const merge             = require( '@stdlib/utils/merge' );
const mongoose          = require( 'mongoose' );
const objectKeys        = require( '@stdlib/utils/keys' );
const objectValues      = require( '@stdlib/utils/values' );

const Program           = require( './../models/program' );
const Namespace         = require( './../models/namespace' );
const Lesson            = require( './../models/lesson' );
const Assessment        = require( './../models/assessment' );

const ASSESSMENT_RULES  = require( './assessment_rules.json' );


// DATA //

const ObjectId = mongoose.Types.ObjectId;

/**
 * Tag used when no explicit tag is associated with a assessment.
 */
const DEFAULT_TAG = '_default_tag' || Symbol( '_default_tag' );

/**
 * Aggregation policy used to filter and combine assessment data.
 * This specifies:
 *   + A time filter for component-level scores
 *   + A multiples policy specifying how to handle multiple
 *         submissions for one component.
 *
 * @type {Object}
 * @property {Array<number>} timeFilter
 * @property {('last'|'first'|'max'|'pass-through')} multiples
 *
 */

const DEFAULT_POLICY = {
    timeFilter: [0, 10000 * 3.1536e+10],
    multiples: 'last'
};


// TAGS //

/**
 * Does tag represent a valid, non-default tag string?
 *
 * @param {string} tag - candidate tag string
 * @param {boolean} [allowWhitespace=false] - if true, returns true
 *     even if the tag string is all whitespace. This is used when
 *     special action is desired on a whitespace string while filtering
 *     out defaults and invalid tags.
 * @returns {boolean}
 *
 */
const isCustomTag = ( tag, allowWhitespace = false ) => isString( tag ) && (allowWhitespace || !isWhitespace( tag )) && tag !== DEFAULT_TAG;


// ENTITY LEVELS //

/**
 * Mapping from node level to matching schema and its field containing the children.
 *
 * If the schema field is missing, the child data are located
 * elsewhere, which is primarily used at the lesson level because
 * component data is stored in a separate table.
 */

const levelMapping = {
        program: {
                schema: Program,
                field: 'namespaces'
        },
        namespace: {
                schema: Namespace,
                field: 'lessons'
        },
        lesson: {
                schema: Lesson
        },
        component: {
                schema: Assessment
        }
};

/**
 * Returns the previous level in the hierarchy.
 *
 * @private
 * @param {EntityLevel} level - input level
 * @returns {EntityLevel|null} predecessor level
 */

 function predecessor( level ) {
        switch ( level ) {
                case 'lesson':
                        return 'component';
                case 'namespace':
                        return 'lesson';
                case 'program':
                        return 'namespace';
                case 'global':
                        return 'program';
                case 'component':
                default:
                        return null;
        }
}


// INSTANCES AND MISSING INSTANCES //

/**
 * Numeric value used for a missing score.
 *
 * @type {number}
 */
const MISSING_SCORE = -999;

/**
 * Returns a new instance with specified properties.
 * The tag is only included if truthy and not equal to DEFAULT_TAG.
 *
 * @param {EntityLevel} level
 * @param {EntityId} entity
 * @param {Score} score
 * @param {Time} time
 * @param {Array<Instance>|null} [provenance]
 * @param {string} [tag]
 *
 * @returns {Instance}
 */
function makeInstance( level, entity, score, time, provenance, tag ) {
    const children = provenance || (level === 'component' ? null : []);
    const instance = {
        level,
        entity,
        score,
        time,
        provenance: children,
        ...(tag && tag !== DEFAULT_TAG && {tag: tag })
    };
    return instance;
}

/**
 * Returns a new instance that represents a missing value at a node.
 * The tag is only included if truthy and not equal to DEFAULT_TAG.
 *
 * The returned value can be updated as needed, which makes this a
 * good initializer for an instance in a calculation or aggregation.
 *
 * @param {EntityLevel} level
 * @param {EntityId} entity
 * @param {string} [tag]
 *
 * @returns {Instance}
 */
function missingInstance( level, entity, tag ) {
    const instance = {
        level,
        entity,
        score: MISSING_SCORE,
        time: void 0,
        provenance: level === 'component' ? null : [],
        ...(tag && tag !== DEFAULT_TAG && {tag: tag })
    };
    return instance;
}

/**
 * Returns score associated with an instance.
 *
 * @param {Instance} instance
 * @returns {Score} the score component of instance.
 *
 */
const instanceScore = instance => instance.score;

/**
 * Is the instance equal to the unique MISSING instance?
 *
 * @param {Instance}
 * @returns {boolean}
 */
function isMissing( instance ) {
    return instance.score === MISSING_SCORE;
}

/**
 * Is the score of an instance a valid (non-missing) value?
 *
 * @param {Instance} instance
 * @returns {boolean}
 */
function isNotMissing( instance ) {
    return !isMissing( instance );
}

/**
 * Does this numeric score represent a missing value?
 *
 * @param {Score} score
 * @returns {boolean}
 */
function isMissingScore( score ) {
    return (score === MISSING_SCORE);
}

/**
 * Ensures that score does not represent a missing value, using zero instead.
 *
 * @param {Score} score
 * @returns {Score} the score with missing score replaced by zero.
 */
function imputeMissingScore( score ) {
    return (score === MISSING_SCORE) ? 0 : score;
}

/**
 * Reducing function that combines provenances of instances with same level and entity.
 * This is not meant to be applied at the component level, though it will do no harm.
 * Returns an updated base instance.
 *
 * @private
 * @param {Instance} base - a provenance
 * @param {Instance} sibling - a provenance with the same level and entity as base
 *
 * @returns {Instance} updated base instance with the sibling's provenance (children)
 *     appended to its own.
 *
 */

function joinProvenances( base, sibling ) {
    if ( !isUndefinedOrNull( sibling.provenance ) ) {
        if ( base.provenance ) {
            base.provenance = base.provenance.concat( sibling.provenance );
        } else {
            base.provenance = [ ...sibling.provenance ];
        }
    }
    return base;
}


// HELPER FUNCTIONS //

/** Returns first element of an array */
const first = a => a[0];

/** Simple debug output for easy search */
const debug = (msg, data) => {
    console.log(`>>> ${msg}: `, JSON.stringify( data, null, 2) );
};

/**
 * Reducing function for computing maximum time among instances.
 *
 * @param {Time} maxTime - accumulated maximum time
 * @param {Time} instance - an instance at the time to incorporate
 *
 * @returns {Time} the maximum of the two times, where an undefined
 *     time is always considered less than any defined time.
 */

const maxInstanceTime = (maxTime, instance) => {
    if( isUndefinedOrNull( maxTime ) ) {
        return instance.time;
    }
    return instance.time >= maxTime ? instance.time : maxTime;
};

/**
 * Attaches metadata to an object and returns the modified object.
 * The metadata is stored as a non-enumerable property on the object
 * with given key and value.
 *
 * @private
 * @param {Object} obj - a non-null object to which metadata is attached
 * @param {string} key - a string key by which the metadata is accessed
 * @param {any} value - the associated value to store
 *
 * @returns {Object} the given object with metadata attached.
 * The object is modified by this function.
 *
 */

function attachMetadata( obj, key, value ) {
   Object.defineProperty( obj, key, {
       value: value,
       writable: false,
       enumerable: false
   });
}

/**
 * Creates and returns a set of tags from a source and optional weight spec.
 *
 * The main use case is to determine all visible tags before some processing
 * so that all such tags can be handled/represented.
 *
 * @private
 * @param {Object} source - an object, typically an array, whose values
 *     contain the viable tags
 * @param {function} extractor - given an element of source, returns the
 *     corresponding tag string. If null is returned, this element is
 *     ignored; if an array is returned, all its elements are added
 *     to the tag set.
 * @param {Object<string,any>} initializer - an object whose keys
 *     are used to initialize the tag set; this is typically but not
 *     necessarily a map from tags to weights.
 * @param {boolean} addDefault - if truthy, add DEFAULT_TAG to the
 *     set regardless of whether it is in source or weights.
 *
 * @returns {Set} a set of tag strings.
 *
 */

function makeTagSet( source, extractor, initializer, addDefault ) {
    const tagSet = new Set( initializer ? objectKeys(initializer) : [] );
    for( const k in source ) {
        const tag = extractor(source[k]);
        if ( tag && Array.isArray( tag ) ) {
            tag.forEach( t => tagSet.add(t) );
        } else if ( tag ) {
            tagSet.add( tag );
        }
    }
    if ( addDefault ) {
        tagSet.add( DEFAULT_TAG );
    }
    return tagSet;
}


// AGGREGATION RULES //

// Rules take an array of instances and zero or more specified parameters
// and return an aggregate score for those instances. If there are no
// instanes (after handling missing values) then a marker for missing
// data is returned.

/**
 * Computes the average value for an array of value and time pairs.
 *
 * @private
 * @param {Array<Instance>} arr - array of assessment instances to summarize
 * @param {('score-missing-zero'|'score-missing-ignore')} missing - how to handle missing values (which have score -999);
 *     either 'score-missing-zero' (impute zero value) or 'score-missing-ignore' (drop from calculation).
 *
 * @returns {Score} average of the values (ignoring time)
 */

function average( arr, missing = 'score-missing-zero' ) {
    let scores;
    if ( missing === 'score-missing-ignore' ) {
        scores = arr.filter(isNotMissing).map(instanceScore);
    } else {
        scores = arr.map( x => imputeMissingScore(x.score) );
    }
    if ( scores.length === 0 ) {
        return MISSING_SCORE;
    }
    return scores.reduce( ( acc, x ) => acc + x, 0 ) / scores.length;
}

/**
 * Returns the average value for an array of value/time pairs, dropping the lowest score.
 * However, if there is only one score, that score is used as is.
 *
 * @private
 * @param {Array<Instance>} arr - array of assessment instances to summarize
 * @param {('score-missing-zero'|'score-missing-ignore')} missing - how to handle missing values (which have score -999);
 *     either 'score-missing-zero' (impute zero value) or 'score-missing-ignore' (drop from calculation).
 *
 * @returns {Score} average of the values (ignoring time) after dropping lowest score
 */

function averageDropLowest( arr, missing = 'score-missing-zero' ) {
    let scores;
    if ( missing === 'score-missing-ignore' ) {
        scores = arr.filter(isNotMissing).map(instanceScore);
    } else {
        scores = arr.map( x => imputeMissingScore(x.score) );
    }

    if ( scores.length === 0 ) {
        return MISSING_SCORE;
    }
    if ( scores.length === 1 ) {
        return scores[0];
    }

    const [ sum, min ] = scores.reduce( ( acc, x ) => {
        acc[0] = acc[0] + x;
        acc[1] = ( x < acc[1] ) ? x : acc[1];
        return acc;
    }, [ 0, Infinity ] );
    return ( sum - min ) / ( scores.length - 1 );
}

/**
 * Returns the average value for an array of value/time pairs, dropping the lowest N scores.
 * However, if there are N or fewer scores, returns the maximum of these.
 *
 * @private
 * @param {Array<Instance>} arr - array of assessment instances to summarize
 * @param {number} N - number of lowest scores to drop from the average,
 *     N is a non-negative integer.
 * @param {('score-missing-zero'|'score-missing-ignore')} missing - how to handle missing values (which have score -999);
 *     either 'score-missing-zero' (impute zero value) or 'score-missing-ignore' (drop from calculation).
 *
 * @returns {Score} average of the values (ignoring time) after dropping N lowest scores.
 *     If there are fewer than N scores available, return the largest of them.
 *     If there are no scores, returns 0.
 */

function averageDropNLowest(arr, N, missing = 'score-missing-zero') {
    let sorted;
    if ( missing === 'score-missing-ignore' ) {
        sorted = arr.filter(isNotMissing).map(instanceScore).sort( (a, b) => a - b );
    } else {
        sorted = arr.map( x => imputeMissingScore(x.score) ).sort( (a, b) => a - b );
    }

    if ( sorted.length === 0 ) {
        return MISSING_SCORE;
    }
    if (sorted.length <= N) {
        return sorted[arr.length - 1];
    }

    const neff = sorted.length - N;
    return sorted.slice(N).reduce((acc, x) => {
        acc = acc + x/neff;
        return acc;
    }, 0);
}

/**
 * Computes the proportion of trues among binary scores.
 * We take any score >= 50 as a 'true' and the rest as 'false', after accounting
 * for missing scores.
 *
 * @private
 * @param {Array<Instance>} arr - array of assessment instances to summarize
 * @param {('score-missing-zero'|'score-missing-ignore')} missing - how to handle missing values;
 *     either 'score-missing-zero' (impute zero value) or 'score-missing-ignore' (drop from calculation).
 *
 * @returns {Score} proportion of trues among scores.
 */

function binaryProportion( arr, missing = 'score-missing-zero' ) {
    const toBinary = x => x >= 50 ? 100 : 0;
    let scores;
    if ( missing === 'score-missing-ignore' ) {
        scores = arr.filter(isNotMissing).map( x => toBinary(x.score) );
    } else {
        scores = arr.map( x => toBinary(imputeMissingScore(x.score)) );
    }
    if ( scores.length === 0 ) {
        return MISSING_SCORE;
    }
    return scores.reduce( ( acc, x ) => acc + x, 0 ) / scores.length;
}

/**
 * Computes the average score, decaying scores recorded after a given deadline.
 *
 * If a score has time that is L minutes after deadline, the value used in the average is
 *
 *            score * 2^(-min( max(L,0), cap )/halving ),
 *
 * where halving is the halving time in minutes after the deadine, and cap
 * (default Infinity) is the maximum time difference used. L is calculated here
 * as (t - d)/60000, where t is the time of the score and d is the deadline,
 * both measured as unix times in milliseconds after epoch.
 *
 * Missing scores are ignored for this rule.
 *
 * A wide variety of decay schemes can be obtained with these parameters,
 * including exponential decay, power-law decay (1/halving = log_2 c),
 * and effective step decay (cap = 1).
 *
 * @private
 * @param {Array<Instance>} arr - array of assessment instances to summarize
 * @param {number} deadline - a unix time in milliseconds at which decay begins
 * @param {number} halving - number of minutes after deadline until score decays
 *     to half its value
 * @param {number} [cap=Infinity] - maximum number of minutes after deadline at
 *     which decay is applied
 *
 * @returns {Score} average of the decayed scores, ignoring missing values.
 */

function decayedAverage( arr, deadline, halving, cap = Infinity ) {
    const decay = ([score, time]) => {
        const late = (time - deadline)/60000;
        const exponent = Math.min( Math.max(late, 0), cap ) / halving;
        return score * Math.pow( 2, -exponent );
    };
    const instances = arr.filter(isNotMissing);

    if ( instances.length === 0 ) {
        return MISSING_SCORE;
    }
    return instances.reduce( ( acc, x ) => acc + decay(x), 0 ) / instances.length;
}

/**
 * Object mapping assessment rule names to rule calculation functions.
 *
 * Each calculation function takes an array of pairs (a value and a time, which
 * may be undefined) and zero or more optional parameters, and returns a
 * single numeric score in the range 0 to 100.
 *
 * A rule calculation function is required to return 0 if the input array is empty.
 *
 */

const assessmentRules = {
    'average': average,
    'dropLowest': averageDropLowest,
    'dropNLowest': averageDropNLowest,
    'binaryProportion': binaryProportion,
    'decayedAverage': decayedAverage
};


// NODE FILTERING AND SEARCHING //

/**
 * Fetches and returns ids for the children of a given entity node.
 *
 * @private
 * @param {EntityId} id - id of the entity node
 * @param {EntityLevel} level - the level of the node given by id, a key in levelMapping
 * @param {[Array<UserId>]} users - if supplied, an array of user ids; if missing,
 *     all are considered
 *
 * @returns Promise<Array<EntityId>> array of child node IDs as strings
 */

async function getChildrenIDs(id, level, users) {
        const mapping = levelMapping[level];
        let children;
        if ( mapping.field ) {
                // Query for the relevant nodes
                const parent = await mapping.schema.findById(id);
                children = parent[mapping.field];  // Array of ObjectIDs for the field
                children = children.map(x => x.toString());
        } else {
                // At the lesson level, we find all distinct components in the lesson:
                const query = { lesson: id };
                if ( users ) {
                        query.user = { $in: users };
                }
                children = await Assessment
                        .find(query, { component: 1 })
                        .distinct('component');
        }
        return children;
}

/**
 * Returns an array of an entity's child node ids that match a level and coverage criterion.
 *
 * @private
 * @param {EntityId} id - id of the node
 * @param {EntityLevel} level - the level of the node given by id
 * @param {Array<string>} coverage - an array with the first element is the type
 *     (`all`,`include`, or `exclude`) and any remaining elements are id strings
 * @param {Array<UserId>} users - user ids to consider for this calculation (if
 *     not provided, all users are considered)
 * @returns {Promise<Array<EntityId>>} array of relevant node IDs
 */

async function relevantChildNodes( id, level, coverage, users ) {
    const children = await getChildrenIDs(id, level, users);
    let out = [];
    if ( coverage[ 0 ] === 'all' ) {
        out = children;
    } else if ( coverage[ 0 ] === 'include' ) {
       const childrenSet = new Set( children );
       for ( let i = 1; i < coverage.length; i++ ) {
           if ( childrenSet.has( coverage[ i ] ) ) {
               out.push( coverage[ i ] );
           }
       }
    } else if ( coverage[ 0 ] === 'exclude' ) {
        const coverageSet = new Set( coverage.slice( 1 ) );
        for ( let i = 0; i < children.length; i++ ) {
            if ( !coverageSet.has( children[ i ] ) ) {
                out.push( children[ i ] );
            }
        }
    }
    if ( level === 'lesson' ) {
        attachMetadata( out, '_lessonId', id );
    }
    debug( `Relevant nodes with id ${id}`, out );
    return out;
}

/**
 * Query the Assessment database table, sorting results by time.
 * Returns matching full documents (i.e., without projection) in specified order.
 *
 * @private
 * @param {Object} query - a mongoose query
 * @param {string} [order='ascending'] - sort order on the 'time' field
 *
 * @returns Promise<Array<Object>> array of full Assessment documents matching
 *     query and sorted by recorded time.
 */

async function getMatchingAssessments( query, order = 'ascending' ) {
    return await Assessment.find( query ).sort({ 'time': order });
}

/**
 * For a set of branch nodes, returns associated assessment metrics and tags.
 *
 * @private
 * @param {Object} schema - a mongoose model for a branch level in the entity hierarchy
 * @param {Array<EntityId>} nodes - node ids to search
 *
 * @returns Promise<Array<Object>> resolves to array of documents with _id (node id),
 *     assessments (array of metrics), and tag keys associated with the specified nodes.
 */

async function getBranchMetricsAndTags( schema, nodes ) {
    return await schema.find({ _id: { $in: nodes } }, { assessments: 1, tag: 1 });
}


// ASSESSMENT POLICIES //

/**
 * Constructs a assessment aggregation policy object with specified options.
 *
 * @param {Object|null} [policyOptions] - an object whose keys form a subset of
 *       allowed policies. If missing, the default policy is used; see descriptions below.
 *   @param {Object} [policyOptions.timeFilter=[0,3.1536e+14]] - range of times in which
 *       instances are accepted as valid Times are measured in milliseconds since 1970.
 *   @param {Object} [policyOptions.multiples='last'] - how to handle multiple instances
 *       for the same component, user, and tag. Possible values are 'last', 'first', 'max',
 *       and 'pass-through'. In the latter case, all instances are passed to the rule
 *       specified in the assessment metric. In the other cases, only the instance with
 *       last/first/max value is.
 *   @param {Object} [policyOptions.tagWeights=void 0] - if defined, a map of strings
 *       representing tags by which assessment values are aggregated to non-negative weights.
 *       If empty, all extant tags are equally weighted. If no tags are defined in the
 *       assessment data, DEFAULT_TAG is used.
 * @returns {Object} a assessment aggregation policy object with unspecified options
 *       filled in with their defaults.
 */

const makeAssessmentPolicy = (policyOptions, metric) => {
    const policy = merge({}, DEFAULT_POLICY, (policyOptions || {}));
    if ( metric ) {
        if ( metric?.tagWeights ) {
            policy.tagWeights = { ...metric.tagWeights }; // Used to propagate tag weights at component level
        }
        if ( metric?.timeFilter ) {
            // ATTN:TODO combine time filters more flexibly and carefully
            policy.timeFilter[0] = Math.max( policy.timeFilter[0], metric.timeFilter[0] );
            policy.timeFilter[1] = Math.min( policy.timeFilter[1], metric.timeFilter[1] );
            if ( policy?.timeFilter ) {
                policy.timeFilter[ 0 ] = Math.max( metric.timeFilter[ 0 ], policy.timeFilter[ 0 ] );
                policy.timeFilter[ 1 ] = Math.min( metric.timeFilter[ 1 ], policy.timeFilter[ 1 ] );
            } else {
                policy.timeFilter = [ ...metric.timeFilter ];
            }
        }
        if ( metric?.multiples ) {
            policy.multiples = metric.multiples;
        }
    }
    return policy;
};


// PRINCIPAL CALCULATION METHODS //
//
// Starting at any level of the entity tree, we do a depth-first
// traversal of the entity tree accumulating subtree calculations
// (and their provenance) until a final reduction to a score at the
// chosen level.

/**
 * Returns an array of userAssessments objects, aggregating assessments in a subtree.
 *
 * The same user id may appear as a key in multiple elements of the returned array
 * as they represent results from different subtrees. The set of tags in each
 * object is determined by the metric.tagWeights (captured in policy) and by
 * the tags associated with the child entities.
 *
 * @private
 * @param {Metric} metric - assessment metric
 * @param {Array<EntityId>} nodes - array of node ids
 * @param {EntityLevel} level - the level of the nodes
 * @param {Array<string>} users - an array of user ids
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *    (@see {@link makeAssessmentPolicy}).
 *
 * @returns {Promise<Array<TaggedUserAssessments>>} resolves userTagAssessments
 *     computed at the given nodes. There is at most one userTagAssessments
 *     object per node, where a node is excluded if it does not have a matching
 *     metric. The tags are determined from the child entities at this level.
 *
 */

async function getBranchData(metric, nodes, level, users, policyOptions) {
    if ( level === 'component' ) {
        // Return promise with the assessment data for all the components in the lesson:
        const policy = makeAssessmentPolicy( policyOptions, metric );
        return getComponentData(metric.ref, nodes, null, users, policy);
    }
    // The next lower level is a namespace or lesson
    // Collect assessment metrics that match the specified ref (or first available if ref null)
    const { schema } = levelMapping[level];
    nodes = nodes.map(x => new ObjectId(x));
    const metricsAndTags = await getBranchMetricsAndTags( schema, nodes );
    if ( metricsAndTags.length === 0 ) {
        return [];  // No data at all so we ignore these nodes
    }

    const submetric = metric.ref;  // ATTN:TODO eventual name change .ref => .submetric
    const [submetrics, tags] = metricsAndTags.reduce((acc, x) => {
        const chosenMetric = submetric ? x.assessments.filter(x => x.name === submetric) : x.assessments;
        if ( chosenMetric.length === 0 ) {
            return acc;
        }
        acc[0][x._id] = chosenMetric[0];
        acc[1][x._id] = x.tag || DEFAULT_TAG;
        return acc;
    }, [ {}, {} ]);
    if ( objectKeys(submetrics).length === 0 ) {
        return [];  // No data at all so we ignore these nodes
    }
    // For all nodes with a matching assessment, we compute the assessments at that subtree
    // Each subtree has an associated tag (or DEFAULT_TAG) if none.
    const children = await Promise.all(nodes
                                       .filter(id => submetrics[id])
                                       .map(node => Promise.all([
                                           Promise.resolve(tags[node]),
                                           computeAssessments(String(node), submetrics[node], users, policyOptions) // Note: Can accept ObjectId, using String to match expected type
                                       ])) );
    const branchData = [];
    const tagSet = makeTagSet( children, first, metric.tagWeights );

    // Distribute child aggregate instances into proper TaggedUserAssessments shape
    for ( let i = 0; i < children.length; ++i ) {
        const thisBranch = {};
        for( const tag of tagSet ) {
            thisBranch[ tag ] = {};
            for ( const user of users ) {
                thisBranch[ tag ][ user ] = [];
            }
        }
        const tag = children[i][0];
        const data = children[ i ][ 1 ];
        for ( const user in data ) {
            const instance = data[ user ];
            if ( tag && tag !== DEFAULT_TAG ) {
                instance.tag = tag;
            }
            thisBranch[ tag ][ user ] = [ instance ];
        }
        branchData.push( thisBranch );
    }
    return branchData;
}

/**
 * Returns an array of userAssessments objects at the component level.
 *
 * @private
 * @param {string} metricName - name of assessment metric at the component level
 * @param {Array<EntityId>} nodes - array of component ids (with non-enumerable
 *     `_lessonId` property showing the lesson the components belongs to)
 * @param {null} level - level of the nodes (not used for component level)
 * @param {Array<string>} users - array of user ids
 * @param {Object} policy - a assessment aggregation policy object, assumed
 *     to have been merged into DEFAULT_POLICY so that all fields are
 *     available (@see {@link makeAssessmentPolicy}).
 *
 * @returns {Promise<Array<TaggedUserAssessments>>} recorded assessment instances
 *     for components in the containing lesson, arranged by tag and user.
 *     Each component is represented by at most one element of the array.
 *
 */

async function getComponentData( metricName, nodes, _, users, policy ) {
    if ( !metricName ) {
        throw new Error( 'No assessment metric specified.' );
    }
    const lessonID = new ObjectId( nodes._lessonId );
    // Get the component assessment instances from the database,
    // filtering according to the policy's time filter.
    const query = {
        lesson: lessonID,
        component: { $in: nodes },
        user: { $in: users },
        time: { $gte: policy.timeFilter[0], $lte: policy.timeFilter[1] },
        metricName: metricName
    };
    debug( 'Query: ', query );

    const timeOrder = policy.multiples === 'first' ? 'descending' : 'ascending';
    const records = await getMatchingAssessments( query, timeOrder );
    debug( 'Assessment Instances', records );
    if ( records.length === 0 ) {
        return [];  // No data at all so we ignore these nodes
    }

    // Pre-populate an object for each node so that all users and tags are represented.
    // Tags are relevant if they are included in the tagWeights or if any user has
    // a recorded value for a tag. So, it is possible that some tags are missing
    // for *these* users if there are no tag weights and values are recorded for
    // a tag only by other users. We populate the DEFAULT_TAG if no others are defined.
    //
    // Note: We accept an extra pass through records here for simplicity.
    // Note also: policy.tagWeights is that inherited from lesson metric
    const tagSet = makeTagSet( records, r => r.tag, policy.tagWeights, true );
    const nodeTags = {};
    const nodeAssessments = {};
    for ( const component of nodes ) {
        nodeTags[ component ] = {};  // Track tags recorded for this component with counts
        nodeAssessments[ component ] = {};  // map tags -> UserAssessments object
        // Ensure all visible tags and users are represented
        for ( const tag of tagSet ) {
            const valueByUser = {};
            for ( const user of users ) {
                valueByUser[ user ] = [];
            }
            nodeAssessments[ component ][ tag ] = valueByUser;
        }
    }

    // Record the scores etc. in the appropriate sub-objects
    const level = 'component';
    if ( policy.multiples === 'last' || policy.multiples === 'first' ) {
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, score, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            const instance = makeInstance( level, component, score, time, null, xtag );
            nodeAssessments[ component ][ xtag ][ user ] = [ instance ];
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    } else if ( policy.multiples === 'max' ) {
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, score, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            const assessment = nodeAssessments[ component ][ xtag ][ user ];
            if ( assessment.length === 0 || assessment[0].score < score ) {
                const instance = makeInstance( level, component, score, time, null, xtag );
                nodeAssessments[ component ][ xtag ][ user ] = [ instance ];
            }
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    } else { // pass-through: all records are passed through to the rule
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, score, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            const instance = makeInstance( level, component, score, time, null, xtag );
            nodeAssessments[ component ][ xtag ][ user ].push( instance );
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    }

    // Ensure that missing components for a user are marked MISSING
    // The MISSING marker is added to the most representative tag, or
    // DEFAULT_TAG if none are recorded.
    for ( const component of nodes ) {
        // Find the most representative tag if more than one, DEFAULT_TAG if none
        const myTagCounts = nodeTags[ component ];
        const myTags = objectKeys(myTagCounts);   // Tags with at least one datum recorded
        let myTag = DEFAULT_TAG;
        if ( myTags.length === 1 ) {
            myTag = myTags[0];
        } else if ( myTags.length > 1 ) {
            myTag = myTags.reduce((a, b) => myTagCounts[a] > myTagCounts[b] ? a : b);
        }

        // Now fill in any missing component scores for all the users
        for ( const user of users ) {
            if ( myTags.every( tag => nodeAssessments[ component ][ tag ][ user ].length === 0 ) ) {
                nodeAssessments[ component ][ myTag ][ user ].push( missingInstance( level, component, myTag ) );
            }
        }
    }
    return nodes.map( x => nodeAssessments[ x ] );
}

/**
 * Joins a collection of TaggedUserAssessments objects into one, so that
 * every user and tag appears only once.
 *
 * If there is no data for a particular tag and user, the resulting
 * array is empty; such values will be treated as missing in
 * downstream calculations.
 *
 * @private
 * @param {Array<TaggedUserAssessments>} nodeAssessments
 * @param {Array<UserId>} users - all user ids for this calculation
 * @param {Object<string,number>} [tagWeights] - a map from tags to their
 *     weights; used here only to construct a set of possible tags.
 * @returns {TaggedUserAssessments} a userAssessments object that joins all the given
 *     userAssessments. All visible tags and users are included in the result.
 *
 */

function groupAssessments( nodeAssessments, users, tagWeights ) {
    const taggedAssessments = {};
    const tagSet = makeTagSet( nodeAssessments, c => objectKeys(c), tagWeights );

    for ( let i = 0; i < nodeAssessments.length; i++ ) {
        const byTag = nodeAssessments[ i ];
        for ( const tag of tagSet ) {
            if ( !taggedAssessments[ tag ] ) {
                taggedAssessments[ tag ] = {};
                for ( const user of users ) {
                    taggedAssessments[ tag ][ user ] = [];
                }
            }
            const byUser = byTag[ tag ];
            if ( byUser ) {
                for ( const user in byUser ) {
                    taggedAssessments[ tag ][ user ] = taggedAssessments[ tag ][ user ].concat( byUser[user] );
                }
            }
        }
    }
    return taggedAssessments;
}

/**
 * Transforms a userAssessments object to a single instance for each user and tag.
 * Returns an object mapping users ids to tags to scores for the given metric.
 *
 * This uses the rule function associated with the metric to compute
 * a score for each user and tag that is a function of values and
 * times of assessment instances.
 *
 * The rule function takes an array of instances along with any additional
 * parameters defined in the metric. The result of the rule function is always a
 * score, that is a number between 0 and 100 or a missing value -999.
 * The rule function also satisfies the contract that an empty input array,
 * after handling missing data, produces a missing value.
 *
 * @private
 * @param {TaggedUserAssessments} taggedAssessments - assessment data
 *     by tag and user; assumed to include all relevant users and tags.
 * @param {EntityId} entity - the entity id whose assessments these represent
 * @param {Metric} metric - assessment metric object
 *
 * @returns {ReducedAssessments} aggregate instance for each tag and user pair,
 *     for the given metric. The score is determined by the metric rule,
 *     the time is the maximum defined time in the input, and
 *     the provenance encapsulates the provenances of the inputs
 *     as subtrees. If all input data is missing for a tag, the instance
 *     is a special MISSING marker; otherwise, missing data is handled
 *     by parameters of the rule function.
 */

function reduceAssessments( taggedAssessments, entity, metric ) {
    const ruleFn = assessmentRules[ metric.rule[ 0 ] || 'average' ];
    const assessments = {};

    for ( const tag in taggedAssessments ) {
        assessments[tag] = {};
        const byUser = taggedAssessments[tag];

        for( const user in byUser ) {
            const instances = byUser[ user ];
            const score = ruleFn( instances, ...metric.rule.slice( 1 ) );
            const time = instances.reduce( maxInstanceTime, void 0);
            const reduced = (score === MISSING_SCORE)
                  ? missingInstance( metric.level, entity, tag )
                  : makeInstance( metric.level, entity, score, time, instances, tag );
            assessments[ tag ][ user ] = reduced;
        }
    }
    return assessments;
}

/**
 * Computes weighted average of assessments across tags by user.
 * Returns an object mapping each user id to an aggregate instance.
 *
 * @private
 * @param {ReducedAssessments} reduced - assessments aggregated across
 *     instances for each tag and user.
 * @param {EntityLevel} level - the level of the target node
 * @param {EntityId} entity - the entity id whose assessments these represent
 * @param {Array<UserId>} users - all user ids for this calculation
 * @param {Object<string,number>} [tagWeights] - a map from tags to their
 *     weights; used here only to construct a set of possible tags.
 *
 * @returns {AggregateAssessments} final results from the calculation
 *     at a given node. Each aggregate instance includes a tag weighted
 *     score, the maximal time in the subtree, and the provenance data
 *     for all subtree calculations.
 *
 */

function weightAssessments( reduced, level, entity, users, tagWeights ) {
    // If no weights > 0, all extant tags weighted equally, including DEFAULT_TAG.
    // Otherwise, tags not in tagWeights are weighted like DEFAULT_TAG (or 0 if none).
    const haveWeights = tagWeights && objectValues(tagWeights).some(isPositiveNumber);
    const defaultWeight = haveWeights ? (tagWeights[DEFAULT_TAG] ?? 0) : 1;

    const computed = {};
    for ( const userId of users ) {
        let total = 0;
        let weightTotal = 0;
        let maxTime = void 0;
        let aggregateInstance = missingInstance( level, entity );
        for ( const tag in reduced ) {
            const weight = tagWeights?.[ tag ] ?? defaultWeight;
            const instance = reduced[ tag ]?.[ userId ];
            if ( !isUndefinedOrNull( instance ) ) {
                if ( isNotMissing( instance ) ) {    // Missing parts imputed to zero  ATTN:?TODO prorate as a policy choice?
                    total += instance.score * weight;
                }
                maxTime = maxInstanceTime( maxTime, instance );
                aggregateInstance = joinProvenances( aggregateInstance, instance );
            }
            weightTotal += weight;
        }
        const avgScore = ( weightTotal > 0 ) ? total / weightTotal : MISSING_SCORE;
        aggregateInstance.score = avgScore;
        aggregateInstance.time = maxTime;
        computed[ userId ] = aggregateInstance;
    }
    return computed;
}

/**
 * Gathers assessment data for an entity with a given metric and set of users.
 *
 * @private
 * @param {EntityId} id - entity id of the node for which to gather and compute assessment data
 * @param {Metric} metric - assessment metric
 * @param {Array<string>} users - all user ids for this calculation
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *    (@see {@link makeAssessmentPolicy}).
 * @returns {Promise<TaggedUserAssessments>} for each tag and user, collects computed
 *     assessments for all subtrees rooted at children of this entity node. The
 *     tags comprise the collection of tags associated with the child nodes and the
 *     weights of their submetrics. All visiible tags are represented, even with
 *     an empty array if there are no associated assessments.
 *
 * Note that time filtering specified by the policy happens at the leaf ('component') level
 * only, whereas tag weighting happens at each level according to the metric.
 *
 */

async function gatherAssessments( id, metric, users, policyOptions ) {
    if ( isUndefinedOrNull( metric ) ) {
        throw new Error( `No metric defined for node ${id}.` );
    }
    if ( metric.level === 'component' ) {
        // This should not ever happen
        throw new Error( `Cannot gatherAssessments at component level, ${id}.` );
    }
    const nodes = await relevantChildNodes( id, metric.level, metric.coverage, users );
    const nodeAssessments = await getBranchData( metric, nodes, predecessor( metric.level ), users, policyOptions );
    debug( `Branch data from relevant children for ${metric.level} ${id}`, nodeAssessments );
    let taggedAssessments = {};
    if ( nodeAssessments.length > 0 ) {
        taggedAssessments = groupAssessments( nodeAssessments, users, metric.tagWeights );
    } else {
        // No assessment data for the given metric and users
        taggedAssessments[ DEFAULT_TAG ] = {};
        const byUser = taggedAssessments[ DEFAULT_TAG ];
        for ( let i = 0; i < users.length; i++ ) {
            byUser[ users[ i ] ] =  [];  // No data at all so we ignore these nodes
        }
    }
    debug( `Assessments by users in gather assessments at ${metric.level}`, taggedAssessments );
    return taggedAssessments;
}

/**
 * Computes final assessment data for a given metric and a set of users.
 * This assumes that the metric level is 'lesson' or higher.
 *
 * @param {EntityId|ObjectId} id - id of the node for which to gather and compute assessment data
 * @param {Metric} metric - assessment metric, at level 'lesson' or higher.
 * @param {Array<UserId>} users - array of user ids
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *
 * @returns {Promise<AggregateAssessments>} computed and tag weighted assessments for
 *     the subtree rooted at this node for the requested set of users.
 *
 *     This contains for each an instance {level, entity, score, time,
 *     provenance, tag} that aggregates the assessment data at the subtree
 *     rooted at `id`. The score is determined by the metric rule; the time is
 *     the maximum time over the subtree, and the provenance gives a tree of all
 *     the data that went into this calculation.
 *
 */

async function computeAssessments( id, metric, users, policyOptions ) {
    const assessments = await gatherAssessments( id, metric, users, policyOptions );
    const reduced = reduceAssessments( assessments, id, metric );
    const aggregate = weightAssessments( reduced, metric.level, id, users, metric.tagWeights );

    debug( `computeAssessments gathered  at ${metric.level} ${id}`, assessments );
    debug( `computeAssessments reduced   at ${metric.level} ${id}`, reduced );
    debug( `computeAssessments aggregate at ${metric.level} ${id}`, aggregate );

    return aggregate;
}


// EXPORTS //

module.exports = {
    computeAssessments,    // Public entry point
    isCustomTag,           // Check for tags that are stored in the database
    isMissingScore,        // Check if a assessment score represents a missing
    ASSESSMENT_RULES,      // Map of rule names to rule specifications
    makeAssessmentPolicy,
    DEFAULT_TAG,
    MISSING_SCORE,
    levelMapping,
    relevantChildNodes,
    gatherAssessments,
    reduceAssessments,
    weightAssessments,
    groupAssessments,
    getBranchData,
    getComponentData
};
