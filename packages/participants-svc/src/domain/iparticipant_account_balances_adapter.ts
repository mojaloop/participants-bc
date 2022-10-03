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

"use strict"

export declare type JournalAccount = {
    id?: string
    type: string
    state: string
    currencyCode: string
    debitBalance: string
    creditBalance: string
    externalId?: string
}

export declare type JournalEntry = {
    id?: string
    currencyCode: string
    amount: string
    accountDebit: string
    accountCredit: string
    timestamp: number
    externalId?: string
    externalCategory?: string
}


export interface IAccountsBalancesAdapter {
    init(): Promise<void>;

    createAccount(account: JournalAccount): Promise<string>;
    getAccount(accountId: string): Promise<JournalAccount | null>;

    getAccounts(participantId: string): Promise<JournalAccount[] | null>;

    createJournalEntry(account: JournalEntry): Promise<string>;

    destroy (): Promise<void>
}
