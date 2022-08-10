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

import {IParticipantsApprovalRepository} from "../domain/repo_interfaces";
import {Participant, ParticipantApproval} from "@mojaloop/participant-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Collection, MongoClient} from 'mongodb'

export class MongoDBParticipantsApprovalRepo implements IParticipantsApprovalRepository {
    private _mongoUri: string;
    private _logger: ILogger;
    private _mongoClient: MongoClient;
    protected _colApproval: Collection;
    protected _colParticipants: Collection;

    private _initialized: boolean = false;
    private readonly _databaseName: string = 'participants';
    private readonly _colNameApproval: string = 'participantApproval';
    private readonly _collectionNameParticipant: string = 'participant';

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
        this._colParticipants = db.collection(this._collectionNameParticipant);
        this._colApproval = db.collection(this._colNameApproval);
        this._initialized = true;
    }

    async approve(participantId: string, approved: ParticipantApproval): Promise<boolean> {
        const updated = Date.now();

        const result = await this._colApproval.updateOne(
            { participantId: participantId },
            {
                $set: {
                    lastUpdated: updated,
                    checkerLastUpdated: updated,
                    checkerApproved: true,
                    feedback: approved.feedback,
                    checker: approved.checker
                },
                $currentDate: { lastModified: true }
            }
        );

        if (result.modifiedCount === 1) {
            const resultPart = await this._colParticipants.updateOne(
                {id: participantId},
                {
                    $set: {
                        lastUpdated: updated,
                        isActive: true
                    },
                    $currentDate: {lastModified: true}
                }
            );
            return (resultPart.modifiedCount === 1);
        }

        return false;
    }

    async destroy (): Promise<void> {
        if (this._initialized) await this._mongoClient.close()
    }
}
