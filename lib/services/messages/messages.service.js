// Initializes the `messages` service on path `/messages`
const { Messages } = require('./messages.class');
const hooks = require('./messages.hooks');
const { realtimeWrapper } = require('@feathersjs-offline/server');
console.log(`typeof realtimeWrapper = ${typeof realtimeWrapper}`);
module.exports = function (app) {
    const options = {
        paginate: false,
        multi: true,
        id: 'uuid'
    };
    // console.dir(Messages);
    // Initialize our service with any options it requires
    app.use('messages', new Messages(options, app));
    realtimeWrapper(app, 'messages', {});
    // Get our initialized service so that we can register hooks
    const service = app.service('messages');
    service.hooks(hooks);
};
//# sourceMappingURL=messages.service.js.map