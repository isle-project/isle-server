# ISLE Server

#### Dependencies

[![Dependencies][dependencies-image]][dependencies-url] [![DevDependencies][dev-dependencies-image]][dev-dependencies-url]
[![DOI](https://zenodo.org/badge/63765629.svg)][doi]

#### Build

[![Build Status](https://travis-ci.com/isle-project/isle-server.svg?branch=master)](https://travis-ci.com/isle-project/isle-server)
[![Coverage](https://img.shields.io/codecov/c/github/isle-project/isle-server/master.svg)](https://img.shields.io/codecov/c/github/isle-project/isle-server/master.svg) [![Greenkeeper badge](https://badges.greenkeeper.io/isle-project/isle-server.svg)](https://greenkeeper.io/)

## Introduction

Server program for *integrated statistics learning environment* (ISLE) lessons. Other parts of the ISLE environment are: 

-   the [isle-editor][isle-editor] is used to author ISLE lessons
-   the [isle-dashboard][isle-dashboard] is the online dashboard used to deploy, organize and monitor ISLE lessons

#### [Open Documentation][docs]

#### Prerequisites

Developing and running the ISLE server has the following prerequisites:

* [git][git]: version control
* [Node.js][node-js]: JavaScript runtime (version `>= 9.0`)

#### Download

To acquire the source code, clone the git repository.

``` bash
$ git clone https://github.com/isle-project/isle-server
```

#### Installation

To install development dependencies,

``` bash
$ npm install
```

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

#### Icon Credits

- User Icon by Atacan from the Noun Project
- Badge Icon by Royyan Wijaya from the Noun Project
- Upload Icon by McGalloway, CC BY-SA 4.0
- Badge by Kristin Hogan from the Noun Project
- Question by unlimicon from the Noun Project
- profile by Hea Poh Lin from the Noun Project
- weights by José Manuel de Laá from the Noun Project
- chat by nauraicon from the Noun Project
- feedback by Delwar Hossain from the Noun Project
- profile by icongeek from the Noun Project

[git]: http://git-scm.com/
[license]: https://raw.githubusercontent.com/isle-project/isle-server/master/LICENSE
[node-js]: https://nodejs.org/en/

[dependencies-image]: https://img.shields.io/david/isle-project/isle-server/master.svg
[dependencies-url]: https://david-dm.org/isle-project/isle-server/master

[dev-dependencies-image]: https://img.shields.io/david/dev/isle-project/isle-server/master.svg
[dev-dependencies-url]: https://david-dm.org/isle-project/isle-server/master#info=devDependencies

[doi]: https://zenodo.org/badge/latestdoi/63765629

[transcrypt]: https://github.com/elasticdog/transcrypt

[docs]: http://isledocs.com/
[isle-dashboard]: https://github.com/isle-project/isle-dashboard
[isle-editor]: https://github.com/isle-project/isle-editor

[forever]: https://github.com/foreverjs/forever

[tape]: https://github.com/substack/tape
[istanbul]: https://github.com/gotwarlost/istanbul
