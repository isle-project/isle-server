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

const isUndefinedOrNull = require( '@stdlib/assert/is-undefined-or-null' );
const merge             = require( '@stdlib/utils/merge' );
const mongoose          = require( 'mongoose' );
const objectKeys        = require( '@stdlib/utils/keys' );
const objectValues      = require( '@stdlib/utils/values' );

const Program           = require( './../models/program' );
const Namespace         = require( './../models/namespace' );
const Lesson            = require( './../models/lesson' );
const Completion        = require( './../models/completion' );


// DATA //

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
 * Marker for missing values at any level.
 */
const MISSING = [-999, void 0, null];


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
                schema: Completion
        }
};

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


// AGGREGATION RULES //

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
* Returns the average value for an array of value/time pairs, dropping the lowest score.
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
* Returns the average value for an array of value/time pairs, dropping the lowest N scores.
*
* @private
* @param {Array} arr - array of value and time pairs
* @param {number} N - number of lowest scores to drop from the average,
*     N is a non-negative integer.
* @returns {number} average of the values (ignoring time) after dropping N lowest scores.
*     If there are fewer than N scores available, return the largest of them.
*     If there are no scores, returns 0.
*/
function averageDropNLowest(arr, N) {
    if (arr.length === 0) {
        return 0;  // ATTN:TODO? - If handling missing values, missing here.
    }
    const sorted = arr.map(x => x[0]).sort((a, b) => a < b);
    if (arr.length <= N) {
        return sorted[arr.length - 1];
    }
    const neff = arr.length - N;
    return sorted.slice(N).reduce((acc, x) => {
        acc = acc + x/neff;
        return acc;
    }, 0);
}

/**
 * Object mapping completion rule names to rule calculation functions.
 *
 * Each calculation function takes an array of pairs (a value and a time, which
 * may be undefined) and zero or more optional parameters, and returns a
 * single numeric score in the range 0 to 100.
 *
 * A rule calculation function is required to return 0 if the input array is empty.
 *
 */
const completionRules = {
        'average': average,
        'dropLowest': averageDropLowest,
        'dropNLowest': averageDropNLowest
};


// NODE FILTERING AND SEARCHING //

// An entity refers to an organizational level such as program,
// course/namespace, lesson, and component. Entities are arranged
// hierarchically in a tree. A node refers to a single entity at a
// given level in the entity tree, which implicitly roots a subtree
// of contained lower-level entities. The id of a node is the ObjectId
// of the corresponding entity.

/**
 * Fetches and returns ids for the children of a given entity node.
 *
 * @private
 * @param {string} id - id of the entity node
 * @param {string} level - the level of the node given by id, a key in levelMapping
 * @param {[Array<string>]} users - if supplied, an array of user ids; if missing,
 *     all are considered
 *
 * @returns Promise<Array<string>> array of child node IDs as strings
 */

async function getChildrenIDs(id, level, users) {
        const mapping = levelMapping[level];
        let children;
        if ( mapping.field ) {
                // Query for the relevant nodes
                const parent = await mapping.schema.findById(id);
                children = parent[mapping.field];
                children = children.map(x => x.toString());
        } else {
                // At the lesson level, we find all distinct components in the lesson:
                const query = { lesson: id };
                if ( users ) {
                        query.user = { $in: users };
                }
                children = await Completion
                        .find(query, { component: 1 })
                        .distinct('component');
        }
        return children;
}

/**
 * Returns an array of an entity's child node ids that match a level and coverage criterion.
 *
 * @private
 * @param {string} id - id of the node
 * @param {string} level - the level of the node given by id
 * @param {Array<string>} coverage - an array with the first element is the type
 *     (`all`,`include`, or `exclude`) and any remaining elements are id strings
 * @param {Array<string>} users - an array of user ids (if not provided, all users
 *     are considered)
 * @returns {Promise<Array<string>>} array of relevant node IDs
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


// PROVENANCES //

function makeProvenance() {
}


// PRINCIPAL CALCULATION METHODS //

// An entity refers to an organizational level such as program,
// course/namespace, lesson, and component. Entities are arranged
// hierarchically in a tree. Starting at any level, we do a
// depth-first traversal of the entity tree accumulating subtree
// calculations (and their provenance) until a final reduction to a
// score at the chosen level.
//
// Several data structures/types are recurring in these methods:
//
// + score: a value in the range 0-100 computed for a subtree
//
// + time: a unix-time marking when a completion is recorded,
//     or undefined (void 0) if not available.
//
// + provenance: a tree that describes the lower-level components from
//     which a score at a given level is computed. It is an object of
//     the form  {level, entity, children}  where
//         - level is a string that is a key in `levelMapping`,
//         - entity is the ObjectId of the entity (e.g., component, lesson, ...)
//           associated with these data, and
//         - children is an array of child provenances, describing the
//           data that produced this result, or null if at the component
//           (leaf) level.
//
// + instance: a triple [score, time, provenance] computed at a given node
//     At the leaf level, the provenance is null. A special instance is used
//     to mark missing values.
//
// + tag: a string label that can be assigned to an entity; instances are
//     grouped by their associated tags and the final scores weighted by tag.
//
// + userCompletions: an object mapping user ids to an object mapping tags to
//     an array of instances.
//
//             {
//                 [userId]: {
//                     [tag]: [[<score>, <time>, <provenance>], ...],
//                     ...
//                 },
//                 ...
//             },
//

/**
 * Returns an array of userCompletions objects, aggregating completions in a subtree.
 *
 * The same user id may appear as a key in multiple elements of the returned array
 * as they represent results from different subtrees.
 *
 * @private
 * @param {Object} metric - completion metric
 * @param {Array<string>} nodes - array of node ids
 * @param {string} level - the level of the nodes
 * @param {Array<string>} users - an array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed to
 *     have been merged into DEFAULT_POLICY so that all fields are available
 *    (@see {@link makeCompletionPolicy}).
 *
 * @returns {Promise} resolves to an array of userCompletions objects.
 *     Recall that each such object maps a user id to an object mapping
 *     tags to arrays of instances. Specifically, the returned array has
 *     the form:
 *         [
 *             {
 *                 [userId]: {
 *                     [tag]: [[<score>, <time>, <provenance>], ...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *             ...
 *         ]
 */
async function getBranchData(metric, nodes, level, users, policy = DEFAULT_POLICY) {
    if ( level === 'component' ) {
        // Return promise with the completion data for all the components in the lesson:
        return getLeafData(metric.ref, nodes, null, users, policy);
    }
    // The next lower level is a namespace or lesson
    // Collect completion metrics that match the specified ref (or first available if ref null)
    const { schema } = levelMapping[level];
    nodes = nodes.map(x => new ObjectId(x));
    const completionData = await schema.find({ _id: { $in: nodes } }, { completions: 1 });
    if ( completionData.length === 0 ) {
        return [];
    }

    const ref = metric.ref;
    const completions = completionData.reduce((acc, x) => {
        const chosenMetric = ref ? x.completions.filter(x => x.name === ref) : x.completions;
        if ( chosenMetric.length === 0 ) {
            return acc;
        }
        acc[x._id] = chosenMetric[0];
        return acc;
    }, {});
    if ( !completions || objectKeys(completions).length === 0 ) {
        return []; // ATTN:CHANGED from throw - check downstream handling
    }
    // For all nodes with a matching completion, we compute the completions at that subtree
    return Promise.all(nodes.filter(id => completions[id]).map(node => gatherCompletions(node, completions[node], users, policy)));
}

/**
 * Returns an array of userCompletions objects, computed at the component level.
 *
 * @private
 * @param {string} ref - name of completion metric at the component level
 * @param {Array<string>} nodes - array of component ids (with non-enumerable
 *     `_lessonId` property showing the lesson the components belongs to)
 * @param {null} level - level of the nodes (not used for component level)
 * @param {Array<string>} users - array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed
 *     to have been merged into DEFAULT_POLICY so that all fields are
 *     available (@see {@link makeCompletionPolicy}).
 *
 * @returns {Promise<[Object]>} resolves to an array of userCompetions objects,
 *     one per component with data among the given nodes and within the
 *     containing lesson.
 *
 *     Recall that each such object maps  user ids to tags to an array of instances.
 *     Specifically, the returned array has the form:
 *         [
 *             {
 *                 [userId]: {
 *                     [tag]: [[<score>, <time>, <provenance>], ...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *             ...
 *         ]
 */
async function getLeafData( ref, nodes, level, users, policy ) {
    if ( !ref ) {
        throw new Error( 'No completion metric specified.' );
    }

    const lessonID = nodes._lessonId;
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
        return []; // ATTN:CHANGED from throw - check downstream handling
    }
    const records = await Completion
          .find( query )
          .sort({ 'time': policy.multiples === 'last' ? 'ascending' : 'descending' });
    console.log( 'Completion Instances: ', JSON.stringify( records, null, 2 ) ); // ATTN:DEBUG

    // Pre-populate an object for each node so that all users and tags are represented.
    // Tags are relevant if they are included in the tagWeights or if any user has
    // a recorded value for a tag. So, it is possible that some tags are missing
    // for *these* users if there are no tag weights and values are recorded for
    // a tag only by other users. We populate the DEFAULT_TAG if no others are defined.
    //
    // Note: We accept an extra pass through records here for simplicity.
    const tagSet = new Set( policy.tagWeights ? Object.keys( policy.tagWeights ) : [] );
    tagSet.add( DEFAULT_TAG );
    records.forEach( comp => {
        if ( comp.tag ) {
            tagSet.add(comp.tag);
        }
    });
    const nodeTags = {};
    const nodeCompletions = {};
    for ( const component of nodes ) {
        nodeTags[ component ] = {};  // Track tags recorded for this component with counts
        nodeCompletions[ component ] = {};
        for ( const user of users ) {
            const valueByTags = {};
            for ( const tag of tagSet ) {
                valueByTags[ tag ] = [];
            }
            nodeCompletions[ component ][ user ] = valueByTags;
        }
    }

    // Record the values in the appropriate sub-objects, but if
    // there are multiples to pass through, add extra objects.
    const provenance = { level: 'component', children: null };
    if ( policy.multiples === 'last' || policy.multiples === 'first' ) {
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, value, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            nodeCompletions[ component ][ user ][ xtag ] = [ [value, time, {...provenance, entity: component }] ];
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    } else if ( policy.multiples === 'max' ) {
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, value, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            const completion = nodeCompletions[ component ][ user ][ xtag ];
            if ( completion.length === 0 || completion[0][0] < value ) {
                completion = [ [value, time, {...provenance, entity: component }] ];
            }
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    } else { // pass-through: all records are passed through to the rule
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, value, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            nodeCompletions[ component ][ user ][ xtag ].push( [value, time, {...provenance, entity: component }] );
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    }

    // Ensure that missing components for a user are marked MISSING
    for ( const component of nodes ) {
        // Find the most representative tag if more than one, DEFAULT_TAG if none
        const myTagCounts = nodeTags[ component ];
        const myTags = objectKeys(myTagCounts);
        let myTag = DEFAULT_TAG;
        if ( myTags.length === 1 ) {
            myTag = myTags[0];
        } else if ( myTags.length > 1 ) {
            myTag = myTags.reduce((a, b) => myTagCounts[a] > myTagCounts[b] ? a : b);
        }

        // Now fill in any missing component scores for all the users
        for ( const user of users ) {
            if ( objectValues(nodeCompletions[ component ][ user ]).every( v => v.length === 0 ) ) {
                nodeCompletions[ component ][ user ][ myTag ].push( MISSING );
            }
        }
    }
    return nodes.map( x => nodeCompletions[ x ] );
}

/**
 * Groups an array of userCompletions objects into a single userCompletions object,
 * joining the collections for each user that appears in multiple elements.
 *
 * If there is no data for a particular tag and user, the resulting
 * array is empty; such values will be treated as missing in
 * downstream calculations.
 *
 * @private
 * @param {Array} nodeCompletions - array of userCompletions objects
 *     (@see {@link getBranchData})
 * @param {Object} policy - a completion aggregation policy object, assumed to have
 *     been merged into DEFAULT_POLICY so that all fields are available
 *     (@see {@link makeCompletionPolicy}).
 * @returns {Object} a userCompletions object that joins all the given
 *     userCompletions.
 *
 *     Recall that a userCompletions object maps user ids to an object mapping
 *     tags to an array of instances. This looks like:
 *         {
 *             [userId]: {
 *                 [tag]: [ [<score>, <time>, <provenance>], ... ],
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
 * Transforms a userCompletions object to a single score for each user and tag.
 * Returns an object mapping users ids to tags to scores for the given metric.
 *
 * This uses the rule function associated with the metric to compute
 * a score for each user and tag that is a function of values and
 * times of completion instances.
 *
 * The rule function takes an array of instances (ATTN:? include provenance)
 * along with any additional parameters defined in the metric.
 * The result of the rule function is always a score, that is
 * a number between 0 and 100. The rule function also satisfies the
 * contract that an empty input array must produce the result 0.
 * ATTN:HANDLE MISSING
 *
 * @private
 * @param {Object} byUsers - a userCompletions object that is assumed
 *     to include all relevant users and tags.
 * @param {Object} metric - completion metric object
 *
 * @returns {Object} an object mapping user ids to tags to a score
 *     (number between 0 and 100) for the given metric
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
 * Gathers completion data for an entity with a given metric and set of users.
 *
 * @private
 * @param {string} id - entity id of the node for which to gather and compute completion data
 * @param {Object} metric - completion metric
 * @param {Array<string>} users - array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed to have
 *     been merged into DEFAULT_POLICY so that all fields are available
 *     (@see {@link makeCompletionPolicy}).
 * @returns {Promise<Object>} a userCompletions object mapping user ids to completion data for the
 *     chosen metric, aggregating lower levels. The resulting data has shape that
 *     looks like:
 *
 *        {
 *            [userId]: {
 *                [tag]: [ [<score>, <time>, <provenance>], ... ],
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
    if ( metric.level === 'component' ) { // ATTN:FIX - this cannot currently happen and would break getBranchData call below if it did as predecessor would be null
        nodes = [ id ];
    } else {
        nodes = await relevantChildNodes( id, metric.level, metric.coverage, users );
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
 * @param {Object|null} [policyOptions] - an object whose keys form a subset of
 *       allowed policies. If missing, the default policy is used; see descriptions below.
 *   @param {Object} [policyOptions.timeFilter=[0,3.1536e+14]] - range of times in which
 *       instances are accepted as valid Times are measured in milliseconds since 1970.
 *   @param {Object} [policyOptions.multiples='last'] - how to handle multiple instances
 *       for the same component, user, and tag. Possible values are 'last', 'first', 'max',
 *       and 'pass-through'. In the latter case, all instances are passed to the rule
 *       specified in the completion metric. In the other cases, only the instance with
 *       last/first/max value is.
 *   @param {Object} [policyOptions.tagWeights=void 0] - if defined, a map of strings
 *       representing tags by which completion values are aggregated to non-negative weights.
 *       If empty, all extant tags are equally weighted. If no tags are defined in the
 *       completion data, DEFAULT_TAG is used.
 * @returns {Object} a completion aggregation policy object with unspecified options
 *       filled in with their defaults.
 */
const makeCompletionPolicy = (policyOptions) => merge( {}, DEFAULT_POLICY, (policyOptions || {}) );

/**
 * Computes final completion data for a given metric and a set of users.
 *
 * @param {string} id - id of the node for which to gather and compute completion data
 * @param {Object} metric - completion metric
 * @param {Array<string>} users - array of user ids
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *
 * @returns {Promise<Object>} object mapping user ids to aggregated completion values
 *     (between 0 and 100) for the chosen metric. Specifically, the returned object
 *     has shape:
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

    if ( hasTagWeights ) {
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
    MISSING,
    levelMapping,
    relevantChildNodes,
    gatherCompletions,
    reduceCompletions,
    groupCompletions,
    getBranchData,
    getLeafData
};
