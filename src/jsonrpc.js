var Request = require('./request');

module.exports = function(debug, socket, data) {
    try {
        return request.call(this, debug, socket, data);
    } catch (e){
        console.error('Something went wrong: ', e.stack);
        return;
    }
};

function request(debug, socket, data) {
    if (typeof data != 'string') {
        data = data.data;
    }

    // If heartbeat, respond
    if (data === '--thump--') {
        debug('← Thump!');
        setTimeout(function () {
            socket.send('--thump--');
        }.bind(this), this._options.heartbeatInterval || 5000);
        return;
    }

    // Try to parse data to JSON
    try {
        var payload = JSON.parse(data);
    } catch (e) {
        debug('Parse error: %s', e.stack);
        socket.error(-32700, 'Parse error');
        return;
    }

    // Create request object
    var request = new Request(socket, payload);

    // Check if valid JSON-RPC 2.0 request
    if (!payload.jsonrpc && payload.jsonrpc !== '2.0') {
        debug('Wrong protocol: %s', payload.jsonrpc);
        socket.error.apply(request, [-32600, 'Invalid request']);
        return;
    }

    // We got a result
    if (payload.result && payload.id) {
        // Check if error
        if (payload.error) {
            debug('← (%s) Error %s: %o', payload.id, payload.error.code, payload.error.message);
            if (typeof this._awaitingResults[payload.id] === 'function') {
                this._awaitingResults[payload.id].apply(this, [payload.error]);
            }
            return;
        }
        // Everything seems fine
        debug('← (%s) Result: %o', payload.id, payload.result);
        if (typeof this._awaitingResults[payload.id] === 'function') {
            this._awaitingResults[payload.id].apply(this, [null, payload.result]);
        }
        return;
    }

    // We got an error
    if (payload.error) {
        // Check if error
        debug('← (%s) Error %s: %o', payload.id, payload.error.code, payload.error.message);
        if (typeof this._awaitingResults[payload.id] === 'function') {
            this._awaitingResults[payload.id].apply(this, [payload.error]);
        }
        return;
    }

    // Check if there's a valid method (if no result was supplied)
    if (!payload.method) {
        debug('Missing method: %o', payload);
        socket.error.apply(request, [-32600, 'Invalid request']);
        return;
    }

    // Make sure params are object or array
    if (typeof payload.params !== 'undefined' && typeof payload.params !== 'object' && !Array.isArray(payload.params)) {
        debug('Invalid params: %o', payload.params);
        socket.error.apply(request, [-32602, 'Invalid params']);
        return;
    }

    // Check if method exists
    if (typeof this._methods[payload.method] === 'function') {
        debug('← (%s) %s: %o', payload.id, payload.method, payload.params);
        try {
            this._methods[payload.method].apply(request);
        } catch (e) {
            debug('Internal error: %s', e.stack);
            socket.error.apply(request, [-32603, 'Internal error']);
        }
    } else {
        debug('← (%s) Error %s: %o', payload.id, -32601, 'Method not found');
        socket.error.apply(request, [-32601, 'Method not found']);
    }

    return;
}