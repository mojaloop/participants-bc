# Mojaloop vNext Participants Client Library

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/participants-bc.svg?style=flat)](https://github.com/mojaloop/participants-bc/releases)
[![Npm Version](https://img.shields.io/npm/v/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@mojaloop/participants-bc-client-lib.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/participants-bc-client-lib)
[![CircleCI](https://circleci.com/gh/mojaloop/participants-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/participants-bc)

This is the client library for the Accounts and Balances bounded context.  
It allows for the following operations:
- **Create account**: create a single account.
- **Create journal entries**: create 1 or more journal entries.
- **Get account by id**: get an account by id.
- **Get accounts by external id**: get all the accounts with a specific external id.
- **Get journal entries by account id**: get all the journal entries with a specific account id - either the credited account id or the debited account id.

## Install
```
npm install @mojaloop/participants-bc-client-lib
```

## Usage

### Configure
```
"use strict";

import {ILogger, ConsoleLogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    AccountsAndBalancesClient,
    IAccountDTO,
    IJournalEntryDTO
} from "@mojaloop/accounts-and-balancs-bc-client-lib";

const ACCOUNTS_AND_BALANCES_URL: string = "http://localhost:1234";
const HTTP_CLIENT_TIMEOUT_MS: number = 10_000;

const logger: ILogger = new ConsoleLogger();
const accountsAndBalancesClient: AccountsAndBalancesClient = new AccountsAndBalancesClient(
    logger,
    ACCOUNTS_AND_BALANCES_URL,
    HTTP_CLIENT_TIMEOUT_MS
);
```

### Create Account
```
const account: IAccountDTO = {
	id: "a",
	externalId: null,
	state: "ACTIVE",
	type: "POSITION",
	currency: "EUR",
	creditBalance: 100,
	debitBalance: 25,
	timestampLastJournalEntry: 0
}
try {
    const accountIdReceived: string = await accountsAndBalancesClient.createAccount(account);
} catch (e: unknown) {
    logger.error(e);
}
```

### Create Journal Entries
```
// Before creating a journal entry, the respective accounts need to be created.
// Account A.
const accountA: IAccountDTO = {
	id: "a",
	externalId: null,
	state: "ACTIVE",
	type: "POSITION",
	currency: "EUR",
	creditBalance: 100,
	debitBalance: 25,
	timestampLastJournalEntry: 0
};
await aggregate.createAccount(accountA);
// Account B.
const accountB: IAccountDTO = {
	id: "b",
	externalId: null,
	state: "ACTIVE",
	type: "POSITION",
	currency: "EUR",
	creditBalance: 100,
	debitBalance: 25,
	timestampLastJournalEntry: 0
};
await aggregate.createAccount(accountB);
// Journal entry A.
const journalEntryA: IJournalEntryDTO = {
	id: "a",
	externalId: null,
	externalCategory: null,
	currency: "EUR",
	amount: 5,
	creditedAccountId: accountA.id,
	debitedAccountId: accountB.id,
	timestamp: 0
}
// Journal entry B.
const journalEntryB: IJournalEntryDTO = {
	id: "b",
	externalId: null,
	externalCategory: null,
	currency: "EUR",
	amount: 5,
	creditedAccountId: accountB.id,
	debitedAccountId: accountA.id,
	timestamp: 0
}
try {
    const idsJournalEntriesReceived: string[] =
	    await accountsAndBalancesClient.createJournalEntries([journalEntryA, journalEntryB]);
} catch (e: unknown) {
    logger.error(e);
}
```

### Get Account by Id
```
const accountId: string = "a";
try {
    const account: IAccountDTO | null = await accountsAndBalancesClient.getAccountById(accountId);
} catch (e: unknown) {
    logger.error(e);
}
```

### Get Accounts by External Id
```
const externalId: string = Date.now().toString();
try {
    const accounts: IAccountDTO[] = await accountsAndBalancesClient.getAccountsByExternalId(externalId);
} catch (e: unknown) {
    logger.error(e);
}
```

### Get Journal Entries by Account Id
```
const accountId: string = Date.now().toString();
try {
    const journalEntries: IJournalEntryDTO[] = await accountsAndBalancesClient.getJournalEntriesByAccountId(accountId);
} catch (e: unknown) {
    logger.error(e);
}
```

## See Also

- [Accounts and Balances web service app](https://github.com/mojaloop/accounts-and-balances-bc/tree/main/modules/web-service-app)
