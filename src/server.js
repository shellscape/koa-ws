var co = require('co');
var WebSocketServer = require('ws').Server;
var cookieHelper = require('koa-ws-cookie-helper');

// Request object
var Request = require('./request');

// Debug output
var debug = require('debug')('koa-ws:server');

/**
 * KoaWebSocketServer object
 * @param app
 * @param options
 */
function KoaWebSocketServer (app, options) {
    // Save ref to app
    this.app = app;

    // Container for methods
    this.methods = {};

    // Container for sockets
    this.sockets = {};

    // Session to socket mapping
    this.sessions = {};
}

KoaWebSocketServer.prototype.listen = function (server) {
    // Create WebSocketServer
    this.server = new WebSocketServer({ 
        server: server
    });

    // Listen to connection
    this.server.on('connection', this.onConnection.bind(this));
}

/**
 * On new connection
 * @param socket
 */
KoaWebSocketServer.prototype.onConnection = function (socket) {
    var server = this.server;
    var methods = this.methods;
    var sockets = this.sockets;
    var sessions = this.sessions;

    socket.method = function (method, params) {
        try {
            var payload = { 
                jsonrpc: '2.0', 
                method: method
            };
            if (params) {
                payload.params = params;
            }
            debug('→ %s: %o', payload.method, payload.params);
            socket.send(JSON.stringify(payload));
        } catch (e) {
            console.error('Something went wrong: ', e.stack);
        }
    };

    socket.result = function (result) {
        try {
            var payload = {
                jsonrpc: '2.0', 
                result: result,
                id: this.currentId
            };
            debug('→ result for id %s: %o', payload.id, payload.result);
            socket.send(JSON.stringify(payload));
        } catch (e) {
            console.error('Something went wrong: ', e.stack);
        }
    }

    socket.error = function (code, message) {
        try {
            var data = {
                jsonrpc: '2.0',
                error: {
                    code: code,
                    message: message
                },
                id: this.currentId
            };
            debug('→', data);
            socket.send(JSON.stringify(data));
        }  catch (e) {
            console.error('Something went wrong: ', e.stack);
        }
    };

    socket.on('close', function () {
        debug('Client disconnected');
        if (socket.session && Array.isArray(sockets[socket.session.id])) {
            sockets[socket.session.id].splice(
                sockets[socket.session.id].indexOf(socket),
                1
            );
        }
    });

    socket.on('error', function (err) {
        debug('Error occurred:', err);
    });

    socket.on('message', function (message) {
        try {
            var payload = JSON.parse(message);
        } catch (e) {
            debug('Parse error: %s', e.stack);
            socket.error(-32700, 'Parse error');
            return;
        }

        var request = new Request(socket, payload);

        if (!payload.jsonrpc && payload.jsonrpc !== '2.0') {
            debug('Wrong protocol: %s', payload.jsonrpc);
            socket.error.apply(request, [-32600, 'Invalid Request']);
            return;
        }

        if (!payload.method) {
            debug('Missing method: %o', payload);
            socket.error.apply(request, [-32600, 'Invalid Request']);
            return;
        }

        if (typeof payload.params !== 'undefined' && typeof payload.params !== 'object' && !Array.isArray(payload.params)) {
            debug('Invalid params: %o', payload.params);
            socket.error.apply(request, [-32602, 'Invalid params']);
            return;
        }

        debug('← %s: %o', payload.method, payload.params);

        if (typeof methods[payload.method] === 'function') {
            try {
                methods[payload.method].apply(request);
            } catch (e) {
                debug('Internal error: %s', e.stack);
                socket.error.apply(request, [-32603, 'Internal error']);
            }
        } else {
            debug('Method not found: %s', payload.method, payload.params);
            socket.error.apply(request, [-32601, 'Method not found']);
        }
    });

    // Let's try and connect the socket to session
    var sessionId = cookieHelper.get(socket, 'koa.sid', this.app.keys);
    if (sessionId) {
        if (typeof this.sockets[sessionId] === 'undefined') {
            this.sockets[sessionId] = [];
        }
        this.sockets[sessionId].push(socket);

        if (this.app.sessionStore) {
            var _this = this;
            (co(function* () {
                socket.session = yield _this.app.sessionStore.get('koa:sess:' + sessionId);
                socket.method('session', socket.session);   
            })());
        }
    }
}

/**
 * Register a method for server-side
 * @param method
 * @param generator
 * @param expose
 */
KoaWebSocketServer.prototype.register = function (method, generator, expose) {
    if (typeof method === 'object') {
        for (var m in method) {
            this.register(m, method[m]);
        }
    } else if (typeof generator === 'object') {
        for (var m in generator) {
            this.register(method + ':' + m, generator[m]);
        }
    } else if (typeof method === 'string') {
        debug('Registering method: %s', method);
        generator.expose = expose || false;
        this.methods[method] = co(generator);
    }
};

/**
 * Broadcast to all connected sockets
 * @param method string
 * @param params object
 */
KoaWebSocketServer.prototype.broadcast = function (method, params) {
    for (var i in this.server.clients) {
        this.server.clients[i].method(method, params, function (err) {
            debug('Could not send message', data, err);
        });
    }
}

module.exports = KoaWebSocketServer;