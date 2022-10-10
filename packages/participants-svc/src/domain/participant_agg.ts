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

"use strict"
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {
    Participant,
    ParticipantEndpoint,
    ParticipantAccount, ParticipantActivityLogEntry
} from "@mojaloop/participant-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";

import {
    CannotAddDuplicateAccountError,
    CannotAddDuplicateEndpointError,
    CouldNotStoreParticipant, EndpointNotFoundError,
    InvalidParticipantError,
    MakerCheckerViolationError,
    NoAccountsError,
    ParticipantCreateValidationError,
    ParticipantNotActive,
    ParticipantNotFoundError,
    UnableToCreateAccountUpstream,
    UnauthorizedError
} from "./errors";
import {IParticipantsRepository} from "./repo_interfaces";

import {IAccountsBalancesAdapter, JournalAccount} from "./iparticipant_account_balances_adapter";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {ParticipantPrivilegeNames} from "./privilege_names";
import {randomUUID} from "crypto";
import {AuditSecurityContext} from "@mojaloop/auditing-bc-public-types-lib";

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

}


export class ParticipantAggregate {
    private _logger: ILogger;
    private _repo: IParticipantsRepository;
    private _accBal: IAccountsBalancesAdapter;
    private _auditClient: IAuditClient;
    private _authorizationClient: IAuthorizationClient;

    constructor(
            repo: IParticipantsRepository,
            accBal: IAccountsBalancesAdapter,
            auditClient: IAuditClient,
            authorizationClient: IAuthorizationClient,
            logger: ILogger
    ) {
        this._repo = repo;
        this._accBal = accBal;
        this._auditClient = auditClient;
        this._authorizationClient = authorizationClient;
        this._logger = logger;
    }

    async init(): Promise<void> {
        await this._repo.init();
        await this._accBal.init();
    }

    private _getAuditSecCtx(secCtx: CallSecurityContext): AuditSecurityContext {
        return {
            userId: secCtx.username,
            role: "", // TODO get role
            appId: secCtx.clientId
        }
    }

    private _enforcePrivilege(secCtx: CallSecurityContext, privName: string): void {
        for (const roleId of secCtx.rolesIds) {
            if (this._authorizationClient.roleHasPrivilege(roleId, privName)) return;
        }
        throw new UnauthorizedError(`Required privilege "${privName}" not held by caller`);
    }

    private _applyDefaultSorts(participant:Participant):void{
        if(!participant) return;

        // sort changeLog desc
        participant.changeLog.sort((a, b) => b.timestamp - a.timestamp);
    }

    async getAllParticipants(secCtx: CallSecurityContext): Promise<Participant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const list: Participant[] | null = await this._repo.fetchAll();
        list.forEach(this._applyDefaultSorts);
        return list;
    }

    async getParticipantById(secCtx: CallSecurityContext, id: string): Promise<Participant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereId(id);
        if (part==null) throw new ParticipantNotFoundError(`Participant with ID: '${id}' not found.`);

        this._applyDefaultSorts(part);
        return part;
    }

    async getParticipantsByIds(secCtx: CallSecurityContext, ids: string[]): Promise<Participant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const parts: Participant[] = await this._repo.fetchWhereIds(ids);
        if (parts.length==0) throw new ParticipantNotFoundError(`Participant with IDs: '${ids}' not found.`);

        parts.forEach(this._applyDefaultSorts);
        return parts;
    }

    async getParticipantByName(secCtx: CallSecurityContext, participantName: string): Promise<Participant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereName(participantName);
        if (part==null) throw new ParticipantNotFoundError(`'${participantName}' not found.`);

        this._applyDefaultSorts(part);
        return part;
    }

    async createParticipant(secCtx: CallSecurityContext, inputParticipant: Participant): Promise<string> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CREATE_PARTICIPANT);

        if (inputParticipant.name.trim().length==0) throw new ParticipantCreateValidationError("[name] cannot be empty");

        if (await this._repo.fetchWhereName(inputParticipant.name)) {
            this._logger.debug("trying to create duplicate participant");
            throw new ParticipantCreateValidationError(`Participant with name: '${inputParticipant.name}' already exists`);
        }

        if (inputParticipant.id) {
            if (await this._repo.fetchWhereId(inputParticipant.id)) {
                this._logger.debug("trying to create duplicate participant");
                throw new ParticipantCreateValidationError(`Participant with id: '${inputParticipant.id}' already exists`);
            }
        }

        const now = Date.now();
        const createdParticipant: Participant = {
            id: inputParticipant.id ?? randomUUID(),
            name: inputParticipant.name,
            isActive: false,
            description: inputParticipant.description,
            createdBy: secCtx.username,
            createdDate: now,
            approved: false,
            approvedBy: null,
            approvedDate: null,
            lastUpdated: now,
            participantAccounts: [],
            participantEndpoints: [],
            participantAllowedSourceIps: [],
            changeLog: [{
                changeType: "CREATE",
                user: secCtx.username,
                timestamp: now,
                notes: null
            }]
        };


        if (!await this._repo.create(createdParticipant))
            throw new CouldNotStoreParticipant("Unable to create participant successfully!");

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_CREATED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: createdParticipant.id}]
        );

        this._logger.info(`Successfully created participant with ID: '${createdParticipant.id}'`);

        return createdParticipant.id;
    }

    async approveParticipant(secCtx: CallSecurityContext, participantId: string, note: string|null): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT);

        if (!participantId) throw new ParticipantNotFoundError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if (secCtx && existing.createdBy===secCtx.username) {
            await this._auditClient.audit(
                    AuditedActionNames.PARTICIPANT_APPROVED, false,
                    this._getAuditSecCtx(secCtx),
                    [{key: "participantId", value: participantId}]
            );
            throw new MakerCheckerViolationError(`Maker check violation - Cannot approve participant with ID: '${participantId}'.`);
        }

        const now = Date.now();
        existing.approved = true;
        existing.approvedBy = secCtx.username;
        existing.approvedDate = now;

        existing.changeLog.push({
            changeType: "APPROVE",
            user: secCtx.username,
            timestamp: now,
            notes: note
        });

        if (!await this._repo.store(existing)) {
            throw new CouldNotStoreParticipant(`Unable to approve participant.`);
        }

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_APPROVED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );

        this._logger.info(`Successfully approved participant with ID: '${existing.id}'`);
    }

    async activateParticipant(secCtx: CallSecurityContext, participantId: string, note: string|null): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.ENABLE_PARTICIPANT);

        if (!participantId) throw new ParticipantNotFoundError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if (existing.isActive){
            this._logger.warn(`Trying to activate an already active participant with id: ${participantId}`)
            return;
        }

        existing.isActive = true;

        existing.changeLog.push({
            changeType: "ACTIVATE",
            user: secCtx.username,
            timestamp: Date.now(),
            notes: note
        });


        if (!await this._repo.store(existing)) {
            const err = new CouldNotStoreParticipant("Could not update participant on activateParticipant");
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENABLED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );

        this._logger.info(`Successfully activated participant with ID: '${existing.id}'`);
    }

    async deactivateParticipant(secCtx: CallSecurityContext, participantId: string, note: string|null): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.ENABLE_PARTICIPANT);

        if (!participantId) throw new ParticipantNotFoundError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if (!existing.isActive){
            this._logger.warn(`Trying to deactivate an already active participant with id: ${participantId}`)
            return;
        }

        existing.isActive = false;
        existing.changeLog.push({
            changeType: "DEACTIVATE",
            user: secCtx.username,
            timestamp: Date.now(),
            notes: note
        });

        if (!await this._repo.store(existing)) {
            const err = new CouldNotStoreParticipant("Could not update participant on deactivateParticipant");
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_DISABLED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );

        this._logger.info(`Successfully deactivated participant with ID: '${existing.id}'`);
    }



    /*
    * Endpoints
    * */

    async addParticipantEndpoint(secCtx: CallSecurityContext, participantId: string, endpoint: ParticipantEndpoint): Promise<string> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length==0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing==null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if (!existing.participantEndpoints) existing.participantEndpoints = [];

        // TODO validate endpoint format

        if (endpoint.id || existing.participantEndpoints.length > 0) {
            if (existing.participantEndpoints.find(value => value.id===endpoint.id)) {
                throw new CannotAddDuplicateEndpointError();
            }
        } else {
            endpoint.id = randomUUID();
        }

        existing.participantEndpoints.push(endpoint);
        existing.changeLog.push({
            changeType: "ADD_ENDPOINT",
            user: secCtx.username,
            timestamp: Date.now(),
            notes: null
        });


        if (!await this._repo.store(existing)) {
            const err = new CouldNotStoreParticipant("Could not update participant on addParticipantEndpoint");
            this._logger.error(err);
            throw err;
        }

        this._logger.info(`Successfully added endpoint with id: ${endpoint.id} to Participant with ID: '${participantId}'`);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENDPOINT_ADDED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );

        return endpoint.id;
    }

    async changeParticipantEndpoint(secCtx: CallSecurityContext, participantId: string, endpoint: ParticipantEndpoint): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length==0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing==null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if (!existing.participantEndpoints) existing.participantEndpoints = [];


        let foundEndpoint;
        if (!endpoint.id || !(foundEndpoint = await existing.participantEndpoints.find(value => value.id === endpoint.id))) {
            throw new EndpointNotFoundError();
        }

        // TODO validate endpoint format
        foundEndpoint.type = endpoint.type;
        foundEndpoint.protocol = endpoint.protocol;
        foundEndpoint.value = endpoint.value;


        existing.changeLog.push({
            changeType: "CHANGE_ENDPOINT",
            user: secCtx.username,
            timestamp: Date.now(),
            notes: null
        });

        if (!await this._repo.store(existing)) {
            const err = new CouldNotStoreParticipant("Could not update participant on changeParticipantEndpoint");
            this._logger.error(err);
            throw err;
        }

        this._logger.info(`Successfully changed endpoint with id: ${endpoint.id} on Participant with ID: '${participantId}'`);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENDPOINT_CHANGED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );
    }

    async removeParticipantEndpoint(secCtx: CallSecurityContext, participantId: string, endpointId: string): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length==0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing==null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if (!existing.participantEndpoints
                || existing.participantEndpoints.length <= 0
                || !existing.participantEndpoints.find(value => value.id===endpointId)) {
            this._logger.debug(`Trying to remove not found endpoint from Participant with ID: '${participantId}'`);
            throw new EndpointNotFoundError();
        }

        existing.participantEndpoints = existing.participantEndpoints.filter(value => value.id!==endpointId);
        existing.changeLog.push({
            changeType: "REMOVE_ENDPOINT",
            user: secCtx.username,
            timestamp: Date.now(),
            notes: null
        });

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant("Could not update participant on removeParticipantEndpoint");
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENDPOINT_REMOVED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );
    }

    async getParticipantEndpointsById(secCtx: CallSecurityContext, id: string): Promise<ParticipantEndpoint[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereId(id);
        if (!part) throw new ParticipantNotFoundError(`Participant with ID: '${id}' not found.`);

        return part.participantEndpoints || [];
    }

    /*
    * Accounts
    * */

    async addParticipantAccount(secCtx: CallSecurityContext, participantId: string, account: ParticipantAccount): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ACCOUNTS);

        if (!participantId) throw new InvalidParticipantError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        if (!existing.isActive) throw new ParticipantNotActive(`'${participantId}' is not active.`);

        if (!existing.participantAccounts) {
            existing.participantAccounts = [];
        } else {
            if (existing.participantAccounts.find(value => value.id===account.id || (value.type===account.type && value.currencyCode===account.currencyCode))) {
                throw new CannotAddDuplicateAccountError("An account with that id, or the same type and currency exists already");
            }
        }

        const accBalAccount: JournalAccount = {
            id: account.id,
            type: account.type, // "position",
            state: "ACTIVE",
            currencyCode: account.currencyCode,
            externalId: participantId
        }

        try {
            accBalAccount.id = await this._accBal.createAccount(accBalAccount);
        } catch (err) {
            this._logger.error(err);
            throw new UnableToCreateAccountUpstream(`'${existing.name}' account '${account.type}' failed upstream.`);
        }

        existing.participantAccounts.push({
            id: accBalAccount.id,
            type: accBalAccount.type,
            currencyCode: accBalAccount.currencyCode
        });
        existing.changeLog.push({
            changeType: "ADD_ACCOUNT",
            user: secCtx.username,
            timestamp: Date.now(),
            notes: null
        });

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant("Could not update participant on addParticipantAccount");
            this._logger.error(err);
            throw err;
        }

        this._logger.info(`Successfully added account with id: ${accBalAccount.id} to Participant with ID: '${participantId}'`);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED, true,
                this._getAuditSecCtx(secCtx),
                [{key: "participantId", value: participantId}]
        );
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


    async getParticipantAccountsById(secCtx: CallSecurityContext, id: string): Promise<ParticipantAccount[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const existing: Participant | null = await this._repo.fetchWhereId(id);
        if (!existing) throw new ParticipantNotFoundError(`Participant with ID: '${id}' not found.`);

        const accounts = existing.participantAccounts || [];

        if (accounts.length > 0) {
            // Obtain the most recent account balances:
            const accBalAccounts = await this._accBal.getParticipantAccounts(existing.id);
            if (!accBalAccounts) {
                const err = new NoAccountsError("Could not get participant accounts from accountsAndBalances adapter for participant id: " + existing.id);
                this._logger.error(err)
                throw err;
            }

            for (const acc of accounts) {
                const jAcc = accBalAccounts.find(value => value.id===acc.id);
                if (jAcc==null) continue;

                acc.debitBalance = jAcc.debitBalance;
                acc.creditBalance = jAcc.creditBalance;
            }
        }

        return accounts;
    }

}
