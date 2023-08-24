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


import {ParticipantPrivilegeNames} from "../domain/privilege_names";

export const AppPrivilegesDefinition = [
    {
        privId: ParticipantPrivilegeNames.VIEW_PARTICIPANT,
        labelName: "View Participant",
        description: "Allows retrieving the list of participants and individual participant records"
    }, {
        privId: ParticipantPrivilegeNames.CREATE_PARTICIPANT,
        labelName: "Create Participant",
        description: "Allows the creation of a participant record in the system"
    }, {
        privId: ParticipantPrivilegeNames.APPROVE_PARTICIPANT,
        labelName: "Approve Participant",
        description: "Allows the approval of an unapproved participant"
    }, {
        privId: ParticipantPrivilegeNames.ENABLE_PARTICIPANT,
        labelName: "Enable Participant",
        description: "Allows the enabling of a disabled participant"
    }, {
        privId: ParticipantPrivilegeNames.DISABLE_PARTICIPANT,
        labelName: "Disable Participant",
        description: "Allows the disabling of an enabled participant"
    }, {
        privId: ParticipantPrivilegeNames.MANAGE_ENDPOINTS,
        labelName: "Manage Participant Endpoints",
        description: "Allows adding and changing participant's endpoint records"
    }, {
        privId: ParticipantPrivilegeNames.CREATE_ACCOUNTS_CHANGE_REQUEST,
        labelName: "Create Participant Accounts Change Request",
        description: "Allows adding and changing participant's accounts records"
    }, {
        privId: ParticipantPrivilegeNames.APPROVE_ACCOUNTS_CHANGE_REQUEST,
        labelName: "Approve Participant Accounts Change Request",
        description: "Approves an existing participant's accounts change request"
    }, {
        privId: ParticipantPrivilegeNames.CREATE_FUNDS_DEPOSIT,
        labelName: "Create deposit funds movement",
        description: "Creates a deposit funds movement record in the participant"
    }, {
        privId: ParticipantPrivilegeNames.CREATE_FUNDS_WITHDRAWAL,
        labelName: "Create withdrawal funds movement",
        description: "Creates a withdrawal funds movement record in the participant"
    }, {
        privId: ParticipantPrivilegeNames.APPROVE_FUNDS_DEPOSIT,
        labelName: "Approves an existing deposit funds movement",
        description: "Approves an existing deposit funds movement record in the participant"
    }, {
        privId: ParticipantPrivilegeNames.APPROVE_FUNDS_WITHDRAWAL,
        labelName: "Approves an existing withdrawal funds movement",
        description: "Approves an existing withdrawal funds movement record in the participant"
    },{
        privId: ParticipantPrivilegeNames.CREATE_NDC_CHANGE_REQUEST,
        labelName: "Create NDC options",
        description: "Create NDC change record in the participant"
    },{
        privId: ParticipantPrivilegeNames.APPROVE_NDC_CHANGE_REQUEST,
        labelName: "Approves an existing NDC",
        description: "Approves an existing NDC change record in the participant"
    }

];

