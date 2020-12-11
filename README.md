# @feathersjs-offline/example

> An example client and server showcasing FeathersJS offline-first realtime support for `own-data` and `own-net` protocols as described in the docs [here](https://auk.docs.feathersjs.com/guides/offline-first/readme.html#offline-first).
>
> This example is a showcase of the algorithms and not your usual implementation (which is a lot simpler - just follow the descriptions [here](https://feathersjs-offline.github.io/docs/api/offline-api.html#feathers-offline-server)).

## Installation

``` bash
git clone https://github.com/feathersjs-offline/example
```

## Documentation

This collection of packages i interesting due to to mainly two things:
- it fully supports own-data and own-net as described in You can read the docs [offline-first](https://auk.docs.feathersjs.com/guides/offline-first/readme.html#offline-first) and the updated docs [here](https://feathersjs-offline.github.io/docs/api/offline-api.html#feathers-offline-server).
- it can be used almost invisibly - you do not have to change your coding habits to utilize it, just set it up and forget all about it!


## Running the Example

After cloning the repository execute

``` bash
cd feathersjs-offline/example
npm install
```
This will take a couple of minutes. When this has completed successfully you start the server by executing
``` bash
node server
```
The server will start and write a message like:
```bash
Feathers application started on http://localhost:3030

after create data = {"text":"This is a message from The Creator Himself!","updatedAt":"2020-12-11T07:05:58.258Z","uuid":"7_lEahFZN","onServerAt":"2020-12-11T07:05:58.323Z"}
result: {"text":"This is a message from The Creator Himself!","updatedAt":"2020-12-11T07:05:58.258Z","uuid":"7_lEahFZN","onServerAt":"2020-12-11T07:05:58.323Z"}
```

Now you point your favourite browser to `file:///<WHATEVER-YOUR-PATH-WAS>/feathersjs-offline/simple-example/public/index.html` and you should be running.

You can open several windows if you want to see what happens when multiple clients operate at the same time both online and offline.

> We presuppose you have `npm` and `node` installed otherwise you will have to install them before running the example.

## License

Copyright (c) 2020

Licensed under the [MIT license](LICENSE).
