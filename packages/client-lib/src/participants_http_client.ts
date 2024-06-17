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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

"use strict";

import crypto from "crypto";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    IParticipant,
    IParticipantAccount,
} from "@mojaloop/participant-bc-public-types-lib";
import {
    UnableToGetParticipantsError,
} from "./errors";
import { IAuthenticatedHttpRequester } from "@mojaloop/security-bc-public-types-lib";
import { ParticipantSearchResults } from "@mojaloop/participants-bc-participants-svc/src/domain/server_types";
import {
    IMessage,
    IMessageConsumer,
    MessageTypes
} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { 
    ParticipantChangedEvt,
    ParticipantsBCTopics
} from "@mojaloop/platform-shared-lib-public-messages-lib";

// default 1 minute cache
const DEFAULT_CACHE_TIMEOUT_MS = 1*60*1000;

export class ParticipantsHttpClient {
    // Properties received through the constructor.
    private readonly _logger: ILogger;
    // Other properties.
    private readonly _baseUrlHttpService: string;
    private readonly _authRequester: IAuthenticatedHttpRequester;
    private readonly _cacheTimeoutMs: number;
    private readonly _messageConsumer:IMessageConsumer | null;

    private _participantsCache: Map<string, { participant: IParticipant, timestamp: number }> = new Map<string, {
        participant: IParticipant;
        timestamp: number
    }>();
    
    private _refreshTimer: NodeJS.Timeout | null = null;

    constructor(
        logger: ILogger,
        baseUrlHttpService: string,
        authRequester: IAuthenticatedHttpRequester,
        cacheTimeoutMs: number = DEFAULT_CACHE_TIMEOUT_MS,
        messageConsumer:IMessageConsumer|null = null
    ) {
        this._logger = logger.createChild(this.constructor.name);
        this._baseUrlHttpService = baseUrlHttpService;
        this._authRequester = authRequester;
        this._cacheTimeoutMs = cacheTimeoutMs;
        this._messageConsumer = messageConsumer;
    }

    async init(): Promise<void> {
        this._logger.info("Initializing ParticipantsHttpClient");
        try {
            const allParticipants = await this.getAllParticipants();
            this._logger.info(`Fetched and cached ${allParticipants.items.length} participants.`);
            this._startRefreshTimer();

            if(this._messageConsumer){
                this._messageConsumer.setTopics([ParticipantsBCTopics.DomainEvents]);
                this._messageConsumer.setCallbackFn(this._messageHandler.bind(this));
                await this._messageConsumer.connect();
                await this._messageConsumer.startAndWaitForRebalance();
            }

            this._logger.info("Initialized ParticipantsHttpClient completed");

        } catch (e) {
            this._logger.error("Failed to initialize ParticipantsHttpClient", e);
            throw e;
        }
    }


    async destroy(): Promise<void> {
        this._logger.info("Destroying ParticipantsHttpClient");
        try {
            if(this._refreshTimer) {
                clearInterval(this._refreshTimer);
            }
            this._logger.info("ParticipantsHttpClient destroy completed");
        } catch (e) {
            this._logger.error("Failed to destroy ParticipantsHttpClient", e);
            throw e;
        }
    }

    private _startRefreshTimer(): void {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }

        this._refreshTimer = setInterval(() => {
            /* istanbul ignore next */
            this.refreshParticipants().catch(err => this._logger.error("Failed to refresh participants", err));
        }, this._cacheTimeoutMs);
    }

    async _cacheSet(arg:IParticipant|IParticipant[]):Promise<void>{
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

    async getAllParticipants(): Promise<ParticipantSearchResults> {
        try {
            const url = new URL("/participants", this._baseUrlHttpService).toString();
            const resp = await this._authRequester.fetch(url);

            if(resp.status === 200){
                const data:ParticipantSearchResults = await resp.json();

                for (const participant of data.items) {
                    await this._cacheSet(participant);
                }

                return data;
            }

            if (resp.status == 404) {
                return {
                    pageIndex: 0,
                    pageSize: 0,
                    totalPages: 0,
                    items: []
                };
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

        const maxRetries = 3;
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
        
        for(let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const url = new URL(
                    `/participants/${notFoundIds.join(",")}/multi`,
                    this._baseUrlHttpService
                ).toString();
                const resp = await this._authRequester.fetch(url);

                if(resp.status === 200){
                    const data: IParticipant[] = await resp.json();
                    await this._cacheSet(data);
                    participants.push(...data);
                    return participants;
                }

                if (resp.status == 404) {
                    return participants;
                }

                throw new UnableToGetParticipantsError();
            } catch (e: unknown) {
                if (attempt < maxRetries - 1) {
                    this._logger.warn(`Attempt ${attempt + 1} to fetch participants failed. Retrying...`);
                    await delay(500 * Math.pow(2, attempt));
                } else {
                    this._logger.error("Failed to fetch participants after multiple retries", e);
                    if (e instanceof Error) throw e;
                    throw new UnableToGetParticipantsError();
                }
            }
        }
        return participants;
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

    async refreshParticipants(): Promise<string[]> {
        const expiredParticipantIds: string[] = [];
        const now = Date.now();

        for (const [id, { timestamp }] of this._participantsCache.entries()) {
            if (now - timestamp > this._cacheTimeoutMs) {
                expiredParticipantIds.push(id);
                this._participantsCache.delete(id);
            }
        }

        if (expiredParticipantIds.length > 0) {
            try {
                await this.getParticipantsByIds(expiredParticipantIds);
            } catch (error) {
                this._logger.error("Failed to refresh participants from remote", error);
            }
        }

        return expiredParticipantIds;
    }

    private async _messageHandler(message:IMessage):Promise<void>{
        if(message.msgType !== MessageTypes.DOMAIN_EVENT) return;
        if(message.msgName !== ParticipantChangedEvt.name) return;

        // for now, simply fetch everything
        this._logger.info("ParticipantChangedEvt received, fetching updated Role privileges associations...");

        // randomize wait time, so we don't have all clients fetching at the exact same time
        setTimeout(async () => {
            const participantChangedEvt = message as ParticipantChangedEvt;

            try {
                const participantId = participantChangedEvt.payload.participantId;
                const updatedParticipant = await this.getParticipantById(participantId);

                if (updatedParticipant) {
                    this._logger.info(`Updated participant with ID ${participantId} cached successfully.`);
                }
            } catch (error) {
                this._logger.error("Failed to update participant cache from event", error);
            }
        }, crypto.randomInt(0, 5000));
    }

}
