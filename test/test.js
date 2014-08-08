var fs = require('fs');
var chai = require('chai');
var expect = chai.expect;

var koa = require('koa');
var middleware = require('../src/middleware');
var app = koa();

app.use(function* (next) {
    if (this.path === '/') {
        this.set('Content-Type', 'text/html');
        this.body = fs.createReadStream(__dirname + '/test.html');
    } else {
        yield next;
    }
});

describe('koa-ws', function () {

    it ('should be able to attach middleware to app', function () {
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
            create: function* () { this.respond('ok'); },
            update: function* () { this.respond('ok'); },
            delete: function* () { this.respond('ok'); }
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
    });

    it ('websocket client should be able to connect to server', function (done) {
        client = require('../src/client');
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

});