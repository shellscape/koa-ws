var co = require('co');
var fs = require('fs');
var path = require('path');
var objectAssign = require('object-assign');
var replaceStream = require('replacestream');
var WebSocketServer = require('ws').Server;
var cookieHelper = require('koa-ws-cookie-helper');
var debug = require('debug')('koa:ws');

/**
 * KoaWebSocketServer object
 * @param app
 * @param options
 */
function KoaWebSocketServer (app, options) {
    // Save ref to app
    this.app = app;

    // Create WebSocketServer
    this.server = new WebSocketServer({ server: app.server });

    // Container for methods
    this.methods = {};

    // Container for sockets
    this.sockets = {};

    // Session to socket mapping
    this.sessions = {};

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

    socket.respond = function (method, params) {
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

        if (!payload.jsonrpc && payload.jsonrpc !== '2.0') {
            debug('Wrong protocol: %s', payload.jsonrpc);
            socket.error(-32600, 'Invalid Request');
            return;
        }

        if (!payload.method) {
            debug('Missing method: %o', payload);
            socket.error(-32600, 'Invalid Request');
            return;
        }

        if (typeof payload.params !== 'object') {
            debug('Invalid params: %o', payload.params);
            socket.error(-32602, 'Invalid params');
            return;
        }

        debug('← %s: %o', payload.method, payload.params);

        if (typeof methods[payload.method] === 'function') {
            var request = {
                currentId: payload.id,
                method: payload.method,
                params: payload.params,
                session: socket.session
            };
            request.error = socket.error.bind(request);
            request.result = socket.result.bind(request);
            request.respond = socket.result.bind(request);
            try {
                methods[payload.method].apply(request);
            } catch (e) {
                debug('Internal error: %s', e.stack);
                socket.error(-32603, 'Internal error').apply(request);
            }
        } else {
            debug('Method not found: %s', payload.method, payload.params);
            socket.error(-32601, 'Method not found');
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
                socket.session = yield _this.app.sessionStore.get(sessionId);
                socket.respond('session', socket.session);   
            })());
        }
    }
}

/**
 * Register a handler generator for method
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
        this.server.clients[i].respond(method, params, function (err) {
            debug('Could not send message', data, err);
        });
    }
}



module.exports = function (app, passedOptions) {
    // Default options
    var options = {
        serveClientFile: true,
        clientFilePath: '/koaws.js',
    };
    // Override with passed options
    objectAssign(options, passedOptions || {});

    var oldListen = app.listen;
    app.listen = function () {
        debug('Attaching server...')
        app.server = oldListen.apply(app, arguments);
        app.ws = app.io = new KoaWebSocketServer(app, options);
        return app;
    };

    return function* (next) {
        if (options.serveClientFile && this.method === 'GET' && this.path === options.clientFilePath) {
            this.set('Content-Type', 'application/javascript');
            this.body = fs.createReadStream(__dirname + '/client.js');
            return;
        }

        if (this.session && this.session.id) {
            console.log(app.ws);
            if (typeof app.ws.sockets[this.session.id] === 'undefined') {
                ws.sockets[this.session.id] = [];
            }
            app.ws.sessions[this.session.id] = this.session;
            this.sockets = app.ws.sockets[this.session.id];
        }

        this.ws = this.io = {};
        this.ws.route = this.io.route = function (method) {
            // TODO: Implement routing
        }

        yield next;
    };
};