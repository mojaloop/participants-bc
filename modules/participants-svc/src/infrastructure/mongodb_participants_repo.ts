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

'use strict'

import {IParticipantsRepository} from "../domain/iparticipant_repo";
import {Participant} from "@mojaloop/participant-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import { Collection, MongoClient } from 'mongodb'

export class MongoDBParticipantsRepo implements IParticipantsRepository {
    private _mongoUri: string;
    private _logger: ILogger;
    private _mongoClient: MongoClient;
    protected _mongoCollection: Collection;

    private _initialized: boolean = false;
    private readonly _databaseName: string = 'participants';
    private readonly _collectionName: string = 'participant';
    

    constructor(_mongoUri: string, logger: ILogger) {
        this._logger = logger;
        this._mongoUri = _mongoUri;
    }

    async init(): Promise<void>{
        try {
            this._mongoClient = await MongoClient.connect(this._mongoUri, { useNewUrlParser: true })
        } catch (err: any) {
            const errMsg: string = err?.message?.toString()
            this._logger.isWarnEnabled() && this._logger.warn(`MongoDbParticipantRepo - init failed with error: ${errMsg}`)
            this._logger.isErrorEnabled() && this._logger.error(err)
            throw (err)
        }

        // this._mongoClient = await MongoClient.connect(this._mongoUri)
        if (this._mongoClient === null) throw new Error('Couldn\'t instantiate mongo client');

        const db = this._mongoClient.db(this._databaseName)
        this._mongoCollection = db.collection(this._collectionName)
        this._initialized = true

        await MongoClient.connect(this._mongoUri, { useNewUrlParser: true })
    }

    async fetchWhereName(participantName: string): Promise<Participant | null> {
        return await this._mongoCollection.findOne({ name: participantName });
    }
    
    async fetchWhereId(participantId: number): Promise<Participant | null> {
        return await this._mongoCollection.findOne({ id: participantId });
    }

    async store(participant: Participant): Promise<boolean> {
        this._logger.info(`Name:  ${participant.name} - stored for Participants-BC:`);
        const result = await this._mongoCollection.insertOne(participant);
        return result.insertedCount === 1;
    }

    async destroy (): Promise<void> {
        if (this._initialized) await this._mongoClient.close()
    }


}
