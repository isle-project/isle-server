# ISLE Server

#### Dependencies

[![Dependencies][dependencies-image]][dependencies-url] [![DevDependencies][dev-dependencies-image]][dev-dependencies-url]
[![DOI](https://zenodo.org/badge/63765629.svg)][doi]

#### Build

[![Build Status](https://travis-ci.org/Planeshifter/isle-server.svg?branch=master)](https://travis-ci.org/Planeshifter/isle-server)
[![Coverage](https://img.shields.io/codecov/c/github/Planeshifter/isle-server/master.svg)](https://img.shields.io/codecov/c/github/Planeshifter/isle-server/master.svg)

## Introduction

Server program for *integrated statistics learning environment* (ISLE) lessons. Other parts of the ISLE environment are: 

-   the [isle-editor][isle-editor] is used to author ISLE lessons
-   the [isle-dashboard][isle-dashboard] is the online dashboard used to deploy, organize and monitor ISLE lessons

#### [Open Documentation][docs]

### Encryption of Sensitive Files

Files in the `credentials` folder have been [transcrypted][transcrypt]. 

### Starting

To start the server,

```bash
npm start 
```

To make sure the server restarts in case of a crash, it is advised to use it via [forever][forever]: 

```bash
forever start -c "npm start" --append --uid="isle-server" /path/to/app/dir/
```

To stop the server, one can then simply do

```bash
forever stop isle-server
```
### Tests

#### Unit

The server uses [tape][tape] for unit tests. To run the tests, execute the following command in the top-level application directory:

``` bash
$ npm test
```

#### Test Coverage

This repository uses [Istanbul][istanbul] as its code coverage tool. To generate a test coverage report, execute the following command in the top-level application directory:

``` bash
$ npm run test-cov
```

Istanbul creates a `./reports/coverage` directory with an HTML version of the report.

## License

See [LICENSE][license].

[license]: https://raw.githubusercontent.com/Planeshifter/isle-server/master/LICENSE.md

[dependencies-image]: https://img.shields.io/david/planeshifter/isle-server/master.svg
[dependencies-url]: https://david-dm.org/planeshifter/isle-server/master

[dev-dependencies-image]: https://img.shields.io/david/dev/planeshifter/isle-server/master.svg
[dev-dependencies-url]: https://david-dm.org/planeshifter/isle-server/master#info=devDependencies

[doi]: https://zenodo.org/badge/latestdoi/63765629

[transcrypt]: https://github.com/elasticdog/transcrypt

[docs]: http://isledocs.com/
[isle-dashboard]: https://github.com/Planeshifter/isle-dashboard
[isle-editor]: https://github.com/Planeshifter/isle-editor

[forever]: https://github.com/foreverjs/forever

[tape]: https://github.com/substack/tape
[istanbul]: https://github.com/gotwarlost/istanbul
