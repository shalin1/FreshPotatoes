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

// test sequalize
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

app.use(function(err, req, res, next) {
	console.error(err.stack);
	res.status(err.httpStatusCode).send({ message: 'key missing' });
});

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
	res.status(200).send('Not Implemented');
}

module.exports = app;
