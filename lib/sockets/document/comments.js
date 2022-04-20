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

const isNull = require( '@stdlib/assert/is-null' );


// MAIN //

/**
* Individual comment left by a user on a document.
*/
class Comment {
	constructor({ from, to, text, id }) {
		this.from = from;
		this.to = to;
		this.text = text;
		this.id = id;
	}

	static fromJSON( json ) {
		return new Comment( json );
	}
}

/**
* A document's comments.
*/
class Comments {
	constructor( comments ) {
		this.comments = comments || [];
		this.events = [];
		this.version = 0;
	}

	mapThrough( mapping ) {
		for ( let i = this.comments.length - 1; i >= 0; i-- ) {
			const comment = this.comments[ i ];
			const from = mapping.map( comment.from, 1 );
			const to = mapping.map( comment.to, -1 );
			if ( from >= to ) {
				this.comments.splice( i, 1 );
			} else {
				comment.from = from;
				comment.to = to;
			}
		}
	}

	created( data ) {
		this.comments.push( new Comment( data ) );
		this.events.push({ type: 'create', id: data.id });
		this.version += 1;
	}

	index( id ) {
		for ( let i = 0; i < this.comments.length; i++ ) {
			if ( this.comments[ i ].id === id ) {
				return i;
			}
		}
	}

	deleted( id ) {
		const found = this.index( id );
		if ( !isNull( found ) ) {
			this.comments.splice( found, 1 );
			this.version += 1;
			this.events.push({ type: 'delete', id: id });
		}
	}

	eventsAfter( startIndex ) {
		const result = [];
		for ( let i = startIndex; i < this.events.length; i++ ) {
			const event = this.events[ i ];
			if ( event.type === 'delete' ) {
				result.push( event );
			} else {
				const found = this.index( event.id );
				if ( !isNull( found ) ) {
					const comment = this.comments[ found ];
					result.push({
						type: 'create',
						id: event.id,
						text: comment.text,
						from: comment.from,
						to: comment.to
					});
				}
			}
		}
		return result;
	}
}


// EXPORTS //

exports.Comment = Comment;

exports.Comments = Comments;
