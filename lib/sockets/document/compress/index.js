/*
* Adapted from: https://github.com/xylk/prosemirror-compress
*
* Copyright (c) 2017 xylk
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.} keysMap
*/

// VARIABLES //

const markTypeValuesMap = {
	em: ['e'],
	strong: ['s'],
	link: ['l'],
	code: ['c']
};

const markAttrsKeysMap = {
	href: ['h'], // link
	title: ['t'] // link
};

const markKeysMap = {
	type: ['t', markTypeValuesMap],
	attrs: ['a', markAttrsKeysMap]
};

const contentTypeValuesMap = {
	doc: ['d'],
	paragraph: ['p'],
	blockquote: ['b'],
	horizontal_rule: ['h_r'],
	heading: ['h'],
	code_block: ['c_b'],
	text: ['t'],
	image: ['i'],
	hard_break: ['h_b'],
	ordered_list: ['o_l'],
	bullet_list: ['b_l'],
	list_item: ['l_i'],
	table: ['ta'],
	table_row: ['t_r'],
	table_cell: ['t_c']
};

const contentAttrsKeysMap = {
	level: ['l'], // heading
	src: ['s'], // image
	alt: ['a'], // image
	title: ['t'], // image
	order: ['o'], // ordered_list
	columns: ['c'] // table, table_row
};

const contentKeysMap = {
	type: ['t', contentTypeValuesMap],
	text: ['te'],
	attrs: ['a', contentAttrsKeysMap],
	level: ['l'],
	marks: ['m', markKeysMap]
}
contentKeysMap.content = ['c', contentKeysMap];

const sliceKeysMap = {
	content: ['c', contentKeysMap],
	openStart: ['oS'],
	openEnd: ['oE'],
	openLeft: ['oL'],
	openRight: ['oR'],
};

const selectionTypeValuesMap = {
	text: ['t'],
	node: ['n'],
	all: ['a']
};

const stepKeysMap = {
	stepType: ['sT'],
	from: ['f'],
	to: ['t'],
	structure: ['st'],
	insert: ['i'],
	gapFrom: ['gF'],
	gapTo: ['gT'],
	slice: ['s', sliceKeysMap],
	mark: ['m', markKeysMap]
};

const selectionKeysMap = {
	type: ['t', selectionTypeValuesMap],
	head: ['h'],
	anchor: ['a'],
	node: ['n'],
	after: ['af']
};

const stateKeysMap = {
	doc: ['d', contentKeysMap],
	selection: ['s', selectionKeysMap],
	storedMarks: ['sM', markKeysMap]
};


// FUNCTIONS //


function invertKeysMap( keysMap ) {
	const recursiveInverseKeys = [];
	const inverseKeysMap = Object.assign(...Object.entries( keysMap ).map(
		function ([ key, [ inverseKey, valueKeysMap ] ]) {
			return ({ // '(' because of https://gitlab.com/Rich-Harris/buble/issues/182
			[inverseKey]: [
				key,
				valueKeysMap && (
				valueKeysMap === keysMap ?
					recursiveInverseKeys.push(inverseKey)
				:
					invertKeysMap(valueKeysMap)
				),
			],
			})
		}
	));
	recursiveInverseKeys.forEach(
		function (inverseKey) {
			inverseKeysMap[inverseKey][1] = inverseKeysMap
		}
	);
	return inverseKeysMap;
}

function mapKeys(keysMap, obj) {
	return (
		typeof obj === 'string' ?
		(keysMap[obj] || [ obj ])[0]
		:
		Array.isArray(obj) ?
		obj.map(mapKeys.bind(0, keysMap))
		:
		Object.assign( {}, ...Object.entries(obj).map(
			function ([ key, value ]) {
				const [ mappedKey = key, valueKeysMap ] = keysMap[key] || []
				return ({ // '(' because of https://gitlab.com/Rich-Harris/buble/issues/182
					[mappedKey]: (
					valueKeysMap && value ?
						mapKeys(valueKeysMap, value)
					:
						value
					),
				})
			}
		))
	);
}

export function keysMappers( keysMap ) {
	return [
		mapKeys.bind( 0, keysMap ),
		mapKeys.bind( 0, invertKeysMap( keysMap ) ),
	]
}


// MAIN //

const main = {};
main.uncompressStateJSON = keysMappers(stateKeysMap)[1];
main.uncompressSelectionJSON = keysMappers(selectionKeysMap)[1];
main.uncompressStepJSON = keysMappers(stepKeysMap)[1];

delete selectionKeysMap[ 'type' ];
delete stepKeysMap['slice'][1]['openStart'];
delete stepKeysMap['slice'][1]['openEnd'];

main.compressStateJSON = keysMappers(stateKeysMap)[0]
main.compressSelectionJSON = keysMappers(selectionKeysMap)[0]
main.compressStepJSON = keysMappers(stepKeysMap)[0]


// EXPORTS //

module.exports = main;
