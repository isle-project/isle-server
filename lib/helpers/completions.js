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


/*
 * Terminology and Data Model
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
 * + metric: an object specifying how to compute completions at a given node
 *
 * + score: a number in the range 0-100, or -999 where the latter
 *     denotes a missing value.
 *
 * + time: a unix-time marking when a completion is recorded,
 *     or undefined (void 0) if not available.
 *
 * + provenance: a tree that specifies the lower-level components
 *     from which a score at a given level is computed.
 *     As a type, it is an object of  the form {level, entity, children}
 *     where
 *         - level is a string that is a key in `levelMapping`,
 *         - entity is the ObjectId of the entity (e.g., component, lesson, ...)
 *           associated with these data, and
 *         - children is an array of child provenances, describing the
 *           data that produced this result, or null if at the component
 *           (leaf) level;
 *     or null
 *
 * + instance: a triple [score, time, provenance] computed at a given node
 *     At the leaf level, the provenance is null. A special instance is used
 *     to mark missing values.
 *
 * + tag: a string label that can be assigned to an entity; instances are
 *     grouped by their associated tags and the final scores weighted by tag.
 *
 * + userCompletions: an object mapping user ids to an array of instances.
 *             {
 *                 [userId]: [[<score>, <time>, <provenance>], ...],
 *                 ...
 *             },
 *
 * + taggedUserCompletions: an object mapping tags to userCompletions objects
 *             {
 *                 [tag]: {
 *                     [userId]: [[<score>, <time>, <provenance>], ...],
 *                     ...
 *                 },
 *                 ...
 *             },
 *
 * + aggregateCompletions: an object mapping each user id to an aggregate instance
 *             {
 *                 [tag]: { [userId]: [<score>, <time>, <provenance>], ... },
 *                 ...
 *             },
 *
 * + reducedCompletions: an object mapping tags to an aggregateCompletions object
 *             {
 *                 [tag]: { [userId]: [<score>, <time>, <provenance>], ... },
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
 * @property {boolean} [shareWithStudents=false]
 * @property {('last'|'first'|'max'|'pass-through')} [multiples='last']
 *
 * @typedef {Object} Provenance
 * @property {EntityLevel} level
 * @property {EntityId} entity
 * @property {Array<Provenance>} children
 *
 * @typedef {[Score, Time, Provenance]} Instance
 * @typedef {Object<UserId, Array<Instance>>} UserCompletions
 * @typedef {Object<Tag, UserCompletions>} TaggedUserCompletions
 * @typedef {Object<UserId, Instance>} AggregateCompletions
 * @typedef {Object<Tag, AggregateCompletions>} ReducedCompletions
 *
 */


// MODULES //

const isUndefinedOrNull = require( '@stdlib/assert/is-undefined-or-null' );
const merge             = require( '@stdlib/utils/merge' );
const mongoose          = require( 'mongoose' );
const objectKeys        = require( '@stdlib/utils/keys' );
const objectValues      = require( '@stdlib/utils/values' );
const pick              = require( '@stdlib/utils/pick' );

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


// MISSING DATA //

/**
 * Numeric value used for a missing score.
 *
 * @type {number}
 */
const MISSING_SCORE = -999;

/**
 * Marker for missing values at any level.
 *
 * @type {Instance}
 */
const MISSING = [MISSING_SCORE, void 0, null];

/**
 * Is the instance equal to the unique MISSING instance?
 *
 * @param {Instance}
 * @returns {boolean}
 */
function isMissing( instance ) {
    return instance === MISSING;
}

/**
 * Does the score of an instance represent a missing value?
 *
 * @param {Instance} instance
 * @returns {boolean}
 */
function notMissingScore( instance ) {
    return instance[0] >= 0;
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

// HELPER FUNCTIONS //

/** Identity function */
const identity = x => x;

/** Returns first element of an array */
const first = a => a[0];

/**
 * Reducing function for computing maximum time among instances.
 *
 * @param {Time} maxTime - accumulated maximum time
 * @param {Time} x - a time to incorporate
 *
 * @returns {Time} the maximum of the two times, where an undefined
 *     time is always considered less than any defined time.
 */
const maxInstanceTime = (maxTime, x) => {
    if( maxTime === void 0 ) {
        return x[1];
    }
    return x[1] >= maxTime ? x[1] : maxTime;
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

/*
 *
 */

function makeTagSet( source, accessor, weights, addDefault ) {
    const tagSet = new Set( weights ? Object.keys(weights) : [] );
    for( const k in source ) {
        const tag = accessor(source[k]);
        if ( tag ) {
            tagSet.add( tag );
        }
    }
    if ( addDefault ) {
        tagSet.add( DEFAULT_TAG );
    }
    return tagSet;
}


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


// AGGREGATION RULES //

/**
* Computes the average value for an array of value and time pairs.
*
* @private
* @param {Array<Instance>} arr - array of completion instances to summarize
* @param {('zero'|'ignore')} missing - how to handle missing values (which have score -999);
*     either 'zero' (impute zero value) or 'ignore' (drop from calculation).
*
* @returns {number} average of the values (ignoring time)
*/
function average( arr, missing = 'zero' ) {
    let scores;
    if ( missing === 'ignore' ) {
        scores = arr.filter(notMissingScore).map(first);
    } else {
        scores = arr.map( x => imputeMissingScore(x[0]) );
    }

    if ( scores.length === 0 ) {
        return 0;
    }
    return scores.reduce( ( acc, x ) => acc + x, 0 ) / scores.length;
}

/**
* Returns the average value for an array of value/time pairs, dropping the lowest score.
*
* @private
* @param {Array<Instance>} arr - array of completion instances to summarize
* @param {('zero'|'ignore')} missing - how to handle missing values (which have score -999);
*     either 'zero' (impute zero value) or 'ignore' (drop from calculation).
*
* @returns {number} average of the values (ignoring time) after dropping lowest score
*/
function averageDropLowest( arr, missing = 'zero' ) {
    let scores;
    if ( missing === 'ignore' ) {
        scores = arr.filter(notMissingScore).map(first);
    } else {
        scores = arr.map( x => imputeMissingScore(x[0]) );
    }

    if ( scores.length === 0 ) {
        return 0;
    }
    if ( scores.length === 1 ) {
        return scores[0];
    }
    const [ sum, min ] = scores.reduce( ( acc, x ) => {
        acc[ 0 ] = acc[ 0 ] + x;
        acc[ 1 ] = ( x < acc[ 1 ] ) ? x : acc[ 1 ];
        return acc;
    }, [ 0, Infinity ] );
    return ( sum - min ) / ( scores.length - 1 );
}

/**
* Returns the average value for an array of value/time pairs, dropping the lowest N scores.
*
* @private
* @param {Array<Instance>} arr - array of completion instances to summarize
* @param {number} N - number of lowest scores to drop from the average,
*     N is a non-negative integer.
* @param {('zero'|'ignore')} missing - how to handle missing values (which have score -999);
*     either 'zero' (impute zero value) or 'ignore' (drop from calculation).
*
* @returns {number} average of the values (ignoring time) after dropping N lowest scores.
*     If there are fewer than N scores available, return the largest of them.
*     If there are no scores, returns 0.
*/
function averageDropNLowest(arr, N, missing = 'zero') {
    if (arr.length === 0) {
        return 0;  // ATTN:TODO? - If handling missing values, missing here.
    }
    let sorted;
    if ( missing === 'ignore' ) {
        sorted = arr.filter(notMissingScore).map(first).sort( (a, b) => a < b );
    } else {
        sorted = arr.map( x => imputeMissingScore(x[0]) ).sort( (a, b) => a < b );
    }

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
        console.log( 'Setting metadata with lesson id:', id );  // ATTN:DEBUG
        attachMetadata( out, '_lessonId', id );
    }
    console.log( 'Relevant nodes:', JSON.stringify( out, null, 2 ) );  // ATTN:DEBUG
    return out;
}


// PROVENANCES //

/**
 * Extracts and returns the provenance from an instance
 *
 * @private
 * @param {Instance} instance - an instance array [score, time, provenance]
 *
 * @returns {Provenance} associated with that instance.
 *
 */
function provenanceOf( instance ) {
    return instance[2];
}

/**
 * Creates a provenance with instance provenances as subtrees
 *
 * @private
 * @param {EntityLevel} level - the level of the containing entity (program|namespace|lesson|component)
 * @param {EntityId} entity - id of the containing entity
 * @param {Array<Instance>|null} instances - an array
 *
 * @returns {Provenance} with the children concatenated
 *
 */
function makeProvenance( level, entity, instances ) {
    return { level, entity, children: instances && instances.map(provenanceOf) };
}

/**
 * Reducing function that combines children of provenances with same level and entity.
 *
 * @private
 * @param {Provenance} base - a provenance
 * @param {Provenance} sibling - a provenance with the same level and entity as base
 *
 * @returns {Provenance} with the children concatenated
 *
 */
function joinProvenances( base, sibling ) {
    if ( !isUndefinedOrNull( sibling.children ) ) {
        if ( base.children ) {
            base.children = base.children.concat( sibling.children );
        } else {
            base.children = [ ...sibling.children ];
        }
    }
    return base;
}


// PRINCIPAL CALCULATION METHODS //
//
// Starting at any level of the entity tree, we do a depth-first
// traversal of the entity tree accumulating subtree calculations
// (and their provenance) until a final reduction to a score at the
// chosen level.

/**
 * Returns an array of userCompletions objects, aggregating completions in a subtree.
 *
 * The same user id may appear as a key in multiple elements of the returned array
 * as they represent results from different subtrees. The set of tags in each
 * object is determined by the metric.tagWeights (captured in policy) and by
 * the tags associated with the child entities.
 *
 * @private
 * @param {Metric} metric - completion metric
 * @param {Array<EntityId>} nodes - array of node ids
 * @param {EntityLevel} level - the level of the nodes
 * @param {Array<string>} users - an array of user ids
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *    (@see {@link makeCompletionPolicy}).
 *
 * @returns {Promise<Array<TaggedUserCompletions>>} resolves userTagCompletions
 *     computed at the given nodes. There is at most one userTagCompletions
 *     object per node, where a node is excluded if it does not have a matching
 *     metric. The tags are determined from the child entities at this level.
 *
 */
async function getBranchData(metric, nodes, level, users, policyOptions) {
    if ( level === 'component' ) {
        // Return promise with the completion data for all the components in the lesson:
        const policy = makeCompletionPolicy( policyOptions, metric );
        return getComponentData(metric.ref, nodes, null, users, policy);
    }
    // The next lower level is a namespace or lesson
    // Collect completion metrics that match the specified ref (or first available if ref null)
    const { schema } = levelMapping[level];
    nodes = nodes.map(x => new ObjectId(x));
    const completionData = await schema.find({ _id: { $in: nodes } }, { completions: 1, tag: 1 });
    if ( completionData.length === 0 ) {
        return [];
    }

    const submetric = metric.ref;
    const [submetrics, tags] = completionData.reduce((acc, x) => {
        const chosenMetric = submetric ? x.completions.filter(x => x.name === submetric) : x.completions;
        if ( chosenMetric.length === 0 ) {
            return acc;
        }
        acc[0][x._id] = chosenMetric[0];
        acc[1][x._id] = x.tag || DEFAULT_TAG;
        return acc;
    }, [ {}, {} ]);
    if ( objectKeys(submetrics).length === 0 ) {
        return []; // ATTN:CHANGED from throw - check downstream handling
    }
    // For all nodes with a matching completion, we compute the completions at that subtree
    // Each subtree has an associated tag (or DEFAULT_TAG) if none.
    const children = await Promise.all(nodes
                                       .filter(id => submetrics[id])
                                       .map(node => [tags[node], computeCompletions(node, submetrics[node], users, policyOptions)]) );
    const branchData = {};
    const tagSet = makeTagSet( children, first, metric.tagWeights || policyOptions.tagWeights );
    for( const tag of tagSet ) {
        branchData[ tag ] = [];
    }
    for ( let i = 0; i < children.length; ++i ) {
        const tag = children[i][0];
        branchData[ tag ].push( children[i][1] );
    }
    return branchData;
}

/**
 * Returns an array of userCompletions objects at the component level.
 *
 * @private
 * @param {string} metricName - name of completion metric at the component level
 * @param {Array<EntityId>} nodes - array of component ids (with non-enumerable
 *     `_lessonId` property showing the lesson the components belongs to)
 * @param {null} level - level of the nodes (not used for component level)
 * @param {Array<string>} users - array of user ids
 * @param {Object} policy - a completion aggregation policy object, assumed
 *     to have been merged into DEFAULT_POLICY so that all fields are
 *     available (@see {@link makeCompletionPolicy}).
 *
 * @returns {Promise<Array<TaggedUserCompletions>>} recorded completion instances
 *     for components in the containing lesson, arranged by tag and user.
 *     Each component is represented by at most one element of the array.
 *
 */
async function getComponentData( metricName, nodes, level, users, policy ) {
    if ( !metricName ) {
        throw new Error( 'No completion metric specified.' );
    }

    const lessonID = new ObjectId( nodes._lessonId );
    // Get the component completion instances from the database,
    // filtering according to the policy's time filter.
    const query = {
        lesson: lessonID,
        component: { $in: nodes },
        user: { $in: users },
        time: { $gte: policy.timeFilter[0], $lte: policy.timeFilter[1] },
        metricName: metricName
    };
    console.log( 'Query: ', query ); // ATTN:DEBUG

    const records = await Completion
          .find( query )
          .sort({ 'time': policy.multiples === 'first' ? 'descending' : 'ascending' });
    console.log( 'Completion Instances: ', JSON.stringify( records, null, 2 ) ); // ATTN:DEBUG
    if ( records.length === 0 ) {
        return []; // ATTN:CHANGED from throw - check downstream handling
    }

    // Pre-populate an object for each node so that all users and tags are represented.
    // Tags are relevant if they are included in the tagWeights or if any user has
    // a recorded value for a tag. So, it is possible that some tags are missing
    // for *these* users if there are no tag weights and values are recorded for
    // a tag only by other users. We populate the DEFAULT_TAG if no others are defined.
    //
    // Note: We accept an extra pass through records here for simplicity.
    const tagSet = makeTagSet( records, r => r.tag, policy.tagWeights, true );
    const nodeTags = {};
    const nodeCompletions = {};
    for ( const component of nodes ) {
        nodeTags[ component ] = {};  // Track tags recorded for this component with counts
        nodeCompletions[ component ] = {};  // map tags -> UserCompletions object
        // Ensure all visible tags and users are represented
        for ( const tag of tagSet ) {
            const valueByUser = {};
            for ( const user of users ) {
                valueByUser[ user ] = [];
            }
            nodeCompletions[ component ][ tag ] = valueByUser;
        }
    }

    // Record the values in the appropriate sub-objects
    const provenance = { level: 'component', children: null };
    if ( policy.multiples === 'last' || policy.multiples === 'first' ) {
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, value, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            nodeCompletions[ component ][ xtag ][ user ] = [ [value, time, {...provenance, entity: component }] ];
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    } else if ( policy.multiples === 'max' ) {
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, value, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            const completion = nodeCompletions[ component ][ xtag ][ user ];
            if ( completion.length === 0 || completion[0][0] < value ) {
                completion = [ [value, time, {...provenance, entity: component }] ];
            }
            nodeTags[ component ][ xtag ] = nodeTags[ component ]?.[ xtag ] ? ++nodeTags[ component ][ xtag ]: 1;
        }
    } else { // pass-through: all records are passed through to the rule
        for ( let i = 0; i < records.length; i++ ) {
            const {component, user, value, time, tag} = records[ i ];
            const xtag = tag || DEFAULT_TAG;
            nodeCompletions[ component ][ xtag ][ user ].push( [value, time, {...provenance, entity: component }] );
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
            if ( myTags.every( tag => nodeCompletions[ component ][ tag ][ user ].length === 0 ) ) {
                nodeCompletions[ component ][ user ][ myTag ].push( MISSING );
            }
        }
    }
    return nodes.map( x => nodeCompletions[ x ] );
}

/**
 * Joins a collection of TaggedUserCompletions objects into one, so that
 * every user and tag appears only once.
 *
 * If there is no data for a particular tag and user, the resulting
 * array is empty; such values will be treated as missing in
 * downstream calculations.
 *
 * @private
 * @param {Array<TaggedUserCompletions>} nodeCompletions
 * @param {Array<string>} users - all user ids for this calculation
 * @param {Object<string,number>} [tagWeights] - a map from tags to their
 *     weights; used here only to construct a set of possible tags.
 * @returns {TaggedUserCompletions} a userCompletions object that joins all the given
 *     userCompletions. All visible tags and users are included in the result.
 *
 */
function groupCompletions( nodeCompletions, users, tagWeights ) {
    const taggedCompletions = {};
    const tagSet = makeTagSet( Object.keys(nodeCompletions), identity, tagWeights );

    for ( let i = 0; i < nodeCompletions.length; i++ ) {
        const byTag = nodeCompletions[ i ];
        for ( const tag of tagSet ) {
            if ( !taggedCompletions[ tag ] ) {
                taggedCompletions[ tag ] = {};
                for ( const user of users ) {
                    taggedCompletions[ tag ][ user ] = [];
                }
            }
            const byUser = byTag[ tag ];
            if ( byUser ) {
                for ( const user in byUser ) {
                    taggedCompletions[ tag ][ user ] = taggedCompletions[ tag ][ user ].concat( byUser[user] );
                }
            }
        }
    }
    return taggedCompletions;
}

/**
 * Transforms a userCompletions object to a single instance for each user and tag.
 * Returns an object mapping users ids to tags to scores for the given metric.
 *
 * This uses the rule function associated with the metric to compute
 * a score for each user and tag that is a function of values and
 * times of completion instances.
 *
 * The rule function takes an array of instances (ATTN:? include provenance)
 * along with any additional parameters defined in the metric.
 * The result of the rule function is always a score, that is
 * a number between 0 and 100, u. The rule function also satisfies the
 * contract that an empty input array must produce the result 0.
 * ATTN:HANDLE MISSING
 *
 * @private
 * @param {TaggedUserCompletions} taggedCompletions - completion data
 *     by tag and user; assumed to include all relevant users and tags.
 * @param {EntityId} entity - the entity id whose completions these represent
 * @param {Metric} metric - completion metric object
 *
 * @returns {ReducedCompletionsObject} aggregate instance for each tag and user pair,
 *     for the given metric. The score is determined by the metric rule,
 *     the time is the maximum defined time in the input, and
 *     the provenance encapsulates the provenances of the inputs
 *     as subtrees. If all input data is missing for a tag, the instance
 *     is a special MISSING marker; otherwise, missing data is handled
 *     by parameters of the rule function.
 */
function reduceCompletions( taggedCompletions, entity, metric ) {
    const ruleFn = completionRules[ metric.rule[ 0 ] || 'average' ];
    const completions = {};

    for ( const tag in taggedCompletions ) {
        completions[tag] = {};
        const byUser = taggedCompletions[tag];

        for( const user in byUser ) {
            const instances = byUser[ user ];
            const score = ruleFn( instances, ...metric.rule.slice( 1 ) );
            const time = instances.reduce( maxInstanceTime, void 0);
            const provenance = makeProvenance( metric.level, entity, instances );
            completions[ tag ][ user ] = [ score, time, provenance ];
        }
    }
    return completions;
}

/**
 * Computes weighted average of completions across tags by user.
 * Returns an object mapping each user id to an aggregate instance.
 *
 * @private
 * @param {ReducedCompletions} reduced - completions aggregated across
 *     instances for each tag and user.
 * @param {EntityLevel} level - the level of the target node
 * @param {EntityId} entity - the entity id whose completions these represent
 * @param {Array<UserId>} users - all user ids for this calculation
 * @param {Object<string,number>} [tagWeights] - a map from tags to their
 *     weights; used here only to construct a set of possible tags.
 *
 * @returns {AggregateCompletions} final results from the calculation
 *     at a given node. Each aggregate instance includes a tag weighted
 *     score, the maximal time in the subtree, and the provenance data
 *     for all subtree calculations.
 *
 */
function weightCompletions( reduced, entity, level, users, tagWeights ) {
    const computed = {};
    if ( tagWeights ) {
        for ( const userId in users ) {
            let total = 0;
            let weightTotal = 0;
            let maxTime = void 0;
            let joinedProvenance = makeProvenance( level, entity, [] );
            for ( const tag in reduced ) {
                const weight = tagWeights?.[ tag ] ?? 0;
                if ( reduced[ tag ]?.[ userId ] !== void 0 ) {
                    const [score, time, provenance ] = reduced[ tag ][ userId ];
                    total += score * weight;
                    maxTime = maxInstanceTime( maxTime, time );
                    joinedProvenance = joinProvenances( joinedProvenance, provenance );
                }
                weightTotal += weight;
            }
            const avgScore = ( weightTotal > 0 ) ? total / weightTotal : 0;
            computed[ userId ] = [ avgScore, maxTime, joinedProvenance ];
        }
    } else { // All extant tags weighted equally. This could be only DEFAULT_TAG.
        for ( const userId in users ) {
            let total = 0;
            let weightTotal = 0;
            let maxTime = void 0;
            let joinedProvenance = makeProvenance( level, entity, [] );
            for ( const tag in reduced ) {
                if ( reduced[ tag ]?.[ userId ] !== void 0 ) {
                    const [score, time, provenance ] = reduced[ tag ][ userId ];
                    total += score;
                    maxTime = maxInstanceTime( maxTime, time );
                    joinedProvenance = joinProvenances( joinedProvenance, provenance );
                }
                weightTotal += 1;
            }
            const avgScore = ( weightTotal > 0 ) ? total / weightTotal : 0;
            computed[ userId ] = [ avgScore, maxTime, joinedProvenance ];
        }
    }
    return computed;
}

/**
 * Gathers completion data for an entity with a given metric and set of users.
 *
 * @private
 * @param {EntityId} id - entity id of the node for which to gather and compute completion data
 * @param {Metric} metric - completion metric
 * @param {Array<string>} users - all user ids for this calculation
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *    (@see {@link makeCompletionPolicy}).
 * @returns {Promise<TaggedUserCompletions>} for each tag and user, collects computed
 *     completions for all subtrees rooted at children of this entity node. The
 *     tags comprise the collection of tags associated with the child nodes and the
 *     weights of their submetrics. All visiible tags are represented, even with
 *     an empty array if there are no associated completions.
 *
 * Note that time filtering specified by the policy happens at the leaf ('component') level
 * only, whereas tag weighting happens at each level according to the metric.
 *
 */
async function gatherCompletions( id, metric, users, policyOptions ) {
    if ( isUndefinedOrNull( metric ) ) {
        throw new Error( `No metric defined for node ${id}.` );
    }
    if ( metric.level === 'component' ) {
        // This should not ever happen
        throw new Error( `Cannot gatherCompletions at component level, ${id}.` );
    }
    const nodes = await relevantChildNodes( id, metric.level, metric.coverage, users );
    const nodeCompletions = await getBranchData( metric, nodes, predecessor( metric.level ), users, policyOptions );
    let taggedCompletions = {};
    if ( nodeCompletions.length > 0 ) {
        taggedCompletions = groupCompletions( nodeCompletions, users, metric.tagWeights || policyOptions.tagWeights );
    } else {
        // No completion data for the given metric and users
        taggedCompletions[ DEFAULT_TAG ] = {};
        const byUser = taggedCompletions[ DEFAULT_TAG ];
        for ( let i = 0; i < users.length; i++ ) {
            byUser[ users[ i ] ] =  [];  // ATTN:? Put MISSING here instead?
        }
    }
    console.log( `Completions by users in gather completions at ${metric.level}:`, JSON.stringify( taggedCompletions, null, 2 ) ); // ATTN:DEBUG
    return taggedCompletions;
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
const makeCompletionPolicy = (policyOptions, metric) => {
    const policy = merge({}, DEFAULT_POLICY, (policyOptions || {}));
    if ( metric ) {
        if ( metric?.tagWeights ) {
            policy.tagWeights = { ...metric.tagWeights };
        }
        if ( metric?.timeFilter ) {
            // ATTN:TODO combine time filters more flexibly and carefully
            // This will fail as we move down the tree as the original policy
            // timefilter is lost. ATTN:FIX by just passing policyOptions down
            policy.timeFilter[0] = Math.max( policy.timeFilter[0], metric.timeFilter[0] );
            policy.timeFilter[1] = Math.min( policy.timeFilter[1], metric.timeFilter[1] );
        }
        if ( metric?.multiples ) {
            policy.multiples = metric.multiples;
        }
    }
    return policy;
};

/**
 * Computes final completion data for a given metric and a set of users.
 * This assumes that the metric level is 'lesson' or higher.
 *
 * @param {EntityId|ObjectId} id - id of the node for which to gather and compute completion data
 * @param {Metric} metric - completion metric, at level 'lesson' or higher.
 * @param {Array<UserId>} users - array of user ids
 * @param {Object} policyOptions - an object whose keys form a subset of allowed policies
 *
 * @returns {Promise<AggregateCompletions>} computed and tag weighted completions for
 *     the subtree rooted at this node for the requested set of users. For each
 *     user, computes an instance [<score>, <time>, <provenance>]. The score is
 *     determined by the metric rule; the time is the maximum time over the
 *     subtree, and the provenance describes all the data that went into this
 *     calculation.
 *
 */
async function computeCompletions( id, metric, users, policyOptions ) {
    const completions = await gatherCompletions( id, metric, users, policyOptions );
    const reduced = reduceCompletions( completions, id, metric );
    const policy = makeCompletionPolicy( policyOptions, metric );
    const aggregate = weightCompletions( reduced, metric.level, id, users, policy.tagWeights );

    // ATTN:DEBUG
    console.log( `>>> computeCompletions gathered  at ${metric.level} ${id}:`, JSON.stringify( completions, null, 2));
    console.log( `>>> computeCompletions reduced   at ${metric.level} ${id}:`, JSON.stringify( reduced, null, 2));
    console.log( `>>> computeCompletions aggregate at ${metric.level} ${id}:`, JSON.stringify( aggregate, null, 2));
    // END:DEBUG

    return aggregate;
}


module.exports = {
    computeCompletions,    // Public entry point
    makeCompletionPolicy,
    DEFAULT_TAG,
    MISSING,
    levelMapping,
    relevantChildNodes,
    gatherCompletions,
    reduceCompletions,
    weightCompletions,
    groupCompletions,
    getBranchData,
    getComponentData
};
