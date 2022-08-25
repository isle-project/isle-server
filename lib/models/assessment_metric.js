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

// MODULES //

const mongoose = require( 'mongoose' );


// MAIN //

const Schema = mongoose.Schema;

const AssessmentMetricSchema = new Schema({
	/**
	* Metric name.
	*/
	name: {
		'type': String,
		'required': true
	},

	/**
     * Level of the metric.
     */
	level: {
		'type': String,
		'enum': [ 'program', 'namespace', 'lesson', 'component' ],
		'required': true
	},

    /**
     * An array of the form `[ 'all' ]`, `[ 'include`, ... ]`, or `[ 'exclude', ... ]` where `...` is a list of IDs (components, lessons, courses)
     */
	coverage: {
		type: Array,
		default: [ 'all' ]
	},

	/**
     * An array of a rule name and zero ore more rule parameters.
     */
	rule: {
		type: Array
	},

    /**
     * Which metric on the lower level to use.
     */
	submetric: {
		type: String,
		default: null
	},

	/**
	 * Mapping of tags to weights for aggregating score
	 */
	tagWeights: {
		type: Object,
		required: false,
		default: null
	},

	/**
	 * Time interval in which scores are accepted.
	 */
	timeFilter: {
		type: [Number],
		required: false,
		default: [0, 3.1536e14]
	},

	/**
	 * How to deal with multiple submissions.
	 */
	multiples: {
		'type': String,
		'enum': [ 'last', 'first', 'max', 'pass-through' ],
		'required': false,
		default: 'last'
	},

	/**
	 * Should this metric be automatically recomputed with new scores?
	 */
	autoCompute: {
		'type': Boolean,
		'required': false,
		default: false
	},

	/**
	 * Should the scores of this metric be visible to students?
	 */
	visibleToStudent: {
		'type': Boolean,
		'required': false,
		default: false
	},

	/**
	 * UnixTime when the score was last computed.
	 */
	lastUpdated: {
		'type': Number,
	}
}, { timestamps: false });


// EXPORTS //

module.exports = AssessmentMetricSchema;
