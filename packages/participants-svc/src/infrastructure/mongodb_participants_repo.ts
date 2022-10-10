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

import {IParticipantsRepository} from "../domain/repo_interfaces";
import {Participant} from "@mojaloop/participant-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Collection, FilterQuery, MongoClient} from 'mongodb'

export class MongoDBParticipantsRepo implements IParticipantsRepository {
    private _mongoUri: string;
    private _logger: ILogger;
    private _mongoClient: MongoClient;
    protected _collectionParticipant: Collection;
    protected _collectionApproval: Collection;

    private _initialized: boolean = false;
    private readonly _databaseName: string = 'participants';
    private readonly _collectionNameParticipant: string = 'participant';
    private readonly _collectionNameApproval: string = 'participantApproval';

    constructor(_mongoUri: string, logger: ILogger) {
        this._logger = logger.createChild(this.constructor.name);
        this._mongoUri = _mongoUri;
    }

    async init(): Promise<void>{
        try {
            this._mongoClient = await MongoClient.connect(this._mongoUri, { useNewUrlParser: true });
        } catch (err: any) {
            const errMsg: string = err?.message?.toString();
            this._logger.isWarnEnabled() && this._logger.warn(`MongoDbParticipantRepo - init failed with error: ${errMsg}`);
            this._logger.isErrorEnabled() && this._logger.error(err);
            throw (err);
        }
        if (this._mongoClient === null) throw new Error('Couldn\'t instantiate mongo client');

        const db = this._mongoClient.db(this._databaseName);
        this._collectionParticipant = db.collection(this._collectionNameParticipant);
        this._collectionApproval = db.collection(this._collectionNameApproval);
        this._initialized = true;
        this._logger.info("MongoDBParticipantsRepo - initialized");
    }

    private _stripMongoId(participant:Participant):Participant{
        delete (participant as any)._id;
        return participant;
    }

    async fetchAll():Promise<Participant[]>{
        const found:Participant[] = await this._collectionParticipant.find({}).toArray();
        return found.map(this._stripMongoId);
    }

    async fetchWhereId(participantId: string): Promise<Participant | null> {
        const found:Participant|null = await this._collectionParticipant.findOne({ id: participantId });
        return found ? this._stripMongoId(found) : null;
    }

    async fetchWhereName(participantName: string): Promise<Participant | null> {
        const found:Participant|null = await this._collectionParticipant.findOne({ name: participantName });
        return found ? this._stripMongoId(found) : null;
    }

    async fetchWhereIds(ids: string[]): Promise<Participant[]> {
        const returnVal : Participant[] = [];

        for (const id of ids) {
            const existing = await this.fetchWhereId(id);
            if (existing !== null) returnVal.push(existing)
        }

        return returnVal.map(this._stripMongoId);
    }

    async create(participant: Participant): Promise<boolean> {
        this._logger.info(`Name:  ${participant.name} - created in:`);
        const result = await this._collectionParticipant.insertOne(participant);

        return result.insertedCount === 1;
    }

    async store(participant: Participant): Promise<boolean> {
        const updated = Date.now();
        const result = await this._collectionParticipant.updateOne(
            { id: participant.id },
            {
                $set: {
                    id: participant.id,
                    name: participant.name,
                    isActive: participant.isActive,
                    description: participant.description,
                    createdBy: participant.createdBy,
                    createdDate: participant.createdDate,

                    approved: participant.approved,
                    approvedBy: participant.approvedBy,
                    approvedDate: participant.approvedDate,

                    lastUpdated: participant.approvedDate,
                    participantAllowedSourceIps: participant.participantAllowedSourceIps,
                    participantEndpoints: participant.participantEndpoints,
                    participantAccounts: participant.participantAccounts,
                    changeLog: participant.changeLog
                }
            }
        );
        return (result.modifiedCount === 1)
    }

    async destroy (): Promise<void> {
        if (this._initialized) await this._mongoClient.close()
    }


}