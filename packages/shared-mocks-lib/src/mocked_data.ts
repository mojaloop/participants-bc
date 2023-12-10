/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
**/

"use strict";

import { 
    IParticipant,
    ParticipantTypes,
    ParticipantAccountTypes,
    ParticipantAllowedSourceIpsPortModes,
    ParticipantEndpointTypes,
    ParticipantEndpointProtocols,
} from "@mojaloop/participant-bc-public-types-lib";

export const mockedParticipantHub: IParticipant = {
    id: "hub",
    name: "HUB",
    type: ParticipantTypes.HUB,
    isActive: true,
    description: "Desc for HUB",
    createdBy: "system",
    createdDate: 1689145137678,
    approved: true,
    approvedBy: "system",
    approvedDate: 1689145259976,
    lastUpdated: 1689145259976,

    participantAllowedSourceIps: [],
    participantSourceIpChangeRequests: [],
    participantEndpoints: [],

    participantAccounts: [
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
    ],
    participantAccountsChangeRequest: [],

    fundsMovements: [],
    changeLog: [],

    netDebitCaps: [],
    netDebitCapChangeRequests: [],

    participantContacts: [],
    participantContactInfoChangeRequests: [],

    participantStatusChangeRequests: [],
};

export const mockedParticipant1: IParticipant = {
    id: "participant1",
    name: "Participant 1",
    type: ParticipantTypes.DFSP,
    isActive: true,
    description: "Desc for participant 1",
    createdBy: "admin",
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
            value: 'http://172.31.88.169:4040'
        }
    ],
    participantAccounts: [
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
        }
    ],
    participantAccountsChangeRequest: [],

    fundsMovements: [],
    changeLog: [],

    netDebitCaps: [],
    netDebitCapChangeRequests: [],

    participantContacts: [],
    participantContactInfoChangeRequests: [],

    participantStatusChangeRequests: [],
};

export const mockedParticipant2: IParticipant = {
    id: "participant2",
    name: "Participant 2",
    type: ParticipantTypes.DFSP,
    isActive: true,
    description: "Desc for participant 2",
    createdBy: "user",
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
            value: 'http://172.31.88.169:4040'
        }
    ],
    participantAccounts: [
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
        }
    ],
    participantAccountsChangeRequest: [],

    fundsMovements: [],
    changeLog: [],

    netDebitCaps: [],
    netDebitCapChangeRequests: [],

    participantContacts: [],
    participantContactInfoChangeRequests: [],

    participantStatusChangeRequests: [],
};

export const mockedInactiveParticipant: IParticipant = {
    id: "participant3",
    name: "Participant 3",
    type: ParticipantTypes.DFSP,
    isActive: false,
    description: "Desc for participant 3",
    createdBy: "user",
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

    participantEndpoints: [],
    participantAccounts: [],
    participantAccountsChangeRequest: [],

    fundsMovements: [],
    changeLog: [],

    netDebitCaps: [],
    netDebitCapChangeRequests: [],

    participantContacts: [],
    participantContactInfoChangeRequests: [],

    participantStatusChangeRequests: [],
};