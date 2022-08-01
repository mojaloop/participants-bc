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

"use strict"

import {AuthorizationClient} from "@mojaloop/security-bc-client-lib";
import {ParticipantPrivilegeNames} from "../../domain/privilege_names";

export function addPrivileges(authorizationClient: AuthorizationClient): void {
    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.VIEW_PARTICIPANT,
            "View Participant",
            "Allows retrieving the list of participants and individual participant records"
    );

    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.CREATE_PARTICIPANT,
        "Create Participant",
        "Allows the creation of a participant record in the system"
    );

    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.APPROVE_PARTICIPANT,
            "Approve Participant",
            "Allows the approval of an unapproved participant"
    );

    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.ENABLE_PARTICIPANT,
            "Enable Participant",
            "Allows the enabling of a disabled participant"
    );

    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.DISABLE_PARTICIPANT,
            "Disable Participant",
            "Allows the disabling of an enabled participant"
    );

    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.MANAGE_ENDPOINTS,
            "Manage Participant Endpoints",
            "Allows adding and changing participant's endpoint records"
    );

    authorizationClient.addPrivilege(
            ParticipantPrivilegeNames.MANAGE_ACCOUNTS,
            "Manage Participant Accounts",
            "Allows adding and changing participant's accounts records"
    );
}
