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

const { getImageAttrs } = require( './image.js' );


// MAIN //

const plotSpec = {
	attrs: {
		src: {},
		plotID: { default: null },
		align: { default: null },
		alt: { default: '' },
		crop: { default: null },
		title: { default: '' },
		meta: { default: null },
		width: { default: null },
		height: { default: null },
		rotate: { default: null }
	},
	inline: true,
	group: 'inline',
	draggable: true,
	toDOM: node => {
		return [ 'span',
			{
				class: 'img-container',
				'data-plot-id': node.attrs.plotID
			},
			[ 'img',
				{
					src: node.attrs.src,
					align: node.attrs.align,
					alt: node.attrs.alt,
					crop: node.attrs.crop,
					title: node.attrs.title,
					width: node.attrs.width,
					height: node.attrs.height,
					rotate: node.attrs.rotate
				}
			],
			[ 'pre',
				{
					class: 'img-tooltip'
				},
				node.attrs.meta
			]
		];
	},
	parseDOM: [{
		priority: 51,
		tag: 'img[data-plot-id]',
		getAttrs: dom => {
			const align = dom.getAttribute( 'align' );
			const width = dom.getAttribute( 'width' );
			const attrs = getImageAttrs( dom );
			if ( !align ) {
				attrs.align = 'center';
			}
			if ( !width ) {
				attrs.width = 550;
			}
			const plotID = dom.getAttribute( 'data-plot-id' );
			const meta = dom.getAttribute( 'data-plot-meta' );
			return { ...attrs, meta, plotID };
		}
	}]
};


// EXPORTS //

module.exports = plotSpec;
