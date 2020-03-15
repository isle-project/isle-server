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

const Namespace = require( './../models/namespace.js' );


// MAIN //

async function isOwner( user, namespaceID ) {
	const namespace = await Namespace.findOne({ _id: namespaceID });
	if ( !namespace ) {
		throw new Error( 'Namespace does not exist.' );
	}
	const id = user._id.toString();
	let owner = false;
	for ( let i = 0; i < namespace.owners.length; i++ ) {
		if ( namespace.owners[ i ].toString() === id ) {
			owner = true;
		}
	}
	return owner;
}


// EXPORTS //

module.exports = isOwner;
