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
* The public entry point for computing completion results at every level is @see
* {@link computeCompletions}. A convenience function for defining completion
* policies is @see {@link makeCompletionPolicy}.
*
*/

/* eslint-disable guard-for-in, no-multi-spaces */

'use strict';

// MODULES //

const isNull            = require( '@stdlib/assert/is-null' );
const isUndefinedOrNull = require( '@stdlib/assert/is-undefined-or-null' );
const merge             = require( '@stdlib/utils/merge' );
const mongoose          = require( 'mongoose' );
const objectKeys        = require( '@stdlib/utils/keys' );

const Program           = require( './../models/program' );
const Namespace         = require( './../models/namespace' );
const Lesson            = require( './../models/lesson' );
const Completion        = require( './../models/completion' );


// VARIABLES //

const ObjectId = mongoose.Types.ObjectId;

/**
 * Tag used when no explicit tag is associated with a completion.
 */
const DEFAULT_TAG = '_default_tag' || Symbol( '_default_tag' );

/**
 * Aggregation policy used to filter and combine completion data.
 *
 * ATTN:DOC
 */
const DEFAULT_POLICY = {
    timeFilter: [0, 10000 * 3.1536e+10],
    tagWeights: void 0,
    multiples: 'last'
};

/**
 * Mapping from a given node level to the corresponding schema and the field in the schema that contains the children.
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
                schema: Completion
        }
};


// FUNCTIONS //

/**
 * Returns the previous level in the hierarchy.
 *
 * @private
 * @param {string} level - input level
 * @returns {string} predecessor level
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

/**
* Computes the average value for an array of value and time pairs.
*
* @private
* @param {Array} arr - array of value and time pairs
* @returns {number} average of the values (ignoring time)
*/
function average( arr ) {
        if ( arr.length === 0 ) {
                return 0;
        }
        return arr.reduce( ( acc, x ) => acc + x[ 0 ], 0 ) / arr.length;
}

/**
* Returns the average value for an array of value and time pairs while dropping the lowest score.
*
* @private
* @param {Array} arr - array of value and time pairs
* @returns {number} average of the values (ignoring time) after dropping lowest score
*/
function averageDropLowest( arr ) {
        if ( arr.length === 0 ) {
                return 0;
        }
        if ( arr.length === 1 ) {
                return arr[ 0 ][ 0 ];
        }
        const [ sum, min ] = arr.reduce( ( acc, x ) => {
                acc[ 0 ] = acc[ 0 ] + x[ 0 ];
                acc[ 1 ] = ( x[ 0 ] < acc[ 1 ] ) ? x[ 0 ] : acc[ 1 ];
                return acc;
        }, [ 0, Infinity ] );
        return ( sum - min ) / ( arr.length - 1 );
}

/**
 * Object different completion rule functions which all take an array of pairs (value and time) and return a single number.
 *
 * ## Notes
 *
 * -   If the array is empty, the functions have to return `0`.
 * -   The functions can have additional parameters aside from the array of pairs which are passed down from the metric
 */
const completionRules = {
        'average': average,
        'avg': average,
        'averageDropLowest': averageDropLowest,
        'avgDropLowest': averageDropLowest
};

/**
 * Returns an array of node id's for those that match the coverage criteria and the level.
 *
 * @private
 * @param {string} id - id of the node
 * @param {string} level - the level of the node given by id
 * @param {Array<string>} coverage - an array with the first element is the type (`all`,`include`, or `exclude`) and any remaining elements are id strings
 * @param {Array<string>} users - an array of user ids (if not provided, all users are considered)
 * @returns {Promise<Array<string>>} array of relevant node IDs
 */
async function relevantNodes( id, level, coverage, users ) {
        const mapping = levelMapping[ level ];
        let children;
        if ( mapping.field ) {
                // Query for the relevant nodes
                const parent = await mapping.schema.findById( id );
                children = parent[ mapping.field ];
                children = children.map( x => x.toString() );
        } else {
                // At the lesson level, we find all distinct components in the lesson:
                const query = { lesson: id };
                if ( users ) {
                        query.user = { $in: users };
                }
                children = await Completion
                        .find( query, { component: 1 } )
                        .distinct( 'component' );
        }
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
        if ( !mapping.field ) {
                console.log( 'Setting metadata with lesson id:', id );
                Object.defineProperty( out, '_lessonId', {
                        value: id,
                        writable: false,
                        enumerable: false
                });
        }
        console.log( 'Relevant nodes:', JSON.stringify( out, null, 2 ) );  // ATTN:DEBUG
        return out;
}


/**
 * Returns an array of objects, with each each object mapping user ids to completion data.
 *
 * @private
 * @param {Object} metric - completion metric
 * @param {Array<string>} nodes - array of node ids
 * @param {string} level - the level of the nodes
 * @param {Array<string>} users - an array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed to have been merged into
 *     DEFAULT_POLICY so that all fields are available (@see {@link makeCompletionPolicy}).
 * @returns {Promise} resolves to an array of objects, each mapping user ids to completion
 *     data (i.e., arrays of value-time pairs). Specifically, the returned array has the form:
 *         [
 *             {
 *                 [userId]: {
 *                     [tag]: [[<0-100>, <time|void 0>], ...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *             ...
 *         ]
 */
async function getBranchData(metric, nodes, level, users, policy = DEFAULT_POLICY) {
    const { schema } = levelMapping[level]; // TODO: handle component level
    if ( level === 'component' ) {
        // Return promise with the completion data for all the components in the lesson:
        return getLeafData(metric.ref, nodes, null, users, policy);
    }
    // The lower level is a namespace or lesson
    nodes = nodes.map(x => new ObjectId(x));
    const completionData = await schema.find({ _id: { $in: nodes } }, { completion: 1 });
    if ( completionData.length === 0 ) {
        return [];
    }

    const ref = metric.ref;
    const completions = completionData.reduce((acc, x) => {
        if ( isNull(acc) || isNull(x) ) {
            return acc;
        }
        const chosenMetric = ref ? x.completion.filter(x => x.name === ref) : x.completion;
        if ( chosenMetric.length === 0 ) {
            return null;
        }
        acc[x._id] = chosenMetric[0];
        return acc;
    }, {});
    if ( !completions || objectKeys(completions).length === 0 ) {
        throw new Error(`No completion data found for the metric with name ${ref} at level ${level}.`);
    }

    return Promise.all(nodes.map(node => gatherCompletions(node, completions[node], users, policy)));
}

/**
 * Returns an array of objects, with each each object mapping user ids to tags to completion data.
 * Each completion data instance is a pair of a value (number from 0-100) and a time (possibly undefined).
 * Only instances that are within the policy's time window are kept and returned.
 *
 * @private
 * @param {string} ref - name of completion metric at the component level
 * @param {Array<string>} nodes - array of component ids (with non-enumerable `_lessonId` property showing
 *     the lesson the components belongs to)
 * @param {null} level - level of the nodes (not used for component level)
 * @param {Array<string>} users - array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed to have been merged into
 *     DEFAULT_POLICY so that all fields are available (@see {@link makeCompletionPolicy}).
 *
 * @returns {Promise<[Object]>} resolves to an array of objects, each mapping user ids to tags to completion
 *     data (i.e., arrays of value-time pairs). Specifically, the returned array has the form:
 *         [
 *             {
 *                 [userId]: {
 *                     [tag]: [[<0-100>, <time|void 0>], ...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *             ...
 *         ]
 */
async function getLeafData( ref, nodes, level, users, policy ) {
    const lessonID = nodes._lessonId;
    if ( !ref ) {
            throw new Error( 'No completion metric specified.' );
        }

    // Get the component completion instances from the database,
    // filtering according to the policy's time filter.
    const query = {
            lesson: lessonID,
            component: { $in: nodes },
            user: { $in: users },
            time: { $gte: policy.timeFilter[0], $lte: policy.timeFilter[1] },
            completion: ref
    };
    console.log( 'Query: ', query ); // ATTN:DEBUG
    if ( !await Completion.exists({ completion: ref }) ) {
        throw new Error( `Metric with name ${ref} at level ${level} is not defined.` );
    }
    const instances = await Completion
          .find( query )
          .sort({ 'time': policy.multiples === 'last' ? 'ascending' : 'descending' });
    console.log( 'Completion Instances: ', JSON.stringify( instances, null, 2 ) ); // ATTN:DEBUG

    // Pre-populate an object for each node so that all users and tags are represented.
    // Tags are relevant if they are included in the tagWeights or if any user has
    // a recorded value for a tag. So, it is possible that some tags are missing
    // for *these* users if there are no tag weights and values are recorded for
    // a tag only by other users. We populate the DEFAULT_TAG if no others are defined.
    //
    // Note: We accept an extra pass through completions here for simplicity.
    const tagSet = new Set( policy.tagWeights ? Object.keys( policy.tagWeights ) : [] );
    instances.forEach( comp => {
        if ( comp.tag ) {
            tagSet.add(comp.tag);
        }
    });
    const nodeCompletions = {};
    for ( const component of nodes ) {
        nodeCompletions[ component ] = {};
        for ( const user of users ) {
            const valueByTags = {};
            for ( const tag of tagSet ) {
                valueByTags[ tag ] = [];
            }
            valueByTags[ DEFAULT_TAG ] = [];
            nodeCompletions[ component ][ user ] = valueByTags;
        }
    }

    // Record the values in the appropriate sub-objects, but if
    // there are multiples to pass through, add extra objects.
    if ( policy.multiples === 'last' || policy.multiples === 'first' ) {
        for ( let i = 0; i < instances.length; i++ ) {
            const {component, user, value, time, tag} = instances[ i ];
            const xtag = tag || DEFAULT_TAG;
            nodeCompletions[ component ][ user ][ xtag ] = [ [value, time] ];
        }
    } else if ( policy.multiples === 'max' ) {
        for ( let i = 0; i < instances.length; i++ ) {
            const {component, user, value, time, tag} = instances[ i ];
            const xtag = tag || DEFAULT_TAG;
            const completion = nodeCompletions[ component ][ user ][ xtag ];
            if ( completion.length === 0 || completion[0][0] < value ) {
                completion = [ [value, time ] ];
            }
        }
    } else { // pass-through: all instances are passed through to the rule
        for ( let i = 0; i < instances.length; i++ ) {
            const {component, user, value, time, tag} = instances[ i ];
            const xtag = tag || DEFAULT_TAG;
            nodeCompletions[ component ][ user ][ xtag ].push( [value, time] );
        }
    }
    return nodes.map( x => nodeCompletions[ x ] );
}

/**
 * Groups completion data into a single object mapping user ids to tags to arrays of value-time pairs.
 *
 * This takes an array of objects, each object mapping user ids to tags to
 * completion data (a value-time pair). Users can be repeated across different
 * elements of the array. If there is no data for a particular tag and user, the
 * resulting array is empty; such values will be imputed to be [0, void 0] if
 * needed in any downstream calculations.
 *
 * @private
 * @param {Array} nodeCompletions - array of objects mapping user ids to completion data
 *     (i.e., array of value-time pairs). Specifically, this parameter has shape:
 *         [
 *             {
 *                 [userId]: {
 *                     [tag]: [[<0-100>, <time|void 0>], ...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *             ...
 *         ]
 *     (@see {@link getBranchData})
 *
 * @param {Object} policy - a completion aggregation policy object, assumed to have been merged into
 *     DEFAULT_POLICY so that all fields are available (@see {@link makeCompletionPolicy}).
 * @returns {Object} object mapping user ids to tags to an array of two-element arrays of completion
 *     values and time. Specifically, the returned object looks like:
 *         {
 *             [userId]: {
 *                 [tag]: [ [<0-100>, <time|void 0>], ... ],
 *                 ...
 *             },
 *             ...
 *         }
 */
function groupCompletions( nodeCompletions, policy ) {
    const byUsers = {};
    const tagSet = new Set( policy.tagWeights ? Object.keys( policy.tagWeights ) : [] );
    for ( let i = 0; i < nodeCompletions.length; i++ ) {
        const userCompletions = nodeCompletions[ i ];
        const userKeys = objectKeys( userCompletions );
        for ( let j = 0; j < userKeys.length; j++ ) {
            const userId = userKeys[ j ];
            const userCompletion = userCompletions[ userId ];
            const tagKeys = objectKeys( userCompletion );
            tagKeys.forEach( tag => tagSet.add(tag) );
            if ( !byUsers[ userId ] ) {
                byUsers[ userId ] = {};
            }

            for ( const tag of tagKeys ) {
                if ( !byUsers[ userId ][ tag ] ) {
                    byUsers[ userId ][ tag ] = [...userCompletion[tag]];
                } else {
                    byUsers[ userId ][ tag ] = byUsers[ userId ][ tag ].concat( userCompletion[tag] );
                }
            }
        }
    }
    // Ensure all tags are represented for each user
    for ( let user in byUsers ) {
        for ( let tag of tagSet ) {
            if ( byUsers[ user ][ tag ] === void 0 ) {
                byUsers[ user ][ tag ] = [];
            }
        }
    }
    return byUsers;
}

/**
 * Returns an object mapping users ids to tags to aggregate completion value for the given metric.
 *
 * This uses the rule function associated with the metric to compute
 * a score for each user and tag that is a function of values and
 * times of completion instances.
 *
 * The rule function takes an array of value-time pairs for
 * completion instances, along with any additional parameters
 * defined in the metric. The result of the rule function is always
 * a number between 0 and 100. The rule function also satisfies the
 * contract that an empty input array must produce the result 0.
 *
 * @private
 * @param {Object} byUsers - object mapping user ids to tags to an
 *     array of two-element arrays of completion instances (value-time pairs).
 *     Specifically, the input data has shape:
 *        {
 *            [userId]: {
 *                [tag]: [ [<0-100>, <time|void 0>], ... ],
 *                ...
 *            },
 *            ...
 *        }
 *     It is assumed here that all relevant users and tags are included.
 * @param {Object} metric - completion metric object
 *
 * @returns {Object} object mapping user ids to tags to aggregate
 *     completion value (between 0 and 100) for the given metric
 *
 * Specifically, the returned object has shape:
 *     {
 *         [userId]: {
 *             [tag]: <number 0-100>,
 *             ...
 *         },
 *         ...
 *     }
 *
 */
function reduceCompletions( byUsers, metric ) {
    const ruleFn = completionRules[ metric.rule[ 0 ] || 'average' ];
    const completions = {};
    for ( const userId in byUsers ) {
        completions[userId] = {};
        for ( let tag in byUsers[ userId ] ) {
            completions[userId][tag] = ruleFn( byUsers[ userId ][ tag ], ...metric.rule.slice( 1 ) );
        }
    }
    return completions;
}

/**
 * Gathers completion data for a given metric and a set of users.
 *
 * @private
 * @param {string} id - id of the node for which to gather and compute completion data
 * @param {Object} metric - completion metric
 * @param {Array<string>} users - array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed to have been merged into
 *     DEFAULT_POLICY so that all fields are available (@see {@link makeCompletionPolicy}).
 * @returns {Promise<Object>} object mapping user ids to completion data for the chosen metric,
 *     aggregating lower levels. The resulting data has shape that looks like:
 *
 *        {
 *            [userId]: {
 *                [tag]: [ [<0-100>, <time|void 0>], ... ],
 *                ...
 *            },
 *            ...
 *        }
 *
 * Note that time filtering specified by the policy happens at the leaf ('component') level,
 * and tag weighting specified in the policy happens at the root (metric.level) level.
 *
 */
async function gatherCompletions( id, metric, users, policy ) {
    if ( isUndefinedOrNull( metric ) ) {
        throw new Error( `No metric defined for node ${id}.` );
    }
    let nodes;
    if ( metric.level === 'component' ) {
        nodes = [ id ];
    } else {
        nodes = await relevantNodes( id, metric.level, metric.coverage, users );
    }
    let nodeCompletions = await getBranchData( metric, nodes, predecessor( metric.level ), users, policy );
    if ( metric.level === 'namespace' ) { // ATTN:DEBUG
        console.log( 'Node completions at namespace level: ', JSON.stringify( nodeCompletions, null, 2 ) );
    }

    let byUsers = {};
    if ( nodeCompletions.length > 0 ) {
        byUsers = groupCompletions( nodeCompletions, policy );
    } else {
        // No completion data for the given metric and users
        for ( let i = 0; i < users.length; i++ ) {
            byUsers[ users[ i ] ] =  { [DEFAULT_TAG]: [] };
        }
    }
    console.log( `Completions by users in gather completions at ${metric.level}:`, JSON.stringify( byUsers, null, 2 ) ); // ATTN:DEBUG
    return byUsers;
}

/**
 * Constructs a completion aggregation policy object with specified options.
 *
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *   @param {Object} [policyOptions.timeFilter=[0,3.1536e+14]] - range of times in which instances are accepted as valid
 *       Times are measured in milliseconds since 1970.
 *   @param {Object} [policyOptions.multiples='last'] - how to handle multiple instances for the same component, user, and tag.
 *       Possible values are 'last', 'first', 'max', and 'pass-through'. In the latter case, all instances are passed to
 *       the rule specified in the completion metric. In the other cases, only the instance with last/first/max value is.
 *   @param {Object} [policyOptioons.tagWeights=void 0] - if defined, an array of strings representing tags by which
 *       completion values are aggregated. If empty, all extant tags are equally weighted. If no tags are defined in
 *       the completion data, DEFAULT_TAG is used.
 * @returns {Object} a completion aggregation policy object with unspecified options filled in with their defaults.
 */
const makeCompletionPolicy = (policyOptions) => merge( {}, DEFAULT_POLICY, policyOptions );

/**
 * Computes final completion data for a given metric and a set of users.
 *
 * @param {string} id - id of the node for which to gather and compute completion data
 * @param {Object} metric - completion metric
 * @param {Array<string>} users - array of user ids
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *
 * @returns {Promise<Object>} object mapping user ids to aggregated completion values (between 0 and 100) for the chosen metric
 *     Specifically, the returned object has shape:
 *         {
 *             [userId]: <number 0-100>,
 *             ...
 *         }
 */
async function computeCompletions( id, metric, users, policyOptions ) {
    const policy = makeCompletionPolicy( policyOptions );
    const hasTagWeights = !!policy.tagWeights;
    const completions = await gatherCompletions( id, metric, users, policy );
    const reduced = reduceCompletions( completions, metric );
    const byUser = {};

    console.log( `>>> computeCompletions gathered at ${metric.level} ${id}:`, JSON.stringify( completions, null, 2));
    console.log( `>>> computeCompletions reduced  at ${metric.level} ${id}:`, JSON.stringify( reduced, null, 2));

    if ( hasTagWeights) {
        for ( const userId in reduced ) {
            let total = 0;
            let weightTotal = 0;
            for ( let tag in reduced[ userId ] ) {
                const weight = policy?.tagWeights?.[ tag ] ?? 0;
                total += (reduced[ userId ]?.[ tag ] ?? 0) * weight;
                weightTotal += weight;
            }
            byUser[ userId ] = ( weightTotal > 0 ) ? total / weightTotal : 0;
        }
    } else { // All extant tags weighted equally. This could be only DEFAULT_TAG.
        for ( const userId in reduced ) {
            let total = 0;
            let weightTotal = 0;
            for ( let tag in reduced[ userId ] ) {
                total += (reduced[ userId ]?.[ tag ] ?? 0);
                weightTotal += 1;
            }
            byUser[ userId ] = ( weightTotal > 0 ) ? total / weightTotal : 0;
        }
    }
    return byUser;
}


module.exports = {
    computeCompletions,    // Public entry point
    makeCompletionPolicy,  // Public helper function
    DEFAULT_TAG,
    levelMapping,
    relevantNodes,
    gatherCompletions,
    reduceCompletions,
    groupCompletions,
    getBranchData,
    getLeafData
};
