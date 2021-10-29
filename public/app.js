// The `simple-example` application file

let DEBUG = false; // Set this to true if you want a chatty application...
const fodebug= (...args) => {if (DEBUG) console.log(...args)};

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
const ioLocation = "http://localhost:3031";
const socket = io(ioLocation);

fodebug(`Connecting to: ${ioLocation}...`);
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

// Determine wanted storage ('localStorage' is use as default if none is specified)
const validStorage = ['websql', 'indexeddb', 'localstorage'];

let regex = new RegExp('[?&]db=([^&#]*)|&|#|$');
let dbs = regex.exec(window.location.href);
dbs = dbs[1] ? dbs[1].split(','): [];

const ok = dbs.reduce((value, db) => value && validStorage.includes(db.toLowerCase()), true);
if (!ok)
  alert(`Unknown storage type specified in url search parameter:\n\n'${ioLocation}/?db=${dbs.join(',')}'\n\nPlease use one (or more) of 'websql', 'indexeddb', or 'localstorage' (separate with comma).`);

if (!dbs.length) dbs = null;

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

  // Remove/forget any prior registered service on path (this is a hack - I know)
  delete app.services[serviceName];

  // Set-up default service
  app.service(serviceName);

  // Register service path with correct wrapper (no-op for standard)
  if (serviceType !== 'standard') {
    console.error(`dbs=${JSON.stringify(dbs)}`);
    serviceWrapper[serviceType](app, serviceName, {
      id: 'uuid', // We use 'uuid' as our key
      storage: dbs, // We want to use the type from the query variable 'db' so you can run several
                    // demo apps in the same browser. By default localStorage is used
      fixedName: localPrefix, // Keep same name for local service and queue (only advisable for demo)
      reuseKeys: true, // Inform '@feathersjs-offline/localforage' that we know we are reusing the keys
      multi: true,
      dates: false
    });
  }

  // Force initialization of service (a somewhat tricky trick)
  await app.service(serviceName).patch(null, {}, {query: {UnknownTag: 'This is only to ensure initialization of the service'}});

  // Register event handlers and attach hooks
  let remote = app.service(serviceName).remote || app.service(serviceName);
  addListeners(app, remote, 'server');
  addListeners(app, app.service(serviceName).local, 'client');
  addListeners(app, app.service(serviceName).queue, 'queue');

  remote.on('created', (message) => {
    console.log(`from Server: ${JSON.stringify(message)}`);
  })

  // Install hook for handling simulation of online/offline
  remote.hooks({
    before: {
      all: async context => {
        // if query contains {force: true} we do not simulate offline behaviour
        const { params = {} } = context;
        const { query = {} } = params;
        const { force = false, ...rest } = query;
        context.params.query = rest;
  
        if (connectStatus === 'offline' && !force) {
          throw new feathers.errors.Timeout('Fail requested by user - simulated timeout/missing connection');
        } else {
            return context;
        }
      }
    }
  });

  getServiceData(); // Get data at load/reload
};
prepareService(); // Setup service at load/reload and at users choice


function getServiceData() {
  function displayRows(parentId, service) {
    service.find()
      .then(res => {
        res.forEach(r => showMessage(parentId, r))
      })
      .catch(err => {
        alert(`Could not read messages from ${parentId} '${serviceName}'! err=${err.name}, ${err.message}}`)
      });
  }

  // Get data from server and display
  clearContents();
  if (serviceType !== 'standard') {
    dim(['clientHead', 'client', 'clientName','queue', 'queueName'], false);

    // Get and show items from remoteService
    displayRows('server', app.service(serviceName).remote);

    // Get and show items from localService
    displayRows('client', app.service(serviceName).local);

    // Get and show items from localQueue
    displayRows('queue', app.service(serviceName).queue);
  }
  else {
    // LocalService and localQueue are not relevant for 'standard' so we dim them
    dim(['clientHead', 'client', 'clientName','queue', 'queueName'], true);

    // Get and show items from remoteService (in this case the ordinary service)
    displayRows('server', app.service(serviceName));
  }

};


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
function formatDate(date) { // Only show the time portion of the ISO date
  let thisDate = typeof date === 'object' ? date.toISOString() : date;
  return thisDate.length > 10 ? thisDate.substr(11,12) : thisDate;
}

function formatMessage (res) {
  let message = res.arg1 || res;

  return `${message.uuid.padEnd(12,' ')}${formatDate(message.updatedAt).padEnd(14,' ')}${formatDate(message.onServerAt).padEnd(14,' ')}${message.text}`/*.replace(/ /g,'&nbsp;')*/;
}

// Show a message in message window
function showMessage(id, message, change = 'green') {
  let res = getRecord(id, message);
  fodebug(`showMessage('${id}', '${JSON.stringify(res)}', '${change}')`);
  let nodeId = getNodeId(id, message);
  let exists = document.getElementById(nodeId);
  if (exists) {
    exists.innerText = formatMessage(res);
  }
  else {
    let node = document.createElement('DIV');
    let textNode = document.createTextNode(formatMessage(res));
    node.appendChild(textNode);
    node.setAttribute("id", nodeId);
    node.setAttribute("onclick", `handleElementClick('${nodeId}',${id === 'client' || /*(serviceType === 'standard' &&*/ id === 'server'/*)*/})`);
    document.getElementById(id).appendChild(node);
  }
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
  fodebug(`getNodeId('${parentId}', '${JSON.stringify(message)}')`);
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
    setSyncButtons();
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


// Handling editing/selecting lines
function showPopup (type) {
  const el = document.getElementById('overlay');
  el.style.display = 'block';

  const text = document.getElementById('text');
  text.focus();

  document.getElementById('olHead').innerText = type;

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

async function rowUpdate() {
  const type = document.getElementById('olHead').innerText;
  const uuid = document.getElementById('uuid').value;
  const text = document.getElementById('text').value;
  const updatedAt = document.getElementById('updatedAt').value;
  const onServerAt = document.getElementById('onServerAt').value;

  if (type === 'server') {
    let hndl = app.service(serviceName);
    if (hndl.remote) {
      let doOne = confirm('Do you want only want to update on server(remote)?');

      if (doOne) {
        await hndl.remote.patch(uuid, { text, updatedAt, onServerAt });
      }
      else {
        await hndl.patch(uuid, { text, updatedAt, onServerAt });
      }
    }
    else {
      await hndl.patch(uuid, { text, updatedAt, onServerAt });
    }
  }
  else if (type === 'client') {
    let doOne = confirm('Do you want only want to update on client(local)?');

    if (doOne) {
      await app.service(serviceName).local.patch(uuid, { text, updatedAt, onServerAt });
    }
    else {
      await app.service(serviceName).patch(uuid, { text, updatedAt, onServerAt });
    }
  }
}

async function rowDelete  () {
  const type = document.getElementById('olHead').innerText;
  const uuid = document.getElementById('uuid').value;

  if (type === 'server') {
    let hndl = app.service(serviceName);
    if (hndl.remote) {
      let doOne = confirm('Do you want only want to delete on server(remote)?');

      if (doOne) {
        await hndl.remote.remove(uuid);
      }
      else {
        await hndl.remove(uuid);
      }
    }
    else {
      await app.service(serviceName).remove(uuid);
    }
  }
  else if (type === 'client') {
    await app.service(serviceName).local.remove(uuid);
  }
}

async function handleElementClick (elId, updatesAllowed = false) {
  const ix = elId.indexOf('-');
  const type = elId.substring(0, ix);
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
      showPopup(type);
    })
    .catch(err => {
      if (elId.includes('queue-')) {
        alert(`You cannot see this deleted row '${elId}', sorry!`);
      } else {
        alert(`An unauthorized error '${err.name}' happened - ${err.message}`);
      }
    })
}


// Handle 'Reset All' button
async function resetAll() {
  if (serviceType === 'standard') {
    let bOnlySome = confirm('To be able to delete local data you must be in an Offline realtime mode - continue?');
    if (!bOnlySome) return
  }

  let bDeleteIt = confirm("You are about to delete all data and state - are you sure?");
  
  if (bDeleteIt) {
    let local = app.service(serviceName).local;
    if (local) {
      await local.find()
        .then(async res => {
          await Promise.all([ res.forEach(r => local.remove(r[local.id])) ]);
        })
        .catch(err => {
          alert(`Could not delete rows from local, err.name=${err.name}, err.message=${err.message}`);
        })
    }
    let queue = app.service(serviceName).queue;
    if (queue) {
      await queue.find()
        .then(async res => {
          await Promise.all([ res.forEach(r => queue.remove(r['id'])) ]);
        })
        .catch(err => {
          alert(`Could not delete rows from queue, err.name=${err.name}, err.message=${err.message}`);
        })
    }
    if (local) { // A hack - for now
      let syncTxt = localStorage.getItem('feathersjs-offline/@@@syncedAt@@@/1');
      let synced = JSON.parse(syncTxt);
      synced.value = "1970-01-01T00:00:00.000Z";
      localStorage.setItem('feathersjs-offline/@@@syncedAt@@@/1', JSON.stringify(synced));
    }

    let remote = app.service(serviceName).remote;
    let query = remote ? { force: true } : {};
    remote = remote || app.service(serviceName);
    const myId = 'uuid'; /* remote.id; */
    await remote.find({ query })
      .then(async res => {
        await Promise.all([res.forEach(r => remote.remove(r[myId], { query }))]);
      })
      .catch(err => {
        alert(`Could not delete rows from server(/remote), err.name=${err.name}, err.message=${err.message}`);
      })

    // location.reload();
  }
}


// Handle the 'Sync' and 'SyncAll' buttons
// eslint-disable-next-line no-unused-vars

const syncButton = async _ev => {
  fodebug('sync() pressed...');
  if (typeof app.service(serviceName).sync === 'function') {
    await app.service(serviceName).sync(false);
    fodebug(`Sync(false) performed for '${serviceType}'.`);
  };
}

const syncAllButton = async _ev => {
  fodebug('syncAll() pressed...');
  if (typeof app.service(serviceName).sync === 'function') {
    await app.service(serviceName).sync(true);
    fodebug(`Sync(true) performed for '${serviceType}'.`);
  };
};

function setSyncButtons() {
  const enableButton = serviceType !== 'standard';

  if (enableButton) {
    document.getElementById('sync').addEventListener('click', syncButton);
    document.getElementById('syncAll').addEventListener('click', syncAllButton);
  }
  else {
    document.getElementById('sync').removeEventListener('click', syncButton);
    document.getElementById('syncAll').removeEventListener('click', syncAllButton);
  }
}