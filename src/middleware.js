var WebSocketServer = require('ws').Server;
var cookieHelper = require('koa-ws-cookie-helper');
var co = require('co');
var debug = require('debug')('koa:ws');

module.exports = function (app) {

    // Attach WebSocketServer to koa app
    var server = app.ws = app.io = new WebSocketServer({ server: app.server });

    // Container for methods
    server.methods = {};

    // Session to sockets mapping
    server.sockets = {};
    server.sessions = {};

    /**
     * Register a handler generator for method
     * @param method
     * @param generator
     * @param expose
     */
    server.register = function (method, generator, expose) {
        if (typeof method === 'object') {
            for (var m in method) {
                server.register(m, method[m]);
            }
        } else if (typeof generator === 'object') {
            for (var m in generator) {
                server.register(method + ':' + m, generator[m]);
            }
        } else if (typeof method === 'string') {
            debug('Registering method: %s', method);
            generator.expose = expose || false;
            server.methods[method] = co(generator);
        }
    };

    /**
     * Broadcast to all connected sockets
     * @param method string
     * @param params object
     */
    server.broadcast = function(method, params) {
        for (var i in this.clients) {
            this.clients[i].respond(method, params, function (err) {
                debug('Could not send message', data, err);
            });
        }
    };

    /**
     * On new connection
     * @param socket
     */
    server.on('connection', function (socket) {

        socket.respond = function (method, params) {
            try {
                var data = { 
                    jsonrpc: '2.0', 
                    method: method
                };
                if (params) {
                    data.params = params;
                }
                debug('→ %s: %o', data.method, data.params);
                socket.send(JSON.stringify(data));
            } catch (e) {
                console.error('Something went wrong: ', e.stack);
            }
        };

        socket.result = function (result) {
            try {
                var data = {
                    jsonrpc: '2.0', 
                    result: result,
                    id: this.currentId
                };
                debug('→ result for id %s: %o', data.id, data.result);
                socket.send(JSON.stringify(data));
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
            if (socket.session && Array.isArray(server.sockets[socket.session.id])) {
                server.sockets[socket.session.id].splice(
                    server.sockets[socket.session.id].indexOf(socket),
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

            if (typeof server.methods[payload.method] === 'function') {
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
                    server.methods[payload.method].apply(request);
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
        var sessionId = cookieHelper.get(socket, 'koa.sid', app.keys);
        if (sessionId) {
            if (typeof server.sockets[sessionId] === 'undefined') {
                server.sockets[sessionId] = [];
            }
            server.sockets[sessionId].push(socket);

            if (app.sessionStore) {
                (co(function* () {
                    socket.session =  yield app.sessionStore.get(sessionId);
                    socket.respond('session', socket.session);   
                })());
            }
        }
    });

    return function* (next) {
        console.error('WTF IS THIS SHIT?');
        if (typeof ws.sockets[this.session.id] === 'undefined') {
            ws.sockets[this.session.id] = [];
        }
        ws.sessions[this.session.id] = this.session;
        this.sockets = ws.sockets[this.session.id];

        console.error('SESSION:', this.session);

        this.ws.route = function (method) {
            // TODO: Implement routing
        }
        yield* next;
    };
};