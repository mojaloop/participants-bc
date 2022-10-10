# Mojaloop vNext Participants Client Library

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/releases)
[![Npm Version](https://img.shields.io/npm/v/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![CircleCI](https://circleci.com/gh/mojaloop/participants-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/participants-bc)

This is a readonly client library for the Accounts and Balances bounded context.  
It allows for the following readonly operations:
- **getAllParticipants**: get all registered participants.
- **getParticipantsByIds**: et multiple participants with an array of Ids.
- **getParticipantById**: get a single participant by its Id.
- **getParticipantEndpointsById**: get the endpoint list of participant by its Id.
- **getParticipantAccountsById**: get the account list of participant by its Id (this is the only call that includes balances - fetched from the Accounts and Balances Services by the Participants Service).


**NOTE**: requests require an access token and access will be controlled by the server


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
