# koa-ws

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Coveralls][coveralls-image]][coveralls-url]
[![David deps][david-image]][david-url]
[![node version][node-image]][node-url]
[![npm download][download-image]][download-url]
[![Gittip][gittip-image]][gittip-url]

[npm-image]: https://img.shields.io/npm/v/koa-ws.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-ws
[travis-image]: https://img.shields.io/travis/mekwall/koa-ws.svg?style=flat-square
[travis-url]: https://travis-ci.org/mekwall/koa-ws
[coveralls-image]: https://img.shields.io/coveralls/mekwall/koa-ws.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/mekwall/koa-ws?branch=master
[david-image]: https://img.shields.io/david/mekwall/koa-ws.svg?style=flat-square
[david-url]: https://david-dm.org/mekwall/koa-ws
[node-image]: https://img.shields.io/badge/node.js-%3E=_0.11-red.svg?style=flat-square
[node-url]: http://nodejs.org/download/
[download-image]: https://img.shields.io/npm/dm/koa-ws.svg?style=flat-square
[download-url]: https://npmjs.org/package/koa-ws
[gittip-image]: https://img.shields.io/gittip/mekwall.svg?style=flat-square
[gittip-url]: https://www.gittip.com/mekwall/

Empower your koa.js application with realtime, using the battle tested ws library.

## Features

* Uses jsonrpc 2.0 protocol per default
* Uses generators as method handlers
* Simple API to register namespaced methods
* Shared koa session between HTTP and WebSocket

## Quick start

### Installation

    $ npm install koa-ws

### Usage

Add realtime to your koa app with a couple of lines:

    var koa = require('koa');
    var koaws = require('koa-ws');
    var app = koa();

    var options = {
        serveClientFile: true,
        clientFilePath: '/koaws.js',
        heartbeat: true,
        heartbeatInterval: 5000
    };

    app.use(koaws(app, options));

    app.listen(3000);

Register a simple method on the server:

    app.ws.register('hello', function* () {
        this.result('world!');
    });

Load the client library in the browser with require (`var koaws = require('koa-ws/client')`) or use the hosted version at `/koaws.js`.

Register a method on the client to recieve the session:

    koaws.register('session', function (err, payload) {
        if (err) console.error('Something went wrong', err);
        console.log(payload) // should include our session
    });

Connect to the server:

    koaws.connect();

Call the method from the client:

    koaws.method('hello', function (err, result) {
        if (err) console.error('Something went wrong', err);
        console.log(result) // should log 'world!'
    });

#### Options

##### heartbeat (default: true)
If server/client should send hearbeats to eachother

##### heartbeatInterval (default: 5000)
How often the heartbeat should be sent

##### serveClientFile (default: true)
Will try and serve the client library file when `this.path` matches the `clientFilePath` option.

##### clientFilePath (default: /koaws.js)
Defines the path to match when serving the client library.

### Examples

#### Namespaced methods

Register a namespace:

    app.ws.register('user', {
        create: function* () {
            // create user
        },
        update: function* () {
            // update user
        },
        remove: function* () {
            // remove user
        }
    });

On the client you can then emit:

* `user:create`
* `user:update`
* `user:remove`


## License

Copyright (c) 2014, Marcus Ekwall marcus.ekwall@gmail.com

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
