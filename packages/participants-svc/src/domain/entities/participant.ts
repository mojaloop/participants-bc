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

"use strict";

import {
    IParticipant,
    IParticipantAccount,
    IParticipantAccountChangeRequest,
    IParticipantActivityLogEntry,
    IParticipantAllowedSourceIp,
    IParticipantContactInfo,
    IParticipantContactInfoChangeRequest,
    IParticipantEndpoint,
    IParticipantFundsMovement, IParticipantNetDebitCap,
    IParticipantNetDebitCapChangeRequest, IParticipantSourceIpChangeRequest,
    ParticipantChangeTypes,
    ParticipantTypes
} from "@mojaloop/participant-bc-public-types-lib";

/** Participant entity **/
export class Participant implements IParticipant {
    id: string;
    name: string;
    type: ParticipantTypes;
    isActive: boolean;
    description: string;

    createdBy: string;
    createdDate: number;

    approved: boolean;
    approvedBy: string | null;
    approvedDate: number | null;

    lastUpdated: number;

    participantAllowedSourceIps: IParticipantAllowedSourceIp[];
    participantSourceIpChangeRequests: IParticipantSourceIpChangeRequest[];

    participantEndpoints: IParticipantEndpoint[];
    participantAccounts: IParticipantAccount[];
    participantAccountsChangeRequest: IParticipantAccountChangeRequest[];

    fundsMovements: IParticipantFundsMovement[];
    changeLog: IParticipantActivityLogEntry[];

    netDebitCaps: IParticipantNetDebitCap[];
    netDebitCapChangeRequests: IParticipantNetDebitCapChangeRequest[];

    participantContacts: IParticipantContactInfo[];
    participantContactInfoChangeRequests: IParticipantContactInfoChangeRequest[];

    static CreateHub(id: string, desc: string, user: string, changeLogNote: string) {
        const now = Date.now();
        const hub: Participant = {
            id: id,
            name: "HUB",
            type: ParticipantTypes.HUB,
            isActive: true,
            description: desc,
            createdBy: user,
            createdDate: now,
            approved: true,
            approvedBy: user,
            approvedDate: now,
            lastUpdated: now,
            participantAccounts: [],
            participantAccountsChangeRequest: [],
            participantEndpoints: [],
            participantAllowedSourceIps: [],
            participantSourceIpChangeRequests: [],
            fundsMovements: [],
            changeLog: [{
                changeType: ParticipantChangeTypes.CREATE,
                user: user,
                timestamp: now,
                notes: changeLogNote
            }],
            netDebitCaps: [],
            netDebitCapChangeRequests: [],
            participantContacts: [],
            participantContactInfoChangeRequests: []
        };

        return hub;
    }


    /**
     * To check sourceIpChangeRequest contains valid data
     * @param request
     * @returns Promise<void>
     */
    static async ValidateParticipantSourceIpChangeRequest(request: IParticipantSourceIpChangeRequest): Promise<void> {
        try {
            if (request.cidr.trim().length === 0) {
                throw new Error(
                    `CIDR cannot be empty.`
                );
            }

            if (!_validateParticipantSourceIP_CIDR(request.cidr.trim())) {
                throw new Error(
                    `Invalid CIDR format.`
                );
            }

            if (!_validateParticipantSourceIP_PortMode(request.portMode)) {
                throw new Error(
                    `Invalid Port Mode.`
                );
            }

            if (request.portMode === "RANGE") {
                if (Number(request.portRange?.rangeFirst) === 0 || Number(request.portRange?.rangeFirst) === 0) {
                    throw new Error(
                        `Invalid Port Range values.`
                    );
                }

                if (!_validateParticipantSourceIP_PortRange(Number(request.portRange?.rangeFirst), Number(request.portRange?.rangeLast))) {
                    throw new Error(
                        `Invalid Port Range values.`
                    );
                }
            }

            if (request.portMode === "SPECIFIC") {
                if (!_validateParticipantSourceIP_Ports(request.ports)) {
                    throw new Error(
                        `Invalid Port value.`
                    );
                }
            }
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }


    /**
     * To check sourceIpChangeRequest contains valid data
     * @param request
     * @returns Promise<void>
     */
    static async ValidateParticipantContactInfoChangeRequest(request: IParticipantContactInfoChangeRequest): Promise<void> {
        try {

            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const phoneNumRegex = /^(\+\d{1,4}\s?)?(\(\d{1,4}\)\s?)?[\d\s-]+$/;

            if (request.name.trim().length === 0) {
                throw new Error(
                    `Contact name cannot be empty.`
                );
            }

            if (!emailRegex.test(request.email)) {
                throw new Error(
                    `Invalid contact email.`
                );
            }

            if (!phoneNumRegex.test(request.phoneNumber)) {
                throw new Error(
                    `Invalid contact phone number.`
                );
            }

            return Promise.resolve();

        } catch (error) {
            return Promise.reject(error);
        }
    }


}

// Helper IP address validation functions called by Participant.ValidateParticipantSourceIpChangeRequest()
////

function _validateParticipantSourceIP_CIDR(input: string): boolean {
    // Regular expression for CIDR notation validation
    const cidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

    // Check if the input matches the CIDR regex
    return cidrRegex.test(input);
}

function _validateParticipantSourceIP_PortMode(portMode: string): boolean {
    return portMode === "ANY" || portMode === "SPECIFIC" || portMode === "RANGE";
}

function _validateParticipantSourceIP_PortRange(rangeFirst?: number | null, rangeLast?: number | null): boolean {
    // Check if either both `rangeFirst` and `rangeLast` are null, or both are valid numbers
    if (
        !(rangeFirst === null && rangeLast === null) &&
        !(rangeFirst === 0 && rangeLast === 0) &&
        (!(typeof rangeFirst === 'number' && typeof rangeLast === 'number') ||
            rangeFirst >= rangeLast)
    ) {
        // Invalid port range
        return false;
    }
    // Valid port range
    return true;
}

function _validateParticipantSourceIP_Ports(portsArray: number[] | undefined): boolean {
    if (!portsArray) {
        return false;
    }

    const portString = portsArray.join(",");

    // Regular expression for ports validation
    const portsRegex = /^([1-9]\d*)(,[1-9]\d*)*$/;

    if (!portsRegex.test(portString)) {
        return false;
    }

    // Check if each port in the array is a valid number
    for (const port of portsArray) {
        if (isNaN(port) || port < 1 || port > 65535) {
            // Invalid port number
            return false;
        }
    }

    // Valid ports array
    return true;
}


/*
// these types below are all unnecessary since they are dumb objects that simply
// implement the interfaces, might as well just use the interfaces

export declare class ParticipantNetDebitCap implements IParticipantNetDebitCap{
    currencyCode: string;
    type: "ABSOLUTE" | "PERCENTAGE";
    percentage: number;
    currentValue: number;
}

export declare class ParticipantNetDebitCapChangeRequest implements IParticipantNetDebitCapChangeRequest {
    id: string;
    createdBy: string;
    createdDate: number;
    approved: boolean;
    approvedBy: string | null;
    approvedDate: number | null;

    currencyCode: string;
    type: ParticipantNetDebitCapTypes;
    // null in the case where type == "ABSOLUTE", 0>100 in the case of "PERCENTAGE"
    percentage: number | null;
    // this will have the value in currency in case of type == "ABSOLUTE" - will directly to the currentValue when approved
    // will be null when type === "PERCENTAGE"
    fixedValue: number | null;

    extReference: string | null;
    note: string | null;
}


export declare class ParticipantFundsMovement implements IParticipantFundsMovement{
    id: string;
    createdBy: string;
    createdDate: number;
    approved: boolean;
    approvedBy: string | null;
    approvedDate: number | null;

    direction: ParticipantFundsMovementDirections;
    currencyCode: string;
    amount: string;

    transferId: string | null;
    extReference: string | null;
    note: string | null;
}


export declare class ParticipantAllowedSourceIps implements IParticipantAllowedSourceIps{
    id: string;                                             // uuid of the source IP
    cidr: string;                                            // proper cidr format
    // ANY to only use the cidr, allow traffic from any ports, SPECIFIC to use ports array, RANGE to use portRange
    portMode: ParticipantAllowedSourceIpsPortModes;
    ports?: number[];                                       // using a single or multiple ports
    portRange?: { rangeFirst: number, rangeLast: number; };   // port range
}


export declare class ParticipantEndpoint implements IParticipantEndpoint{
    id: string;                                             // uuid of the endpoint
    type: ParticipantEndpointTypes;                            // "FSPIOP" | "ISO20022"
    protocol: ParticipantEndpointProtocols;                                 // for now only "HTTPs/REST";
    value: string;                                          // URL format for urls, ex: https://example.com:8080/fspcallbacks/, or simply 192.168.1.1:3000
}


export declare class ParticipantAccount implements IParticipantAccount{
    id: string;                                             // uuid of the account (from the external accounts and balances system)
    type: ParticipantAccountTypes;
    //isActive: boolean                                     //TODO do we need this?
    currencyCode: string;                                   //TODO move
    debitBalance: string | null;                            // output only, we don't store this here
    creditBalance: string | null;                           // output only, we don't store this here
    balance: string | null;									// output only, we don't store this here
    externalBankAccountId: string | null;
    externalBankAccountName: string | null;
}

export declare class ParticipantAccountChangeRequest implements IParticipantAccountChangeRequest{
    id: string;
    accountId: string | null;
    type: ParticipantAccountTypes;
    currencyCode: string;
    externalBankAccountId: string | null;
    externalBankAccountName: string | null;
    createdBy: string;
    createdDate: number;
    approved: boolean;
    approvedBy: string | null;
    approvedDate: number | null;
}

export declare class ParticipantActivityLogEntry implements IParticipantActivityLogEntry{
    changeType: ParticipantChangeTypes;
    user: string;
    timestamp: number;
    notes: string | null;
}
*/
