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

// MAIN //

/**
* An object to assist in waiting for a collaborative editing instance to publish a new version before sending the version event data to the client.
*/
class Waiting {
	constructor( resp, inst, ip, finish ) {
		this.resp = resp;
		this.inst = inst;
		this.ip = ip;
		this.finish = finish;
		this.done = false;
		resp.setTimeout( 1000 * 60 * 5, () => {
			this.abort();
			// this.send( Output.json({}) );
		});
	}

	abort() {
		let found = this.inst.waiting.indexOf( this );
		if ( found > -1 ) {
			this.inst.waiting.splice( found, 1 );
		}
	}

	send( output ) {
		if ( this.done ) {
			return;
		}
		output.resp( this.resp );
		this.done = true;
	}
}


// EXPORTS //

module.exports = Waiting;
