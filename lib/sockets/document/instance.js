/**
* Adapted from MIT-licensed code.
*/

/**
* Copyright (C) 2015-2017 by Marijn Haverbeke <marijnh@gmail.com> and others
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/

'use strict';

// MODULES //

const { Mapping } = require( 'prosemirror-transform' );
const { Node } = require( 'prosemirror-model' );
const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const objectKeys = require( '@stdlib/utils/keys' );
const isJSON = require( '@stdlib/assert/is-json' );
const schema = require( './schema.js' );
const { Comments } = require( './comments.js' );


// VARIABLES //

const MAX_STEP_HISTORY = 10000;


// FUNCTIONS //

class Instance {
	constructor({ id, doc, comments }) {
		this.id = id;
		if ( isJSON( doc ) ) {
			console.log( doc );
			this.doc = Node.fromJSON( schema, JSON.parse( doc ) );
		} else {
			this.doc = schema.node( 'doc', null, [ schema.node( 'paragraph', null, [
				schema.text( 'This is a collaborative test document. Start editing to make it more interesting!' )
			])]);
		}
		this.comments = comments || new Comments();
		this.version = 0; // The version number of the document instance
		this.steps = [];
		this.lastActive = Date.now(); // Last time the instance was changed
		this.users = {};
		this.userSelections = {};
		this.userCount = 0;
		this.collecting = null;
	}

	addEvents( version, steps, comments, clientID ) {
		if ( version < 0 || version > this.version ) {
			return false;
		}
		if ( this.version !== version ) {
			return false;
		}
		let doc = this.doc;
		const maps = [];
		for ( let i = 0; i < steps.length; i++ ) {
			steps[ i ].clientID = clientID;
			const result = steps[ i ].apply( doc );
			doc = result.doc;
			maps.push( steps[ i ].getMap() );
		}
		this.doc = doc;
		this.version += steps.length;
		this.steps = this.steps.concat( steps );
		if ( this.steps.length > MAX_STEP_HISTORY ) {
			this.steps = this.steps.slice( this.steps.length - MAX_STEP_HISTORY );
		}
		console.log( this.userSelections );
		this.comments.mapThrough( new Mapping( maps ) );
		if ( comments ) {
			for ( let i = 0; i < comments.length; i++ ) {
				const event = comments[i];
				if ( event.type === 'delete' ) {
					this.comments.deleted( event.id );
				} else {
					this.comments.created( event );
				}
			}
		}
		// TODO: Save document and comments to database
		return { version: this.version, commentVersion: this.comments.version, users: this.userCount };
	}

	updateCursors( clientID, selection ) {
		this.userSelections[ clientID ] = selection;
		console.log( this.userSelections );
	}

	/**
	* Get events between a given document version and the current document version.
	*/
	getEvents( version, commentVersion ) {
		if ( version < 0 || version > this.version ) {
			return false;
		}
		let startIndex = this.steps.length - ( this.version - version );
		if ( startIndex < 0 ) {
			return false;
		}
		let commentStartIndex = this.comments.events.length - ( this.comments.version - commentVersion );
		if ( commentStartIndex < 0 ) {
			return false;
		}
		return {
			steps: this.steps.slice( startIndex ),
			comment: this.comments.eventsAfter( commentStartIndex ),
			users: this.userCount
		};
	}

	registerUser( ip ) {
		if ( !( ip in this.users ) ) {
			this._registerUser( ip );
		}
	}

	_registerUser( ip ) {
		if ( !( ip in this.users ) ) {
			this.users[ ip ] = true;
			this.userCount += 1;
		}
	}
}


// MAIN //

const instances = Object.create( null );
let instanceCount = 0;
let maxCount = 99;

function getInstance( id, member, doc ) {
	let inst = instances[ id ] || newInstance( id, doc );
	if ( member && member.email ) {
		inst.registerUser( member.email );
	}
	inst.lastActive = Date.now();
	return inst;
}

function removeFromInstances( member ) {
	const keys = objectKeys( instances );
	for ( let i = 0; i < keys.length; i++ ) {
		const inst = instances[ keys[ i ] ];
		if ( inst.users[ member.email ] ) {
			delete inst.users[ member.email ];
			inst.userCount -= 1;
		}
	}
}

function newInstance( id, doc, comments ) {
	if ( ++instanceCount > maxCount ) {
		let oldest = null;
		for ( let id in instances ) {
			if ( hasOwnProp( instances, id ) ) {
				let inst = instances[ id ];
				if ( !oldest || inst.lastActive < oldest.lastActive ) {
					oldest = inst;
				}
			}
		}
		instances[ oldest.id ].stop();
		delete instances[ oldest.id ];
		--instanceCount;
	}
	instances[ id ] = new Instance({ id, doc, comments });
	return instances[ id ];
}

function instanceInfo() {
	let found = [];
	for ( let id in instances ) {
		if ( hasOwnProp( instances, id ) ) {
			found.push({
				id: id,
				users: instances[ id ].userCount
			});
		}
	}
	return found;
}


// EXPORTS //

exports.getInstance = getInstance;

exports.instanceInfo = instanceInfo;

exports.removeFromInstances = removeFromInstances;
