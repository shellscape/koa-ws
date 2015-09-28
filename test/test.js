var fs = require('fs');
var chai = require('chai');
var expect = chai.expect;

var request = require('supertest');
var koa = require('koa');
var http = require('http');
var session = require('koa-generic-session');

// Setup koa app
var app = koa();
app.keys = ['foo', 'bar'];
app.sessionStore = new session.MemoryStore();
app.use(session({
    store: app.sessionStore,
    allowEmpty: true
}));

app.use(function* (next) {
    this.session.testing = true;
    if (this.path === '/') {
        this.set('Content-Type', 'text/html');
        this.body = fs.createReadStream(__dirname + '/test.html');
    } else {
        yield next;
    }
});

describe('koa-ws', function () {

    describe('server', function () {

        var socket;
        var client = require('../src/client');
        var middleware = require('../src/middleware');

        it('expect to be able to attach middleware to app', function () {
            app.use(middleware(app, {
                heartbeatInterval: 500,
                heartbeat: false
            }));
            expect(app).to.have.property('ws');
        });

        it('expect provide address', function () {
            var address = app.listen().address();
            expect(address.address).to.equal('::');
            expect(address.family).to.be.a('string');
            expect(address.port).to.be.a('number');
        });

        it('expect to be able to register a simple server method', function () {
            app.ws.register('hello', function* () {
                this.result('world');
            });
            expect(app.ws._methods.hello).to.be.a('function');
        });

        it('expect to be able to register namespaced server methods', function () {
            app.ws.register('user', {
                create: function* () { this.result('ok'); },
                update: function* () { this.result('ok'); },
                delete: function* () { this.result('ok'); }
            });

            expect(app.ws._methods['user:create']).to.be.a('function');
            expect(app.ws._methods['user:update']).to.be.a('function');
            expect(app.ws._methods['user:update']).to.be.a('function');
        });

        it('expect server to be able to listen to the same port as koa server', function (done) {
            app.listen(3000, function () {
                expect(app.ws.server._server).to.be.a('object');
                done();
            });
            // Connect and generate session
            request(app.server).get('/');
        });

        it('expect server to handle a connection', function (done) {
            app.ws.server.once('connection', function (wss) {
                expect(wss).to.be.a('object');
                socket = wss;
                done();
            });
            client.connect();
        });

        it('expect to be able to register namespaced client methods', function () {
            client.register('user', {
                create: function () { this.result('ok'); },
                update: function () { this.result('ok'); },
                delete: function () { this.result('ok'); }
            });

            expect(client._methods['user:create']).to.be.a('function');
            expect(client._methods['user:update']).to.be.a('function');
            expect(client._methods['user:update']).to.be.a('function');
        });

        it('expect server to be able to call namespaced client methods', function (done) {
            socket.method('user:create', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('ok');
            });

            socket.method('user:update', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('ok');
            });

            socket.method('user:delete', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('ok');
                done();
            });
        });

        it('expect to be able to serve the client library at /koaws.js', function (done) {
            request(app.server)
                .get('/koaws.js')
                .expect(200)
                .expect('Content-Type', 'application/javascript')
                .end(function (err, res) {
                    if (err) throw err;
                    done();
                });
        });

        it('expect heartbeat response from client', function (done) {
            socket.once('message', function (message) {
                if (message === '--thump--') {
                    done();
                }
            });
            socket.send('--thump--');
        });

    });

    describe('client', function () {

        var socket;
        var client = require('../src/client');

        it('expect client to be able to connect to server', function (done) {
            app.ws.server.once('connection', function (wss) {
                expect(wss).to.be.a('object');
                socket = wss;
            });
            client.once('open', function () {
                done();
            });
            client.connect();
        });

        it('expect client to be able to disconnect from server', function (done) {
            client.once('close', function () {
                client.connect();
                done();
            });
            client.disconnect();
        });

        it('expect client to recieve result world when hello server method is called', function (done) {
            client.method('hello', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('world');
                done();
            });
        });

        it('expect client to be able to call namespaced server methods', function (done) {
            client.method('user:create', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('ok');
            });

            client.method('user:update', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('ok');
            });

            client.method('user:delete', function (err, payload) {
                expect(err).to.be.a('null');
                expect(payload).to.equal('ok');
                done();
            });
        });

        it('expect heartbeat response from server', function (done) {
            client.once('message', function (message) {
                if (message === '--thump--') {
                    done();
                }
            });
            client.socket.send('--thump--');
        });
    });

});

describe('protocol', function () {

    describe('jsonrpc 2.0', function () {

        var client = require('../src/client');

        it('expect server to return error -32700 parse error', function (done) {
            client.once('message', function (payload) {
                payload = JSON.parse(payload);
                expect(payload.error.code).to.be.equal(-32700);
                done();
            });
            client.socket.send("{ foo: 'bar' }");
        });

        it('expect server to return error -32600 invalid request', function (done) {
            client.once('message', function (payload) {
                payload = JSON.parse(payload);
                expect(payload.error.code).to.be.equal(-32600);
                done();
            });
            client.socket.send(JSON.stringify({ foo: 'bar' }));
        });

        it('expect server to return error -32602 invalid params', function (done) {
            client.method('hello', 'world!', function (err, payload) {
                expect(err.code).to.be.equal(-32602);
                done();
            });
        });

        it('expect server to return error -32601 method not found', function (done) {
            client.method('foo', function (err, payload) {
                expect(err.code).to.be.equal(-32601);
                done();
            });
        });

    });

});

describe('http server', function () {
    it('expect close connection', function () {
        app.server.close();
    });
});
