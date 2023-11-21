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

export enum ParticipantPrivilegeNames {
    VIEW_PARTICIPANT= "VIEW_PARTICIPANT",
    CREATE_PARTICIPANT = "CREATE_PARTICIPANT",
    APPROVE_PARTICIPANT = "APPROVE_PARTICIPANT",
    ENABLE_PARTICIPANT = "ENABLE_PARTICIPANT",
    DISABLE_PARTICIPANT = "DISABLE_PARTICIPANT",
    MANAGE_ENDPOINTS = "MANAGE_ENDPOINTS",
    CREATE_PARTICIPANT_ACCOUNT = "CREATE_PARTICIPANT_ACCOUNT",
    CHANGE_PARTICIPANT_ACCOUNT_BANK_DETAILS = "CHANGE_PARTICIPANT_ACCOUNT_BANK_DETAILS",
    APPROVE_PARTICIPANT_ACCOUNT_CREATION_REQUEST = "APPROVE_PARTICIPANT_ACCOUNT_CREATION_REQUEST",
    APPROVE_PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST = "APPROVE_PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST",
    CREATE_FUNDS_DEPOSIT = "CREATE_FUNDS_DEPOSIT",
    APPROVE_FUNDS_DEPOSIT = "APPROVE_FUNDS_DEPOSIT",
    CREATE_LIQUIDITY_ADJUSTMENT_BULK_REQUEST = "CREATE_LIQUIDITY_ADJUSTMENT_BULK_REQUEST",
    CREATE_FUNDS_WITHDRAWAL = "CREATE_FUNDS_WITHDRAWAL",
    APPROVE_FUNDS_WITHDRAWAL = "APPROVE_FUNDS_WITHDRAWAL",
    CREATE_NDC_CHANGE_REQUEST = "CREATE_NDC_CHANGE_REQUEST",
    APPROVE_NDC_CHANGE_REQUEST = "APPROVE_NDC_CHANGE_REQUEST",
    CREATE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST = "CREATE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST",
    APPROVE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST = "APPROVE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST",
    CREATE_PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST = "CREATE_PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST",
    APPROVE_PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST = "APPROVE_PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST",
    CREATE_PARTICIPANT_STATUS_CHANGE_REQUEST = "CREATE_PARTICIPANT_STATUS_CHANGE_REQUEST",
    APPROVE_PARTICIPANT_STATUS_CHANGE_REQUEST = "APPROVE_PARTICIPANT_STATUS_CHANGE_REQUEST",
    VIEW_ALL_PENDING_APPROVALS = "VIEW_ALL_PENDING_APPROVALS",
    APPROVE_PENDING_APPROVAL_BULK_REQUEST = "APPROVE_PENDING_APPROVAL_BULK_REQUEST"
}
