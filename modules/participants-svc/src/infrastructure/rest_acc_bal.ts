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

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

'use strict'

import {
    ParticipantABAccount,
    ParticipantABJournalEntry
} from "@mojaloop/participant-bc-private-types-lib";
import {
    AccountsAndBalancesClient
} from "@mojaloop/accounts-and-balances-bc-client";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAccountsBalances} from "../domain/iparticipant_account_balances_ds";

export class RestAccountsAndBalances implements IAccountsBalances {
    private _restUri: string;
    private _logger: ILogger;
    private _accBalClient: AccountsAndBalancesClient;

    private _initialized: boolean = false;
    private _enabled: boolean = false;

    constructor(_restUri: string, logger: ILogger) {
        this._logger = logger;
        this._restUri = _restUri;

    }

    async init(): Promise<void> {
        this._initialized = true;
        if (this._enabled) {
            this._accBalClient = new AccountsAndBalancesClient(this._logger, this._restUri, 30000);
        }
    }
    
    async createAccount(account: ParticipantABAccount): Promise<boolean> {
        if (!this._enabled) return true;

        const state = await this._accBalClient.createAccount(account);
        return true;
    }

    async createJournalEntry(entry: ParticipantABJournalEntry): Promise<boolean> {
        if (!this._enabled) return true;

        const state = await this._accBalClient.createJournalEntries([entry]);
        return true;
    }

    async getAccount(accountId: string): Promise<ParticipantABAccount | null> {
        if (!this._enabled) return null;

        const result = await this._accBalClient.getAccountById(accountId)
        return result;
    }

    async getAccounts(externalId: string): Promise<ParticipantABAccount[] | null> {
        return null;//TODO @jason, implement...
    }

    async destroy (): Promise<void> {
        this._initialized = false;
    }
}
