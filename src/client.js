(function(){

'use strict';

// Utils
var util = require('util');

// EventEmitter
var EventEmitter = require('events').EventEmitter;

// Request object
var Request = require('./request');

// Debug output
var debug;
try {
    debug = require('debug')('koa-ws');
} catch (e) {
    debug = console.log.bind(console);
}

if (typeof WebSocket === 'undefined') {
    var WebSocket = require('ws');
}

try {
    var scriptElements = document.getElementsByTagName('script');
    var guessedAddress = typeof __resourceQuery === "string" && __resourceQuery ?
        __resourceQuery.substr(1) :
        scriptElements[scriptElements.length-1].getAttribute("src").replace(/\/[^\/]+$/, "");
} catch (e) {
    var guessedAddress = typeof __resourceQuery === "string" && __resourceQuery ?
        __resourceQuery.substr(1) : 'localhost:3000';
}

function Client() {
    // Init EventEmitter
    EventEmitter.call(this);

    // Queue list for messages
    this._messageQueue = [];

    // Callback container for results
    this._awaitingResults = {};

    // Client-side methods
    this._methods = {};

    // Event handler containers
    this._events = {
        open: [],
        close: [],
        connection: [],
        message: []
    };

    // On WebSocket open
    this.on('open', this.onOpen);

    // On WebSocket close
    this.on('close', this.onClose);

    // On WebSocket message
    this.on('message', this.onMessage);
};

// Inherit prototype from EventEmitter
util.inherits(Client, EventEmitter);

Client.prototype.onOpen = function (e) {
    debug('WebSocket opened');
    if (this._messageQueue.length) {
        var payload;
        while (this._messageQueue.length) {
            payload = this._messageQueue.shift();
            debug('→ %o', payload);
            this.socket.send(JSON.stringify(payload));
        }
    }
};

Client.prototype.onClose = function (e) {
    debug('WebSocket closed');
};

Client.prototype.onMessage = function (e) {
    var payload = JSON.parse(e.data || e);
    if (payload.method) {
        debug('← %s: %o', payload.method, payload.params);
        var request = new Request(this, payload);
        if (payload.error) {
            debug('Got error for method %s, code %s: %s', 
                payload.method, payload.error.code, payload.error.message);
            this._methods[payload.method].apply(
                request,
                payload.params
            ); 
        }
    } else {

        if (payload.error && payload.id && this._awaitingResults[payload.id]) {
            debug('← (%s) Error %s: %o', payload.id, payload.error.code, payload.error.message);
            this._awaitingResults[payload.id].apply(
                this,
                [payload.error]
            );
        } else if (payload.error) {
            debug('← Error %s: %o', payload.error.code, payload.error.message);
            //client.emit('error', payload.error);
            //console.error('Error %s: %s', payload.error.code, payload.error.message);
        } else if (payload.id && this._awaitingResults[payload.id]) {
            debug('← (%s) %o', payload.id, payload.result);
            this._awaitingResults[payload.id].apply(
                this, 
                [null, payload.result]
            );
        }
    }
};

Client.prototype.connect = function (address) {
    address = address || guessedAddress;
    address = address.replace('ws://', '');

    // Initialize WebSocket client
    debug('Connecting to server: ws://%s', address);
    this.socket = new WebSocket('ws://' + address);

    // Add helper handlers for the folowing events
    ['open', 'close', 'message']
        .forEach(function (type, i) {
            var handler = function (e) {
                this.emit.apply(this, [type].concat(Array.prototype.slice.call(arguments)));
            }.bind(this);
            if (this.socket.on) {
                this.socket.on(type, handler)
            } else if (!this.socket['on' + type]) {
                this.socket['on' + type] = handler;
            }
        }.bind(this));
};

// Register a client-side method
Client.prototype.register = function (method, handler) {
    if (typeof method === 'object') {
        for (var name in methods) {
            this.register(name, method[name]);
        }
    } else {
        debug('Registering method: %s', method);
        this._methods[method] = handler;
    }
};

// Call a server-side method
Client.prototype.method = function () {
    var cb = null;
    var payload = {
        jsonrpc: '2.0',
        method: arguments[0],
        id: Math.random().toString(36).substr(2, 9) // Generate random id
    };

    if (typeof arguments[1] !== 'function' && typeof arguments[1] !== 'undefined') {
        payload.params = arguments[1];
        if (typeof arguments[2] === 'function') {
            cb = arguments[2];
        }
    } else if (typeof arguments[1] === 'function') {
        cb = arguments[1];
    }

    if (cb) {
        this._awaitingResults[payload.id] = function () {
            cb.apply(this, arguments);
            delete this._awaitingResults[payload.id];
        };
    }

    if (this.socket.readyState !== 1) {
        // WebSocket is not ready yet, push payload to messsage queue
        this._messageQueue.push(payload);
    } else {
        try {
            debug('→ %o', payload);
            this.socket.send(JSON.stringify(payload));
        } catch (e) {
            if (cb) {
                cb.call(this, e);
            }
        }
    }
};

var clientInstance = new Client();

// Expose the client
if (typeof module !== 'undefined' && module.exports) {
    module.exports = clientInstance;
} else {
    window.koaws = clientInstance;
}

}.call(this));