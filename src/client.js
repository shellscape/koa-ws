(function(){

'use strict';

var debug, hostname, port;

// Debug output
try {
    debug = require('debug')('koa:ws');
} catch (e) {
    debug = console.log.bind(console);
}

if (typeof WS_HOSTNAME !== 'undefined') {
    hostname = WS_HOSTNAME;
} else if (typeof location !== 'undefined') {
    hostname = location.hostname;
} else {
    hostname = 'localhost';
}

if (typeof WS_HOSTNAME !== 'undefined') {
    port = WS_PORT;
} else {
    port = 3000;
}

if (typeof WebSocket === 'undefined') {
    var WebSocket = require('ws');
}

// Initialize WebSocket client
debug('Connecting to server: ws://%s:%s', hostname, port);
var client = new WebSocket('ws://' + hostname + ':' + port);

// Queue list for messages
var messageQueue = [];

// Callback container for results
var awaitingResults = {};

// Simple support for events
var callbacks = client._events = {
    open: [],
    close: [],
    connection: [],
    message: []
};

if (!client.on)
    client.addListener = client.on = function (type, cb) {
        if (callbacks[type]) {
            callbacks[type].push(cb);
        } else {
            callbacks[type] = [cb];
        }
    };

if (!client.once)
    client.once = function (type, cb) {
        client.on(type, function onceFn () {
            client.off(type, onceFn);
            cb.apply(cb, arguments);
        });
    };

if (!client.off)
    client.removeListener = client.off = function (type, cb) {
        if (Array.isArray(callbacks[type])) {
            var idx = callbacks[type].indexOf(cb);
            if (idx !== -1) {
                if (callbacks[type].length === 1) {
                    delete callbacks[type];
                } else {
                    callbacks[type].splice(idx, 1);
                }
            }
        }
    };

// Add helper handlers for the folowing events
if (client._socket) {
    ['open', 'close', 'message']
        .forEach(function (type, i) {
            return;
            if (!client['on' + type]) {
                client['on' + type] = function () {
                    for (var i = 0, l = callbacks[type].length; i < l; i++) {
                        callbacks[type][i].apply(client, arguments);
                    }
                };
            }
        });
}

// Call a method
client.method = function () {
    var cb = null;
    var payload = {
        jsonrpc: '2.0',
        method: arguments[0],
        id: Math.random().toString(36).substr(2, 9) // Generate random id
    };

    if (typeof arguments[1] === 'object') {
        payload.params = arguments[1];
        if (typeof arguments[2] === 'function') {
            cb = arguments[2];
        }
    } else if (typeof arguments[1] === 'function') {
        cb = arguments[1];
    } else {
        payload.params = arguments[1];
    }

    if (cb) {
        debug('Registering callback for id %s', payload.id);
        awaitingResults[payload.id] = function () {
            cb.apply(this, arguments);
            delete awaitingResults[payload.id];
        };
    }

    if (this.readyState !== 1) {
        // Webclient is not ready, push payload to messsage queue
        messageQueue.push(payload);
    } else {
        try {
            debug('Sending message: %o', payload);
            client.send(JSON.stringify(payload));
        } catch (e) {
            if (cb) {
                cb.call(client, e);
            }
        }
    }
};

client.on('open', function (e) {
    debug('WebSocket open');

    if (messageQueue.length) {
        var payload;
        while (messageQueue.length) {
            payload = messageQueue.shift();
            client.send(JSON.stringify(payload));
        }
    }
});

client.on('message', function (e) {
    var payload = JSON.parse(e.data || e);
    debug('Incoming message: %o', payload);
    if (payload.result && payload.id && awaitingResults[payload.id]) {
        debug('Got result for id %s, sending to callback', payload.id);
        awaitingResults[payload.id].apply(client, [null, payload.result]);
    } else if (payload.method && Array.isArray(callbacks[payload.method])) {
        for (var i = 0, l = callbacks[payload.method].length; i < l; i++) {
            callbacks[payload.method][i].apply(
                client, [null, payload.params]);
        }
    } else if (payload.error && payload.id) {
        awaitingResults[payload.id].apply(client, [payload.error]);
    } else if (payload.error) {
        debug('Error %s: %s', payload.error.code, payload.error.message);
    }
});

// Expose the client
if (typeof module !== 'undefined' && module.exports) {
    module.exports = client;
} else {
    window.koaws = client;
}

}.call(this));