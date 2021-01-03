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

const { Mapping, Step } = require( 'prosemirror-transform' );
const { Node } = require( 'prosemirror-model' );
const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const objectKeys = require( '@stdlib/utils/keys' );
const isJSON = require( '@stdlib/assert/is-json' );
const repeat = require( '@stdlib/string/repeat' );
const isPlainObject = require( '@stdlib/assert/is-plain-object' );
const TextEditorDocument = require( '../../models/text_editor_document.js' );
const debug = require( './../debug' );
const schema = require( './schema.js' );
const { Comments, Comment } = require( './comments.js' );
const { compressStepJSON, uncompressStepJSON } = require( './compress' );
const { Cursors } = require( './cursors.js' );


// VARIABLES //

let saveTimeout = null;
const MAX_STEP_HISTORY = 10000;
const SAVE_INTERVAL = 60000;
const MAX_DOC_INSTANCES = 200;
const DEFAULT_EDITOR_VALUE = repeat( '\n', 15 );
const RE_ID_PARTS = /^([^-]+)-([^-]+)-([\s\S]+?)$/;


// FUNCTIONS //

function mergeSteps( steps ) {
	const mergedSteps = [];
	let step = steps[ 0 ];
	let authors = new Set();
	authors.add( step.clientID );
	for ( let i = 1; i <= steps.length; i++ ) {
		const merged = step.merge( steps[ i ] );
		if ( merged ) {
			authors.add( steps[ i ].clientID );
			step = merged;
		} else {
			let clientID = '';
			authors.forEach( ( x ) => {
				if ( clientID ) {
					clientID += ', ';
				}
				clientID += x;
			})
			step.clientID = clientID;
			mergedSteps.push( step );
			authors.clear();
			step = steps[ i ];
		}
	}
	return mergedSteps
}

class Instance {
	constructor({ id, doc, comments, version = 0, steps = [] }) {
		debug( 'Creating document instance...' );
		this.id = id;
		if ( isJSON( doc ) ) {
			debug( 'Recreate document from JSON string...' );
			this.doc = Node.fromJSON( schema, JSON.parse( doc ) );
		}
		else if ( isPlainObject( doc ) ) {
			debug( 'Recreate document from JSON object...' );
			this.doc = Node.fromJSON( schema, doc );
		}
		else if ( doc instanceof Node ) {
			debug( 'Use existing document node...' );
			this.doc = doc;
		} else {
			debug( 'Use default document...' );
			this.doc = schema.node( 'doc', null, [ schema.node( 'paragraph', null, [
				schema.text( DEFAULT_EDITOR_VALUE )
			])]);
		}
		this.comments = comments || new Comments();
		this.version = version; // The version number of the document instance
		this.steps = steps;
		this.lastActive = Date.now(); // Last time the instance was changed
		this.users = {};
		this.cursors = new Cursors();
		this.userCount = 0;
		this.collecting = null;
	}

	/**
	* Adds steps from a user to the document instance.
	*
	* @param {number} version - document version
	* @param {Array} steps - steps array
	* @param {Array} comments - comment array
	* @param {string} clientID - id of client
	*/
	addEvents( version, steps, comments, clientID ) {
		if ( version < 0 || version > this.version ) {
			return false;
		}
		if ( this.version !== version ) {
			return false;
		}
		// Case: version < this.version
		let doc = this.doc;
		const maps = [];
		try {
			for ( let i = 0; i < steps.length; i++ ) {
				steps[ i ].clientID = clientID;
				const result = steps[ i ].apply( doc );
				doc = result.doc;
				maps.push( steps[ i ].getMap() );
			}
		} catch ( err ) {
			debug( 'Encountered an error: '+err.message );
			return false;
		}
		this.doc = doc;
		this.version += steps.length;
		this.steps = this.steps.concat( steps );
		if ( this.steps.length > MAX_STEP_HISTORY ) {
			this.steps = this.steps.slice( this.steps.length - MAX_STEP_HISTORY );
		}
		this.comments.mapThrough( new Mapping( maps ) );
		this.cursors.mapThrough( new Mapping( maps ) );
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
		scheduleSaveToDatabase();
		return { version: this.version, commentVersion: this.comments.version, users: this.userCount };
	}

	/**
	* Updates the cursor for the specified client.
	*
	* @param {string} clientID
	* @param {Object} cursor
	*/
	updateCursors( clientID, selection ) {
		this.cursors.update( clientID, selection );
	}

	/**
	* Get events between a given document version and the current document version.
	*
	* @param {number} version - document version
	* @param {number} commentVersion - version of comments
	* @param {number} cursorVersion - version of cursors
	* @returns {(boolean|Object)} document information or `false`
	*/
	getEvents( version, commentVersion, cursorVersion ) {
		if ( version < 0 || version > this.version ) {
			return false;
		}
		const startIndex = this.steps.length - ( this.version - version );
		debug( `Return steps starting with index ${startIndex} (number of steps: ${this.steps.length}; local version: ${version}; instance version: ${this.version})` );
		const commentStartIndex = this.comments.events.length - ( this.comments.version - commentVersion );
		if (
			startIndex < 0 &&
			commentStartIndex < 0 &&
			cursorVersion >= this.cursors.version
		) {
			return false;
		}
		return {
			steps: this.steps.slice( startIndex ),
			comment: this.comments.eventsAfter( commentStartIndex ),
			users: this.userCount,
			cursors: this.cursors.getCursors( cursorVersion )
		};
	}

	registerUser( email, name ) {
		if ( !( email in this.users ) ) {
			this._registerUser( email, name );
		}
	}

	_registerUser( email, name ) {
		if ( !( email in this.users ) ) {
			this.users[ email ] = true;
			this.cursors[ name ] = null;
			this.userCount += 1;
		}
	}
}


// MAIN //

const instances = Object.create( null );
let instanceCount = 0;

async function getInstance( id, member, doc ) {
	let inst = instances[ id ];
	if ( !inst ) {
		debug( `Retrieving "${id}" text document from database...` );
		const [ _, namespaceID, lessonID, componentID ] = RE_ID_PARTS.exec( id );
		const textDocument = await TextEditorDocument.findOne({ id: componentID, namespace: namespaceID, lesson: lessonID });
		if ( textDocument ) {
			inst = newInstance({
				id,
				doc: schema.nodeFromJSON( textDocument.doc ),
				comments: new Comments( textDocument.comments.map( c => Comment.fromJSON( c ) ) ),
				steps: textDocument.steps.map( json => {
					json = uncompressStepJSON( json );
					let out = Step.fromJSON( schema, json );
					out.clientID = json.clientID;
					return out;
				}),
				version: textDocument.version
			});
		} else {
			debug( `Creating new text document instance with identifier "${id}"...` );
			inst = newInstance({ id, doc });
		}
	}
	if ( member && member.email && member.name ) {
		inst.registerUser( member.email, member.name );
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
			inst.cursors.remove( member.name );
			inst.userCount -= 1;
		}
	}
}

function newInstance({ id, doc, comments, steps, version }) {
	if ( ++instanceCount > MAX_DOC_INSTANCES ) {
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
	instances[ id ] = new Instance({ id, doc, comments, steps, version });
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

function scheduleSaveToDatabase() {
	if ( !saveTimeout ) {
		saveTimeout = setTimeout( saveToDatabase, SAVE_INTERVAL );
	}
}

async function saveToDatabase() {
	saveTimeout = null;
	debug( 'Saving document instances to database...' );
	for ( let prop in instances ) {
		const instance = instances[ prop ];
		const [ _, namespaceID, lessonID, componentID ] = RE_ID_PARTS.exec( instance.id );
		const elem = {
			id: componentID,
			version: instance.version,
			doc: instance.doc.toJSON(),
			namespace: namespaceID,
			lesson: lessonID,
			comments: instance.comments.comments,
			steps: mergeSteps( instance.steps ).map( step => {
				let out = step.toJSON();
				out.clientID = step.clientID;
				out = compressStepJSON( out );
				return out;
			})
		};
		debug( 'Save document with id '+elem.id );
		await TextEditorDocument.updateOne({ id: componentID, namespace: namespaceID, lesson: lessonID }, elem, {
			upsert: true,
			setDefaultsOnInsert: true
		});
	}
}


// EXPORTS //

exports.getInstance = getInstance;

exports.instanceInfo = instanceInfo;

exports.removeFromInstances = removeFromInstances;
