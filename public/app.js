let DEBUG = false;
const fodebug = (...args) => {if (DEBUG) console.log(...args)};

// Make sure the feathersjs-offline wrappers for own-data, own-net, and server are available
/* eslint-disable no-undef */
if (!(feathersjsOfflineClient)) {
  alert('Could not load the \'feathersjs-offline\' library. Please check.');
}

// Identify this browser tab (uniquely) so we can have more than one tab open
const defineTabID = function () {
  let iPageTabID = sessionStorage.getItem("tabID");
    // if it is the first time that this page is loaded
  if (iPageTabID == null) {
      let iLocalTabID = localStorage.getItem("tabID");
        // if tabID is not yet defined in localStorage it is initialized to 1
        // else tabId counter is increment by 1
      iPageTabID = (iLocalTabID == null) ? 1 : Number(iLocalTabID) + 1;
        // new computed value are saved in localStorage and in sessionStorage
      localStorage.setItem("tabID",iPageTabID);
      sessionStorage.setItem("tabID",iPageTabID);
  }
  return iPageTabID;
}

const tabID = defineTabID();

// Read relevant values from sessionStorage
let serviceType = sessionStorage.getItem('serviceType');
if (!serviceType || serviceType!== '') serviceType = 'standard';
document.getElementById(serviceType).checked = true;
sessionStorage.setItem('serviceType', serviceType);

let connectStatus = sessionStorage.getItem('connectStatus');
if (!connectStatus || connectStatus!== '') connectStatus = 'online';
document.getElementById(connectStatus).checked = true;
sessionStorage.setItem('connectStatus', connectStatus);


// This is only needed for this demo
const localPrefix = `local_messages_${tabID}`;
const localServiceName = `${localPrefix}_local`;
const localQueueName = `${localPrefix}_queue`;

// Animation speed 0 - 1800 ms
let speed = 800;


// Create Feathers client
const app = feathers();
window.app = app;
const ioLocation = "http://localhost:3030";
const socket = io(ioLocation);
fodebug(`connecting to: ${ioLocation}...`);

app.configure(feathers.socketio(socket));


//
// Start of application proper
//
const serviceName = 'messages';

const serviceWrapper = {
  'standard': (app, path, o) => {}, // Dummy wrapper
  'owndata': feathersjsOfflineClient.owndataWrapper,
  'ownnet': feathersjsOfflineClient.ownnetWrapper
}


// Setup service according to users choice
async function prepareService () {
  // User wants to try serviceType i.e. either standard, own-data, or own-net
  // First we remove any previously registered listeners
  if (app.services[serviceName]) {
    removeListeners(app, app.service(serviceName), 'server');
    removeListeners(app, app.service(serviceName).remote, 'server');
    removeListeners(app, app.service(serviceName).local, 'client');
    removeListeners(app, app.service(serviceName).queue, 'queue');

    // We force a sync (if available) before changing serviceType
    if (typeof app.service(serviceName).sync !== 'undefined') {
      await app.service(serviceName).sync();
    }
  }

  // Remove/forget any prior registered service on path (this is a hack I know)
  delete app.services[serviceName];

  // Set-up default service
  app.service(serviceName);

  // Register service path with correct wrapper (no-op for standard)
  if (serviceType !== 'standard') {
    serviceWrapper[serviceType](app, serviceName, {
      id: 'uuid', // We use 'uuid' as our key
      storage: sessionStorage, // We want to force sessionStorage so you can run several demo apps
                               // in the same browser. By default localStorage (or file for NodeJS) is used
      store: sessionStorage.getItem(localServiceName), // Initialize with (possibly) stored data
      fixedName: localPrefix, // Keep same name for local service and queue (only advisable for demo)
      reuseKeys: true, // Inform 'feathers-localstorage' that we know what we are doing reusing the keys
      multi:true
    });
  }

  // Force initialization of service (somewhat a tricky trick)
  await app.service(serviceName).patch(null, {}, {query: {UnknownTag: 'This is only to ensure initialization of the service'}});

  // Register event handlers and attach hooks
  let remote = app.service(serviceName).remote || app.service(serviceName);
  addListeners(app, remote, 'server');
  addListeners(app, app.service(serviceName).local, 'client');
  addListeners(app, app.service(serviceName).queue, 'queue');

  // remote.timeout = 300;  // only here to force quicker return from remote (better experience for this demo)

  if (typeof app.service(serviceName).sync !== 'undefined') {
    await app.service(serviceName).sync();
  }

  // Install hook for handling simulation of online/offline
  remote.hooks({
    before: {
      all: async context => {
        if (connectStatus === 'offline') {
          throw new feathers.errors.Timeout('Fail requested by user - simulated timeout/missing connection');
        } else {
            return context;
        }
      }
    }
  });
};
prepareService(); // Setup service at load/reload and at users choice


function getServiceData() {
  // Get data from server and display
  clearContents();
  if (serviceType !== 'standard') {
    dim(['client', 'clientName','queue', 'queueName'], false);

    // Get and show items from remoteService
    app.service(serviceName).remote.find()
      .then(res => {
        res.forEach(r => showMessage('server', r))
      })
      .catch(err => {
        alert(`Could not read messages from remoteService '${serviceName}'! err=${err.name}, ${err.message}}`)
      });

    // Get and show items from localService
    app.service(serviceName).local.find()
      .then(res => {
        res.forEach(r => showMessage('client', r))
      })
      .catch(err => {
        alert(`Could not read messages from localService '${localServiceName}'! err=${err.name}, ${err.message}}`)
      });

    // Get and show items from localQueue
    app.service(serviceName).queue.find()
      .then(res => {
        res.forEach(r => showMessage('queue', r))
      })
      .catch(err => {
        alert(`Could not read messages from localQueue '${localQueueName}'! err=${err.name}, ${err.message}}`)
      });
  }
  else {
    // LocalService and localQueue are not relevant for 'standard' so we dim them
    dim(['client', 'clientName','queue', 'queueName'], true);

    // Get and show items from remoteService (in this case the ordinary service)
    app.service(serviceName).find()
      .then(res => {
        res.forEach(r => showMessage('server', r))
      })
      .catch(err => {
        alert(`Could not read messages from Service '${serviceName}'! err=${err.name}, ${err.message}}`)
      });
  }

};
getServiceData(); // Get data at load/reload


function removeHandler (parentId, message, cls) {
  fodebug(`removeHandler called: parentId = ${parentId}, message = ${JSON.stringify(message)}`);
  indicateChange(parentId, message, cls);
  let id = getNodeId(parentId, message);

  addChange(id, async () => await new Promise((resolve, _) => {
      let el = document.getElementById(id);
      fodebug(`removeHandler actually removing id=${id}, el=${JSON.stringify(el)}`);
      if (el) el.remove();

      resolve(true);
  }));
}


const events = [
    {event: 'created', cls: 'green', fn: showMessage},
    {event: 'updated', cls: 'yellow', fn: indicateChange},
    {event: 'patched', cls: 'yellow', fn: indicateChange},
    {event: 'removed', cls: 'red', fn: removeHandler}
  ];

function addListeners (app, service, elId) {
  if (service === undefined) return;
  events.forEach(ev => service.on(ev.event, (message) => {
    fodebug(`${elId}[${ev.event}]: ${JSON.stringify(message)}`);
    ev.fn(elId, message, ev.cls);
  }));
};

function removeListeners (app, service, elId) {
  if (service === undefined) return;
  // events.forEach(ev => service.listeners(ev.event).forEach(l => service.removeListener(ev.event, l)));
  events.forEach(ev => service.removeAllListeners(ev.event));
};




//==============================
// UI handling
//==============================

// Some message display formatting
function formatDate (date) { // Only show the time portion of the ISO date
  return date.length > 10 ? date.substr(11,12) : date;
}

function formatMessage (res) {
  let message = res.arg1 || res;
  return `${message.uuid}: ${formatDate(message.updatedAt)}, ${formatDate(message.onServerAt)}, ${message.text}`;
}

// Show a message in message window
function showMessage (id, message, change = 'green') {
  let res =  getRecord(id, message);
  fodebug(`showMessage('${id}', '${JSON.stringify(res)}', '${change}')`);
  let node = document.createElement('DIV');
  let nodeId = getNodeId(id, message);
  let textNode = document.createTextNode(formatMessage(res));
  node.appendChild(textNode);
  node.setAttribute("id", nodeId);
  node.setAttribute("onclick", `handleElementClick('${nodeId}',${id === 'client' || (serviceType === 'standard' && id === 'server')})`);
  document.getElementById(id).appendChild(node);
  indicateChange(id, message, change);
  document.getElementById(id).scrollTop = 0;
};

const changingIds = {}; // Object tracking which rows are currently highlighted by which colour

function addChange (id, fn) {
  if (!changingIds[id]) {
    changingIds[id] = { active: false, queue: []};
  }

  changingIds[id].queue.push(async () => {await fn(); nextChange(id)});
  if (!changingIds[id].active)
    nextChange(id);
}

async function nextChange (id) {
  if (changingIds[id] && changingIds[id].queue) {
    let fn = changingIds[id].queue.shift();
    if (fn == undefined) {
      changingIds[id].active = false;
    }
    else {
      changingIds[id].active = true;
      await fn();
    }
  }
}

function getNodeId (parentId, message) {
  let uuid = message.uuid || message.record.uuid;
  let nodeId = parentId + '-' + uuid;
  if (parentId === 'queue') nodeId += '-' + message.id;
  return nodeId;
}

function getRecord (id, message) {
  let record;
  if (id.includes('queue')) {
    record = message.record;
  } else {
    record = message;
  }

  return record;
}

function indicateChange (parentId, message, change = 'green') {

  function removeColour (nodeId, change) {
    fodebug(`removeColour called: ('${nodeId}', '${change}')`);
      let el = document.getElementById(nodeId);
      if (el) el.classList.remove(change);
  };

  function setNode (nodeId, cls, message, change, resolve) {
    fodebug(`setNode called: ('${nodeId}', '${JSON.stringify(cls)}', ${JSON.stringify(message)}', '${change}')`);
    const el = document.getElementById(nodeId);
    if (el) {
      setTimeout(() => { // Wait 1/4 of the speed before introducing this change
        el.classList.add(...cls);
        el.innerHTML = formatMessage(getRecord(nodeId, message));
        setTimeout(() => { // Show the change for speed ms
          removeColour(nodeId, change, resolve);
          resolve(true);
        }, speed);
      }, speed/4);
    }
  };

  let nodeId = getNodeId(parentId, message);
  let cls = [ change, 'clickable' ];

  addChange(nodeId, async () => await new Promise((resolve, _) => { // If changes come quickly in succession we want to display all colours in sequence
    setNode(nodeId, cls, message, change, resolve);
  }));
}

function dim (ids, flag = true) {
  if (!Array.isArray(ids)) ids = [ ids ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (flag) {
      el.classList.add('dim');
    } else {
      el.classList.remove('dim');
    }
  })
}

// Clear message windows
function clearContents () {
  document.getElementById('client').innerHTML = '';
  document.getElementById('server').innerHTML = '';
  document.getElementById('queue').innerHTML = '';
};


// ==== UI event handlers

// Handle serviceType radio buttons...
function handleTypeToggle (ev) {
  let id = ev.currentTarget.id;
  serviceType = sessionStorage.getItem('serviceType');
  let newType = id;
  if (serviceType != newType) {
    document.getElementById(id).checked = true;
    sessionStorage.setItem('serviceType', newType);
    serviceType = newType;
    prepareService();
    getServiceData();
  }
};

document.getElementById('standard').addEventListener('click', async ev => {
  handleTypeToggle(ev);
});
document.getElementById('owndata').addEventListener('click', async ev => {
  handleTypeToggle(ev);
});
document.getElementById('ownnet').addEventListener('click', async ev => {
  handleTypeToggle(ev);
});


// Handle connectionStatus radio buttons...
function handleConnectToggle (ev) {
  let id = ev.currentTarget.id;
  connectStatus = sessionStorage.getItem('connectStatus');
  let newStatus = id;
  if (connectStatus != newStatus) {
    document.getElementById(id).checked = true;
    sessionStorage.setItem('connectStatus', newStatus);
    connectStatus = newStatus;
  }
};

document.getElementById('online').addEventListener('click', async ev => {
  handleConnectToggle(ev);
});
document.getElementById('offline').addEventListener('click', async ev => {
  handleConnectToggle(ev);
});
document.getElementById('speed').addEventListener('click', async ev => {
  let id = ev.currentTarget.id;
  speed = document.getElementById(id).value;
});

// Handle the 'Add Message' button
// eslint-disable-next-line no-unused-vars
document.getElementById('add').addEventListener('click', async _ev => {
  let text = `A new message from tab ${tabID}`;
  app.service(serviceName).create({ text })
    .catch((err) => {
      if (serviceType!=='standard' || connectStatus==='online') {
        alert(`Ups! Something went wrong inserting new message '${text}'.\nerr=${err.name}, ${err.message}`);
      } else {
        alert(`Cannot insert new message while '${connectStatus}' with '${serviceType}'.`);
      }
    });
});

// Handle the 'Sync' button
// eslint-disable-next-line no-unused-vars
document.getElementById('sync').addEventListener('click', async _ev => {
  fodebug('sync() pressed...');
  if (typeof app.service(serviceName).sync === 'function') {
    await app.service(serviceName).sync();
    fodebug(`Sync performed for '${serviceType}'.`);
  } else {
    alert(`Sync is a no-op for '${serviceType}'.`);
  };
});

function showPopup () {
  const el = document.getElementById('overlay');
  el.style.display = 'block';

  const text = document.getElementById('text');
  text.focus();

  // Workaround for Safari bug
  // http://stackoverflow.com/questions/1269722/selecting-text-on-focus-using-jquery-not-working-in-safari-and-chrome
  setTimeout(function () {
    text.select();
  }, 10);
};

function hidePopup () {
  const el = document.getElementById('overlay');
  el.style.display = 'none';
};

function setInputFieldValue (id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value;
  }
}

async function rowUpdate () {
  const uuid = document.getElementById('uuid').value;
  const text = document.getElementById('text').value;
  const updatedAt = document.getElementById('updatedAt').value;
  const onServerAt = document.getElementById('onServerAt').value;

  let res = await app.service(serviceName).patch(uuid, { text, updatedAt, onServerAt });
}

async function rowDelete  () {
  const uuid = document.getElementById('uuid').value;

  let res = await app.service(serviceName).remove(uuid);
}

async function handleElementClick (elId, updatesAllowed = false) {
  const ix = elId.indexOf('-');
  let uuid = elId.substring(ix+1);
  if (elId.includes('queue')) {
    const ix2 = elId.lastIndexOf('-');
    uuid = elId.substring(ix+1,ix2);
  }
  await app.service(serviceName).get(uuid)
    .then(res => {
      for (let i in res) setInputFieldValue(i, res[i]);

      if (updatesAllowed) {
        document.getElementById('delete').style.display = 'inline';
        document.getElementById('update').style.display = 'inline';
      } else {
        document.getElementById('delete').style.display = 'none';
        document.getElementById('update').style.display = 'none';
      }
      showPopup();
    })
    .catch(err => {
      if (elId.includes('queue-')) {
        alert(`You cannot see this deleted row '${elId}', sorry!`);
      } else {
        alert(`An unauthorized error '${err.name}' happened - ${err.message}`);
      }
    })
}

async function resetAll() {
  alert("You are about to delete all data and stated - are you sure?");
  sessionStorage.setItem(localServiceName, "{}");
  sessionStorage.setItem(localQueueName, "{}");

  let remote = app.service(serviceName).remote || app.service(serviceName);
  await remote.find()
    .then(async res => {
      let arr = [];
      res.forEach(r => arr.push(remote.remove(r['uuid'])));
      await Promise.all(arr);
    })
    .catch(err => {
      alert(`Could not delete rows from server(/remote), err.name=${err.name}, err.message=${err.message}`);
    })
  location.reload();
}
