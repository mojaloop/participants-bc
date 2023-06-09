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

 --------------
 ******/

"use strict";
import {
    AccountsAndBalancesAccountType,
    AccountsAndBalancesAccount,
    AccountsAndBalancesJournalEntry,
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {
    AuditSecurityContext,
    IAuditClient,
} from "@mojaloop/auditing-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    IParticipant,
    IParticipantAccount,
    IParticipantActivityLogEntry,
    IParticipantEndpoint,
    IParticipantFundsMovement,
} from "@mojaloop/participant-bc-public-types-lib";
import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {
    ForbiddenError,
    IAuthorizationClient,
    MakerCheckerViolationError,
    UnauthorizedError,
    CallSecurityContext,
} from "@mojaloop/security-bc-public-types-lib";
import {randomUUID} from "crypto";
import {
    ParticipantAccountTypes,
    ParticipantChangeTypes,
    ParticipantEndpointProtocols,
    ParticipantEndpointTypes,
    ParticipantFundsMovementDirections,
    ParticipantTypes,
} from "./entities/enums";
import {
    Participant,
    ParticipantAccount,
    ParticipantEndpoint,
} from "./entities/participant";

import {
    AccountNotFoundError,
    CannotAddDuplicateAccountError,
    CannotAddDuplicateEndpointError,
    CouldNotStoreParticipant,
    EndpointNotFoundError,
    InvalidAccountError,
    InvalidParticipantError,
    NoAccountsError,
    ParticipantAlreadyApproved,
    ParticipantCreateValidationError,
    ParticipantNotFoundError,
    UnableToCreateAccountUpstream,
} from "./errors";
import {IAccountsBalancesAdapter} from "./iparticipant_account_balances_adapter";
import {ParticipantPrivilegeNames} from "./privilege_names";
import {IParticipantsRepository} from "./repo_interfaces";

enum AuditedActionNames {
    PARTICIPANT_CREATED = "PARTICIPANT_CREATED",
    PARTICIPANT_APPROVED = "PARTICIPANT_APPROVED",
    PARTICIPANT_ENABLED = "PARTICIPANT_ENABLED",
    PARTICIPANT_DISABLED = "PARTICIPANT_DISABLED",
    PARTICIPANT_ENDPOINT_ADDED = "PARTICIPANT_ENDPOINT_ADDED",
    PARTICIPANT_ENDPOINT_CHANGED = "PARTICIPANT_ENDPOINT_CHANGED",
    PARTICIPANT_ENDPOINT_REMOVED = "PARTICIPANT_ENDPOINT_REMOVED",
    PARTICIPANT_ACCOUNT_ADDED = "PARTICIPANT_ACCOUNT_ADDED",
    PARTICIPANT_ACCOUNT_CHANGED = "PARTICIPANT_ACCOUNT_CHANGED",
    PARTICIPANT_ACCOUNT_REMOVED = "PARTICIPANT_ACCOUNT_REMOVED",
    PARTICIPANT_SOURCEIP_ADDED = "PARTICIPANT_SOURCEIP_ADDED",
    PARTICIPANT_SOURCEIP_CHANGED = "PARTICIPANT_SOURCEIP_CHANGED",
    PARTICIPANT_SOURCEIP_REMOVED = "PARTICIPANT_SOURCEIP_REMOVED",
    PARTICIPANT_FUNDS_DEPOSIT_CREATED = "PARTICIPANT_FUNDS_DEPOSIT_CREATED",
    PARTICIPANT_FUNDS_DEPOSIT_APPROVED = "PARTICIPANT_FUNDS_DEPOSIT_APPROVED",
    PARTICIPANT_FUNDS_WITHDRAWAL_CREATED = "PARTICIPANT_FUNDS_WITHDRAWAL_CREATED",
    PARTICIPANT_FUNDS_WITHDRAWAL_APPROVED = "PARTICIPANT_FUNDS_WITHDRAWAL_APPROVED",
    PARTICIPANT_NDC_CHANGE_REQUEST_CREATED = "PARTICIPANT_NDC_CHANGE_REQUEST_CREATED",
    PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED = "PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED",
}

export const HUB_PARTICIPANT_ID = "hub";

export class ParticipantAggregate {
    private _logger: ILogger;
    private _configClient: IConfigurationClient;
    private _repo: IParticipantsRepository;
    private _accBal: IAccountsBalancesAdapter;
    private _auditClient: IAuditClient;
    private _authorizationClient: IAuthorizationClient;
    private _currencyList: string[];

    constructor(
        configClient: IConfigurationClient,
        repo: IParticipantsRepository,
        accBal: IAccountsBalancesAdapter,
        auditClient: IAuditClient,
        authorizationClient: IAuthorizationClient,
        currencyList: string[],
        logger: ILogger
    ) {
        this._configClient = configClient;
        this._logger = logger.createChild(this.constructor.name);
        this._repo = repo;
        this._accBal = accBal;
        this._auditClient = auditClient;
        this._authorizationClient = authorizationClient;
        this._currencyList = currencyList;
    }

    async init(): Promise<void> {
        await this._repo.init();
        await this._accBal.init();

        // find hub participant or create one
        const hubParticipant = await this._repo.fetchWhereId(HUB_PARTICIPANT_ID);
        if (hubParticipant) {
            if (hubParticipant.type === "HUB") return;
            throw new Error("Hub participant record is not of type HUB");
        }

        await this._bootstrapHubParticipant();
    }

    private async _bootstrapHubParticipant(): Promise<void> {
        const userAndRole = "(system)";

        const hubParticipant = Participant.CreateHub(
            HUB_PARTICIPANT_ID,
            "Hub participant account",
            userAndRole,
            "(participants-svc bootstrap routine)"
        );

        if (!(await this._repo.create(hubParticipant)))
            throw new CouldNotStoreParticipant(
                "Unable to create HUB participant successfully!"
            );

        // Create the accounts for each currency
        for (const currency of this._currencyList) {
            // Hub Multilateral Net Settlement (HMLNS) account
            // participant account
            const participantHMLNSAccount: ParticipantAccount = {
                id: randomUUID(),
                type: ParticipantAccountTypes.HUB_MULTILATERAL_SETTLEMENT,
                currencyCode: currency,
                debitBalance: null,
                creditBalance: null,
            };

            try {
                // this uses the initial security context/loginhelper, which is the service creds
                participantHMLNSAccount.id = await this._accBal.createAccount(
                    participantHMLNSAccount.id,
                    hubParticipant.id,
                    participantHMLNSAccount.type as AccountsAndBalancesAccountType,
                    participantHMLNSAccount.currencyCode
                );

                hubParticipant.participantAccounts.push(participantHMLNSAccount);
                hubParticipant.changeLog.push({
                    changeType: ParticipantChangeTypes.ADD_ACCOUNT,
                    user: "(system)",
                    timestamp: hubParticipant.createdDate,
                    notes: `(participants-svc bootstrap routine added HMLNS account for: ${currency})`,
                });
            } catch (err) {
                this._logger.error(err);
                throw new UnableToCreateAccountUpstream(
                    `'${hubParticipant.name}' account '${participantHMLNSAccount.type}' failed upstream.`
                );
            }

            // Hub Reconciliation account
            // participant account record (minimal
            const participantReconAccount: ParticipantAccount = {
                id: randomUUID(),
                type: ParticipantAccountTypes.HUB_RECONCILIATION,
                currencyCode: currency,
                debitBalance: null,
                creditBalance: null,
            };

            try {
                // this uses the initial security context/loginhelper, which is the service creds
                participantReconAccount.id = await this._accBal.createAccount(
                    participantReconAccount.id,
                    hubParticipant.id,
                    participantReconAccount.type as AccountsAndBalancesAccountType,
                    participantReconAccount.currencyCode
                );
                hubParticipant.participantAccounts.push(participantReconAccount);
                hubParticipant.changeLog.push({
                    changeType: ParticipantChangeTypes.ADD_ACCOUNT,
                    user: "(system)",
                    timestamp: hubParticipant.createdDate,
                    notes: `(participants-svc bootstrap routine added Reconciliation account for: ${currency})`,
                });
            } catch (err) {
                this._logger.error(err);

                throw new UnableToCreateAccountUpstream(
                    `'${hubParticipant.name}' account '${participantReconAccount.type}' failed upstream.`
                );
            }
        }

        // store the participant that now has the accounts
        if (!(await this._repo.store(hubParticipant)))
            throw new CouldNotStoreParticipant(
                "Unable to store HUB participant successfully!"
            );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_CREATED,
            true,
            {
                userId: userAndRole,
                role: userAndRole,
                appId: this._configClient.applicationName,
            },
            [{key: "participantId", value: hubParticipant.id}]
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED,
            true,
            {
                userId: "(system)",
                role: "(system)",
                appId: "participants-svc",
            },
            [{key: "participantId", value: hubParticipant.id}]
        );

        this._logger.info(
            `Successfully bootstrapped HUB participant with ID: '${hubParticipant.id}'`
        );

        return;
    }

    private async _getHub(): Promise<IParticipant> {
        const hub: IParticipant | null = await this._repo.fetchWhereId(
            HUB_PARTICIPANT_ID
        );
        if (!hub) {
            const err = new Error("Could not get hub participant in aggregate");
            this._logger.error(err.message);
            throw err;
        }
        return hub;
    }

    private _getAuditSecCtx(secCtx: CallSecurityContext): AuditSecurityContext {
        return {
            userId: secCtx.username,
            role: "", // TODO get role
            appId: secCtx.clientId,
        };
    }

    private _enforcePrivilege(secCtx: CallSecurityContext, privName: string): void {
        for (const roleId of secCtx.rolesIds) {
            if (this._authorizationClient.roleHasPrivilege(roleId, privName)) return;
        }
        throw new ForbiddenError(
            `Required privilege "${privName}" not held by caller`
        );
    }

    private _applyDefaultSorts(participant: IParticipant): void {
        if (!participant) return;

        // sort changeLog desc
        participant.changeLog.sort(
            (a: IParticipantActivityLogEntry, b: IParticipantActivityLogEntry) =>
                b.timestamp - a.timestamp
        );
    }

    async getAllParticipants(secCtx: CallSecurityContext): Promise<IParticipant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const list: IParticipant[] | null = await this._repo.fetchAll();
        list.forEach(this._applyDefaultSorts);
        return list;
    }

    async searchParticipants(secCtx: CallSecurityContext, id: string, name: string, state: string): Promise<IParticipant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);
        const list: IParticipant[] = await this._repo.searchParticipants(
            id,
            name,
            state
        );
        list.forEach(this._applyDefaultSorts);
        return list;
    }

    async getParticipantById(secCtx: CallSecurityContext, id: string): Promise<IParticipant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: IParticipant | null = await this._repo.fetchWhereId(id);
        if (part == null)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );

        this._applyDefaultSorts(part);
        return part;
    }

    async getParticipantsByIds(secCtx: CallSecurityContext, ids: string[]): Promise<IParticipant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const parts: IParticipant[] = await this._repo.fetchWhereIds(ids);
        if (parts.length == 0)
            throw new ParticipantNotFoundError(
                `Participant with IDs: '${ids}' not found.`
            );

        parts.forEach(this._applyDefaultSorts);
        return parts;
    }

    /*async getParticipantByName(secCtx: CallSecurityContext, participantName: string): Promise<Participant> {
          this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

          const part: Participant | null = await this._repo.fetchWhereName(participantName);
          if (part==null) throw new ParticipantNotFoundError(`'${participantName}' not found.`);

          this._applyDefaultSorts(part);
          return part;
      }*/

    async createParticipant(secCtx: CallSecurityContext, inputParticipant: IParticipant): Promise<string> {
        this._enforcePrivilege(
            secCtx,
            ParticipantPrivilegeNames.CREATE_PARTICIPANT
        );

        if (inputParticipant.name.trim().length == 0)
            throw new ParticipantCreateValidationError("[name] cannot be empty");

        if (inputParticipant.type === "HUB") {
            this._logger.warn("Cannot create participants of type HUB via the API");
            throw new ParticipantCreateValidationError(
                "Cannot create participants of type HUB via the API"
            );
        }

        if (await this._repo.fetchWhereName(inputParticipant.name)) {
            this._logger.debug("trying to create duplicate participant");
            throw new ParticipantCreateValidationError(
                `Participant with name: '${inputParticipant.name}' already exists`
            );
        }

        if (inputParticipant.id) {
            if (
                inputParticipant.id.toUpperCase() === HUB_PARTICIPANT_ID.toUpperCase()
            ) {
                this._logger.warn(
                    "Cannot create a participant with the Hub reserved Id"
                );
                throw new ParticipantCreateValidationError(
                    "Cannot create a participant with the Hub reserved Id"
                );
            }

            if (await this._repo.fetchWhereId(inputParticipant.id)) {
                this._logger.debug("trying to create duplicate participant");
                throw new ParticipantCreateValidationError(
                    `Participant with id: '${inputParticipant.id}' already exists`
                );
            }
        }

        // make sure participant id fits 32 char length (as per FSPIOP definition)
        if (!inputParticipant.id || inputParticipant.id.length > 32) {
            inputParticipant.id = randomUUID();
            inputParticipant.id = inputParticipant.id.replace(/-/g, "");
        }

        const now = Date.now();
        const createdParticipant: Participant = {
            id: inputParticipant.id,
            name: inputParticipant.name,
            type: inputParticipant.type as ParticipantTypes,
            isActive: false,
            description: inputParticipant.description,
            createdBy: secCtx.username!,
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            lastUpdated: now,
            participantAccounts: [],
            participantEndpoints: [],
            participantAllowedSourceIps: [],
            fundsMovements: [],
            changeLog: [
                {
                    changeType: ParticipantChangeTypes.CREATE,
                    user: secCtx.username!,
                    timestamp: now,
                    notes: null,
                },
            ],
            netDebitCaps: inputParticipant.netDebitCaps || [],
            netDebitCapChangeRequests: []
        };

        if (!(await this._repo.create(createdParticipant)))
            throw new CouldNotStoreParticipant(
                "Unable to create participant successfully!"
            );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_CREATED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: createdParticipant.id}]
        );

        this._logger.info(
            `Successfully created participant with ID: '${createdParticipant.id}'`
        );

        return createdParticipant.id;
    }

    async approveParticipant(secCtx: CallSecurityContext, participantId: string,note: string | null ): Promise<void> {
        this._enforcePrivilege(
            secCtx,
            ParticipantPrivilegeNames.APPROVE_PARTICIPANT
        );

        if (!participantId)
            throw new ParticipantNotFoundError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        if (existing.approved)
            throw new ParticipantAlreadyApproved(
                `Participant with ID: '${participantId}' is already approved.`
            );

        if (secCtx && existing.createdBy === secCtx.username) {
            await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_APPROVED,
                false,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
            );
            throw new MakerCheckerViolationError(
                "Maker check violation - Same user cannot create and approve a participant"
            );
        }

        const now = Date.now();
        // existing.isActive = true;
        existing.approved = true;
        existing.approvedBy = secCtx.username;
        existing.approvedDate = now;

        existing.changeLog.push({
            changeType: ParticipantChangeTypes.APPROVE,
            user: secCtx.username!,
            timestamp: now,
            notes: note,
        });

        if (!(await this._repo.store(existing))) {
            throw new CouldNotStoreParticipant(`Unable to approve participant.`);
        }

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_APPROVED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        this._logger.info(
            `Successfully approved participant with ID: '${existing.id}'`
        );
    }

    async activateParticipant(secCtx: CallSecurityContext, participantId: string, note: string | null): Promise<void> {
        this._enforcePrivilege(
            secCtx,
            ParticipantPrivilegeNames.ENABLE_PARTICIPANT
        );

        if (!participantId)
            throw new ParticipantNotFoundError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        if (existing.isActive) {
            this._logger.warn(
                `Trying to activate an already active participant with id: ${participantId}`
            );
            return;
        }

        existing.isActive = true;

        existing.changeLog.push({
            changeType: ParticipantChangeTypes.ACTIVATE,
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: note,
        });

        if (!(await this._repo.store(existing))) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on activateParticipant"
            );
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ENABLED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        this._logger.info(
            `Successfully activated participant with ID: '${existing.id}'`
        );
    }

    async deactivateParticipant(secCtx: CallSecurityContext, participantId: string, note: string | null): Promise<void> {
        this._enforcePrivilege(
            secCtx,
            ParticipantPrivilegeNames.ENABLE_PARTICIPANT
        );

        if (!participantId)
            throw new ParticipantNotFoundError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        if (!existing.isActive) {
            this._logger.warn(
                `Trying to deactivate an already active participant with id: ${participantId}`
            );
            return;
        }

        existing.isActive = false;
        existing.changeLog.push({
            changeType: ParticipantChangeTypes.DEACTIVATE,
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: note,
        });

        if (!(await this._repo.store(existing))) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on deactivateParticipant"
            );
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_DISABLED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        this._logger.info(
            `Successfully deactivated participant with ID: '${existing.id}'`
        );
    }

    /*
     * Endpoints
     * */

    async addParticipantEndpoint(
        secCtx: CallSecurityContext,
        participantId: string,
        endpoint: IParticipantEndpoint
    ): Promise<string> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length == 0)
            throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (existing == null)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        if (!existing.participantEndpoints) existing.participantEndpoints = [];

        // TODO validate endpoint format

        if (endpoint.id || existing.participantEndpoints.length > 0) {
            if (
                existing.participantEndpoints.find(
                    (value: IParticipantEndpoint) => value.id === endpoint.id
                )
            ) {
                throw new CannotAddDuplicateEndpointError();
            }
        } else {
            endpoint.id = randomUUID();
        }

        existing.participantEndpoints.push(endpoint as ParticipantEndpoint);
        existing.changeLog.push({
            changeType: ParticipantChangeTypes.ADD_ENDPOINT,
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: null,
        });

        if (!(await this._repo.store(existing))) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantEndpoint"
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully added endpoint with id: ${endpoint.id} to Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ENDPOINT_ADDED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        return endpoint.id;
    }

    async changeParticipantEndpoint(
        secCtx: CallSecurityContext,
        participantId: string,
        endpoint: IParticipantEndpoint
    ): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length == 0)
            throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (existing == null)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        if (!existing.participantEndpoints) existing.participantEndpoints = [];

        let foundEndpoint;
        if (
            !endpoint.id ||
            !(foundEndpoint = await existing.participantEndpoints.find(
                (value: IParticipantEndpoint) => value.id === endpoint.id
            ))
        ) {
            throw new EndpointNotFoundError();
        }

        // TODO validate endpoint format
        foundEndpoint.type = endpoint.type as ParticipantEndpointTypes;
        foundEndpoint.protocol = endpoint.protocol as ParticipantEndpointProtocols;
        foundEndpoint.value = endpoint.value;

        existing.changeLog.push({
            changeType: ParticipantChangeTypes.CHANGE_ENDPOINT,
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: null,
        });

        if (!(await this._repo.store(existing))) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on changeParticipantEndpoint"
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully changed endpoint with id: ${endpoint.id} on Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ENDPOINT_CHANGED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );
    }

    async removeParticipantEndpoint(
        secCtx: CallSecurityContext,
        participantId: string,
        endpointId: string
    ): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length == 0)
            throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (existing == null)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        if (
            !existing.participantEndpoints ||
            existing.participantEndpoints.length <= 0 ||
            !existing.participantEndpoints.find(
                (value: IParticipantEndpoint) => value.id === endpointId
            )
        ) {
            this._logger.debug(
                `Trying to remove not found endpoint from Participant with ID: '${participantId}'`
            );
            throw new EndpointNotFoundError();
        }

        existing.participantEndpoints = existing.participantEndpoints.filter(
            (value: IParticipantEndpoint) => value.id !== endpointId
        );
        existing.changeLog.push({
            changeType: ParticipantChangeTypes.REMOVE_ENDPOINT,
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: null,
        });

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on removeParticipantEndpoint"
            );
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ENDPOINT_REMOVED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );
    }

    async getParticipantEndpointsById(secCtx: CallSecurityContext, id: string): Promise<IParticipantEndpoint[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: IParticipant | null = await this._repo.fetchWhereId(id);
        if (!part)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );

        return part.participantEndpoints || [];
    }

    /*
     * Accounts
     * */

    async addParticipantAccount(
        secCtx: CallSecurityContext,
        participantId: string,
        account: IParticipantAccount
    ): Promise<string> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ACCOUNTS);

        if (!participantId)
            throw new InvalidParticipantError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );
        // if (!existing.isActive) throw new ParticipantNotActive("Participant is not active.");

        if (!existing.participantAccounts) {
            existing.participantAccounts = [];
        } else {
            if (
                existing.participantAccounts.find(
                    (value: IParticipantAccount) =>
                        value.id === account.id ||
                        (value.type === account.type &&
                            value.currencyCode === account.currencyCode)
                )
            ) {
                throw new CannotAddDuplicateAccountError(
                    "An account with that id, or the same type and currency exists already"
                );
            }
        }

        if (
            (account.type === "HUB_MULTILATERAL_SETTLEMENT" ||
                account.type === "HUB_RECONCILIATION") &&
            participantId !== HUB_PARTICIPANT_ID
        ) {
            this._logger.warn(
                "Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION"
            );
            throw new InvalidAccountError(
                "Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION"
            );
        }

        let createdId: string;
        try {
            this._accBal.setToken(secCtx.accessToken);
            createdId = await this._accBal.createAccount(
                account.id,
                participantId,
                account.type,
                account.currencyCode
            );
        } catch (err) {
            this._logger.error(err);
            if (err instanceof UnauthorizedError) throw err;

            throw new UnableToCreateAccountUpstream(
                `'${existing.name}' account '${account.type}' failed upstream.`
            );
        }

        existing.participantAccounts.push({
            id: createdId,
            type: account.type as ParticipantAccountTypes,
            currencyCode: account.currencyCode,
            creditBalance: null,
            debitBalance: null,
        });
        existing.changeLog.push({
            changeType: ParticipantChangeTypes.ADD_ACCOUNT,
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: null,
        });

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantAccount"
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully added account with id: ${createdId} to Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        return createdId;
    }

    /*async removeParticipantAccount(secCtx: CallSecurityContext, participantId: string, account: ParticipantAccount): Promise<void> {
          this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ACCOUNTS);

          if (participantId.trim().length==0) throw new ParticipantCreateValidationError("[id] cannot be empty");

          const existing: Participant | null = await this._repo.fetchWhereId(participantId);
          if (existing==null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
          const successLocalAcc = await this._repoAccount.removeAccount(participantId, account);
          if (!successLocalAcc) throw new InvalidParticipantError(`Unable to remove local account ${account.type}`);

          await this._auditClient.audit(
                  AuditedActionNames.PARTICIPANT_ACCOUNT_REMOVED, true,
                  this._getAuditSecCtx(secCtx),
                  [{key: "participantId", value: participantId}]
          );
      }*/

    async getParticipantAccountsById(secCtx: CallSecurityContext, id: string): Promise<IParticipantAccount[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const existing: IParticipant | null = await this._repo.fetchWhereId(id);
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );

        const participantAccounts = existing.participantAccounts || [];

        if (participantAccounts.length > 0) {
            // Obtain the most recent account balances:
            this._accBal.setToken(secCtx.accessToken);
            const accBalAccounts = await this._accBal.getAccounts(
                participantAccounts.map((value: IParticipantAccount) => value.id)
            );

            if (!accBalAccounts) {
                const err = new NoAccountsError(
                    "Could not get participant accounts from accountsAndBalances adapter for participant id: " +
                    existing.id
                );
                this._logger.error(err);
                throw err;
            }

            for (const pacc of participantAccounts) {
                const jAcc = accBalAccounts.find((value) => value.id === pacc.id);
                if (jAcc == null) continue;

                pacc.debitBalance = jAcc.postedDebitBalance || null;
                pacc.creditBalance = jAcc.postedCreditBalance || null;
            }
        }

        return participantAccounts;
    }

    /*
     * Funds management
     * */
    async createFundsMovement(
        secCtx: CallSecurityContext,
        participantId: string,
        fundsMov: IParticipantFundsMovement
    ) {
        this._enforcePrivilege(
            secCtx,
            fundsMov.direction === "FUNDS_DEPOSIT"
                ? ParticipantPrivilegeNames.CREATE_FUNDS_DEPOSIT
                : ParticipantPrivilegeNames.CREATE_FUNDS_WITHDRAWAL
        );

        if (!participantId)
            throw new ParticipantNotFoundError("participantId cannot be empty");
        if (!fundsMov.currencyCode) throw new Error("currencyCode cannot be empty");
        if (!fundsMov.amount) throw new Error("amount cannot be empty");

        const hub = await this._getHub();

        const participant: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!participant)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        const positionAccount = participant.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "SETTLEMENT"
        );
        if (!positionAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's position account for currency: ${fundsMov.currencyCode}`
            );
        }
        const hubReconAccount = hub.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "HUB_RECONCILIATION"
        );
        if (!hubReconAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's settlement account for currency: ${fundsMov.currencyCode}`
            );
        }

        const now = Date.now();
        if (!participant.fundsMovements) participant.fundsMovements = [];
        participant.fundsMovements.push({
            id: fundsMov.id || randomUUID(),
            createdBy: secCtx.username!,
            createdDate: now,
            direction: fundsMov.direction as ParticipantFundsMovementDirections,
            amount: fundsMov.amount,
            currencyCode: fundsMov.currencyCode,
            note: fundsMov.note,
            extReference: fundsMov.extReference,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            transferId: null,
        });

        const updateSuccess = await this._repo.store(participant);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantAccount"
            );
            this._logger.error(err);
            throw err;
        }
        await this._auditClient.audit(
            fundsMov.direction === "FUNDS_DEPOSIT"
                ? AuditedActionNames.PARTICIPANT_FUNDS_DEPOSIT_CREATED
                : AuditedActionNames.PARTICIPANT_FUNDS_WITHDRAWAL_CREATED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        return;
    }

    async approveFundsMovement(secCtx: CallSecurityContext, participantId: string, fundsMovId: string):Promise<void> {
        if (!participantId)
            throw new ParticipantNotFoundError("participantId cannot be empty");

        const participant: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!participant)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        const fundsMov = participant.fundsMovements.find(
            (value: IParticipantFundsMovement) => value.id === fundsMovId
        );
        if (!fundsMov) {
            throw new AccountNotFoundError(
                `Cannot find a participant's funds movement with id: ${fundsMovId}`
            );
        }
        if (fundsMov.approved) {
            throw new AccountNotFoundError(
                `Participant's funds movement with id: ${fundsMovId} is already approved`
            );
        }

        // now we can enforce the correct privilege
        this._enforcePrivilege(
            secCtx,
            fundsMov.direction === "FUNDS_DEPOSIT"
                ? ParticipantPrivilegeNames.APPROVE_FUNDS_DEPOSIT
                : ParticipantPrivilegeNames.APPROVE_FUNDS_WITHDRAWAL
        );

        if (secCtx && fundsMov.createdBy === secCtx.username) {
            await this._auditClient.audit(
                fundsMov.direction === "FUNDS_DEPOSIT"
                    ? "FUNDS_DEPOSIT"
                    : "FUNDS_WITHDRAWAL",
                false,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
            );
            throw new MakerCheckerViolationError(
                "Maker check violation - Same user cannot create and approve participant a funds movement"
            );
        }

        // find accounts
        const hub = await this._getHub();
        const hubReconAccount = hub.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "HUB_RECONCILIATION"
        );
        if (!hubReconAccount) {
            throw new AccountNotFoundError(
                `Cannot find a hub's assets account for currency: ${fundsMov.currencyCode}`
            );
        }
        const positionAccount = participant.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "SETTLEMENT"
        );
        if (!positionAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's position account for currency: ${fundsMov.currencyCode}`
            );
        }

        const now = Date.now();

        this._accBal.setToken(secCtx.accessToken);
        fundsMov.transferId = await this._accBal
            .createJournalEntry(
                randomUUID(),
                fundsMov.id,
                fundsMov.currencyCode,
                fundsMov.amount,
                false,
                fundsMov.direction === "FUNDS_DEPOSIT"
                    ? hubReconAccount.id
                    : positionAccount.id,
                fundsMov.direction === "FUNDS_DEPOSIT"
                    ? positionAccount.id
                    : hubReconAccount.id
            )
            .catch((error: Error) => {
                this._logger.error(error);
                throw error;
            });

        fundsMov.approved = true;
        fundsMov.approvedBy = secCtx.username;
        fundsMov.approvedDate = now;

        participant.changeLog.push({
            changeType:
                fundsMov.direction === "FUNDS_DEPOSIT"
                    ? ParticipantChangeTypes.FUNDS_DEPOSIT
                    : ParticipantChangeTypes.FUNDS_WITHDRAWAL,
            user: secCtx.username!,
            timestamp: now,
            notes: null,
        });

        const updateSuccess = await this._repo.store(participant);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantAccount"
            );
            this._logger.error(err);
            throw err;
        }
        await this._auditClient.audit(
            fundsMov.direction === "FUNDS_DEPOSIT"
                ? AuditedActionNames.PARTICIPANT_FUNDS_DEPOSIT_APPROVED
                : AuditedActionNames.PARTICIPANT_FUNDS_WITHDRAWAL_APPROVED,
            true,
            this._getAuditSecCtx(secCtx),
            [{key: "participantId", value: participantId}]
        );

        return;
    }

}
