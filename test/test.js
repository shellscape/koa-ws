var fs = require('fs');
var chai = require('chai');
var expect = chai.expect;

var request = require('supertest');
var koa = require('koa');
var http = require('http');
var session = require('koa-generic-session');
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

    it ('should be able to attach middleware to app', function () {
        var middleware = require('../src/middleware');
        app.use(middleware(app));
        expect(app).to.have.property('ws');
    });

    it ('should be able to register a simple route', function () {
        app.ws.register('hello', function* () {
            this.result('world');
        });
        expect(app.ws.methods.hello).to.be.a('function');
    });

    it ('should be able to register namespaced routes', function () {
        app.ws.register('user', {
            create: function* () { this.result('ok'); },
            update: function* () { this.result('ok'); },
            delete: function* () { this.result('ok'); }
        });

        expect(app.ws.methods['user:create']).to.be.a('function');
        expect(app.ws.methods['user:update']).to.be.a('function');
        expect(app.ws.methods['user:update']).to.be.a('function');
    });

    it ('should be able to listen to the same port as koa server', function (done) {
        app.listen(3000, function () {
            expect(app.ws.server._server).to.be.a('object');
            done();
        });

        request(app.server)
            .get('/');
    });

    it ('websocket client should be able to connect to server', function (done) {
        client = require('../src/client');
        client.connect();
        client.on('open', function () {
            done();
        });
    });

    it ('should get world when hello method is called', function (done) {
        client.method('hello', function (err, payload) {
            expect(err).to.be.a('null');
            expect(payload).to.equal('world');
            done();
        });
    });

    it ('should be able to call namespaced events', function (done) {
        client.method('user:create', function (err, payload) {
            expect(err).to.be.a('null');
        });

        client.method('user:update', function (err, payload) {
            expect(err).to.be.a('null');
        });

        client.method('user:delete', function (err, payload) {
            expect(err).to.be.a('null');
            done();
        });
    });

    it ('should return error -32700 parse error', function (done) {
        client.once('message', function (payload) {
            var payload = JSON.parse(payload);
            expect(payload.error.code).to.be.equal(-32700);
            done();
        });
        client.socket.send({ foo: 'bar' });
    });

    it ('should return error -32600 invalid request', function (done) {
        client.once('message', function (payload) {
            var payload = JSON.parse(payload);
            expect(payload.error.code).to.be.equal(-32600);
            done();
        });
        client.socket.send(JSON.stringify({ foo: 'bar' }));
    });

    it ('should return error -32602 invalid params', function (done) {
        client.method('hello', 'world!', function (err, payload) {
            expect(err.code).to.be.equal(-32602);
            done();
        });
    });

    it ('should return error -32601 method not found', function (done) {
        client.method('foo', function (err, payload) {
            expect(err.code).to.be.equal(-32601);
            done();
        });
    });

    it ('should serve the client library at /koaws.js', function (done) {
        request(app.server)
            .get('/koaws.js')
            .expect(200)
            .expect('Content-Type', 'application/javascript')
            .end(function (err, res) {
                if (err) throw err;
                done();
            });
    });

});