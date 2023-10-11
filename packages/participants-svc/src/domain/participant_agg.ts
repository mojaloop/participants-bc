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
import { AccountsAndBalancesAccountType, } from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import { IHistogram, IMetrics } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { AuditSecurityContext, IAuditClient, } from "@mojaloop/auditing-bc-public-types-lib";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {
    HUB_PARTICIPANT_ID,
    IParticipant,
    IParticipantAccount,
    IParticipantAccountChangeRequest,
    IParticipantActivityLogEntry,
    IParticipantAllowedSourceIp,
    IParticipantContactInfo,
    IParticipantContactInfoChangeRequest,
    IParticipantEndpoint,
    IParticipantFundsMovement,
    IParticipantNetDebitCapChangeRequest,
    IParticipantSourceIpChangeRequest,
    ParticipantAccountTypes,
    ParticipantChangeTypes,
    ParticipantEndpointProtocols,
    ParticipantEndpointTypes,
    ParticipantFundsMovementDirections,
    ParticipantNetDebitCapTypes,
    ParticipantTypes
} from "@mojaloop/participant-bc-public-types-lib";
import {
    SettlementMatrixSettledEvt,
    ParticipantChangedEvt,
    ParticipantChangedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {Currency, IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {
    CallSecurityContext,
    ForbiddenError,
    IAuthorizationClient,
    MakerCheckerViolationError,
    UnauthorizedError,
} from "@mojaloop/security-bc-public-types-lib";
import {randomUUID} from "crypto";
import {Participant,} from "./entities/participant";

import {
    AccountChangeRequestAlreadyApproved,
    AccountChangeRequestNotFound,
    AccountNotFoundError,
    CannotAddDuplicateAccountError,
    CannotAddDuplicateContactInfoError,
    CannotAddDuplicateEndpointError,
    CannotAddDuplicateSourceIpError,
    ContactInfoChangeRequestAlreadyApproved,
    ContactInfoChangeRequestNotFound,
    CouldNotStoreParticipant,
    EndpointNotFoundError,
    InvalidAccountError,
    InvalidNdcChangeRequest,
    InvalidParticipantError,
    NdcChangeRequestAlreadyApproved,
    NdcChangeRequestNotFound,
    NoAccountsError,
    ParticipantAlreadyApproved,
    ParticipantCreateValidationError,
    ParticipantNotFoundError,
    SourceIpChangeRequestAlreadyApproved,
    SourceIpChangeRequestNotFound,
    UnableToCreateAccountUpstream,
    WithdrawalExceedsBalanceError,
} from "./errors";
import {IAccountsBalancesAdapter} from "./iparticipant_account_balances_adapter";
import {ParticipantPrivilegeNames} from "./privilege_names";
import {IParticipantsRepository} from "./repo_interfaces";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";

enum AuditedActionNames {
    PARTICIPANT_CREATED = "PARTICIPANT_CREATED",
    PARTICIPANT_APPROVED = "PARTICIPANT_APPROVED",
    PARTICIPANT_ENABLED = "PARTICIPANT_ENABLED",
    PARTICIPANT_DISABLED = "PARTICIPANT_DISABLED",
    PARTICIPANT_ENDPOINT_ADDED = "PARTICIPANT_ENDPOINT_ADDED",
    PARTICIPANT_ENDPOINT_CHANGED = "PARTICIPANT_ENDPOINT_CHANGED",
    PARTICIPANT_ENDPOINT_REMOVED = "PARTICIPANT_ENDPOINT_REMOVED",
    PARTICIPANT_ACCOUNT_ADDED = "PARTICIPANT_ACCOUNT_ADDED",
    PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGED = "PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGED",
    PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_CREATED = "PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_CREATED",
    PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_APPROVED = "PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_APPROVED",
    PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_CREATED = "PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_CREATED",
    PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_APPROVED = "PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_APPROVED",
    PARTICIPANT_ACCOUNT_REMOVED = "PARTICIPANT_ACCOUNT_REMOVED",
    PARTICIPANT_SOURCE_IP_CHANGE_REQUEST_CREATED = "PARTICIPANT_SOURCE_IP_CHANGE_REQUEST_CREATED",
    PARTICIPANT_SOURCE_IP_CHANGE_REQUEST_APPROVED = "PARTICIPANT_SOURCE_IP_CHANGE_REQUEST_APPROVED",
    PARTICIPANT_SOURCE_IP_ADDED = "PARTICIPANT_SOURCE_IP_ADDED",
    PARTICIPANT_SOURCE_IP_CHANGED = "PARTICIPANT_SOURCE_IP_CHANGED",
    PARTICIPANT_SOURCE_IP_REMOVED = "PARTICIPANT_SOURCE_IP_REMOVED",
    PARTICIPANT_FUNDS_DEPOSIT_CREATED = "PARTICIPANT_FUNDS_DEPOSIT_CREATED",
    PARTICIPANT_FUNDS_DEPOSIT_APPROVED = "PARTICIPANT_FUNDS_DEPOSIT_APPROVED",
    PARTICIPANT_FUNDS_WITHDRAWAL_CREATED = "PARTICIPANT_FUNDS_WITHDRAWAL_CREATED",
    PARTICIPANT_FUNDS_WITHDRAWAL_APPROVED = "PARTICIPANT_FUNDS_WITHDRAWAL_APPROVED",
    PARTICIPANT_NDC_CHANGE_REQUEST_CREATED = "PARTICIPANT_NDC_CHANGE_REQUEST_CREATED",
    PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED = "PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED",
    PARTICIPANTS_PROCESSED_MATRIX_SETTLED_EVENT = "PARTICIPANTS_PROCESSED_MATRIX_SETTLED_EVENT",
    PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST_CREATED = "PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST_CREATED",
    PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST_APPROVED = "PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST_APPROVED",
    PARTICIPANT_CONTACT_INFO_ADDED = "PARTICIPANT_CONTACT_INFO_ADDED",
    PARTICIPANT_CONTACT_INFO_CHANGED = "PARTICIPANT_CONTACT_INFO_CHANGED",
    PARTICIPANT_CONTACT_INFO_REMOVED = "PARTICIPANT_CONTACT_INFO_REMOVED",
}

export class ParticipantAggregate {
    private _logger: ILogger;
    private _configClient: IConfigurationClient;
    private _repo: IParticipantsRepository;
    private _accBal: IAccountsBalancesAdapter;
    private _auditClient: IAuditClient;
    private _authorizationClient: IAuthorizationClient;
    private _messageProducer: IMessageProducer;
    private _currencyList: Currency[];
    private _metrics: IMetrics;
    private readonly _requestsHisto: IHistogram;

    constructor(
        configClient: IConfigurationClient,
        repo: IParticipantsRepository,
        accBal: IAccountsBalancesAdapter,
        auditClient: IAuditClient,
        authorizationClient: IAuthorizationClient,
        messageProducer: IMessageProducer,
        metrics: IMetrics,
        logger: ILogger
    ) {
        this._configClient = configClient;
        this._logger = logger.createChild(this.constructor.name);
        this._repo = repo;
        this._accBal = accBal;
        this._auditClient = auditClient;
        this._authorizationClient = authorizationClient;
        this._messageProducer = messageProducer;
        this._metrics = metrics;
        this._currencyList = this._configClient.globalConfigs.getCurrencies();

        this._requestsHisto = metrics.getHistogram("ParticipantAggregate", "Participants Aggregate metrics", ["callName", "success"]);
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

        this._configClient.setChangeHandlerFunction(async (type: "BC" | "GLOBAL") => {
            // configurations changed centrally, reload what needs reloading
            if (type === "GLOBAL") {
                this._currencyList = this._configClient.globalConfigs.getCurrencies();
            }
        });
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
            const participantHMLNSAccount: IParticipantAccount = {
                id: randomUUID(),
                type: ParticipantAccountTypes.HUB_MULTILATERAL_SETTLEMENT,
                currencyCode: currency.code,
                debitBalance: null,
                creditBalance: null,
                balance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
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
            const participantReconAccount: IParticipantAccount = {
                id: randomUUID(),
                type: ParticipantAccountTypes.HUB_RECONCILIATION,
                currencyCode: currency.code,
                debitBalance: null,
                creditBalance: null,
                balance: null,
                externalBankAccountId: null,
                externalBankAccountName: null
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
            [{ key: "participantId", value: hubParticipant.id }]
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED,
            true,
            {
                userId: "(system)",
                role: "(system)",
                appId: "participants-svc",
            },
            [{ key: "participantId", value: hubParticipant.id }]
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

        const timerEndFn = this._requestsHisto.startTimer({ callName: "getAllParticipants" });

        const list: IParticipant[] | null = await this._repo.fetchAll();
        list.forEach(this._applyDefaultSorts);

        timerEndFn({ success: "true" });
        return list;
    }

    async searchParticipants(secCtx: CallSecurityContext, id: string, name: string, state: string): Promise<IParticipant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const timerEndFn = this._requestsHisto.startTimer({ callName: "searchParticipants" });

        const list: IParticipant[] = await this._repo.searchParticipants(
            id,
            name,
            state
        );
        list.forEach(this._applyDefaultSorts);
        timerEndFn({ success: "true" });

        return list;
    }

    async getParticipantById(secCtx: CallSecurityContext, id: string): Promise<IParticipant> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const timerEndFn = this._requestsHisto.startTimer({ callName: "getParticipantById" });
        const part: IParticipant | null = await this._repo.fetchWhereId(id);
        if (part == null)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );

        this._applyDefaultSorts(part);
        timerEndFn({ success: "true" });

        return part;
    }

    async getParticipantsByIds(secCtx: CallSecurityContext, ids: string[]): Promise<IParticipant[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const timerEndFn = this._requestsHisto.startTimer({ callName: "getParticipantsByIds" });
        const parts: IParticipant[] = await this._repo.fetchWhereIds(ids);
        if (parts.length == 0)
            throw new ParticipantNotFoundError(
                `Participant with IDs: '${ids}' not found.`
            );

        parts.forEach(this._applyDefaultSorts);
        timerEndFn({ success: "true" });

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
            participantAccountsChangeRequest: [],
            participantEndpoints: [],
            participantAllowedSourceIps: [],
            participantSourceIpChangeRequests: [],
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
            netDebitCapChangeRequests: [],
            participantContacts: [],
            participantContactInfoChangeRequests: []

        };

        if (!(await this._repo.create(createdParticipant)))
            throw new CouldNotStoreParticipant(
                "Unable to create participant successfully!"
            );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_CREATED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: createdParticipant.id }]
        );

        this._logger.info(
            `Successfully created participant with ID: '${createdParticipant.id}'`
        );

        //create event for participant create
        const payload: ParticipantChangedEvtPayload = {
            participantId: inputParticipant.id,
            actionName: AuditedActionNames.PARTICIPANT_CREATED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

        return createdParticipant.id;
    }

    async approveParticipant(secCtx: CallSecurityContext, participantId: string, note: string | null): Promise<void> {
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
                [{ key: "participantId", value: participantId }]
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
            [{ key: "participantId", value: participantId }]
        );

        //create event for participant approve
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_APPROVED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

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
            [{ key: "participantId", value: participantId }]
        );

        this._logger.info(
            `Successfully activated participant with ID: '${existing.id}'`
        );

        //create event for participant activate
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_ENABLED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);
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
            [{ key: "participantId", value: participantId }]
        );

        this._logger.info(
            `Successfully deactivated participant with ID: '${existing.id}'`
        );

        //create event for participant deactivate
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_DISABLED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);
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

        existing.participantEndpoints.push(endpoint as IParticipantEndpoint);
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
            [{ key: "participantId", value: participantId }]
        );

        //create event for participant add endpoint
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_ENDPOINT_ADDED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

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
            [{ key: "participantId", value: participantId }]
        );

        //create event for participant change endpoint
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_ENDPOINT_CHANGED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);
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
            [{ key: "participantId", value: participantId }]
        );

        //create event for participant remove endpoint
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_ENDPOINT_REMOVED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);
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
     * Contact Info
     * */

    async getContactInfoByParticipantId(secCtx: CallSecurityContext, id: string): Promise<IParticipantContactInfo[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const timerEndFn = this._requestsHisto.startTimer({ callName: "getContactInfoByParticipantId" });
        const existing: IParticipant | null = await this._repo.fetchWhereId(id);
        if (!existing) {
            timerEndFn({ success: "false" });
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );
        }
        const participantContacts = existing.participantContacts || [];

        return participantContacts;
    }

    async createParticipantContactInfoChangeRequest(
        secCtx: CallSecurityContext,
        participantId: string,
        contactInfoChangeRequest: IParticipantContactInfoChangeRequest
    ): Promise<string> {

        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CREATE_PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST);

        if (!participantId)
            throw new InvalidParticipantError("[id] cannot be empty");

        await Participant.ValidateParticipantContactInfoChangeRequest(contactInfoChangeRequest);

        const existing: IParticipant | null = await this._repo.fetchWhereId(participantId);
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );


        if (!existing.participantContactInfoChangeRequests) {
            existing.participantContactInfoChangeRequests = [];
        }

        existing.participantContactInfoChangeRequests.push({
            id: contactInfoChangeRequest.id || randomUUID(),
            contactInfoId: contactInfoChangeRequest.contactInfoId,
            name: contactInfoChangeRequest.name,
            email: contactInfoChangeRequest.email,
            phoneNumber: contactInfoChangeRequest.phoneNumber,
            role: contactInfoChangeRequest.role,
            createdBy: secCtx.username!,
            createdDate: Date.now(),
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: contactInfoChangeRequest.requestType
        });

        existing.changeLog.push({
            changeType: (contactInfoChangeRequest.requestType === "ADD_PARTICIPANT_CONTACT_INFO" ? ParticipantChangeTypes.ADD_CONTACT_INFO : ParticipantChangeTypes.CHANGE_CONTACT_INFO),
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: null,
        });

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on adding participant contact info change request."
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully created contact info change request for Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST_CREATED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        return contactInfoChangeRequest.id;
    }

    async approveParticipantContactInfoChangeRequest(
        secCtx: CallSecurityContext,
        participantId: string,
        contactInfoChangeRequestId: string
    ): Promise<string | null> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST);

        if (!participantId) throw new InvalidParticipantError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) {
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );
        }


        const contactInfoChangeRequest = existing.participantContactInfoChangeRequests.find(
            (value: IParticipantContactInfoChangeRequest) => value.id === contactInfoChangeRequestId
        );
        if (!contactInfoChangeRequest) {
            throw new ContactInfoChangeRequestNotFound(
                `Cannot find a participant's contact info change request with id: ${contactInfoChangeRequestId}`
            );
        }
        if (contactInfoChangeRequest.approved) {
            throw new ContactInfoChangeRequestAlreadyApproved(
                `Participant's contact info change request with id: ${contactInfoChangeRequestId} is already approved`
            );
        }

        // now we can enforce the correct privilege
        //this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST);

        if (secCtx && contactInfoChangeRequest.createdBy === secCtx.username) {
            await this._auditClient.audit(
                ParticipantChangeTypes.ADD_CONTACT_INFO,
                false,
                this._getAuditSecCtx(secCtx),
                [{ key: "participantId", value: participantId }]
            );
            throw new MakerCheckerViolationError(
                "Maker check violation - Same user cannot create and approve participant contact info change request."
            );
        }

        if (!existing.participantContacts) {
            existing.participantContacts = [];
        } else {

            if (contactInfoChangeRequest.requestType === "ADD_PARTICIPANT_CONTACT_INFO") {
                if (existing.participantContacts.find((value: IParticipantContactInfo) =>
                    value.name === contactInfoChangeRequest.name)) {
                    throw new CannotAddDuplicateContactInfoError("Same contact name already exists.");
                }

                if (existing.participantContacts.find((value: IParticipantContactInfo) =>
                    value.email === contactInfoChangeRequest.email)) {
                    throw new CannotAddDuplicateContactInfoError("Same contact email already exists.");
                }

                if (existing.participantContacts.find((value: IParticipantContactInfo) =>
                    value.phoneNumber === contactInfoChangeRequest.phoneNumber)) {
                    throw new CannotAddDuplicateContactInfoError("Same contact phone no. already exists.");
                }
            } else {
                if (existing.participantContacts.find((value: IParticipantContactInfo) =>
                    value.name === contactInfoChangeRequest.name &&
                    value.email === contactInfoChangeRequest.email &&
                    value.phoneNumber === contactInfoChangeRequest.phoneNumber &&
                    value.role === contactInfoChangeRequest.role)) {

                    throw new CannotAddDuplicateContactInfoError("Same contact information already exists.");
                }
            }
        }


        if (contactInfoChangeRequest.requestType === "ADD_PARTICIPANT_CONTACT_INFO") {
            contactInfoChangeRequest.contactInfoId = randomUUID();

            existing.participantContacts.push({
                id: contactInfoChangeRequest.contactInfoId,
                name: contactInfoChangeRequest.name,
                email: contactInfoChangeRequest.email,
                phoneNumber: contactInfoChangeRequest.phoneNumber,
                role: contactInfoChangeRequest.role
            });
        } else {
            existing.participantContacts.map((contactInfo) => {
                if (contactInfo.id == contactInfoChangeRequest.contactInfoId) {
                    contactInfo.name = contactInfoChangeRequest.name,
                        contactInfo.email = contactInfoChangeRequest.email,
                        contactInfo.phoneNumber = contactInfoChangeRequest.phoneNumber,
                        contactInfo.role = contactInfoChangeRequest.role
                }
            });
        }

        const now = Date.now();

        contactInfoChangeRequest.approved = true;
        contactInfoChangeRequest.approvedBy = secCtx.username;
        contactInfoChangeRequest.approvedDate = Date.now();

        existing.changeLog.push(
            {
                changeType: ParticipantChangeTypes.APPROVE_SOURCE_IP_REQUEST,
                user: secCtx.username!,
                timestamp: now,
                notes: null,
            }, {
            changeType: (contactInfoChangeRequest.requestType === "ADD_PARTICIPANT_CONTACT_INFO" ? ParticipantChangeTypes.ADD_CONTACT_INFO : ParticipantChangeTypes.CHANGE_CONTACT_INFO),
            user: secCtx.username!,
            timestamp: now + 1,
            notes: null,
        }
        );

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on adding participant's contact info."
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully added contact info with id: ${contactInfoChangeRequest.contactInfoId} to Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_CONTACT_INFO_CHANGE_REQUEST_APPROVED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        await this._auditClient.audit(
            (contactInfoChangeRequest.requestType === "ADD_PARTICIPANT_CONTACT_INFO" ? AuditedActionNames.PARTICIPANT_CONTACT_INFO_ADDED : AuditedActionNames.PARTICIPANT_CONTACT_INFO_CHANGED),
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        //create event for participant create
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: (contactInfoChangeRequest.requestType === "ADD_PARTICIPANT_CONTACT_INFO" ? AuditedActionNames.PARTICIPANT_CONTACT_INFO_ADDED : AuditedActionNames.PARTICIPANT_CONTACT_INFO_CHANGED),
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

        return contactInfoChangeRequest.contactInfoId;
    }


    /*
     * SourceIPs
     * */

    async getAllowedSourceIpsByParticipantId(secCtx: CallSecurityContext, id: string): Promise<IParticipantAllowedSourceIp[]> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.VIEW_PARTICIPANT);

        const timerEndFn = this._requestsHisto.startTimer({ callName: "getAllowedSourceIpsByParticipantId" });
        const existing: IParticipant | null = await this._repo.fetchWhereId(id);
        if (!existing) {
            timerEndFn({ success: "false" });
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );
        }
        const participantAllowedSourceIps = existing.participantAllowedSourceIps || [];

        return participantAllowedSourceIps;
    }

    async createParticipantSourceIpChangeRequest(
        secCtx: CallSecurityContext,
        participantId: string,
        sourceIpChangeRequest: IParticipantSourceIpChangeRequest
    ): Promise<string> {

        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CREATE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST);

        if (!participantId)
            throw new InvalidParticipantError("[id] cannot be empty");

        await Participant.ValidateParticipantSourceIpChangeRequest(sourceIpChangeRequest);

        const existing: IParticipant | null = await this._repo.fetchWhereId(participantId);
        if (!existing)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );


        if (!existing.participantSourceIpChangeRequests) {
            existing.participantSourceIpChangeRequests = [];
        }

        existing.participantSourceIpChangeRequests.push({
            id: sourceIpChangeRequest.id || randomUUID(),
            allowedSourceIpId: sourceIpChangeRequest.allowedSourceIpId,
            cidr: sourceIpChangeRequest.cidr,
            portMode: sourceIpChangeRequest.portMode,
            ports: sourceIpChangeRequest.ports,
            portRange: sourceIpChangeRequest.portRange,
            createdBy: secCtx.username!,
            createdDate: Date.now(),
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: sourceIpChangeRequest.requestType
        });

        existing.changeLog.push({
            changeType: (sourceIpChangeRequest.requestType === "ADD_SOURCE_IP" ? ParticipantChangeTypes.ADD_SOURCE_IP : ParticipantChangeTypes.CHANGE_SOURCE_IP),
            user: secCtx.username!,
            timestamp: Date.now(),
            notes: null,
        });

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantSourceIp"
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully created sourceIP change request for Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_SOURCE_IP_CHANGE_REQUEST_CREATED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        return sourceIpChangeRequest.id;
    }

    async approveParticipantSourceIpChangeRequest(
        secCtx: CallSecurityContext,
        participantId: string,
        sourceIpChangeRequestId: string
    ): Promise<string | null> {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST);

        if (!participantId) throw new InvalidParticipantError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) {
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );
        }


        const soureIPChangeRequest = existing.participantSourceIpChangeRequests.find(
            (value: IParticipantSourceIpChangeRequest) => value.id === sourceIpChangeRequestId
        );
        if (!soureIPChangeRequest) {
            throw new SourceIpChangeRequestNotFound(
                `Cannot find a participant's sourceIP change request with id: ${soureIPChangeRequest}`
            );
        }
        if (soureIPChangeRequest.approved) {
            throw new SourceIpChangeRequestAlreadyApproved(
                `Participant's sourceIP change request with id: ${soureIPChangeRequest} is already approved`
            );
        }

        // now we can enforce the correct privilege
        //this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT_SOURCE_IP_CHANGE_REQUEST);

        if (secCtx && soureIPChangeRequest.createdBy === secCtx.username) {
            await this._auditClient.audit(
                ParticipantChangeTypes.ADD_SOURCE_IP,
                false,
                this._getAuditSecCtx(secCtx),
                [{ key: "participantId", value: participantId }]
            );
            throw new MakerCheckerViolationError(
                "Maker check violation - Same user cannot create and approve participant sourceIP change request"
            );
        }

        if (!existing.participantAllowedSourceIps) {
            existing.participantAllowedSourceIps = [];
        } else {
            const isDuplicate = existing.participantAllowedSourceIps.find((value: IParticipantAllowedSourceIp) => {
                if (soureIPChangeRequest.requestType === "ADD_SOURCE_IP") {
                    return value.cidr === soureIPChangeRequest.cidr;
                } else {
                    return (
                        value.cidr === soureIPChangeRequest.cidr &&
                        value.portMode === soureIPChangeRequest.portMode &&
                        value.portRange === soureIPChangeRequest.portRange &&
                        value.ports === soureIPChangeRequest.ports
                    );
                }
            });

            if (isDuplicate) {
                throw new CannotAddDuplicateSourceIpError("Same sourceIP record already exists.");
            }
        }

        if (soureIPChangeRequest.requestType === "ADD_SOURCE_IP") {
            soureIPChangeRequest.allowedSourceIpId = randomUUID();


            existing.participantAllowedSourceIps.push({
                id: soureIPChangeRequest.allowedSourceIpId,
                cidr: soureIPChangeRequest.cidr,
                portMode: soureIPChangeRequest.portMode,
                ports: soureIPChangeRequest.ports,
                portRange: soureIPChangeRequest.portRange
            });
        } else {
            existing.participantAllowedSourceIps.map((sourceIP) => {
                if (sourceIP.id == soureIPChangeRequest.allowedSourceIpId) {
                    sourceIP.cidr = soureIPChangeRequest.cidr;
                    sourceIP.portMode = soureIPChangeRequest.portMode;
                    sourceIP.ports = soureIPChangeRequest.ports;
                    sourceIP.portRange = soureIPChangeRequest.portRange;
                }
            });
        }

        const now = Date.now();

        soureIPChangeRequest.approved = true;
        soureIPChangeRequest.approvedBy = secCtx.username;
        soureIPChangeRequest.approvedDate = Date.now();

        existing.changeLog.push(
            {
                changeType: ParticipantChangeTypes.APPROVE_SOURCE_IP_REQUEST,
                user: secCtx.username!,
                timestamp: now,
                notes: null,
            },{
                changeType: (soureIPChangeRequest.requestType==="ADD_SOURCE_IP" ? ParticipantChangeTypes.ADD_SOURCE_IP : ParticipantChangeTypes.CHANGE_SOURCE_IP),
                user: secCtx.username!,
                timestamp: now+1,
                notes: null,
            }
        );

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantSourceIP"
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully added sourceIP with id: ${soureIPChangeRequest.allowedSourceIpId} to Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_SOURCE_IP_CHANGE_REQUEST_APPROVED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );
        await this._auditClient.audit(
            (soureIPChangeRequest.requestType==="ADD_SOURCE_IP" ? AuditedActionNames.PARTICIPANT_SOURCE_IP_ADDED : AuditedActionNames.PARTICIPANT_SOURCE_IP_CHANGED),
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        //create event for participant source ip change request approved - we don't need both, just the reason for the actual change
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName:  (soureIPChangeRequest.requestType==="ADD_SOURCE_IP" ? AuditedActionNames.PARTICIPANT_SOURCE_IP_ADDED : AuditedActionNames.PARTICIPANT_SOURCE_IP_CHANGED)
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

        return soureIPChangeRequest.allowedSourceIpId;
    }

    /*
     * Accounts
     * */

    async createParticipantAccountChangeRequest(
        secCtx: CallSecurityContext,
        participantId: string,
        accountChangeRequest: IParticipantAccountChangeRequest
    ): Promise<string> {
        if(accountChangeRequest.requestType === "ADD_ACCOUNT") {
            this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CREATE_PARTICIPANT_ACCOUNT);
        }else if(accountChangeRequest.requestType === "CHANGE_ACCOUNT_BANK_DETAILS") {
            this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CHANGE_PARTICIPANT_ACCOUNT_BANK_DETAILS);
        }else{
            const err =new InvalidAccountError("Invalid requestType on ParticipantAccountChangeRequest");
            this._logger.error(err);
            throw err;
        }

        if (!participantId){
            const err = new InvalidParticipantError("[id] cannot be empty");
            this._logger.error(err);
            throw err;
        }


        const existing: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!existing) {
            const err = new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
            this._logger.error(err);
            throw err;
        }
        // if (!existing.isActive) throw new ParticipantNotActive("Participant is not active.");

        if (accountChangeRequest.type != ParticipantAccountTypes.SETTLEMENT && (accountChangeRequest.externalBankAccountId || accountChangeRequest.externalBankAccountName))
            throw new InvalidAccountError(
                `Only the SETTLEMENT account type can have external bank account info.`
            );

        if (!existing.participantAccountsChangeRequest) {
            existing.participantAccountsChangeRequest = [];
        }

        if (
            (accountChangeRequest.type === "HUB_MULTILATERAL_SETTLEMENT" ||
                accountChangeRequest.type === "HUB_RECONCILIATION") &&
            participantId !== HUB_PARTICIPANT_ID
        ) {
            this._logger.warn(
                "Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION"
            );
            throw new InvalidAccountError(
                "Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION"
            );
        }

        existing.participantAccountsChangeRequest.push({
            id: accountChangeRequest.id || randomUUID(),
            accountId: accountChangeRequest.accountId,
            type: accountChangeRequest.type as ParticipantAccountTypes,
            currencyCode: accountChangeRequest.currencyCode,
            externalBankAccountId: accountChangeRequest.externalBankAccountId,
            externalBankAccountName: accountChangeRequest.externalBankAccountName,
            createdBy: secCtx.username!,
            createdDate: Date.now(),
            approved: false,
            approvedBy: null,
            approvedDate: null,
            requestType: accountChangeRequest.requestType
        });
        existing.changeLog.push({
            changeType: accountChangeRequest.requestType==="ADD_ACCOUNT" ? ParticipantChangeTypes.ADD_ACCOUNT_REQUEST : ParticipantChangeTypes.CHANGE_ACCOUNT_BANK_DETAILS_REQUEST,
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
            `Successfully created account to Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            (accountChangeRequest.requestType==="ADD_ACCOUNT" ?
                AuditedActionNames.PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_CREATED : AuditedActionNames.PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_CREATED),
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        return accountChangeRequest.id;
    }

    async approveParticipantAccountChangeRequest(
        secCtx: CallSecurityContext,
        participantId: string,
        accountChangeRequestId: string
    ): Promise<string | null> {
        if (!participantId) throw new InvalidParticipantError("[id] cannot be empty");

        const existing: IParticipant | null = await this._repo.fetchWhereId(participantId);
        if (!existing) {
            throw new ParticipantNotFoundError(`Participant with ID: '${participantId}' not found.`);
        }
        // if (!existing.isActive) throw new ParticipantNotActive("Participant is not active.");

        const accountChangeRequest = existing.participantAccountsChangeRequest.find(
            (value: IParticipantAccountChangeRequest) => value.id === accountChangeRequestId
        );
        if (!accountChangeRequest) {
            throw new AccountChangeRequestNotFound(
                `Cannot find a participant's account change request with id: ${accountChangeRequestId}`
            );
        }



        if (accountChangeRequest.approved) {
            throw new AccountChangeRequestAlreadyApproved(
                `Participant's account change request with id: ${accountChangeRequestId} is already approved`
            );
        }

        // now we can enforce the correct privilege
        if(accountChangeRequest.requestType === "ADD_ACCOUNT") {
            this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT_ACCOUNT_CREATION_REQUEST);
        }else if(accountChangeRequest.requestType === "CHANGE_ACCOUNT_BANK_DETAILS") {
            this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.APPROVE_PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST);
        }else{
            const err =new InvalidAccountError("Invalid requestType on ParticipantAccountChangeRequest");
            this._logger.error(err);
            throw err;
        }

        if (secCtx && accountChangeRequest.createdBy === secCtx.username) {
            await this._auditClient.audit(
                (accountChangeRequest.requestType==="ADD_ACCOUNT" ?
                    AuditedActionNames.PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_APPROVED : AuditedActionNames.PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_APPROVED),
                false,
                this._getAuditSecCtx(secCtx),
                [{ key: "participantId", value: participantId }]
            );
            throw new MakerCheckerViolationError(
                "Maker check violation - Same user cannot create and approve participant account change request"
            );
        }

        if (!existing.participantAccounts) {
            existing.participantAccounts = [];
        } else {
            if (accountChangeRequest.accountId == null &&
                existing.participantAccounts.find(
                    (value: IParticipantAccount) =>
                        value.type === accountChangeRequest.type &&
                        value.currencyCode === accountChangeRequest.currencyCode
                )
            ) {
                throw new CannotAddDuplicateAccountError(
                    "An account with that id, or the same type and currency exists already"
                );
            }
        }

        if (
            (accountChangeRequest.type === "HUB_MULTILATERAL_SETTLEMENT" ||
                accountChangeRequest.type === "HUB_RECONCILIATION") &&
            participantId !== HUB_PARTICIPANT_ID
        ) {
            this._logger.warn(
                "Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION"
            );
            throw new InvalidAccountError(
                "Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION"
            );
        }

        //no need update process in account&balance
        let accountId: string | null;
        if (accountChangeRequest.requestType === "ADD_ACCOUNT") {
            accountChangeRequest.accountId = randomUUID();
            try {
                this._accBal.setToken(secCtx.accessToken);
                accountId = await this._accBal.createAccount(
                    accountChangeRequest.accountId,
                    participantId,
                    accountChangeRequest.type,
                    accountChangeRequest.currencyCode
                );
            } catch (err) {
                this._logger.error(err);
                if (err instanceof UnauthorizedError) throw err;

                throw new UnableToCreateAccountUpstream(
                    `'${existing.name}' account '${accountChangeRequest.type}' failed upstream.`
                );
            }

            existing.participantAccounts.push({
                id: accountId,
                type: accountChangeRequest.type as ParticipantAccountTypes,
                currencyCode: accountChangeRequest.currencyCode,
                creditBalance: null,
                debitBalance: null,
                balance: null,
                externalBankAccountId: accountChangeRequest.externalBankAccountId,
                externalBankAccountName: accountChangeRequest.externalBankAccountName
            });
        } else {
            accountId = accountChangeRequest.accountId;

            existing.participantAccounts.map((account) => {
                if (account.id == accountId) {
                    account.externalBankAccountId = accountChangeRequest.externalBankAccountId,
                        account.externalBankAccountName = accountChangeRequest.externalBankAccountName;
                }
            });

        }

        const now = Date.now();

        accountChangeRequest.approved = true;
        accountChangeRequest.approvedBy = secCtx.username;
        accountChangeRequest.approvedDate = now;

        existing.changeLog.push(
            {
                changeType: ParticipantChangeTypes.ACCOUNT_CHANGE_REQUEST_APPROVED,
                user: secCtx.username!,
                timestamp: now,
                notes: null,
            },{
                changeType: (accountChangeRequest.requestType==="ADD_ACCOUNT" ?
                    ParticipantChangeTypes.ADD_ACCOUNT : ParticipantChangeTypes.CHANGE_ACCOUNT_BANK_DETAILS),
                user: secCtx.username!,
                timestamp: now+1,
                notes: null,
            }
        );

        const updateSuccess = await this._repo.store(existing);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on addParticipantAccount"
            );
            this._logger.error(err);
            throw err;
        }

        this._logger.info(
            `Successfully added account with id: ${accountId} to Participant with ID: '${participantId}'`
        );

        await this._auditClient.audit(
            (accountChangeRequest.requestType === "ADD_ACCOUNT" ?
                AuditedActionNames.PARTICIPANT_ADD_ACCOUNT_CHANGE_REQUEST_APPROVED : AuditedActionNames.PARTICIPANT_CHANGE_ACCOUNT_BANK_DETAILS_CHANGE_REQUEST_APPROVED),
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );
        await this._auditClient.audit(
            (accountChangeRequest.requestType === "ADD_ACCOUNT" ?
                AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED : AuditedActionNames.PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGED),
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        //create event for Participant account change request approved - we don't need both, just the reason for the actual change
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: (accountChangeRequest.requestType==="ADD_ACCOUNT" ?
                AuditedActionNames.PARTICIPANT_ACCOUNT_ADDED : AuditedActionNames.PARTICIPANT_ACCOUNT_BANK_DETAILS_CHANGED)
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

        return accountId;
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

        const timerEndFn = this._requestsHisto.startTimer({ callName: "getParticipantAccountsById" });
        const existing: IParticipant | null = await this._repo.fetchWhereId(id);
        if (!existing) {
            timerEndFn({ success: "false" });
            throw new ParticipantNotFoundError(
                `Participant with ID: '${id}' not found.`
            );
        }
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
                timerEndFn({ success: "false" });
                throw err;
            }

            for (const pacc of participantAccounts) {
                const jAcc = accBalAccounts.find((value) => value.id === pacc.id);
                if (jAcc == null) continue;

                pacc.debitBalance = jAcc.postedDebitBalance || null;
                pacc.creditBalance = jAcc.postedCreditBalance || null;
                pacc.balance = jAcc.balance || null;
            }
        }
        timerEndFn({ success: "true" });

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

        const settlementAccount = participant.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "SETTLEMENT"
        );
        if (!settlementAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's settlement account for currency: ${fundsMov.currencyCode}`
            );
        }
        const hubReconAccount = hub.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "HUB_RECONCILIATION"
        );
        if (!hubReconAccount) {
            throw new AccountNotFoundError(
                `Cannot find hub's reconciliation account for currency: ${fundsMov.currencyCode}`
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
            [{ key: "participantId", value: participantId }]
        );

        return;
    }

    async approveFundsMovement(secCtx: CallSecurityContext, participantId: string, fundsMovId: string): Promise<void> {
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
                [{ key: "participantId", value: participantId }]
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
        const settlementAccount = participant.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === fundsMov.currencyCode &&
                value.type === "SETTLEMENT"
        );
        if (!settlementAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's position account for currency: ${fundsMov.currencyCode}`
            );
        }

        // Check if enough balance in settlement account for withdrawal
        if (fundsMov.direction === ParticipantFundsMovementDirections.FUNDS_WITHDRAWAL) {
            // Get the account from account and balance adapter
            const updatedSettlementAcc = await this._accBal.getAccount(settlementAccount.id);
            if (!updatedSettlementAcc) {
                throw new AccountNotFoundError(
                    `Could not get settlement account from accountsAndBalances adapter for participant id: ${participant.id}`
                );
            }

            const fundsMovAmount = Number(fundsMov.amount);
            const balance = Number(updatedSettlementAcc.balance);

            if (isNaN(fundsMovAmount)) {
                throw new AccountNotFoundError(
                    `Invalid withdrawal amount for funds movement with id: ${fundsMovId}`
                );
            }
            if (isNaN(balance)) {
                throw new AccountNotFoundError(
                    `Invalid balance value in the settlement account for participant id: ${participant.id}`
                );
            }
            if (fundsMovAmount > balance) {
                throw new WithdrawalExceedsBalanceError(
                    `Not enough balance in the settlement account for participant id: ${participant.id}`
                );
            }
        }

        const now = Date.now();

        this._accBal.setToken(secCtx.accessToken);
        fundsMov.transferId = await this._accBal.createJournalEntry(
            randomUUID(),
            fundsMov.id,
            fundsMov.currencyCode,
            fundsMov.amount,
            false,
            fundsMov.direction === "FUNDS_DEPOSIT"
                ? hubReconAccount.id
                : settlementAccount.id,
            fundsMov.direction === "FUNDS_DEPOSIT"
                ? settlementAccount.id
                : hubReconAccount.id
        ).catch((error: Error) => {
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
            [{ key: "participantId", value: participantId }]
        );

        //create event for fund movement approved
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: fundsMov.direction === "FUNDS_DEPOSIT"
                ? AuditedActionNames.PARTICIPANT_FUNDS_DEPOSIT_APPROVED
                : AuditedActionNames.PARTICIPANT_FUNDS_WITHDRAWAL_APPROVED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

        return;
    }

    async createParticipantNetDebitCap(
        secCtx: CallSecurityContext,
        participantId: string,
        netDebitCapChangeRequest: IParticipantNetDebitCapChangeRequest
    ) {
        this._enforcePrivilege(secCtx, ParticipantPrivilegeNames.CREATE_NDC_CHANGE_REQUEST);

        if (!participantId)
            throw new ParticipantNotFoundError("participantId cannot be empty");
        if (!netDebitCapChangeRequest.currencyCode) throw new Error("currencyCode cannot be empty");
        if (netDebitCapChangeRequest.type === "PERCENTAGE" &&
            !(typeof netDebitCapChangeRequest.percentage === "number" && netDebitCapChangeRequest.percentage >= 0 && netDebitCapChangeRequest.percentage <= 100)) {
            throw new Error("Invalid percentage value");
        }
        if (netDebitCapChangeRequest.type === "ABSOLUTE"
            && (netDebitCapChangeRequest.fixedValue === null || netDebitCapChangeRequest.fixedValue == undefined)) {
            throw new Error("Invalid fixed value");
        }

        const participant: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!participant)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        const settlementAccount = participant.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === netDebitCapChangeRequest.currencyCode &&
                value.type === "SETTLEMENT"
        );
        if (!settlementAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's settlement account for currency: ${netDebitCapChangeRequest.currencyCode}`
            );
        }

        const now = Date.now();
        if (!participant.netDebitCapChangeRequests) participant.netDebitCapChangeRequests = [];
        participant.netDebitCapChangeRequests.push({
            id: netDebitCapChangeRequest.id || randomUUID(),
            createdBy: secCtx.username!,
            createdDate: now,
            type: netDebitCapChangeRequest.type as ParticipantNetDebitCapTypes,
            fixedValue: netDebitCapChangeRequest.fixedValue,
            percentage: netDebitCapChangeRequest.percentage,
            currencyCode: netDebitCapChangeRequest.currencyCode,
            note: netDebitCapChangeRequest.note,
            extReference: netDebitCapChangeRequest.extReference,
            approved: false,
            approvedBy: null,
            approvedDate: null
        });

        const updateSuccess = await this._repo.store(participant);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on createParticipantNetDebitCap"
            );
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_NDC_CHANGE_REQUEST_CREATED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        return;
    }


    private _calculateParticipantPercentageNetDebitCap(ndcFixed: number, ndcPercentage: number | null, liqAccBalance: number, type: "ABSOLUTE" | "PERCENTAGE"): number {
        let finalNDCAmount: number;
        if (type === ParticipantNetDebitCapTypes.ABSOLUTE && ndcFixed !== null) {
            finalNDCAmount = Math.max(ndcFixed, 0); // min is 0
        } else if (type === ParticipantNetDebitCapTypes.PERCENTAGE && ndcPercentage !== null) {
            // we cannot have negative NDC value, if the current value is <0, then NDC is 0
            finalNDCAmount = Math.max(Math.floor((ndcPercentage / 100) * liqAccBalance), 0);
        } else {
            throw new InvalidNdcChangeRequest("Invalid participant's NDC definition");
        }

        return Math.max(Math.min(finalNDCAmount, liqAccBalance), 0);
    }

    async approveParticipantNetDebitCap(secCtx: CallSecurityContext, participantId: string, ndcReqId: string): Promise<void> {
        if (!participantId)
            throw new ParticipantNotFoundError("participantId cannot be empty");

        const participant: IParticipant | null = await this._repo.fetchWhereId(
            participantId
        );
        if (!participant)
            throw new ParticipantNotFoundError(
                `Participant with ID: '${participantId}' not found.`
            );

        const netDebitCapChange = participant.netDebitCapChangeRequests.find(
            (value: IParticipantNetDebitCapChangeRequest) => value.id === ndcReqId
        );
        if (!netDebitCapChange) {
            throw new NdcChangeRequestNotFound(
                `Cannot find a participant's NDC change request with id: ${ndcReqId}`
            );
        }
        if (netDebitCapChange.approved) {
            throw new NdcChangeRequestAlreadyApproved(
                `Participant's NDC change request with id: ${ndcReqId} is already approved`
            );
        }

        // now we can enforce the correct privilege
        this._enforcePrivilege(
            secCtx,
            ParticipantPrivilegeNames.APPROVE_NDC_CHANGE_REQUEST
        );

        if (secCtx && netDebitCapChange.createdBy === secCtx.username) {
            await this._auditClient.audit(
                AuditedActionNames.PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED,
                false,
                this._getAuditSecCtx(secCtx),
                [{ key: "participantId", value: participantId }]
            );
            throw new MakerCheckerViolationError(
                "Maker check violation - Same user cannot create and approve participant a NDC change request"
            );
        }

        // find accounts
        const settlementAccount = participant.participantAccounts.find(
            (value: IParticipantAccount) =>
                value.currencyCode === netDebitCapChange.currencyCode &&
                value.type === "SETTLEMENT"
        );
        if (!settlementAccount) {
            throw new AccountNotFoundError(
                `Cannot find a participant's settlement account for currency: ${netDebitCapChange.currencyCode}`
            );
        }

        const account = await this._accBal.getAccount(settlementAccount.id);
        if (!account) {
            throw new AccountNotFoundError(
                `Could not get participant's settlement account with id: ${settlementAccount.id} from accounts and balances`
            );
        }

        const currentBalance: number = Number(account.balance || 0);

        const finalNDCAmount = this._calculateParticipantPercentageNetDebitCap(
            netDebitCapChange.fixedValue || 0,
            netDebitCapChange.percentage || 0,
            currentBalance,
            netDebitCapChange.type
        );

        const now = Date.now();

        if (!participant.netDebitCaps) participant.netDebitCaps = [];

        const found = participant.netDebitCaps.find(
            (value) =>
                value.currencyCode === netDebitCapChange.currencyCode
        );

        if (!found) {
            participant.netDebitCaps.push({
                currencyCode: netDebitCapChange.currencyCode,
                type: netDebitCapChange.type as ParticipantNetDebitCapTypes,
                percentage: netDebitCapChange.percentage,
                currentValue: finalNDCAmount
            });
        } else {
            found.currencyCode = netDebitCapChange.currencyCode;
            found.type = netDebitCapChange.type as ParticipantNetDebitCapTypes;
            found.percentage = netDebitCapChange.percentage;
            found.currentValue = finalNDCAmount;
        }

        netDebitCapChange.approved = true;
        netDebitCapChange.approvedBy = secCtx.username;
        netDebitCapChange.approvedDate = now;

        participant.changeLog.push({
            changeType: ParticipantChangeTypes.NDC_CHANGE,
            user: secCtx.username!,
            timestamp: now,
            notes: "approved NDC change",
        });

        const updateSuccess = await this._repo.store(participant);
        if (!updateSuccess) {
            const err = new CouldNotStoreParticipant(
                "Could not update participant on approveParticipantNetDebitCap"
            );
            this._logger.error(err);
            throw err;
        }

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "participantId", value: participantId }]
        );

        //create event for NDC change
        const payload: ParticipantChangedEvtPayload = {
            participantId: participantId,
            actionName: AuditedActionNames.PARTICIPANT_NDC_CHANGE_REQUEST_APPROVED
        };

        const event = new ParticipantChangedEvt(payload);

        await this._messageProducer.send(event);

        return;
    }

    /**
     * This will reflect the settlement in the participants accounts ledger,
     * updating their settlement/liquidity and position accounts as instructed
     * byt the payload of the SettlementMatrixSettledEvt (payload.participantList)
     * @param secCtx
     * @param msg SettlementMatrixSettledEvt
     */
    async handleSettlementMatrixSettledEvt(secCtx: CallSecurityContext, msg: SettlementMatrixSettledEvt): Promise<void> {
        // this is an internall call, triggerd by the event handler, we use secCtx for audit
        //this._enforcePrivilege( secCtx, ParticipantPrivilegeNames.APPROVE_NDC_CHANGE_REQUEST);

        if (!msg.payload || !msg.payload.participantList || !msg.payload.participantList.length) {
            const error = new Error("Invalid participantList in SettlementMatrixSettledEvt message in handleSettlementMatrixSettledEvt()");
            this._logger.error(error);
            throw error;
        }

        const retParticipantsNotFoundError = (): Error => {
            const error = new Error("Could not get all participants for handleSettlementMatrixSettledEvt()");
            this._logger.error(error);
            return error;
        };

        const retParticipantAccountNotFoundError = (): Error => {
            const error = new Error("Could not get all participants' accounts for handleSettlementMatrixSettledEvt()");
            this._logger.error(error);
            return error;
        };

        const participantIds = msg.payload.participantList.flatMap(msg => msg.participantId);
        const participants = await this._repo.fetchWhereIds(participantIds);
        if (!participants || participants.length !== msg.payload.participantList.length) {
            throw retParticipantsNotFoundError();
        }

        const ledgerEntriesToCreate: {
            requestedId: string,
            ownerId: string,
            currencyCode: string,
            amount: string,
            pending: boolean,
            debitedAccountId: string,
            creditedAccountId: string
        }[] = [];

        for (const participantItem of msg.payload.participantList) {
            const participant = participants.find(participant => participant.id === participantItem.participantId);
            if (!participant) throw retParticipantsNotFoundError();

            const liqAcc = participant.participantAccounts?.find(
                (acc) => acc.type === "SETTLEMENT" && acc.currencyCode === participantItem.currencyCode
            );

            const posAcc = participant.participantAccounts?.find(
                (acc) => acc.type === "POSITION" && acc.currencyCode === participantItem.currencyCode
            );

            if (!liqAcc || !posAcc) throw retParticipantAccountNotFoundError();

            // if we got a credit -> credit liquidity and debit position
            if (Number(participantItem.settledCreditBalance) > 0) {
                ledgerEntriesToCreate.push({
                    requestedId: randomUUID(),
                    ownerId: msg.payload.settlementMatrixId,
                    currencyCode: participantItem.currencyCode,
                    amount: participantItem.settledCreditBalance,
                    pending: false,
                    creditedAccountId: liqAcc.id,   // driver of the entry is liquidity account
                    debitedAccountId: posAcc.id
                });
            }

            // if we got a debit -> debit liquidity and credit position
            if (Number(participantItem.settledDebitBalance) > 0) {
                ledgerEntriesToCreate.push({
                    requestedId: randomUUID(),
                    ownerId: msg.payload.settlementMatrixId,
                    currencyCode: participantItem.currencyCode,
                    amount: participantItem.settledDebitBalance,
                    pending: false,
                    creditedAccountId: posAcc.id,
                    debitedAccountId: liqAcc.id    // driver of the entry is liquidity account
                });
            }
        }

        if (ledgerEntriesToCreate.length == 0) {
            const error = new Error("Empty list of ledger entries to create in handleSettlementMatrixSettledEvt()");
            this._logger.error(error);
            throw error;
        }

        const respIds = await this._accBal.createJournalEntries(ledgerEntriesToCreate);

        if (respIds.length !== ledgerEntriesToCreate.length) {
            const error = new Error("List of created ledger entries ids, doesn't match request to create in handleSettlementMatrixSettledEvt()");
            this._logger.error(error);
            throw error;
        }

        this._logger.info(`SettlementMatrixSettledEvt processed successfully for settlement matrix id: ${msg.payload.settlementMatrixId}`);

        await this._auditClient.audit(
            AuditedActionNames.PARTICIPANTS_PROCESSED_MATRIX_SETTLED_EVENT,
            true,
            this._getAuditSecCtx(secCtx),
            [{ key: "settlementMatrixId", value: msg.payload.settlementMatrixId }]
        );

        await this._updateNdcForParticipants(participants, "SettlementMatrixSettledEvt Processing");
    }

    private async _updateNdcForParticipants(participants: IParticipant[], reason: string): Promise<void> {
        const now = Date.now();

        for (const participant of participants) {
            if (!participant.netDebitCaps || participant.netDebitCaps.length <= 0) continue;

            let changed = false;

            for (const ndcDefinition of participant.netDebitCaps) {
                const partAccount = participant.participantAccounts.find(
                    item => item.type === "SETTLEMENT" && item.currencyCode === ndcDefinition.currencyCode
                );
                if (!partAccount) {
                    throw new Error(`Cannot get settlement account for participant with id: ${participant.id} and currency: ${ndcDefinition.currencyCode} for _updateNdcForParticipants()`);
                }
                const abAccount = await this._accBal.getAccount(partAccount.id);
                if (!abAccount) {
                    throw new Error(`Cannot get participant account with id: ${partAccount.id} from accounts and balaces for _updateNdcForParticipants()`);
                }

                ndcDefinition.currentValue = this._calculateParticipantPercentageNetDebitCap(
                    ndcDefinition.currentValue,
                    ndcDefinition.percentage,
                    Math.min(Number(abAccount.balance || 0)),
                    ndcDefinition.type
                );
                changed = true;
            }

            if (!changed) continue;

            participant.changeLog.push({
                changeType: ParticipantChangeTypes.NDC_RECALCULATED,
                user: "(n/a)",
                timestamp: now,
                notes: "NDC recalculated - for: " + reason,
            });

            await this._repo.store(participant);

            this._logger.info(`Participant id: ${participant.id} NDC recalculated - for: ${reason}`);

            //create event for NDC recalculated
            const payload: ParticipantChangedEvtPayload = {
                participantId: participant.id,
                actionName: ParticipantChangeTypes.NDC_RECALCULATED
            };

            const event = new ParticipantChangedEvt(payload);

            await this._messageProducer.send(event);
        }
    }
}
