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
const SAVE_INTERVAL = 60000; // Save document instances every minute...
const MAX_DOC_INSTANCES = 400; // Maximum number of document instances to keep in memory
const DEFAULT_EDITOR_VALUE = repeat( '\n', 15 );
const RE_ID_PARTS = /^([^-]+)-([^-]+)-([\s\S]+?)$/;


// FUNCTIONS //

/**
* Merges a sequence of steps into as few steps as possible given the authorship of the steps.
*
* @private
* @param {Array} steps - sequence of steps
* @returns {Array} merged steps
*/
function mergeSteps( steps ) {
	const mergedSteps = [];
	let step = steps[ 0 ];
	for ( let i = 1; i < steps.length; i++ ) {
		let merged;
		if ( !steps[ i ] ) {
			continue;
		}
		if ( steps[ i ].clientID === step.clientID ) {
			merged = step.merge( steps[ i ] );
		}
		if ( merged ) {
			step = merged;
			step.clientID = steps[ i ].clientID;
		} else {
			mergedSteps.push( step );
			step = steps[ i ];
		}
		if ( i === steps.length - 1 ) {
			mergedSteps.push( step );
		}
	}
	return mergedSteps;
}

/**
* Document instance.
*/
class Instance {
	constructor({ id, doc, comments, version = 0, steps = [], users = {}}) {
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
		this.lastActive = Date.now(); // Last time the instance was loaded
		this.users = users;
		this.cursors = new Cursors();
		this.userCount = 0;
	}

	/**
	* Adds steps from a user to the document instance.
	*
	* @param {number} version - document version
	* @param {Array} steps - steps array
	* @param {Array} comments - comment array
	* @param {string} clientID - id of client
	* @returns {(boolean|Object} false if the steps could not be added, otherwise an object containing the version numbers and user counts
	*/
	addEvents( version, steps, comments, clientID ) {
		if ( version < 0 || version >= this.version ) {
			// TODO: When can this happen?
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
			// TODO: Is this necessary? Investigate whether the current limit is appropriate.
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
		scheduleSaveToDatabase( this.id, this.version );
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

	/**
	* Registers a user with the document instance.
	*
	* @param {string} email - user email
	* @param {string} name - user name
	* @param {(string|null)} id - user id
	*/
	registerUser( email, name, id = null ) {
		if ( !this.users[ email ] || !this.users[ email ].active ) {
			this.users[ email ] = {
				active: true,
				id: id
			};
			this.cursors[ name ] = null;
			this.userCount += 1;
		}
	}
}


// MAIN //

const instances = Object.create( null );
const instancesToSave = {}; // Object mapping id to versions
let instanceCount = 0;

/**
* Returns a document instance from the in-memory store or queries the database.
*
* @param {string} id - document id
* @param {Object} member - member retrieving the document (to be registered to the instance as a user)
* @param {Object} doc - document object used to initialize new document instance (if required)
* @returns {Instance} document instance
*/
async function getInstance( id, member, doc ) {
	let inst = instances[ id ];
	if ( !inst ) {
		debug( `Retrieving "${id}" text document from database...` );
		const [ _, namespaceID, lessonID, componentID ] = RE_ID_PARTS.exec( id );
		const textDocument = await TextEditorDocument
			.findOne({ id: componentID, namespace: namespaceID, lesson: lessonID })
			.populate( 'users', [ 'email' ])
			.exec();
		if ( textDocument ) {
			const users = {};
			for ( let i = 0; i < textDocument.users.length; i++ ) {
				users[ textDocument.users[ i ].email ] = {
					active: false,
					id: textDocument.users[ i ]._id
				};
			}
			inst = newInstance({
				id,
				doc: schema.nodeFromJSON( textDocument.doc || doc ), // Use sent document if the document in the database is empty...
				comments: new Comments( textDocument.comments.map( c => Comment.fromJSON( c ) ) ),
				steps: textDocument.steps.map( json => {
					json = uncompressStepJSON( json );
					let out = Step.fromJSON( schema, json );
					out.clientID = json.clientID;
					return out;
				}),
				version: textDocument.version,
				users
			});
		} else {
			debug( `Creating new text document instance with identifier "${id}"...` );
			inst = newInstance({ id, doc });
		}
	}
	if ( member && member.email && member.name ) {
		inst.registerUser( member.email, member.name, member.id );
	}
	inst.lastActive = Date.now();
	return inst;
}


/**
* Removes a user from all instances.
*
* @param {Object} member - user object
* @param {string} member.email - user email
* @param {string} member.name - user name
* @returns {void}
*/
function removeFromInstances( member ) {
	const keys = objectKeys( instances );
	for ( let i = 0; i < keys.length; i++ ) {
		const inst = instances[ keys[ i ] ];
		if ( inst.users[ member.email ] && inst.users[ member.email ].active ) {
			inst.users[ member.email ].active = false;
			inst.cursors.remove( member.name );
			inst.userCount -= 1;
		}
	}
}

/**
* Creates a new instance and adds it to the instances object.
*
* @param {Object} options - options
* @param {string} options.id - instance id
* @param {Object} options.doc - ProseMirror document object
* @param {Array} options.comments - array of comments
* @param {Array} options.steps - array of steps that have been applied to the document
* @param {number} options.version - current document version
* @returns {Object} document instance
*/
function newInstance({ id, doc, comments, steps, version }) {
	if ( ++instanceCount > MAX_DOC_INSTANCES ) {
		let oldest = null;
		for ( let id in instances ) {
			if ( hasOwnProp( instances, id ) && !hasOwnProp( instancesToSave, id ) ) {
				let inst = instances[ id ];
				if ( !oldest || inst.lastActive < oldest.lastActive ) {
					oldest = inst;
				}
			}
		}
		if ( oldest ) {
			delete instances[ oldest.id ];
			--instanceCount;
		}
	}
	instances[ id ] = new Instance({ id, doc, comments, steps, version });
	return instances[ id ];
}

/**
* Returns document instance information objects.
*
* @returns {Array} list of objects with keys `id` and number of `users` for each instance
*/
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

/**
* Schedules a save of all in-memory document instances to the database.
*
* @param {string} id - document id
* @param {number} version - document version
*/
function scheduleSaveToDatabase( id, version ) {
	instancesToSave[ id ] = Math.max( instancesToSave[ id ] || 0, version );
	if ( !saveTimeout ) {
		saveTimeout = setTimeout( saveToDatabase, SAVE_INTERVAL );
	}
}

/**
* Saves all in-memory document instances to the database.
*/
async function saveToDatabase() {
	saveTimeout = null;
	debug( 'Saving document instances to database...' );
	const keys = objectKeys( instancesToSave );
	for ( let i = 0; i < keys.length; i++ ) {
		const docId = keys[ i ];
		delete instancesToSave[ docId ];
		const instance = instances[ docId ];

		const [ _, namespaceID, lessonID, componentID ] = RE_ID_PARTS.exec( instance.id );
		const users = [];
		const emails = objectKeys( instance.users );
		for ( let i = 0; i < emails.length; i++ ) {
			const user = instance.users[ emails[ i ] ];
			if ( user.id ) {
				users.push( user.id );
			}
		}
		const doc = instance.doc ? instance.doc.toJSON() : instance.doc;
		if ( doc === null ) {
			return debug( 'Document instance has no document, but existing document has a document. Aborting save...' );
		}
		const elem = {
			id: componentID,
			version: instance.version,
			doc: doc,
			namespace: namespaceID,
			lesson: lessonID,
			comments: instance.comments.comments,
			steps: mergeSteps( instance.steps ).map( step => {
				let out = step.toJSON();
				out.clientID = step.clientID;
				out = compressStepJSON( out );
				return out;
			}),
			users
		};
		debug( `Save document with id ${elem.id} and ${elem.users.length} users...` );
		try {
			await TextEditorDocument.updateOne({ id: componentID, namespace: namespaceID, lesson: lessonID }, elem, {
				upsert: true,
				setDefaultsOnInsert: true
			});
		} catch ( err ) {
			debug( `Document couldn't be updated in database. Error message: ${err.message}.` );
		}
	}
}


// EXPORTS //

exports.getInstance = getInstance;

exports.instanceInfo = instanceInfo;

exports.saveToDatabase = saveToDatabase;

exports.removeFromInstances = removeFromInstances;
