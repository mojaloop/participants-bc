/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Contributors
--------------
This is the official list of the Mojaloop project contributors for this file.
Names of the original copyright holders (individuals or organizations)
should be listed with a '*' in the first column. People who have
contributed from an organization can be listed under the organization
that actually holds the copyright for their contributions (see the
Mojaloop Foundation for an example). Those individuals should have
their names indented and be marked with a '-'. Email address can be added
optionally within square brackets <email>.

* Mojaloop Foundation
- Name Surname <name.surname@mojaloop.io>

* Crosslake
- Pedro Sousa Barreto <pedrob@crosslaketech.com>
*****/

"use strict";

import {GrpcCreateJournalEntryArray} from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import {AccountsAndBalancesAccountType} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {LoginHelper} from "@mojaloop/security-bc-client-lib";
import {IAccountsBalancesAdapter} from "../domain/iparticipant_account_balances_adapter";

import {
    AccountsAndBalancesAccount,
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

import {
    AccountsAndBalancesGrpcClient,
    GrpcCreateAccountArray
} from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import {UnauthorizedError} from "@mojaloop/security-bc-public-types-lib";

export class GrpcAccountsAndBalancesAdapter implements IAccountsBalancesAdapter {
    private readonly _grpcUrl: string;
    private readonly _logger: ILogger;
    private readonly _loginHelper: LoginHelper;
    private _client: AccountsAndBalancesGrpcClient;

    constructor(grpcUrl: string, loginHelper: LoginHelper, logger: ILogger) {
        this._grpcUrl = grpcUrl;
        this._logger = logger.createChild(this.constructor.name);
        this._loginHelper = loginHelper;
    }

    async init(): Promise<void> {
        this._client = new AccountsAndBalancesGrpcClient(
            this._grpcUrl,
            this._loginHelper,
            this._logger
        );
        await this._client.init();
        this._logger.info("GrpcAccountsAndBalancesAdapter initialised successfully");
    }

    setToken(accessToken: string): void {
        this._loginHelper.setToken(accessToken);
    }

    setUserCredentials(client_id: string, username: string, password: string): void {
        this._loginHelper.setUserCredentials(client_id, username, password);
    }

    setAppCredentials(client_id: string, client_secret: string): void {
        this._loginHelper.setAppCredentials(client_id, client_secret);
    }

    async createAccount(requestedId: string, ownerId: string, type: AccountsAndBalancesAccountType, currencyCode: string): Promise<string> {
        const req: GrpcCreateAccountArray = {
            accountsToCreate: [{
                requestedId: requestedId,
                type: type as string,
                ownerId: ownerId,
                currencyCode: currencyCode
            }]
        };

        const createdIds = await this._client.createAccounts(req).catch((reason: any) => {
            this._logger.error(reason);
            if (reason instanceof Error && reason.constructor.name === "UnauthorizedError") {
                throw new UnauthorizedError(reason.message);
            }

            throw new Error("Could not create account in remote system: " + reason);
        });

        return createdIds.grpcIdArray![0].grpcId!;
    }

    async createJournalEntries(
        entries: {requestedId: string, ownerId: string, currencyCode: string,
        amount: string, pending: boolean, debitedAccountId: string, creditedAccountId: string}[]
    ): Promise<string[]> {
        const req: GrpcCreateJournalEntryArray = {
            entriesToCreate:entries
        };

        const createdIds = await this._client.createJournalEntries(req).catch((reason: any) => {
            this._logger.error(reason);
            throw new Error("Could not create journalEntries in remote system: " + reason);
        });

        if (!createdIds.grpcIdArray) {
            throw new Error("Bad response on createJournalEntries - invalid createdIds.grpcIdArray");
        }

        return createdIds.grpcIdArray.map(entries => entries.grpcId) as string [];
    }

    async createJournalEntry(
        requestedId: string, ownerId: string, currencyCode: string,
        amount: string, pending: boolean, debitedAccountId: string, creditedAccountId: string
    ): Promise<string> {
        const req: GrpcCreateJournalEntryArray = {
            entriesToCreate: [{
                requestedId: requestedId,
                amount: amount,
                pending: pending,
                ownerId: ownerId,
                currencyCode: currencyCode,
                debitedAccountId: debitedAccountId,
                creditedAccountId: creditedAccountId
            }]
        };

        const createdId = await this._client.createJournalEntries(req).catch((reason: any) => {
            this._logger.error(reason);
            throw new Error("Could not create journalEntry in remote system: " + reason);
        });
        return createdId.grpcIdArray![0].grpcId!;
    }

    async getAccount(accId: string): Promise<AccountsAndBalancesAccount | null> {
        const foundAccounts = await this._client.getAccountsByIds([accId]);
        if (!foundAccounts || foundAccounts.length <= 0) {
            return null;
        }
        return foundAccounts[0];
    }

    async getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]> {
        const foundAccounts: AccountsAndBalancesAccount[] = await this._client.getAccountsByIds(accountIds);
        if (!foundAccounts || foundAccounts.length <= 0) {
            return [];
        }

        return foundAccounts;
    }

    async getParticipantAccounts(externalId: string): Promise<AccountsAndBalancesAccount[]> {
        const foundAccounts: AccountsAndBalancesAccount[] = await this._client.getAccountsByOwnerId(externalId);
        if (!foundAccounts || foundAccounts.length <= 0) {
            return [];
        }

        return foundAccounts;
    }

    async destroy(): Promise<void> {
        await this._client.destroy();
    }
}
