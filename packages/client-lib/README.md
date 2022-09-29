# Mojaloop vNext Participants Client Library

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/releases)
[![Npm Version](https://img.shields.io/npm/v/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![CircleCI](https://circleci.com/gh/mojaloop/participants-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/participants-bc)

This is the client library for the Accounts and Balances bounded context.  
It allows for the following operations:
- **Create participant**: create a single participant.
- **Create participant endpoint**: create a single participant endpoint.
- **Create participant account**: create a single participant account.

## Install
```
npm install @mojaloop/participants-bc-client-lib
```

## Usage

### Configure
```typescript
"use strict";

import {ILogger, ConsoleLogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    AccountsAndBalancesClient,
    IAccountDTO,
    IJournalEntryDTO
} from "@mojaloop/participants-bc-client-lib";

const PARTICIPANTS_URL: string = "http://localhost:1234";
const HTTP_CLIENT_TIMEOUT_MS: number = 10_000;

const ACCESS_TOKEN= "....jwt access token fetched from authentication client lib"

const logger: ILogger = new ConsoleLogger();
const participantsClient: ParticipantsHttpClient = new ParticipantsHttpClient(
    logger,
    PARTICIPANTS_URL,
    ACCESS_TOKEN,
    HTTP_CLIENT_TIMEOUT_MS
);
```

### How to set a new token
```typescript
participantsClient.setAccessToken("new access token string");
```

## See Also

- [Participants-BC Web Service App](https://github.com/mojaloop/participants-bc/tree/main/packagtes/participants-svc)
