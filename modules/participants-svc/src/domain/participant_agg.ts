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

import {IParticipantsRepository} from "./iparticipant_repo";
import {IParticipantsEndpointRepository} from "./iparticipant_endpoint_repo";
import {
    Participant,
    ParticipantEndpoint,
    ParticipantAccount,
    ParticipantApproval
} from "@mojaloop/participant-bc-public-types-lib";
import {
    JournalAccount, JournalEntry
} from "@mojaloop/participant-bc-private-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";

import {
    InvalidParticipantError, NoAccountsError, NoEndpointsError, ParticipantCreateValidationError, ParticipantNotActive,
    ParticipantNotFoundError, UnableToCreateAccountUpstream
} from "./errors";
import {IParticipantsApprovalRepository} from "./iparticipant_approval_repo";
import {IAccountsBalances} from "./iparticipant_account_balances_ds";
import {IParticipantsAccountRepository} from "./iparticipant_account_repo";

export class ParticipantAggregate {
    private _logger: ILogger;
    private _repo: IParticipantsRepository;
    private _repoEndpoints: IParticipantsEndpointRepository;
    private _repoApproval: IParticipantsApprovalRepository;
    private _repoAccount: IParticipantsAccountRepository;
    private _accBal: IAccountsBalances;

    constructor(
        repo: IParticipantsRepository,
        _repoEndpoints: IParticipantsEndpointRepository,
        _repoApproval: IParticipantsApprovalRepository,
        _repoAccount: IParticipantsAccountRepository,
        _accBal: IAccountsBalances,
        logger: ILogger
    ) {
        this._repo = repo;
        this._repo.init();
        this._repoEndpoints = _repoEndpoints;
        this._repoEndpoints.init();
        this._repoApproval = _repoApproval;
        this._repoApproval.init();
        this._repoAccount = _repoAccount;
        this._repoAccount.init();
        this._accBal = _accBal;
        this._accBal.init();
        this._logger = logger;
    }

    async getParticipantByName(participantName: string): Promise<Participant> {
        const part: Participant | null = await this._repo.fetchWhereName(participantName);
        if (part == null) throw new ParticipantNotFoundError(`'${participantName}' not found.`);
        return part;
    }

    async getParticipantEndpointsByName(participantName: string): Promise<ParticipantEndpoint[]> {
        const part: Participant | null = await this._repo.fetchWhereName(participantName);
        if (part == null) throw new ParticipantNotFoundError(`'${participantName}' not found.`);

        const endpoints: ParticipantEndpoint[] | null = await this._repoEndpoints.fetchWhereParticipant(part);
        if (endpoints == null || endpoints.length == 0) {
            throw new NoEndpointsError(`Participant '${participantName}' has no endpoints.`);
        }
        return endpoints;
    }

    async getParticipantAccountsByName(participantName: string): Promise<ParticipantAccount[]> {
        const part: Participant | null = await this._repo.fetchWhereName(participantName);
        if (part == null) throw new ParticipantNotFoundError(`'${participantName}' not found.`);

        const accounts: ParticipantAccount[] | null = await this._repoAccount.fetchWhereParticipant(part);
        if (accounts == null || accounts.length == 0) {
            throw new NoAccountsError(`Participant '${participantName}' has no accounts.`);
        }

        // Obtain the most recent account balances:
        for (const acc of accounts) {
            //TODO this may be improved with fetching accounts by participantId in future...
            const jAcc = await this._accBal.getAccount(acc.id);
            if (jAcc == null) continue;

            acc.balanceDebit = jAcc.balanceDebit;
            acc.balanceCredit = jAcc.balanceCredit;
        }
        return accounts;
    }

    async createParticipant(participant: Participant): Promise<Participant> {
        if (!await this._validateParticipantCreate(participant)) {
            throw new ParticipantCreateValidationError("Invalid credentials for participant");
        }

        if (!await this._repo.store(participant)) throw new InvalidParticipantError("Unable to store participant successfully!");

        return participant;
    }

    async approveParticipant(
        participant: Participant,
        checker: string,
        feedback: string
    ): Promise<Participant> {
        if (participant.name.trim().length == 0) throw new ParticipantCreateValidationError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        if (existing == null) throw new ParticipantNotFoundError(`'${participant.name}' not found.`);

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

        await this._repoApproval.approve(participant, approval);
        
        return existing;
    }

    async deActivateParticipant(participant: Participant): Promise<Participant> {
        if (participant.name.trim().length == 0) throw new ParticipantNotFoundError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        if (existing == null) throw new ParticipantNotFoundError(`'${participant.name}' not found.`);
        existing.isActive = false;
        await this._repo.store(existing);
        return existing;
    }

    async addParticipantEndpoint(participant: Participant, endpoint: ParticipantEndpoint): Promise<Participant> {
        if (participant.name.trim().length == 0) throw new ParticipantNotFoundError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        if (existing == null) throw new ParticipantNotFoundError(`'${participant.name}' not found.`);
        await this._repoEndpoints.addEndpoint(participant, endpoint);
        return existing;
    }

    async removeParticipantEndpoint(participant: Participant, endpoint: ParticipantEndpoint): Promise<Participant> {
        if (participant.name.trim().length == 0) throw new ParticipantNotFoundError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        if (existing == null) throw new ParticipantNotFoundError(`'${participant.name}' not found.`);
        await this._repoEndpoints.removeEndpoint(participant, endpoint);
        return existing;
    }

    async addParticipantAccount(participant: Participant, account: ParticipantAccount): Promise<Participant> {
        if (participant.name.trim().length == 0) throw new ParticipantNotFoundError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        if (existing == null) throw new ParticipantNotFoundError(`'${participant.name}' not found.`);
        if (!existing.isActive) throw new ParticipantNotActive(`'${participant.name}' is not active.`);

        const accBalAccount : JournalAccount = {
            id: account.id,
            type: 'position',
            state: 'active',
            currency: account.currency,
            balanceDebit: 0n,
            balanceCredit: 0n,
            externalId: participant.id
        }
        let success = await this._accBal.createAccount(accBalAccount);
        if (!success) {
            throw new UnableToCreateAccountUpstream(`'${participant.name}' account '${account.type}' failed upstream.`);
        }

        if (account.balanceCredit != null && account.balanceCredit > 0) {
            const hubAccountForDeposit = 'deposit';//TODO @jason, lookup...
            const journal: JournalEntry = {
                id: `uuid`,
                currency: account.currency,
                amount: account.balanceCredit,
                accountDebit: hubAccountForDeposit,
                accountCredit: account.id,
                timestamp: Date.now(),
                externalId: `initial-deposit`,
                externalCategory: `deposit`,
            };
            success = await this._accBal.createJournalEntry(journal);
            if (!success) {
                throw new UnableToCreateAccountUpstream(`'${participant.name}' account '${account.type}' balance update failed upstream.`);
            }
        }

        // We store balances in acc+balances:
        delete account.balanceDebit;
        delete account.balanceCredit;

        await this._repoAccount.addAccount(participant, account);
        return existing;
    }

    async removeParticipantAccount(participant: Participant, account: ParticipantAccount): Promise<Participant> {
        if (participant.name.trim().length == 0) throw new ParticipantNotFoundError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        if (existing == null) throw new ParticipantNotFoundError(`'${participant.name}' not found.`);
        await this._repoAccount.removeAccount(participant, account);
        return existing;
    }

    private async _validateParticipantCreate(participant: Participant) : Promise<boolean> {
        participant.isActive = false;

        if (participant.name.trim().length == 0) throw new ParticipantCreateValidationError("[name] cannot be empty");

        const existing = await this._repo.fetchWhereName(participant.name);
        this._logger.debug(existing);
        if (existing != null) throw new ParticipantCreateValidationError(`'${participant.name}' already exists`);

        return true;
    }
}
