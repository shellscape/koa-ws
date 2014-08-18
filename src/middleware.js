var fs = require('fs');
var path = require('path');
var objectAssign = require('object-assign');
var replaceStream = require('replacestream');
var debug = require('debug')('koa-ws:middleware');

var KoaWebSocketServer = require('./server');

module.exports = function (app, passedOptions) {
    // Default options
    var options = {
        serveClientFile: true,
        clientFilePath: '/koaws.js',
        heartbeat: true,
        heartbeatInterval: 5000
    };
    // Override with passed options
    objectAssign(options, passedOptions || {});

    var oldListen = app.listen;
    app.listen = function () {
        debug('Attaching server...')
        app.server = oldListen.apply(app, arguments);
        app.ws.listen(app.server);
        return app;
    };

    app.ws = app.io = new KoaWebSocketServer(app, options);

    return function* (next) {
        if (options.serveClientFile && this.method === 'GET' && this.path === options.clientFilePath) {
            this.set('Content-Type', 'application/javascript');
            this.body = fs.createReadStream(__dirname + '/client.js');
            return;
        }

        if (this.session && this.session.id) {
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