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

"use strict"

import {
    Participant,
    ParticipantAccount,
    ParticipantApproval,
    ParticipantEndpoint
} from "@mojaloop/participant-bc-public-types-lib";

export interface IParticipantsRepository {
    init(): Promise<void>;

    //Participant
    insert(participant: Participant): Promise<boolean>;
    update(participant: Participant): Promise<boolean>;
    fetchWhereName(participantName: string): Promise<Participant | null>;
    fetchWhereId(id: string): Promise<Participant | null>;

    fetchWhereIds(id: string[]): Promise<Participant[]>;
    fetchAll():Promise<Participant[]>;

    //Approvals
    //TODO needs their own repository, not to conflict...
    updateApprovalForChecker(participantApp: ParticipantApproval): Promise<boolean>;

    destroy (): Promise<void>
}

export interface IParticipantsAccountRepository {
    init(): Promise<void>;

    addAccount(participantId: string, toAdd: ParticipantAccount): Promise<boolean>;
    removeAccount(participantId: string, toRemove: ParticipantAccount): Promise<boolean>;
    fetchWhereParticipantId(participantId: string): Promise<ParticipantAccount[] | null>;
    fetchWhereParticipantIdAndType(participantId: string, type: number): Promise<ParticipantAccount | null>;

    destroy (): Promise<void>
}

export interface IParticipantsApprovalRepository {
    init(): Promise<void>;

    //TODO @jason remove
    approve(participantId: string, approved: ParticipantApproval): Promise<boolean>;

    destroy (): Promise<void>
}

export interface IParticipantsEndpointRepository {
    init(): Promise<void>;

    //TODO move to aggregate.
    addEndpoint(participantId: string, toAdd: ParticipantEndpoint): Promise<boolean>;
    removeEndpoint(participantId: string, toRemove: ParticipantEndpoint): Promise<boolean>;
    fetchWhereParticipantId(participantId: string): Promise<ParticipantEndpoint[] | null>;
    fetchWhereParticipantIdAndType(participantId: string, type: string): Promise<ParticipantEndpoint | null>;

    destroy (): Promise<void>
}
