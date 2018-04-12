const sqlite = require('sqlite');
const Sequelize = require('sequelize');
const request = require('request');
const express = require('express');
const app = express();

const {
  PORT = 3000,
  NODE_ENV = 'development',
  DB_PATH = './db/database.db',
  API_URL = 'http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1'
} = process.env;

// Initalize sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DB_PATH,
});

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Define models
const Film = sequelize.define(
  'film',
  {
    id: {type: Sequelize.INTEGER, primaryKey: true},
    title: Sequelize.STRING,
    release_date: Sequelize.DATE,
    genre_id: Sequelize.INTEGER,
  },
  {timestamps: false}
);

const Genre = sequelize.define(
  'genre',
  {
    id: {type: Sequelize.INTEGER, primaryKey: true},
    name: Sequelize.STRING,
  },
  {timestamps: false}
);

// Start server
Promise.resolve()
  .then(() =>
    app.listen(PORT, () => console.log(`App listening on port ${PORT}`))
  )
  .catch(err => {
    if (NODE_ENV === 'development') console.error(err.stack);
  });

// Declare routes
app.get('/films/:id/recommendations', getFilmRecommendations);
// Catch all invalid routes
app.get('*', (req, res, next) => {
  const error = new Error('invalid route!');
  error.httpStatusCode = 404;
  return next(error);
});

// Fire up route handler
function getFilmRecommendations(req, res, next) {
  let response = {
    recommendations: [],
    meta: {
      limit: 10,
      offset: 0,
    },
  };

  // Sanitize :film_id param
  if (isNaN(parseInt(req.params.id, 10))) {
    const error = new Error('invalid movie id');
    error.httpStatusCode = 422;
    return next(error);
  }

  // Sanitize + set limit & offset
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

  // Fetch film and genre name from local DB
  Film.findById(req.params.id).then(film => {
    if (film === null) {
      const error = new Error('no film with that id');
      error.httpStatusCode = 422;
      return next(error);
    }

    Genre.findById(film.genre_id).then(genre => {
      if (genre === null) {
        const error = new Error('genre lookup error');
        error.httpStatusCode = 422;
        return next(error);
      }
      let dateRangeStart = new Date(film.release_date);
      dateRangeStart.setFullYear(-15 + dateRangeStart.getFullYear());
      let dateRangeEnd = new Date(film.release_date);
      dateRangeEnd.setFullYear(15 + dateRangeEnd.getFullYear());

      // Fetch all films matching query film genre from local db
      return Film.findAll({
        attributes: ['id', 'title', 'release_date'],
        where: {
          genre_id: genre.id,
          release_date: {$between: [dateRangeStart, dateRangeEnd]},
        },
        raw: true,
      }).then(allFilms => {
        const ids = allFilms.map(film => film.id);

        // Query 3rd Party API for reviews blob for all those films
        const sortedRecommendationIds = request(
          {url: API_URL + '?films=' + ids.join(',')},
          (err, res, body) => {
            if (err) {
              return next(err);
            }

            // Filter recommendations by rating quantity/quality
            const averageRating = film => {
              let ratingsSum = 0;
              film.reviews.forEach(review => {
                ratingsSum += review.rating;
              });
              return (
                Math.round(ratingsSum / film.reviews.length * 100, 1) / 100
              );
            };

            let allReviews = JSON.parse(body);
            allReviews
              .filter(
                film => film.reviews.length >= 5 && averageRating(film) > 4.0
              )

              // Add data to response
              .map(film => {
                let dbData = allFilms.find(data => {
                  return film.film_id === data.id;
                });
                response.recommendations.push({
                  id: film.film_id,
                  title: dbData.title,
                  releaseDate: dbData.release_date,
                  genre: genre.name,
                  averageRating: averageRating(film),
                  reviews: film.reviews.length,
                });
              })
              .sort((a, b) => a.id - b.id);
            createResponse();
          }
        );
      }).catch(function(err){next(err)});
    });
  });

  // Start response handler
  // Handle limit + offset
  const createResponse = () => {
    response.recommendations.splice(0, response.meta.offset);
    response.recommendations.splice(
      response.meta.limit,
      response.recommendations.length - response.meta.limit
    );
    sendResponse();
  };
  // Finally return response
  const sendResponse = () => {
    res.status(200).json(response);
  };
}

// Error handling middleware
// note that i would probably implement NODE_ENV dependent output if specs were different
// (HTML w/ stack trace for development, json for production)
app.use(function(err, req, res, next) {
  res.status(err.httpStatusCode || 500);
  res.send({message: err.message || 'key missing'});
});

module.exports = app;
