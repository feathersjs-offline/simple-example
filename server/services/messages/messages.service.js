// Initializes the `messages` service on path `/messages`
const { Messages } = require('./messages.class');
const hooks = require('./messages.hooks');

const { realtimeWrapper } = require('@feathersjs-offline/server');

module.exports = function (app) {
  const options = {
    paginate: false, // app.get('paginate')
    multi: true,
    id: 'uuid'
  };


  // Initialize our service with any options it requires
  app.use('messages', new Messages(options, app));
  realtimeWrapper(app, 'messages', {});

  // Get our initialized service so that we can register hooks
  const service = app.service('messages');

  service.hooks(hooks);
};
