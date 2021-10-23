module.exports = function (app) {
  if(typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    return;
  }

  app.on('connection', connection => {
    // On a new real-time connection, add it to the anonymous channel
    app.channel('offlineRealtimeDemo').join(connection);
  });

  app.publish((_data, _hook) => {
    return app.channel('offlineRealtimeDemo');
  });
};
