# Mojaloop vNext Participants Client Library

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/releases)
[![Npm Version](https://img.shields.io/npm/v/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![CircleCI](https://circleci.com/gh/mojaloop/participants-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/participants-bc)

This is a readonly HTTP client library for the Participants bounded context.

It allows for the following readonly operations:
- **getAllParticipants**: get all registered participants.
- **getParticipantsByIds**: get multiple participants whose ids match the provided array of Ids.
- **getParticipantById**: get a single participant by its Id.
- **getParticipantAccountsById**: get the account list of a participant by its Id _(This is the only call that includes balances - fetched from the Accounts and Balances Services by the Participants Service)_.


**NOTE**: This client requires an instance of a IAuthenticatedHttpRequester with adequate credentials from the Authentication BC to be passed in the constructor


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
	AuthenticatedHttpRequester,
	IAuthenticatedHttpRequester
} from "@mojaloop/security-bc-client-lib";
import {
    AccountsAndBalancesClient,
    IAccountDTO,
    IJournalEntryDTO
} from "@mojaloop/participants-bc-client-lib";

const logger: ILogger = new ConsoleLogger();

// IAuthenticatedHttpRequester consts
const AUTH_TOKEN_ENPOINT = "http://localhost:3201/token";
const USERNAME = "user";                // only needed for user logins (password grant)
const PASSWORD = "superPass";           // only needed for user logins (password grant)
const CLIENT_ID = "security-bc-ui";     // always required
const CLIENT_SECRET = "client_secret";  // only needed for app logins (client_credentials grant)

// create the instance of IAuthenticatedHttpRequester
const authRequester = new AuthenticatedHttpRequester(logger, AUTH_TOKEN_ENPOINT);

// set user credentials example (password grant)
authRequester.setUserCredentials(CLIENT_ID, USERNAME, PASSWORD);

// set app credentials example (client_credentials grant)
// authRequester.setAppCredentials(CLIENT_ID, CLIENT_SECRET);

// ParticipantsHttpClient constants
const PARTICIPANTS_BASE_URL: string = "http://localhost:3010";
const HTTP_CLIENT_TIMEOUT_MS: number = 10_000;

const participantsClient = new ParticipantsHttpClient(logger, PARTICIPANTS_BASE_URL, authRequester);

await participantsClient.getAllParticipants().then(value => {
	console.log(value);
}).catch(reason => {
	if(reason instanceof UnauthorizedError){
		console.log("Invalid credentials");
	}else if(reason instanceof ConnectionRefusedError){
		console.log("Cannot connect to destination endpoint");
	}else if(reason instanceof RequestTimeoutError) {
		console.log("Timeout while waiting for request to finish");
	}else if(reason instanceof MaxRetriesReachedError) {
		console.log("Request max retries reached, giving up");
	}else {
		console.error(reason);
	}
});
```

## See Also

- [Participants-BC Web Service App](https://github.com/mojaloop/participants-bc/tree/main/packagtes/participants-svc)
