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

"use strict";

import {
    AccountsAndBalancesAccount, AccountsAndBalancesAccountType
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

export class TransferWouldExceedCreditsError extends Error{}
export class TransferWouldExceedDebitsError extends Error{}

export interface IAccountsBalancesAdapter {
    init(): Promise<void>;

    createAccount(requestedId:string, ownerId:string, type: AccountsAndBalancesAccountType, currencyCode: string): Promise<string>;
    getAccount(accountId: string): Promise<AccountsAndBalancesAccount | null>;
    getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]>;

    getParticipantAccounts(participantId: string): Promise<AccountsAndBalancesAccount[]>;

    createJournalEntry(
        requestedId: string, ownerId: string, currencyCode: string,
        amount: string, pending: boolean, debitedAccountId: string, creditedAccountId: string
    ): Promise<string>;

    createJournalEntries(
        entries: {requestedId: string, ownerId: string, currencyCode: string,
            amount: string, pending: boolean, debitedAccountId: string, creditedAccountId: string}[]
    ): Promise<string[]>

    setToken(accessToken: string): void;
    setUserCredentials(client_id: string, username: string, password: string): void;
    setAppCredentials(client_id: string, client_secret: string): void;

    destroy(): Promise<void>;
}
