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

const CompletionMetricSchema = new Schema({
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
	* A two-element array with a start and end date. Default being the time in milliseconds since the epoch until the year 10000.
	*/
	timeFilter: {
		type: Array,
		default: [ 0, 10000 * 3.1536e+10 ]
	},

	/**
	* An array of a rule name and zero ore more rule parameters.
	*/
	rule: {
		type: Array
	},

	/**
	* A mapping from tags to non-negative numbers.
	*/
	tagWeights: {
		type: Object,
		default: null
	},

	/**
	* Which metric on the lower level to use.
	*/
	ref: {
		type: String,
		default: null
	}
}, { timestamps: true });


// EXPORTS //

module.exports = CompletionMetricSchema;
