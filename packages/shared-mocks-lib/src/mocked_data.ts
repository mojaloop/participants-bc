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

 * ThitsaWorks
 - Sithu Kyaw <sithu.kyaw@thitsaworks.com>
 - Zwe Htet Myat <zwehtet.myat@thitsaworks.com>
 --------------
 ******/

"use strict";

import {
    IParticipant,
    ParticipantTypes,
    ParticipantAccountTypes,
    ParticipantAllowedSourceIpsPortModes,
    ParticipantEndpointTypes,
    ParticipantEndpointProtocols,
} from "@mojaloop/participant-bc-public-types-lib";


function createMockedParticipant(id: string, name: string, type: ParticipantTypes, description: string, createdBy: string): IParticipant {
    return {
        id,
        name,
        type,
        isActive: true,
        description,
        createdBy,
        createdDate: 1689145137678,
        approved: false,
        approvedBy: null,
        approvedDate: 1689145259976,
        lastUpdated: 1689145259976,

        participantAllowedSourceIps: [
            {
                id: "1",
                cidr: "127.0.0.1/8",
                portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                ports: undefined,
                portRange: undefined,
            }
        ],
        participantSourceIpChangeRequests: [],
        participantEndpoints: [
            {
                id: "1",
                type: ParticipantEndpointTypes.FSPIOP,
                protocol: ParticipantEndpointProtocols["HTTPs/REST"],
                value: "https://172.31.88.169:4040"
            }
        ],
        participantAccounts: type === ParticipantTypes.HUB ? [
            {
                id: "1",
                type: ParticipantAccountTypes.HUB_MULTILATERAL_SETTLEMENT,
                currencyCode: "USD",
                balance: null,
                creditBalance: null,
                debitBalance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
            }, {
                id: "2",
                type: ParticipantAccountTypes.HUB_RECONCILIATION,
                currencyCode: "USD",
                balance: null,
                creditBalance: null,
                debitBalance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
            }
        ] : [
            {
                id: "1",
                type: ParticipantAccountTypes.POSITION,
                currencyCode: "USD",
                balance: null,
                creditBalance: null,
                debitBalance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
            }, {
                id: "2",
                type: ParticipantAccountTypes.SETTLEMENT,
                currencyCode: "USD",
                balance: null,
                creditBalance: null,
                debitBalance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
            }],
        participantAccountsChangeRequest: [],
        fundsMovements: [],
        changeLog: [],
        netDebitCaps: [],
        netDebitCapChangeRequests: [],
        participantContacts: [],
        participantContactInfoChangeRequests: [],
        participantStatusChangeRequests: [],
        csrRequests: [],
        certificates: [],
    };
}

export const mockedParticipantHub: IParticipant = createMockedParticipant("hub", "HUB", ParticipantTypes.HUB, "Desc for HUB", "system");
export const mockedParticipant1: IParticipant = createMockedParticipant("participant1", "Participant 1", ParticipantTypes.DFSP, "Desc for participant 1", "admin");
export const mockedParticipant2: IParticipant = createMockedParticipant("participant2", "Participant 2", ParticipantTypes.DFSP, "Desc for participant 2", "user");
export const mockedInactiveParticipant: IParticipant = createMockedParticipant("participant3", "Participant 3", ParticipantTypes.DFSP, "Desc for participant 3", "user");
