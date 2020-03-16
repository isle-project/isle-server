// MAIN //

function harmonizeSketchpadElements( userElements, nUndos, userPages = [], ownerPages = [] ) {
	userPages = userPages.map( x => x.page );
	ownerPages = ownerPages.map( x => x.page );

	console.log( 'USER PAGES:'+userPages );
	for ( let i = 0; i < userPages.length; i++ ) {
		const page = userPages[ i ];
		if ( !ownerPages.includes( page ) ) {
			console.log( 'Removing elements from page '+page );
			userElements.splice( page, 1 );
			nUndos.splice( page, 1 );
		}
	}
	console.log( 'ownerPages:' + ownerPages );
	for ( let i = 0; i < ownerPages.length; i++ ) {
		const page = ownerPages[ i ];
		if ( !userPages.includes( page ) ) {
			console.log( 'Adding an empty page at position '+page );
			userElements.splice( page, 0, [] );
			nUndos.splice( page, 0, 0 );
		}
	}
}


// EXPORTS //

module.exports = harmonizeSketchpadElements;
