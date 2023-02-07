const lessonIds = [
    ObjectId("6075e18e82443304c3a46348"),
    ObjectId("6075e20682443304c3a46350"),
    ObjectId("61956dcba011aec3438b260d")
];
const components = [
	[
		'intro-video',
		'free-text-question-1',
		'free-text-question-2',
		'lesson-submit'
	],
	[
		'exam-question-1',
		'exam-question-2',
		'exam-question-3',
		'lesson-submit'

	],
	[
		'free-text-question-1',
		'multiple-choice-question-1',
		'quiz-1'
	]
];
const users = [
	ObjectId("6171a92ccf6e189c3144f65a"), // genovese
	ObjectId("60186c3ff996a8399ca8276d"), // pb
	ObjectId("600e0ad44c7a064db2b42556") // admin
];


db.assessments.insertMany([
	{
		user: users[0],
		lesson: lessonIds[0],
		component: components[0][0],
		componentType: 'video-player',
		assessment: 'interacted',
		value: 100,
		time: 1654623007711,
	},
	{
		user: users[0],
		lesson: lessonIds[0],
		component: components[0][1],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 50,
		time: 1654623007711 + 20000,
	},
	{
		user: users[0],
		lesson: lessonIds[0],
		component: components[0][2],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 80,
		time: 1654623007711 - 15000,
	},
	{
		user: users[0],
		lesson: lessonIds[0],
		component: components[0][3],
		componentType: 'lesson-submit',
		assessment: 'completed',
		value: 100,
		time: 1654623007711 + 20000,
	},
	{
		user: users[0],
		lesson: lessonIds[1],
		component: components[1][0],
		componentType: 'number-question',
		assessment: 'correct',
		value: 100,
		time: 1654623007711,
	},
	{
		user: users[0],
		lesson: lessonIds[1],
		component: components[1][1],
		componentType: 'number-question',
		assessment: 'correct',
		value: 80,
		time: 1654623007711 + 20000,
	},
	{
		user: users[0],
		lesson: lessonIds[1],
		component: components[1][2],
		componentType: 'number-question',
		assessment: 'correct',
		value: 100,
		time: 1654623007711 - 15000,
	},
	{
		user: users[0],
		lesson: lessonIds[2],
		component: components[2][0],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 100,
		time: 1654623007711 + 10000, // random increment in the range tens of thousands of milliseconds
	},
	{
		user: users[0],
		lesson: lessonIds[2],
		component: components[2][1],
		componentType: 'multiple-choice-question',
		assessment: 'completed',
		value: 75,
		time: 1654623007711 + 10000,
	},
	{
		user: users[0],
		lesson: lessonIds[2],
		component: components[2][2],
		componentType: 'quiz',
		assessment: 'completed',
		value: 100,
		time: 1654623007711 + 300000,
	},
	{
		user: users[1],
		lesson: lessonIds[0],
		component: components[0][0],
		componentType: 'video-player',
		assessment: 'interacted',
		value: 100,
		time: 1654623007711 + 10000,
	},
	{
		user: users[1],
		lesson: lessonIds[0],
		component: components[0][1],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 50,
		time: 1654623007711 + 90000,
	},
	{
		user: users[1],
		lesson: lessonIds[0],
		component: components[0][2],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 80,
		time: 1654623007711 + 100000,
	},
	{
		user: users[1],
		lesson: lessonIds[0],
		component: components[0][3],
		componentType: 'lesson-submit',
		assessment: 'completed',
		value: 100,
		time: 1654623007711 + 90000,
	},
	{
		user: users[1],
		lesson: lessonIds[1],
		component: components[1][0],
		componentType: 'number-question',
		assessment: 'correct',
		value: 100,
		time: 1654623007711 + 10000,
	},
	{
		user: users[1],
		lesson: lessonIds[1],
		component: components[1][1],
		componentType: 'number-question',
		assessment: 'correct',
		value: 80,
		time: 1654623007711 + 270000,
	},
	{
		user: users[1],
		lesson: lessonIds[1],
		component: components[1][2],
		componentType: 'number-question',
		assessment: 'correct',
		value: 100,
		time: 1654623007711 + 100000,
	},
	{
		user: users[2],
		lesson: lessonIds[0],
		component: components[0][0],
		componentType: 'video-player',
		assessment: 'interacted',
		value: 100,
		time: 1654623007711 + 10000,
	},
	{
		user: users[2],
		lesson: lessonIds[0],
		component: components[0][1],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 50,
		time: 1654623007711 + 90000,
	},
	{
		user: users[2],
		lesson: lessonIds[0],
		component: components[0][2],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 20,
		time: 1654623007711 + 100000,
	},
	{
		user: users[2],
		lesson: lessonIds[0],
		component: components[0][3],
		componentType: 'lesson-submit',
		assessment: 'completed',
		value: 100,
		time: 1654623007711 + 90000,
	},
	{
		user: users[2],
		lesson: lessonIds[1],
		component: components[1][0],
		componentType: 'number-question',
		assessment: 'correct',
		value: 100,
		time: 1654623007711 + 10000,
	},
	{
		user: users[2],
		lesson: lessonIds[1],
		component: components[1][1],
		componentType: 'number-question',
		assessment: 'correct',
		value: 80,
		time: 1654623007711 + 270000,
	},
	{
		user: users[2],
		lesson: lessonIds[1],
		component: components[1][2],
		componentType: 'number-question',
		assessment: 'correct',
		value: 100,
		time: 1654623007711 + 100000,
	},
	{
		user: users[2],
		lesson: lessonIds[2],
		component: components[2][0],
		componentType: 'free-text-question',
		assessment: 'completed',
		value: 40,
		time: 1654623007711 + 10000,
	},
	{
		user: users[2],
		lesson: lessonIds[2],
		component: components[2][1],
		componentType: 'multiple-choice-question',
		assessment: 'completed',
		value: 75,
		time: 1654623007711 + 10000,
	},
	{
		user: users[2],
		lesson: lessonIds[2],
		component: components[2][2],
		componentType: 'quiz',
		assessment: 'completed',
		value: 60,
		time: 1654623007711 + 300000,
	}
]);



db.lessons.updateOne({ _id: lessonIds[ 0 ] }, { $set: {
	assessments: [
		{
			name: 'watched-video',
			coverage: [ 'include', 'intro-video' ],
			ref: 'interacted',
			rule: [ 'average' ],
			level: 'lesson'
		},
		{
			name: 'did-stuff',
			coverage: [ 'all' ],
			ref: 'completed',
			rule: [ 'average' ],
			level: 'lesson'
		}
	]
} } );

db.lessons.updateOne({ _id: lessonIds[ 1 ] }, { $set: {
	assessments: [
		{
			name: 'exam-score',
			coverage: [ 'include', 'exam-question-1', 'exam-question-2', 'exam-question-3' ],
			ref: 'correct',
			rule: [ 'average' ],
			level: 'lesson'
		},
		{
			name: 'completed',
			coverage: [ 'all' ],
			ref: 'completed',
			rule: [ 'average' ],
			level: 'lesson'
		}
	]
} } );

db.lessons.updateOne({ _id: lessonIds[ 2 ] }, { $set: {
	assessments: [
		{
			name: 'quiz',
			coverage: [ 'include', 'quiz-1' ],
			ref: 'completed',
			rule: [ 'average' ],
			level: 'lesson'
		},
		{
			name: 'exclude-quiz',
			coverage: [ 'exclude', 'quiz-1' ],
			ref: 'completed',
			rule: [ 'average' ],
			level: 'lesson'
		}
	]
} } );
