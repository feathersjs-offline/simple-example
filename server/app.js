const path = require('path');
const favicon = require('serve-favicon');
const compress = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./logger');

const feathers = require('@feathersjs/feathers');
const configuration = require('@feathersjs/configuration');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');

const middleware = require('./middleware');
const services = require('./services');
const appHooks = require('./app.hooks');
const channels = require('./channels');

const app = express(feathers());

// Load app configuration
app.configure(configuration());
// Enable security, CORS, compression, favicon and body parsing
app.use(helmet());
app.use(cors());
app.use(compress());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));

// Add middleware to add header for CSP
app.use('/', function(req, res, next) {
  res.setHeader("Content-Security-Policy", `img-src 'self'; child-src 'self'; style-src 'unsafe-inline' https://cdn.jsdelivr.net 'self'; default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-elem https://cdn.jsdelivr.net https://cdnjs.cloudflare.com 'self';`);
  next();
});

// Host the public folder
app.use('/', express.static(app.get('public')));

// Set up Plugins and providers
app.configure(express.rest());
app.configure(socketio());

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
// Set up our services (see `services/index.js`)
app.configure(services);
// Set up event channels (see channels.js)
app.configure(channels);

// Configure a middleware for 404s and the error handler
app.use(express.notFound());
app.use(express.errorHandler({ logger }));

app.hooks(appHooks);

// Publish all messages service events to channel 'offlineRealtimeDemo
app.service('messages').publish((data, context) => {
  return app.channel('offlineRealtimeDemo');
});

app.service('messages').create({text: 'This is a message from The Creator Himself!', updatedAt: new Date() })
  .then(res => console.log(`result: ${JSON.stringify(res)}`))
  .catch(err => console.error(`Create failed: ${JSON.stringify(err)}`));

module.exports = app;
