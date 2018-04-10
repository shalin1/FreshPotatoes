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
	const error = new Error('invalid route');
	error.httpStatusCode = 404;
	return next(error);
});

// ERROR HANDLING MIDDLEWARE
app.use(function(err, req, res, next) {
	console.error(err.stack);
	if (err.status === 422) {
		res.status(err.httpStatusCode).send(err.message || 'message: key missing');
	} else if (err.status === 404) res.status(err.httpStatusCode).send({ message: err.message });
});

// ROUTE HANDLER
function getFilmRecommendations(req, res, next) {
	// DEFAULTS / SHAPE STATE
	let response = {
		recommendations: [],
		meta: {
			limit: 10,
			offset: 1
		}
	};

	// SET OFFSET + LIMIT
	if (isNaN(parseInt(req.params.id, 10))) {
		const error = new Error('invalid movie id');
		error.httpStatusCode = 422;
		return next(error);
		res.status(422).json({
			message: 'bad id'
		});
	}
	if (isNaN(parseInt(req.params.id, 10))) {
		const error = new Error('invalid movie id');
		error.httpStatusCode = 422;
		return next(error);
		res.status(422).json({
			message: 'bad id'
		});
	}

	const offset = parseInt(req.query.offset);
	if (offset >= 0) response.meta.offset = offset;

	if (req.query.limit) {
		const limit = parseInt(req.query.limit);
		if (limit >= 0) response.meta.limit = limit;
	}

	// FETCH FILM FROM LOCAL DB
	Film.findById(req.params.id).then(film => {
		if (typeof film == undefined) {
			const error = new Error({ message: 'no film with that id' });
			error.httpStatusCode = 422;
			return next(error);
		}
		response.recommendations.push(film.dataValues);
		console.log(response);
		return response;
	});
}

module.exports = app;
