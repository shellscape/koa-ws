# kao-ws

> Empower your koa.js application with realtime.

## Features

* Uses jsonrpc 2.0 protocol per default
* Uses generators as method handlers
* Simple API to register namespaced methods
* Connects your sockets to the users session

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
        clientFilePath: '/koaws.js'
    };

    app.use(koaws(app, options));

    app.listen(3000);

Register a simple method on the server:

    app.ws.register('hello', function* () {
        this.result('world!');
    });

Make sure the client library is loaded in the browser. The path is `/koaws.js` per default but can easily be changed.

Call the method from the client:

    koaws.emit('hello', function (err, result) {
        if (err) console.error('Something went wrong', err);
        console.log(result) // should log 'world!'
    });

#### Options

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