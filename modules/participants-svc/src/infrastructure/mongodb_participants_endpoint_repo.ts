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

import {IParticipantsEndpointRepository} from "../domain/iparticipant_endpoint_repo";
import {Participant, ParticipantEndpoint} from "@mojaloop/participant-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Collection, MongoClient} from 'mongodb'
import {EndpointTypeExistsError, NoEndpointsError} from "../domain/errors";

export class MongoDBParticipantsEndpointRepo implements IParticipantsEndpointRepository {
    private _mongoUri: string;
    private _logger: ILogger;
    private _mongoClient: MongoClient;
    protected _colParticipant: Collection;

    private _initialized: boolean = false;
    private readonly _databaseName: string = 'participants';
    private readonly _colNameParticipant: string = 'participant';

    constructor(_mongoUri: string, logger: ILogger) {
        this._logger = logger;
        this._mongoUri = _mongoUri;
    }

    async init(): Promise<void>{
        try {
            this._mongoClient = await MongoClient.connect(this._mongoUri, { useNewUrlParser: true });
        } catch (err: any) {
            const errMsg: string = err?.message?.toString();
            this._logger.isWarnEnabled() && this._logger.warn(`MongoDbParticipantEndpointRepo - init failed with error: ${errMsg}`);
            this._logger.isErrorEnabled() && this._logger.error(err);
            throw (err);
        }
        if (this._mongoClient === null) throw new Error('Couldn\'t instantiate mongo client');

        const db = this._mongoClient.db(this._databaseName);
        this._colParticipant = db.collection(this._colNameParticipant);
        this._initialized = true;
    }

    async fetchWhereParticipant(participant: Participant): Promise<ParticipantEndpoint[] | null> {
        const participantBy = await this._colParticipant.findOne({ name: participant.name });
        if (participantBy == null) return null;

        return participantBy.participantEndpoints;
    }

    async fetchWhereParticipantAndType(participant: Participant, type: string): Promise<ParticipantEndpoint | null> {
        const participantEndpoints = await this.fetchWhereParticipant(participant);
        if (participantEndpoints == null) return null;

        for (let i = 0; i < participantEndpoints.length; i++) {
            if (type === participantEndpoints[i].type) return participantEndpoints[i];
        }

        throw new NoEndpointsError(`No endpoint of type '${type}' for participant '${participant.name}'.`);
    }

    async addEndpoint(participant: Participant, toAdd: ParticipantEndpoint): Promise<boolean> {
        let existing = await this.fetchWhereParticipant(participant);
        if (existing == null) existing = [];
        else if (this.doesEndpointTypeExist(existing, toAdd.type)) {
            throw new EndpointTypeExistsError(`Type ${toAdd.type} already exists for participant.`);
        }
        existing.push(toAdd);

        const updated = Date.now();
        const result = await this._colParticipant.updateOne(
            { participantId: participant.id },
            {
                $set: {
                    lastUpdated: updated,
                    participantEndpoints: existing
                },
                $currentDate: { lastModified: true }
            }
        );
        return result.modifiedCount === 1;
    }

    async removeEndpoint(participant: Participant, toRemove: ParticipantEndpoint): Promise<boolean> {
        let existing = await this.fetchWhereParticipant(participant);
        if (existing == null || existing.length === 0) return true;

        const newArr = [];
        for (const itm of existing) {
            if (toRemove.type.toLowerCase() === itm.type.toLowerCase()) continue;
            newArr.push(itm);
        }

        const updated = Date.now();
        const result = await this._colParticipant.updateOne(
            { participantId: participant.id },
            {
                $set: {
                    lastUpdated: updated,
                    participantEndpoints: newArr
                },
                $currentDate: { lastModified: true }
            }
        );
        return result.modifiedCount === 1;
    }

    async destroy (): Promise<void> {
        if (this._initialized) await this._mongoClient.close()
    }

    doesEndpointTypeExist (endpoints: ParticipantEndpoint[], type : string) : boolean {
        for (const ep of endpoints) if (type.toLowerCase() === ep.type.toLowerCase()) return true;
        return false;
    }
}
