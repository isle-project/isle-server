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
	* An array of a rule name and zero ore more rule parameters.
	*/
	rule: {
		type: Array
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
