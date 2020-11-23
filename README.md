# ISLE Server [![License][license-image]][license-url] [![DOI][doi-image]][doi-url]

<div class="image" align="center">
    <img width="250" height="auto" src="https://raw.githubusercontent.com/isle-project/www/master/images/isle_icon_transparent.png" alt="ISLE logo">
    <br>
</div>

---

#### Dependencies

[![Dependabot][dependabot-image]][dependabot-url]
[![Dependencies][dependencies-image]][dependencies-url]
[![DevDependencies][dev-dependencies-image]][dev-dependencies-url]

#### Build

[![Actions Status][actions-image]][actions-url]
[![Coverage][coverage-image]][coverage-url]

## Introduction

Server program for *integrated statistics learning environment* (ISLE) lessons. Other parts of the ISLE environment are: 

-   the [isle-editor][isle-editor] is used to author ISLE lessons
-   the [isle-dashboard][isle-dashboard] is the online dashboard used to deploy, organize and monitor ISLE lessons

#### [Open Documentation][docs]

#### Prerequisites

Developing and running the ISLE server has the following prerequisites:

* [git][git]: version control
* [Node.js][node-js]: JavaScript runtime (version `>= 10.0`)
* [MongoDB][mongodb]: NoSQL document database

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

``` bash
npm start 
```

To make sure the server restarts in case of a crash, it is advised to use it via [pm2][pm2]: 

``` bash
pm2 start lib/index.js --name isle-server
```

### Tests

#### Unit

The server uses [tape][tape] for unit tests. To run the tests, execute the following command in the top-level application directory:

``` bash
$ npm test
```

#### Test Coverage

This repository uses [Istanbul][istanbul] as its code coverage tool. To generate a test coverage report, execute the following command in the top-level application directory:

```bash
$ npm run test-cov
```

Istanbul creates a `./reports/coverage` directory with an HTML version of the report.

## License

See [LICENSE][license-url].

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
[node-js]: https://nodejs.org/en/
[mongodb]: https://mongodb.com

[license-url]: https://raw.githubusercontent.com/isle-project/isle-server/master/LICENSE
[license-image]: https://img.shields.io/badge/license-APGL-blue.svg

[dependabot-image]: https://badgen.net/dependabot/isle-project/isle-server?icon=dependabot
[dependabot-url]: https://dependabot.com/

[dependencies-image]: https://img.shields.io/david/isle-project/isle-server.svg
[dependencies-url]: https://david-dm.org/isle-project/isle-server/master

[dev-dependencies-image]: https://img.shields.io/david/dev/isle-project/isle-server.svg
[dev-dependencies-url]: https://david-dm.org/isle-project/isle-server/master?type=dev

[doi-image]: https://zenodo.org/badge/63765629.svg
[doi-url]: https://zenodo.org/badge/latestdoi/63765629

[coverage-image]: https://img.shields.io/codecov/c/github/isle-project/isle-server/master.svg
[coverage-url]: https://codecov.io/gh/isle-project/isle-server

[actions-image]: https://github.com/isle-project/isle-server/workflows/NodeCI/badge.svg
[actions-url]: https://github.com/isle-project/isle-server/actions

[transcrypt]: https://github.com/elasticdog/transcrypt

[docs]: http://isledocs.com/
[isle-dashboard]: https://github.com/isle-project/isle-dashboard
[isle-editor]: https://github.com/isle-project/isle-editor

[pm2]: https://github.com/Unitech/pm2

[tape]: https://github.com/substack/tape
[istanbul]: https://github.com/gotwarlost/istanbul
