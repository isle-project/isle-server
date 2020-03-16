// MAIN //

function harmonizeSketchpadElements( userElements, nUndos, userPages, ownerPages ) {
	userPages = userPages.map( x => x.page );
	ownerPages = ownerPages.map( x => x.page );

	for ( let i = 0; i < userPages.length; i++ ) {
		const page = userPages[ i ];
		if ( !ownerPages.includes( page ) ) {
			userElements.splice( page, 1 );
			nUndos.splice( page, 1 );
		}
	}
	for ( let i = 0; i < ownerPages.length; i++ ) {
		const page = ownerPages[ i ];
		if ( !userPages.includes( page ) ) {
			userElements.splice( page, 0, [] );
			nUndos.splice( page, 0, 0 );
		}
	}
}


// EXPORTS //

module.exports = harmonizeSketchpadElements;
