(function(){

'use strict';

// Utils
var util = require('util');

// EventEmitter
var EventEmitter = require('events').EventEmitter;

// Protocol
var protocol = require('./jsonrpc');

// Debug output
var debug;
try {
    debug = require('debug')('koa-ws:client');
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

    // Options container
    this._options = {};

    // Session container
    this._session = null;

    // On WebSocket open
    this.on('open', this.onOpen);

    // On WebSocket close
    this.on('close', this.onClose);

    // On WebSocket message
    this.on('message', this.onMessage);

    var _this = this;
    // Listen for options
    this.register('options', function () {
        _this._options = this.params;
    });

    // Listen for session
    this.register('session', function () {
        _this._session = this.params;
    });
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

Client.prototype.onMessage = function (data) {
    protocol.apply(this, [debug, this.socket, data]);
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
Client.prototype.register = function (method, handler, expose) {
    if (typeof method === 'object') {
        for (var m in method) {
            this.register(m, method[m]);
        }
    } else if (typeof handler === 'object') {
        for (var m in handler) {
            this.register(method + ':' + m, handler[m]);
        }
    } else if (typeof method === 'string') {
        debug('Registering method: %s', method);
        handler.expose = expose || false;
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
            debug('→ (%s) %s: %o', payload.id, payload.method, payload.params);
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