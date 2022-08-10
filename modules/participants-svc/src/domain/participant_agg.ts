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
import {IParticipantsRepository} from "./iparticipant_repo";
import {IParticipantsEndpointRepository} from "./iparticipant_endpoint_repo";
import {
    Participant,
    ParticipantEndpoint,
    ParticipantAccount,
    ParticipantApproval
} from "@mojaloop/participant-bc-public-types-lib";
import {
    ParticipantABAccount,
    ParticipantABJournalEntry
} from "@mojaloop/participant-bc-private-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";

import {
    InvalidParticipantError,
    MakerCheckerViolationError,
    NoAccountsError,
    NoEndpointsError,
    ParticipantCreateValidationError,
    ParticipantNotActive,
    ParticipantNotFoundError,
    UnableToCreateAccountUpstream,
    UnauthorizedError
} from "./errors";
import {
    IParticipantsApprovalRepository,
    IParticipantsAccountRepository,
    IParticipantsRepository,
    IParticipantsEndpointRepository
} from "./repo_interfaces";

import {IAccountsBalances} from "./iparticipant_account_balances_ds";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib/dist/index";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {ParticipantPrivilegeNames} from "./privilege_names";
import {randomUUID} from "crypto";
import {AuditSecurityContext} from "@mojaloop/auditing-bc-public-types-lib/dist/audit_types";

enum AuditedActionNames {
    PARTICIPANT_CREATED = "PARTICIPANT_CREATED",
    PARTICIPANT_APPROVED = "PARTICIPANT_APPROVED",
    PARTICIPANT_ENABLED = "PARTICIPANT_ENABLED",
    PARTICIPANT_DISABLED = "PARTICIPANT_DISABLED",
    PARTICIPANT_ENDPOINT_ADDED = "PARTICIPANT_ENDPOINT_ADDED",
    PARTICIPANT_ENDPOINT_REMOVED = "PARTICIPANT_ENDPOINT_REMOVED",
    PARTICIPANT_ACCOUNT_ADDED = "PARTICIPANT_ACCOUNT_ADDED",
    PARTICIPANT_ACCOUNT_REMOVED = "PARTICIPANT_ACCOUNT_REMOVED",

}


export class ParticipantAggregate {
    private _logger: ILogger;
    private _repo: IParticipantsRepository;
    private _repoEndpoints: IParticipantsEndpointRepository;
    private _repoApproval: IParticipantsApprovalRepository;
    private _repoAccount: IParticipantsAccountRepository;
    private _accBal: IAccountsBalances;
    private _auditClient:IAuditClient;
    private _authorizationClient:IAuthorizationClient;

    constructor(
            repo: IParticipantsRepository,
            repoEndpoints: IParticipantsEndpointRepository,
            repoApproval: IParticipantsApprovalRepository,
            repoAccount: IParticipantsAccountRepository,
            accBal: IAccountsBalances,
            auditClient:IAuditClient,
            authorizationClient:IAuthorizationClient,
            logger: ILogger
    ) {
        this._repo = repo;
        this._repoEndpoints = repoEndpoints;
        this._repoApproval = repoApproval;
        this._repoAccount = repoAccount;
        this._accBal = accBal;
        this._auditClient = auditClient;
        this._authorizationClient = authorizationClient;
        this._logger = logger;
    }

    async init():Promise<void>{
        await this._repo.init();
        await this._repoEndpoints.init();
        await this._repoApproval.init();
        await this._repoAccount.init();
        await this._accBal.init();
    }
    private _getAuditSecCtx(secCtx:CallSecurityContext):AuditSecurityContext{
        return {
            userId: secCtx.username,
            role: "", // TODO get role
            appId: secCtx.clientId
        }
    }

    private _enforcePrivilege(secCtx:CallSecurityContext, privName:string):void{
        for(const roleId of secCtx.rolesIds){
            if(this._authorizationClient.roleHasPrivilege(roleId, privName)) return;
        }
        throw new UnauthorizedError();
    }

    async getAllParticipants(secCtx:CallSecurityContext): Promise<Participant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const list: Participant[] | null = await this._repo.fetchAll();
        return list;
    }

    async getParticipantById(secCtx:CallSecurityContext, id: string): Promise<Participant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereId(id);
        if (part == null) throw new ParticipantNotFoundError(`Participant with ID: '${id}' not found.`);
        return part;
    }

    async getParticipantByName(secCtx:CallSecurityContext, participantName: string): Promise<Participant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereName(participantName);
        if (part == null) throw new ParticipantNotFoundError(`'${participantName}' not found.`);
        return part;
    }

    async getParticipantEndpointsById(secCtx:CallSecurityContext, id: string): Promise<ParticipantEndpoint[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereId(id);
        if (part == null) throw new ParticipantNotFoundError(`Participant with ID: '${id}' not found.`);

        const endpoints: ParticipantEndpoint[] | null = await this._repoEndpoints.fetchWhereParticipantId(id);
        if (endpoints == null || endpoints.length == 0) {
            throw new NoEndpointsError(`Participant '${id}' has no endpoints.`);
        }
        return endpoints;
    }

    async getParticipantAccountsById(secCtx:CallSecurityContext, id: string): Promise<ParticipantAccount[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const part: Participant | null = await this._repo.fetchWhereId(id);
        if (part == null) throw new ParticipantNotFoundError(`Participant with ID: '${id}' not found.`);

        const accounts: ParticipantAccount[] | null = await this._repoAccount.fetchWhereParticipantId(id);
        if (accounts == null || accounts.length == 0) {
            throw new NoAccountsError(`Participant '${id}' has no accounts.`);
        }

        // Obtain the most recent account balances:
        for (const acc of accounts) {
            //TODO this may be improved with fetching accounts by participantId in future...
            const jAcc = await this._accBal.getAccount(acc.id);
            if (jAcc == null) continue;

            acc.balanceDebit = jAcc.debitBalance;
            acc.balanceCredit = jAcc.creditBalance;
        }
        return accounts;
    }

    async createParticipant(secCtx:CallSecurityContext, participant: Participant): Promise<Participant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CREATE_PARTICIPANT);

        if (participant.name.trim().length == 0) throw new ParticipantCreateValidationError("[name] cannot be empty");

        let existingById = null;
        const existingByName = await this._repo.fetchWhereName(participant.name);

        if(participant.id){
            existingById = await this._repo.fetchWhereId(participant.id);
        }
        if (existingById || existingByName){
            this._logger.debug("trying to create duplicate participant");
            throw new ParticipantCreateValidationError(`'${participant.name}' already exists`);
        }

        if(!participant.id){
            participant.id = randomUUID();
        }
        participant.isActive = false;
        participant.createdBy = secCtx.username;
        participant.createdDate = Date.now();
        participant.lastUpdated = participant.createdDate;

        if (!await this._repo.insert(participant))
            throw new InvalidParticipantError("Unable to store participant successfully!");

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_CREATED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participant.id}]
        );

        return participant;
    }

    async approveParticipant(secCtx:CallSecurityContext,participantId:string,checker: string,feedback: string): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        if(existing.createdBy === secCtx.username){
            await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_APPROVED, false,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
            );
            throw new MakerCheckerViolationError(`Maker check violation - Cannot approve participant with ID: '${participantId}'.`);
        }

        const approval: ParticipantApproval = {
            participantId: existing.id,
            lastUpdated: 0,
            maker: '',
            makerLastUpdated: 0,
            checker: checker,
            checkerLastUpdated: 0,
            checkerApproved: true,
            feedback: feedback
        }

        //TODO @jason, move the approve here, repo should be more low-level.
        const approvedResult = await this._repoApproval.approve(participantId, approval);
        if (!approvedResult) throw new InvalidParticipantError(`Unable to approve participant.`);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_APPROVED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );
    }

    async deActivateParticipant(secCtx:CallSecurityContext, participantId:string): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.DISABLE_PARTICIPANT);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        if (existing.isActive == false) return;

        existing.isActive = false;
        await this._repo.update(existing);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_DISABLED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );

    }

    async activateParticipant(secCtx:CallSecurityContext, participantId:string): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.ENABLE_PARTICIPANT);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        if (existing.isActive) return;
        
        existing.isActive = true;
        await this._repo.update(existing);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENABLED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );
     }

    async addParticipantEndpoint(secCtx:CallSecurityContext, participantId:string, endpoint: ParticipantEndpoint): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);

        await this._repoEndpoints.addEndpoint(participantId, endpoint);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENDPOINT_ADDED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );
    }

    async removeParticipantEndpoint(secCtx:CallSecurityContext, participantId:string, endpoint: ParticipantEndpoint): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ENDPOINTS);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        await this._repoEndpoints.removeEndpoint(participantId, endpoint);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ENDPOINT_REMOVED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );
    }

    async addParticipantAccount(secCtx:CallSecurityContext, participantId:string, account: ParticipantAccount): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ACCOUNTS);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        if (!existing.isActive) throw new ParticipantNotActive(`'${participantId}' is not active.`);

        const accBalAccount : ParticipantABAccount = {
            id: account.id,
            type: AccountType.POSITION,
            state: AccountState.ACTIVE,
            currency: ''+account.currency,
            debitBalance: 0n,
            creditBalance: 0n,
            externalId: participant.id,
            timeStampLastJournalEntry: Date.now()
        }
        let success = await this._accBal.createAccount(accBalAccount);
        if (!success) {
            throw new UnableToCreateAccountUpstream(`'${existing.name}' account '${account.type}' failed upstream.`);
        }

        if (account.balanceCredit != null && account.balanceCredit > 0) {
            const hubAccountForDeposit = 'deposit';//TODO @jason, lookup...
            const journal: ParticipantABJournalEntry = {
                id: `uuid`,
                currency: ''+account.currency,
                amount: account.balanceCredit,
                debitedAccountId: hubAccountForDeposit,
                creditedAccountId: account.id,
                timeStamp: Date.now(),
                externalId: `initial-deposit`,
                externalCategory: `deposit`,
            };
            success = await this._accBal.createJournalEntry(journal);
            if (!success) {
                throw new UnableToCreateAccountUpstream(`'${existing.name}' account '${account.type}' balance update failed upstream.`);
            }
        }

        // We store balances in acc+balances:
        delete account.balanceDebit;
        delete account.balanceCredit;


        const successLocalAcc = await this._repoAccount.addAccount(participantId, account);
        if (!successLocalAcc) throw new InvalidParticipantError(`Unable to add local account ${account.type}`);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );

    }

    async removeParticipantAccount(secCtx:CallSecurityContext, participantId:string, account: ParticipantAccount): Promise<void> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.MANAGE_ACCOUNTS);

        if (participantId.trim().length == 0) throw new ParticipantCreateValidationError("[id] cannot be empty");

        const existing: Participant | null = await this._repo.fetchWhereId(participantId);
        if (existing == null) throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        const successLocalAcc = await this._repoAccount.removeAccount(participantId, account);
        if (!successLocalAcc) throw new InvalidParticipantError(`Unable to remove local account ${account.type}`);

        await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_ACCOUNT_REMOVED, true,
                this._getAuditSecCtx(secCtx),
                [{key:"participantId", value: participantId}]
        );
    }

}
