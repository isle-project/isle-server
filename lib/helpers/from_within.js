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

const contains = require( '@stdlib/assert/contains' );


// MAIN //

/**
* Checks whether a GET request originates from within the dashboard, a lesson, or the editor.
*
* @param {Request} req - HTTP request object
* @param {Response} res - HTTP response object
* @param {Function} next - callback to invoke after executing a route handler
* @returns {void}
*/
function fromWithinApp( req, res, next ) {
	const userAgent = req.headers[ 'user-agent' ];
	if (
		contains( userAgent, 'isle-editor' ) &&
		contains( userAgent, 'Electron' )
	) {
		return next();
	}
	if ( !req.session.inLesson && !req.session.inDashboard ) {
		return res.status( 403 ).send( req.t( 'access-denied' ) );
	}
	next();
}


// EXPORTS //

module.exports = fromWithinApp;
