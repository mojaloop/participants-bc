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
import * as TB from "tigerbeetle-node";
import {randomUUID} from "crypto";

export class TigerBeetleAdapter implements IAccountsBalancesAdapter {
    private _logger: ILogger;
    private readonly _clusterId: number;
    private readonly _replicaAddresses: string[];
    private _client: TB.Client;

    constructor(clusterId: number, replicaAddresses: string[], logger: ILogger) {
        this._clusterId = clusterId;
        this._replicaAddresses = replicaAddresses;
        this._logger = logger.createChild(this.constructor.name);
    }

    async init(): Promise<void> {
        this._client = TB.createClient({
            cluster_id: this._clusterId,
            replica_addresses: this._replicaAddresses
        });

        this._logger.info("GrpcAccountsAndBalancesAdapter initialised successfully");
    }

    // inspired from https://stackoverflow.com/a/53751162/5743904
    private _uuidToBigint(uuid:string): bigint{
        // let hex = uuid.replaceAll("-",""); // replaceAll only works on es2021
        let hex = uuid.replace(/-/g, "");
        if (hex.length % 2) { hex = "0" + hex; }
        const bi = BigInt("0x" + hex);
        return bi;
    }

    private _bigIntToUuid(bi:bigint): string{
        let str = bi.toString(16);
        if(str.length !== 32){
            this._logger.warn("_bigIntToUuid() got string that is not 32 chars long");
        }else{
            str = str.substring(0, 8)+"-"+str.substring(8, 12)+"-"+str.substring(12, 16)+"-"+str.substring(16, 20)+"-"+str.substring(20);
        }

        return str;
    }

    async createAccount(account: JournalAccount): Promise<string> {
        const id = account.id || randomUUID();

        const tbAccount = {
            id: this._uuidToBigint(id), // u128
            user_data: 0n, // u128, opaque third-party identifier to link this account to an external entity:
            reserved: Buffer.alloc(48, 0), // [48]u8
            ledger: 1,   // u32, ledger value
            code: 718, // u16, a chart of accounts code describing the type of account (e.g. clearing, settlement)
            flags: 0,  // u16
            debits_pending: 0n,  // u64
            debits_posted: 0n,  // u64
            credits_pending: 0n, // u64
            credits_posted: 0n, // u64
            timestamp: 0n, // u64, Reserved: This will be set by the server.
        }

        const errors = await this._client.createAccounts([tbAccount])

        if(errors.length){
            throw new Error("Cannot create account - error code: "+errors[0].code);
        }

        return id;
    }

    async createJournalEntry(entry: JournalEntry): Promise<string> {

        const id = entry.id || randomUUID();

        const transfer:TB.Transfer = {
            id: this._uuidToBigint(id), // u128
            pending_id: 0n, // u128
            // Double-entry accounting:
            debit_account_id: this._uuidToBigint(entry.accountDebit),  // u128
            credit_account_id: this._uuidToBigint(entry.accountCredit), // u128
            // Opaque third-party identifier to link this transfer to an external entity:
            user_data: 0n, // u128
            reserved: 0n, // u128
            // Timeout applicable for a pending/2-phase transfer:
            timeout: 0n, // u64, in nano-seconds.
            // Collection of accounts usually grouped by the currency:
            // You can't transfer money between accounts with different ledgers:
            ledger: 1,  // u32, ledger for transfer (e.g. currency).
            // Chart of accounts code describing the reason for the transfer:
            code: 720,  // u16, (e.g. deposit, settlement)
            flags: 0, // u16
            amount: BigInt(entry.amount), // u64
            timestamp: 0n, //u64, Reserved: This will be set by the server.
        }
        const errors = await this._client.createTransfers([transfer])

        if(errors.length){
            throw new Error("Cannot create createJournalEntry - error code: "+errors[0].code);
        }

        return id;
    }

    async getAccount(accountId: string): Promise<JournalAccount | null>{
        const accounts = await this.getAccounts([accountId]);
        return accounts[0] ?? null;
    }

    async getAccounts(accountIds: string[]): Promise<JournalAccount[]>{
        const ids:TB.AccountID[] = accountIds.map(value => this._uuidToBigint(value));

        const accounts = await this._client.lookupAccounts(ids);

        const ret:JournalAccount[] = accounts.map(value => {
            return {
                id: this._bigIntToUuid(value.id),
                type: String(value.flags),
                currencyCode: String(value.code),
                creditBalance: String(value.credits_posted),
                debitBalance: String(value.debits_posted)
            }
        });

        return ret;
    }

    async getParticipantAccounts(externalId: string): Promise<JournalAccount[] | null> {
        throw new Error("not implemented");
    }

    async destroy (): Promise<void> {
        await this._client.destroy();
    }
}
