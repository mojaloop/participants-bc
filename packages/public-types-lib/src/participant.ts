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

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
******/

"use strict";

// import {verify} from "crypto";
// import {NetworkInterfaceInfo} from "os";

export declare type ParticipantType = "HUB" | "DFSP";

/** Participants **/
export declare type Participant = {
  id: string;
  name: string;
  type: ParticipantType;
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
  changeLog:ParticipantActivityLogEntry[];
}

export declare type ParticipantFundsMovementDirection = "FUNDS_DEPOSIT" | "FUNDS_WITHDRAWAL";

export declare type ParticipantFundsMovement = {
  id: string;
  createdBy: string;
  createdDate: number;
  approved: boolean;
  approvedBy: string | null;
  approvedDate: number | null;

  direction: ParticipantFundsMovementDirection;
  currencyCode: string;
  amount: string;

  transferId: string | null;
  extReference: string | null;
  note: string | null;
}

export declare type ParticipantAllowedSourceIps = {
  id: string;                                             // uuid of the source IP
  cidr:string;                                            // proper cidr format
  // ANY to only use the cidr, allow traffic from any ports, SPECIFIC to use ports array, RANGE to use portRange
  portMode: "ANY" | "SPECIFIC" | "RANGE";
  ports?: number[];                                       // using a single or multiple ports
  portRange?:{ rangeFirst: number, rangeLast: number;};   // port range
}

export declare type PartipantEndpointType = "FSPIOP" | "ISO20022";
export declare type PartipantEndpointProtocol = "HTTPs/REST";

export declare type ParticipantEndpoint = {
  id: string;                                             // uuid of the endpoint
  type: PartipantEndpointType;                            // "FSPIOP" | "ISO20022"
  protocol: PartipantEndpointProtocol;                                 // for now only "HTTPs/REST";
  value: string;                                          // URL format for urls, ex: https://example.com:8080/fspcallbacks/, or simply 192.168.1.1:3000
}

export declare type ParticipantAccountType = "HUB_ASSET" | "POSITION" | "SETTLEMENT";

export declare type ParticipantAccount = {
  id: string;                                             // uuid of the account (from the external accounts and balances system)
  type: ParticipantAccountType;
  //isActive: boolean                                     //TODO do we need this?
  currencyCode: string;                                   //TODO move
  debitBalance?: string;                                  // output only, we don't store this here
  creditBalance?: string;                                 // output only, we don't store this here
}

export declare type ParticipantChangeType =
        "CREATE" | "APPROVE" | "ACTIVATE" | "DEACTIVATE"
        | "ADD_ACCOUNT" | "REMOVE_ACCOUNT"
        | "ADD_ENDPOINT" | "REMOVE_ENDPOINT" | "CHANGE_ENDPOINT"
        | "ADD_SOURCEIP" | "REMOVE_SOURCEIP" | "CHANGE_SOURCEIP"
        | "FUNDS_DEPOSIT" | "FUNDS_WITHDRAWAL";

export declare type ParticipantActivityLogEntry = {
  changeType: ParticipantChangeType;
  user: string;
  timestamp: number;
  notes: string | null;
}



//
// export declare type ParticipantApproval = {
//   participantId: string;
//   lastUpdated: number;
//   maker: string;
//   makerLastUpdated: number;
//   checker: string;
//   checkerLastUpdated: number;
//   checkerApproved: boolean;
//   feedback: string;
// }

