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

const tokens = require( './../credentials/tokens.json' );
const apixu = require( './../credentials/apixu.json' );
const deepl = require( './../credentials/deepl.json' );
const jitsi = require( './../credentials/jitsi.json' );
const github = require( './../credentials/github.json' );
const mailgun = require( './../credentials/mailgun.json' );
const mapbox = require( './../credentials/mapbox.json' );
const opencpu = require( './../credentials/opencpu.json' );


// MAIN //

const main = {
	tokens,
	apixu,
	deepl,
	jitsi,
	github,
	mailgun,
	mapbox,
	opencpu
};


// EXPORTS //

module.exports = main;
