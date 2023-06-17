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

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    IParticipant,
    IParticipantAccount,
    IParticipantEndpoint,
} from "@mojaloop/participant-bc-public-types-lib";
import {
    UnableToCreateParticipantError,
    UnableToGetParticipantsError,
} from "./errors";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-client-lib";

// default 1 minute cache
const DEFAULT_CACHE_TIMEOUT_MS = 1*60*1000;

export class ParticipantsHttpClient {
    // Properties received through the constructor.
    private readonly _logger: ILogger;
    // Other properties.
    private readonly _baseUrlHttpService: string;
    private readonly _authRequester: IAuthenticatedHttpRequester;
    private readonly UNKNOWN_ERROR_MESSAGE: string = "Unknown error";
    private accessToken: string;

    private _participantsCache: Map<string, { participant: IParticipant, timestamp: number }> = new Map<string, {
        participant: IParticipant;
        timestamp: number
    }>();
    private readonly _cacheTimeoutMs: number;

    constructor(
        logger: ILogger,
        baseUrlHttpService: string,
        authRequester: IAuthenticatedHttpRequester,
        cacheTimeoutMs: number = DEFAULT_CACHE_TIMEOUT_MS
    ) {
        this._logger = logger;
        this._baseUrlHttpService = baseUrlHttpService;
        this._authRequester = authRequester;
        this._cacheTimeoutMs = cacheTimeoutMs;
    }

    async _cacheSet(arg:IParticipant):Promise<void>{
        const now = Date.now();
        if(Array.isArray(arg)){
            for(const item of arg){
               this._participantsCache.set(item.id, {participant:item, timestamp:now});
            }
        }else{
            this._participantsCache.set(arg.id, {participant:arg, timestamp:now});
        }
    }
    async _cacheGet(id:string):Promise<IParticipant|null>{
        const found = this._participantsCache.get(id);
        if(!found) return null;

        if(Date.now() - found.timestamp <= this._cacheTimeoutMs){
            return found.participant;
        }

        this._participantsCache.delete(id);
        return null;
    }

    async getAllParticipants(): Promise<IParticipant[]> {
        // not cacheable
        try {
            const url = new URL("/participants", this._baseUrlHttpService).toString();
            const resp = await this._authRequester.fetch(url);

            if(resp.status === 200){
                const data = await resp.json();
                await this._cacheSet(data);
                return data;
            }

            if (resp.status == 404) {
                return [];
            }

            throw new UnableToGetParticipantsError();
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async getParticipantsByIds(ids: string[]): Promise<IParticipant[]> {
        const notFoundIds:string[] = [];
        const participants:IParticipant[] = [];

        for(const id of ids){
            const found = await this._cacheGet(id);
            if(found) participants.push(found);
            else notFoundIds.push(id);
        }

        if(notFoundIds.length == 0){
            return participants;
        }

        try {
            const url = new URL(
                `/participants/${notFoundIds.join(",")}/multi`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if(resp.status === 200){
                const data = await resp.json();
                await this._cacheSet(data);
                participants.push(...data);
                return participants;
            }

            if (resp.status == 404) {
                return [];
            }

            throw new UnableToGetParticipantsError();
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async getParticipantById(participantId: string): Promise<IParticipant | null> {
        const found = await this._cacheGet(participantId);
        if(found) return found;

        try {
            const url = new URL(
                `/participants/${participantId}`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if(resp.status === 200){
                const data = await resp.json();
                await this._cacheSet(data);
                return data;
            }

            if (resp.status == 404) {
                return null;
            }

            throw new UnableToGetParticipantsError();
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    // this is the only method that requests updated balances from the Accounts and Balances BC
    async getParticipantAccountsById(participantId: string): Promise<IParticipantAccount[] | null> {
        // not cacheable
        try {
            const url = new URL(
                `/participants/${participantId}/accounts`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if(resp.status === 200){
                const data = await resp.json();
                return data;
            }

            if (resp.status == 404) {
                return [];
            }

            throw new UnableToGetParticipantsError();
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

}
