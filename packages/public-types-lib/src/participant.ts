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

// NOTE types/enums here are kept as simple string type unions
// If changes are made in the master participant entities and enums, these should be updated

export const HUB_PARTICIPANT_ID = "hub";

export declare interface IParticipant {
  id: string;
  name: string;
  type: "HUB" | "DFSP";
  isActive: boolean;
  description: string;

  createdBy: string;
  createdDate: number;

  approved: boolean;
  approvedBy: string | null;
  approvedDate: number | null;

  lastUpdated: number;

  participantAllowedSourceIps: IParticipantAllowedSourceIps[];
  participantEndpoints: IParticipantEndpoint[];
  participantAccounts: IParticipantAccount[];
  participantAccountsChangeRequest: IParticipantAccountChangeRequest[];

  fundsMovements: IParticipantFundsMovement[];
  changeLog: IParticipantActivityLogEntry[];

  // only per currency
  netDebitCaps: IParticipantNetDebitCap[];
  netDebitCapChangeRequests: IParticipantNetDebitCapChangeRequest[];
}

export declare interface IParticipantNetDebitCap{
    currencyCode: string;
    type: "ABSOLUTE" | "PERCENTAGE";
    percentage: number | null; // null in the case where type == "ABSOLUTE", 0>100 in the case of "PERCENTAGE"
    currentValue: number;
}

export declare interface IParticipantNetDebitCapChangeRequest {
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

export declare interface IParticipantFundsMovement {
  id: string;
  createdBy: string;
  createdDate: number;
  approved: boolean;
  approvedBy: string | null;
  approvedDate: number | null;

  direction: "FUNDS_DEPOSIT" | "FUNDS_WITHDRAWAL";
  currencyCode: string;
  amount: string;

  transferId: string | null;
  extReference: string | null;
  note: string | null;
}

export declare interface IParticipantAllowedSourceIps {
  id: string;
  cidr:string;                                            // proper cidr format
  // ANY to only use the cidr, allow traffic from any ports, SPECIFIC to use ports array, RANGE to use portRange
  portMode: "ANY" | "SPECIFIC" | "RANGE";
  ports?: number[];                                       // using a single or multiple ports
  portRange?:{ rangeFirst: number, rangeLast: number;};   // port range
}

export declare interface IParticipantEndpoint {
  id: string;                                             // uuid of the endpoint
  type: "FSPIOP" | "ISO20022";                            // "FSPIOP" | "ISO20022"
  protocol: "HTTPs/REST";                                 // for now only "HTTPs/REST";
  value: string;                                          // URL format for urls, ex: https://example.com:8080/fspcallbacks/, or simply 192.168.1.1:3000
}

export declare interface IParticipantAccount {
  id: string;                                             // uuid of the account (from the external accounts and balances system)
  type: "FEE" | "POSITION" | "SETTLEMENT" | "HUB_MULTILATERAL_SETTLEMENT" | "HUB_RECONCILIATION";
  //isActive: boolean                                     //TODO do we need this?
  currencyCode: string;                                   //TODO move
  debitBalance: string | null;                            // output only, we don't store this here
  creditBalance: string | null;                           // output only, we don't store this here
  balance: string | null;                                 // output only, we don't store this here
  externalBankAccountId: string | null;
  externalBankAccountName: string | null;
}

export declare interface IParticipantAccountChangeRequest{
	id: string;
	accountId: string | null;
	type: "FEE" | "POSITION" | "SETTLEMENT" | "HUB_MULTILATERAL_SETTLEMENT" | "HUB_RECONCILIATION";
	currencyCode: string;
	externalBankAccountId: string | null;
	externalBankAccountName: string | null;
	createdBy: string;
	createdDate: number;
	approved: boolean;
	approvedBy: string | null;
	approvedDate: number | null;
  requestType: "ADD_ACCOUNT" | "CHANGE_ACCOUNT_BANK_DETAILS"
}

export declare interface IParticipantActivityLogEntry {
  changeType: "CREATE" | "APPROVE" | "ACTIVATE" | "DEACTIVATE"
     | "ADD_ACCOUNT_REQUEST" | "ADD_ACCOUNT" | "REMOVE_ACCOUNT" | "CHANGE_ACCOUNT_BANK_DETAILS_REQUEST" | "CHANGE_ACCOUNT_BANK_DETAILS"
      | "ADD_ENDPOINT" | "REMOVE_ENDPOINT" | "CHANGE_ENDPOINT"
      | "ADD_SOURCEIP" | "REMOVE_SOURCEIP" | "CHANGE_SOURCEIP"
      | "FUNDS_DEPOSIT" | "FUNDS_WITHDRAWAL" | "NDC_CHANGE" | "NDC_RECALCULATED";
  user: string;
  timestamp: number;
  notes: string | null;
}

