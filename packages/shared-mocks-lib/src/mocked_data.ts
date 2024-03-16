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
    };
}

export const mockedParticipantHub: IParticipant = createMockedParticipant("hub", "HUB", ParticipantTypes.HUB, "Desc for HUB", "system");
export const mockedParticipant1: IParticipant = createMockedParticipant("participant1", "Participant 1", ParticipantTypes.DFSP, "Desc for participant 1", "admin");
export const mockedParticipant2: IParticipant = createMockedParticipant("participant2", "Participant 2", ParticipantTypes.DFSP, "Desc for participant 2", "user");
export const mockedInactiveParticipant: IParticipant = createMockedParticipant("participant3", "Participant 3", ParticipantTypes.DFSP, "Desc for participant 3", "user");
