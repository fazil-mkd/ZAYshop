const express = require('express')
const app = express()

const NotFoundError = require('../helpers/NotFoundError');



const errorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).render('page-404', { message: 'Validation error: ' + err.message });
  }

  if (err.code === 11000) {
    return res.status(409).render('page-404', { message: 'Duplicate key error: ' + err.message });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).render('page-404', { message: 'Token has expired' });
  }

  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).render('page-404', { message: err.message });
  }

  res.status(500).render('page-404', { message: 'Internal Server Error' });
};


const notFoundHandler = (req, res, next) => {
  res.status(404).render('page-404', { message: 'Route not found' });
};





module.exports = { errorHandler, notFoundHandler, NotFoundError };