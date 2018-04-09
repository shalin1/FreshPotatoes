const sqlite = require('sqlite'),
	Sequelize = require('sequelize'),
	request = require('request'),
	express = require('express'),
	app = express();

const {
	PORT = 3000,
	NODE_ENV = 'development',
	DB_PATH = './db/database.db'
} = process.env;

const API_URL = 'http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1'

var sequelize = new Sequelize('database', 'username', 'password', {
	  host: 'localhost',
	  dialect: 'mysql'|'mariadb'|'sqlite'|'postgres'|'mssql',

	  pool: {
	    max: 5,
	    min: 0,
	    idle: 10000
	  },

	  // SQLite only
	  storage: 'path/to/database.sqlite'
	});

	// Or you can simply use a connection uri
	var sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname');


)
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
app.get('/', (req, res) => res.send('Hello World!'));

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
	res.status(200).send('Not Implemented');
}

module.exports = app;
