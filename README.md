# kao-ws

Empower your koa.js application with realtime.

Attaches WebSocket server (using ws) and connects your sessions with your sockets.

## Usage

### Installation

    npm install koa-ws

### Examples

How to add to your app:

    var koa = require('koa');
    var koaws = require('koa-ws');
    var app = koa();

    app.use(koaws(app));

    app.listen(3000);

Register a simple method on the server:

    app.ws.register('hello', function* () {
        this.result('world!');
    });

Call the method from the client (make sure to have the client file loaded):

    socket.emit('hello', function (err, result) {
        console.log(result) // should log 'world!'
    });

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