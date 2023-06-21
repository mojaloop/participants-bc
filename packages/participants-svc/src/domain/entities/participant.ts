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
    IParticipantActivityLogEntry,
    IParticipantAllowedSourceIps,
    IParticipantEndpoint,
    IParticipantFundsMovement, IParticipantNetDebitCap, IParticipantNetDebitCapChangeRequest
} from "@mojaloop/participant-bc-public-types-lib";

import {
	ParticipantAccountTypes,
	ParticipantAllowedSourceIpsPortModes,
	ParticipantChangeTypes,
	ParticipantFundsMovementDirections,
	ParticipantTypes,
	ParticipantEndpointProtocols,
	ParticipantEndpointTypes
} from "./enums";

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

	participantAllowedSourceIps: ParticipantAllowedSourceIps[];
	participantEndpoints: ParticipantEndpoint[];
	participantAccounts: ParticipantAccount[];

	fundsMovements: ParticipantFundsMovement[];
	changeLog: ParticipantActivityLogEntry[];

    netDebitCaps: IParticipantNetDebitCap[];
    netDebitCapChangeRequests: IParticipantNetDebitCapChangeRequest[];

	static CreateHub(id:string, desc:string, user:string, changeLogNote:string){
		const now = Date.now();
		const hub :Participant = {
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
			participantEndpoints: [],
			participantAllowedSourceIps: [],
			fundsMovements: [],
			changeLog: [{
				changeType: ParticipantChangeTypes.CREATE,
				user: user,
				timestamp: now,
				notes: changeLogNote
			}],
            netDebitCaps: [],
            netDebitCapChangeRequests: []
		};

		return hub;
	}
}

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
    type: "ABSOLUTE" | "PERCENTAGE";
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
	debitBalance: string | null;                                  // output only, we don't store this here
	creditBalance: string | null;                                 // output only, we don't store this here
    balance: string | null;                                 // output only, we don't store this here
}

export declare class ParticipantActivityLogEntry implements IParticipantActivityLogEntry{
	changeType: ParticipantChangeTypes;
	user: string;
	timestamp: number;
	notes: string | null;
}
