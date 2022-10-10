/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAccountsBalancesAdapter, JournalAccount, JournalEntry} from "../domain/iparticipant_account_balances_adapter";
import {AccountsAndBalancesGrpcClient} from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import {
    AccountState,
    AccountType,
    IAccountDto,
    IJournalEntryDto
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

export class GrpcAccountsAndBalancesAdapter implements IAccountsBalancesAdapter {
    private readonly _grpcUrl: string;
    private _logger: ILogger;
    private _client: AccountsAndBalancesGrpcClient;

    constructor(grpcUrl: string, logger: ILogger) {
        this._grpcUrl = grpcUrl;
        this._logger = logger.createChild(this.constructor.name);
    }

    async init(): Promise<void> {
        this._client = new AccountsAndBalancesGrpcClient(
                this._logger.createChild("AccountsAndBalancesGrpcClient"),
                this._grpcUrl
        );
        await this._client.init();
        this._logger.info("GrpcAccountsAndBalancesAdapter initialised successfully");
    }

    async createAccount(account: JournalAccount): Promise<string> {
        const accountDto:IAccountDto = {
            id: null,
            externalId: account.externalId || null,
            state: account.state as AccountState,
            type: account.type as AccountType,
            currencyCode: account.currencyCode,
            creditBalance: account.creditBalance || "0",
            debitBalance: account.debitBalance || "0",
            timestampLastJournalEntry: null
        };

        const createdId = await this._client.createAccount(accountDto).catch(reason => {
            this._logger.error(reason);
            throw new Error("Could not create account in remote system: "+reason);
        });
        return createdId;
    }

    async createJournalEntry(entry: JournalEntry): Promise<string> {
        const entryDto : IJournalEntryDto = {
          id: null,
          externalId: null,
          externalCategory: null,
          currencyCode: entry.currencyCode,
          amount: entry.amount,
          creditedAccountId: entry.accountCredit,
          debitedAccountId: entry.accountDebit,
          timestamp: null
        } ;

        const createdId = await this._client.createJournalEntries([entryDto]).catch(reason => {
            this._logger.error(reason);
            throw new Error("Could not create journalEntry in remote system: "+reason);
        });
        return createdId[0];
    }

    async getAccount(accName: string): Promise<JournalAccount | null> {
        const found = await this._client.getAccountById(accName);
        if(!found){
            return null;
        }

        const ret: JournalAccount = {
            id: found.id!,
            type: found.type,
            externalId: found.externalId || undefined,
            state: found.state,
            currencyCode: found.currencyCode,
            debitBalance: found.creditBalance,
            creditBalance: found.debitBalance
        };

        return ret;
    }

    async getParticipantAccounts(externalId: string): Promise<JournalAccount[] | null> {
        const foundAccounts:IAccountDto[] = await this._client.getAccountsByExternalId(externalId);
        if(!foundAccounts){
            return null;
        }
        if(foundAccounts.length <= 0 ) {
            return null;
        }

        const ret: JournalAccount[] = [];

        for(const foundAcc of foundAccounts) {
            ret.push({
                id: foundAcc.id!,
                type: foundAcc.type,
                externalId: foundAcc.externalId || externalId,
                state: foundAcc.state,
                currencyCode: foundAcc.currencyCode,
                debitBalance: foundAcc.creditBalance,
                creditBalance: foundAcc.debitBalance
            });
        }

        return ret;
    }

    async destroy (): Promise<void> {
        await this._client.destroy();
    }
}
