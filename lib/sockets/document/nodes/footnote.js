// MAIN //

const footnoteSpec = {
	group: 'inline',
	content: 'inline*',
	inline: true,
	atom: true,
	toDOM: () => [ 'footnote', 0 ],
	parseDOM: [{
		tag: 'footnote'
	}]
};


// EXPORTS //

module.exports = footnoteSpec;
