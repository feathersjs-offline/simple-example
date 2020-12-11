module.exports = function (app) {
  if(typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    return;
  }

  app.on('connection', connection => {
    // On a new real-time connection, add it to the anonymous channel
    app.channel('offlineRealtimeDemo').join(connection);
  });

  // eslint-disable-next-line no-unused-vars
  app.publish((data, hook) => {
    return app.channel('offlineRealtimeDemo');
  });
};
