const sqlite = require('sqlite'),
	Sequelize = require('sequelize'),
	request = require('request'),
	express = require('express'),
	app = express();

const {
	PORT = 3000,
	NODE_ENV = 'development',
	DB_PATH = './db/database.db',
	API_URL = 'http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1'
} = process.env;

// INIT SEQUELIZE
const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: DB_PATH
});

sequelize
	.authenticate()
	.then(() => {
		console.log('Connection has been established successfully.');
	})
	.catch(err => {
		console.error('Unable to connect to the database:', err);
	});

// DEFINE MODELS
const Film = sequelize.define(
	'film',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true },
		title: Sequelize.STRING,
		release_date: Sequelize.DATE,
		genre_id: Sequelize.INTEGER
	},
	{ timestamps: false }
);

const Genre = sequelize.define(
	'genre',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true },
		name: Sequelize.STRING
	},
	{ timestamps: false }
);

// START SERVER
Promise.resolve()
	.then(() =>
		app.listen(PORT, () => console.log(`App listening on port ${PORT}`))
	)
	.catch(err => {
		if (NODE_ENV === 'development') console.error(err.stack);
	});

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);
app.get('*', (req, res, next) => {
	const error = new Error('invalid route!');
	error.httpStatusCode = 404;
	return next(error);
});

// ROUTE HANDLER
function getFilmRecommendations(req, res, next) {
	let response = {
		recommendations: [],
		meta: {
			limit: 10,
			offset: 1
		}
	};

	// MOVIE ID SANITIZATION
	if (isNaN(parseInt(req.params.id, 10))) {
		const error = new Error('invalid movie id');
		error.httpStatusCode = 422;
		return next(error);
	}

	// LIMIT/OFFSET SANITIZATION + SETTING
	if (req.query.limit) {
		let limit = parseInt(req.query.limit, 10);
		if (isNaN(limit)) {
			const error = new Error('invalid limit');
			error.httpStatusCode = 422;
			return next(error);
		}
		if (limit >= 0) response.meta.limit = limit;
	}

	if (req.query.offset) {
		let offset = parseInt(req.query.offset, 10);
		if (isNaN(offset)) {
			const error = new Error('invalid offset');
			error.httpStatusCode = 422;
			return next(error);
		}
		if (offset >= 0) response.meta.offset = offset;
	}

	// FETCH FILM IDS WITH MATCHING GENRE WITHIN DATE RANGE FROM LOCAL DB
	Film.findById(req.params.id).then(film => {
		if (film === null) {
			const error = new Error('no film with that id');
			error.httpStatusCode = 422;
			return next(error);
		}
		let dateRangeStart = new Date(film.release_date);
		dateRangeStart.setFullYear(-15 + dateRangeStart.getFullYear());
		let dateRangeEnd = new Date(film.release_date);
		dateRangeEnd.setFullYear(15 + dateRangeEnd.getFullYear());

		Film.findAll({
			attributes: ['id'],
			where: {
				genre_id: film.genre_id,
				release_date: { $between: [dateRangeStart, dateRangeEnd] }
			},
			raw: true
		}).then(films => {
			const ids = films.map(film => film.id);

			// REQUEST REVIEWS BLOB FOR CANDIDATES FROM 3RD PARTY API
			const sortedRecommendationIds = request(
				{ url: API_URL + '?films=' + ids.join(',') },
				(err, res, body) => {
					if (err) {
						return next(err);
					}
					// FILTER RECOMMENDATIONS PER SPEC
					const averageRating = film => {
						let ratingsSum = 0;
						film.reviews.forEach(review => {
							ratingsSum += review.rating;
						});
						return ratingsSum / film.reviews.length;
					};

					const allFilms = JSON.parse(body);
					console.log(
						allFilms
							.filter(
								film => film.reviews.length >= 5 && averageRating(film) > 4.0
							)
							// ADD RELEVANT API DATA TO RESPONSE
							.map(film => {
								return {
									id: film.film_id,
									averageRating: averageRating(film),
									reviews: film.reviews.length
								};
							})
							.sort((a, b) => a.id - b.id)
					);
				}
			);
		});
	});
}

// ERROR HANDLING MIDDLEWARE
// note that i would probably implement NODE_ENV dependent output if specs were different
// (HTML w/ stack trace for development, json for production)
app.use(function(err, req, res, next) {
	res.status(err.httpStatusCode || 500);
	res.send({ message: err.message || 'key missing' });
});

module.exports = app;
