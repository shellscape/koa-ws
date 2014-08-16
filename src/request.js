var debug = require('debug')('koa-ws:request');

function Request (socket, payload) {
    this.socket = socket;
    this.currentId = payload.id;
    this.method = payload.method;
    this.params = payload.params;
    this.session = socket.session;
};

Request.prototype.error = function (code, message) {
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
        this.socket.send(JSON.stringify(data));
    }  catch (e) {
        console.error('Something went wrong: ', e.stack);
    }
};

Request.prototype.result = function (result) {
    try {
        var payload = {
            jsonrpc: '2.0', 
            result: result,
            id: this.currentId
        };
        debug('→ result for id %s: %o', payload.id, payload.result);
        this.socket.send(JSON.stringify(payload));
    } catch (e) {
        console.error('Something went wrong: ', e.stack);
    }
};

module.exports = Request;