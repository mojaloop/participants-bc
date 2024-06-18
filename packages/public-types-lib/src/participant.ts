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

import {
  ApprovalRequestState,
  ParticipantAccountTypes, ParticipantAllowedSourceIpsPortModes,
  ParticipantChangeTypes,
  ParticipantEndpointProtocols,
  ParticipantEndpointTypes, ParticipantFundsMovementTypes, ParticipantNetDebitCapTypes, ParticipantTypes
} from "./enums";

export const HUB_PARTICIPANT_ID = "hub";

export declare interface IParticipant {
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

  // only per currency
  netDebitCaps: IParticipantNetDebitCap[];
  netDebitCapChangeRequests: IParticipantNetDebitCapChangeRequest[];

  participantContacts: IParticipantContactInfo[];
  participantContactInfoChangeRequests: IParticipantContactInfoChangeRequest[];

  participantStatusChangeRequests: IParticipantStatusChangeRequest[];
}

export declare interface IParticipantNetDebitCap {
  currencyCode: string;
  type: ParticipantNetDebitCapTypes;
  percentage: number | null; // null in the case where type == "ABSOLUTE", 0>100 in the case of "PERCENTAGE"
  currentValue: number;
}

export declare interface IParticipantNetDebitCapChangeRequest {
  id: string;
  createdBy: string;
  createdDate: number;
  requestState: ApprovalRequestState;
  approvedBy: string | null;
  approvedDate: number | null;
  rejectedBy: string | null;
  rejectedDate: number | null;

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

export declare interface IParticipantFundsMovement {
  id: string;
  createdBy: string;
  createdDate: number;
  requestState: ApprovalRequestState;
  approvedBy: string | null;
  approvedDate: number | null;
  rejectedBy: string | null;
  rejectedDate: number | null;
  type: ParticipantFundsMovementTypes;
  currencyCode: string;
  amount: string;
  journalEntryId: string | null;
  extReference: string | null;
  note: string | null;
}

export declare interface IParticipantAllowedSourceIp {
  id: string;
  cidr: string; // proper cidr format
  portMode: ParticipantAllowedSourceIpsPortModes; // ANY to only use the cidr, allow traffic from any ports, SPECIFIC to use ports array, RANGE to use portRange
  ports?: number[]; // using a single or multiple ports
  portRange?: { rangeFirst: number, rangeLast: number; }; // port range
}

export declare interface IParticipantSourceIpChangeRequest extends IParticipantAllowedSourceIp {
  allowedSourceIpId: string | null;
  createdBy: string;
  createdDate: number;
  requestState: ApprovalRequestState;
  approvedBy: string | null;
  approvedDate: number | null;
  rejectedBy: string | null;
  rejectedDate: number | null;
  requestType: "ADD_SOURCE_IP" | "CHANGE_SOURCE_IP"
}

export declare interface IParticipantEndpoint {
  id: string;                                             // uuid of the endpoint
  type: ParticipantEndpointTypes;                            // "FSPIOP" | "ISO20022"
  protocol: ParticipantEndpointProtocols;                                 // for now only "HTTPs/REST";
  value: string;                                          // URL format for urls, ex: https://example.com:8080/fspcallbacks/, or simply 192.168.1.1:3000
}

export declare interface IParticipantAccount {
  id: string;                                             // uuid of the account (from the external accounts and balances system)
  type: ParticipantAccountTypes;
  //isActive: boolean                                     //TODO do we need this?
  currencyCode: string;                                   //TODO move
  debitBalance: string | null;                            // output only, we don't store this here
  creditBalance: string | null;                           // output only, we don't store this here
  balance: string | null;                                 // output only, we don't store this here
  externalBankAccountId: string | null;
  externalBankAccountName: string | null;
}

export declare interface IParticipantAccountChangeRequest {
  id: string;
  accountId: string | null;
  type: ParticipantAccountTypes;
  currencyCode: string;
  externalBankAccountId: string | null;
  externalBankAccountName: string | null;
  createdBy: string;
  createdDate: number;
  requestState: ApprovalRequestState;
  approvedBy: string | null;
  approvedDate: number | null;
  rejectedBy: string | null;
  rejectedDate: number | null;
  requestType: "ADD_ACCOUNT" | "CHANGE_ACCOUNT_BANK_DETAILS"
}

// TODO: standardise these verbs/entries
export declare interface IParticipantActivityLogEntry {
  changeType: ParticipantChangeTypes;
  user: string;
  timestamp: number;
  notes: string | null;
}

export declare interface IParticipantContactInfo {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
}

export declare interface IParticipantContactInfoChangeRequest extends IParticipantContactInfo {
  contactInfoId: string | null;
  createdBy: string;
  createdDate: number;
  requestState: ApprovalRequestState;
  approvedBy: string | null;
  approvedDate: number | null;
  rejectedBy: string | null;
  rejectedDate: number | null;
  requestType: "ADD_PARTICIPANT_CONTACT_INFO" | "CHANGE_PARTICIPANT_CONTACT_INFO";
}

export declare interface IParticipantStatusChangeRequest {
  id: string;
  isActive: boolean;
  createdBy: string;
  createdDate: number;
  requestState: ApprovalRequestState;
  approvedBy: string | null;
  approvedDate: number | null;
  rejectedBy: string | null;
  rejectedDate: number | null;
  requestType: "CHANGE_PARTICIPANT_STATUS";
}

export declare interface IParticipantLiquidityBalanceAdjustment {
  matrixId: string;
  isDuplicate: boolean;
  participantId: string;
  participantName: string | null;
  participantBankAccountInfo: string;
  bankBalance: string;
  settledTransferAmount: string;
  currencyCode: string;
  type: ParticipantFundsMovementTypes | null;
  updateAmount: string | null;
  settlementAccountId: string | null;
}

export declare interface IParticipantPendingApprovalCountByType {
  type: string,
  count: number
}

export declare interface IParticipantPendingApprovalSummary {
  totalCount: number;
  countByType: IParticipantPendingApprovalCountByType[]
}

export declare interface IParticipantPendingApproval {
  accountsChangeRequest: (IParticipantAccountChangeRequest & { participantId: string; participantName: string })[];
  fundsMovementRequest: (IParticipantFundsMovement & { participantId: string; participantName: string })[];
  ndcChangeRequests: (IParticipantNetDebitCapChangeRequest & { participantId: string; participantName: string })[];
  ipChangeRequests: (IParticipantSourceIpChangeRequest & { participantId: string; participantName: string })[];
  contactInfoChangeRequests: (IParticipantContactInfoChangeRequest & { participantId: string; participantName: string })[];
  statusChangeRequests: (IParticipantStatusChangeRequest & { participantId: string; participantName: string })[];
}

export declare type ParticipantSearchResults = {
  pageSize: number;
  totalPages: number;
  pageIndex: number;
  items: IParticipant[];
}

export declare type BulkApprovalRequestResults = {
  reqId: string;
  status: "success" | "error";
  message: string;
}