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

const OverviewStatistics = new Schema({
	nUsers: {
		'type': Number,
		'required': true
	},
	nLessons: {
		'type': Number,
		'required': true
	},
	nCohorts: {
		'type': Number,
		'required': true
	},
	nNamespaces: {
		'type': Number,
		'required': true
	},
	nSessionData: {
		'type': Number,
		'required': true
	},
	nEvents: {
		'type': Number,
		'required': true
	},
	nFiles: {
		'type': Number,
		'required': true
	},
	spentTime: {
		'type': Number,
		'default': 0
	},
	dailyActiveUsers: {
		'type': Number,
		'default': 0
	},
	actionTypes: {
		'type': Object,
		'default': {}
	}
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'OverviewStatistics', OverviewStatistics );
