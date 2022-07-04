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

import express from "express";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    Participant,
    ParticipantAccount,
    ParticipantApproval,
    ParticipantEndpoint
} from "@mojaloop/participant-bc-public-types-lib";
import {ParticipantAggregate} from "../domain/participant_agg";
import {ConsoleLogger} from "../logger_console";
import {IParticipantsRepository} from "../domain/iparticipant_repo";
import {MongoDBParticipantsRepo} from "../infrastructure/mongodb_participants_repo";

import {
    InvalidParticipantError, NoAccountsError, NoEndpointsError, ParticipantCreateValidationError,
    ParticipantNotFoundError
} from "../domain/errors";
import {IParticipantsEndpointRepository} from "../domain/iparticipant_endpoint_repo";
import {MongoDBParticipantsEndpointRepo} from "../infrastructure/mongodb_participants_endpoint_repo";
import {IParticipantsApprovalRepository} from "../domain/iparticipant_approval_repo";
import {MongoDBParticipantsApprovalRepo} from "../infrastructure/mongodb_participants_approval_repo";
import {IParticipantsAccountRepository} from "../domain/iparticipant_account_repo";
import {MongoDBParticipantsAccountRepo} from "../infrastructure/mongodb_participants_account_repo";
import {IAccountsBalances} from "../domain/iparticipant_account_balances_ds";
import {RestAccountsAndBalances} from "../infrastructure/rest_acc_bal";

const logger: ILogger = new ConsoleLogger();
//TODO need to fetch properties with config bc.
const mongoURL = "mongodb://root:example@localhost:27017/";
const accBalancesURL = "http://localhost:3001/";

const repoPart: IParticipantsRepository = new MongoDBParticipantsRepo(mongoURL, logger);
const repoPartEndpoint: IParticipantsEndpointRepository = new MongoDBParticipantsEndpointRepo(mongoURL, logger);
const repoPartApproval: IParticipantsApprovalRepository = new MongoDBParticipantsApprovalRepo(mongoURL, logger);
const repoPartAccount: IParticipantsAccountRepository = new MongoDBParticipantsAccountRepo(mongoURL, logger);
const restAccAndBal: IAccountsBalances = new RestAccountsAndBalances(accBalancesURL, logger);

const participantAgg: ParticipantAggregate = new ParticipantAggregate(
    repoPart,
    repoPartEndpoint,
    repoPartApproval,
    repoPartAccount,
    restAccAndBal,
    logger
);

export class ExpressRoutes {
    private _logger:ILogger;

    private _mainRouter = express.Router();

    constructor(logger: ILogger) {
        this._logger = logger;

        // main
        this._mainRouter.get("/", this.getExample.bind(this));
        this._mainRouter.get("/participant/:name", this.participantByName.bind(this));
        this._mainRouter.post("/participant", this.participantCreate.bind(this));
        this._mainRouter.put("/participant/:name/approve", this.participantApprove.bind(this));
        this._mainRouter.put("/participant/:name/disable", this.deActivateParticipant.bind(this));

        // endpoint
        this._mainRouter.get("/participant/:name/endpoints", this.endpointsByParticipantName.bind(this));
        this._mainRouter.post("/participant/:name/endpoint", this.participantEndpointCreate.bind(this));
        this._mainRouter.delete("/participant/:name/endpoint", this.participantEndpointDelete.bind(this));

        // account
        this._mainRouter.get("/participant/:name/accounts", this.accountsByParticipantName.bind(this));
        this._mainRouter.post("/participant/:name/account", this.participantAccountCreate.bind(this));
        this._mainRouter.delete("/participant/:name/account", this.participantAccountDelete.bind(this));
    }

    get MainRouter():express.Router{
        return this._mainRouter;
    }

    private async getExample(req: express.Request, res: express.Response, next: express.NextFunction) {
        return res.send({resp:"example worked"});
    }

    private async participantByName(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        this._logger.debug(`Fetching Participant [${partName}].`);

        try {
            const fetched = await participantAgg.getParticipantByName(partName);
            res.send(fetched);
        } catch (err : any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: `No participant with name ${partName}.`
                });
            }
        }
    }

    private async participantCreate(req: express.Request, res: express.Response, next: express.NextFunction) {
        const data: Participant = req.body;
        this._logger.debug(`Creating Participant [${JSON.stringify(data)}].`);

        try {
            const created = await participantAgg.createParticipant(data);
            res.send(created);
        } catch (err: any) {
            if (err instanceof ParticipantCreateValidationError) {
                res.status(400).json({
                    status: "error",
                    msg: `Validation failure: ${err.message}.`
                });
            } else if (err instanceof InvalidParticipantError) {
                res.status(500).json({
                    status: "error",
                    msg: `Unable to store participant. ${err.message}.`
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: "unknown error"
                });
            }
        }
    }

    private async endpointsByParticipantName(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        this._logger.debug(`Fetching Endpoints for Participant [${partName}].`);

        try {
            const fetched = await participantAgg.getParticipantEndpointsByName(partName);
            res.send(fetched);
        } catch (err : any) {
            if (err instanceof ParticipantNotFoundError || err instanceof NoEndpointsError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async accountsByParticipantName(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        this._logger.debug(`Fetching Accounts for Participant [${partName}].`);

        try {
            const fetched = await participantAgg.getParticipantAccountsByName(partName);
            res.send(fetched);
        } catch (err : any) {
            if (err instanceof ParticipantNotFoundError || err instanceof NoAccountsError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async participantEndpointCreate(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        const data: ParticipantEndpoint = req.body;
        this._logger.debug(`Creating Participant Endpoint [${JSON.stringify(data)}] for [${partName}].`);

        try {
            const participant = await participantAgg.getParticipantByName(partName);
            const created = await participantAgg.addParticipantEndpoint(participant, data);
            res.send(created);
        } catch (err: any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async participantAccountCreate(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        const data: ParticipantAccount = req.body;
        this._logger.debug(`Creating Participant Account [${JSON.stringify(data)}] for [${partName}].`);

        try {
            const participant = await participantAgg.getParticipantByName(partName);
            const created = await participantAgg.addParticipantAccount(participant, data);
            res.send(created);
        } catch (err: any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async participantApprove(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        const data: ParticipantApproval = req.body;
        this._logger.debug(`Approving Participant [${JSON.stringify(data)}] for [${partName}].`);

        try {
            const participant = await participantAgg.getParticipantByName(partName);
            const approved = await participantAgg.approveParticipant(
                participant,
                data.checker,
                data.feedback
            );
            res.send(approved);
        } catch (err: any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async deActivateParticipant(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        const data: ParticipantApproval = req.body;
        this._logger.debug(`Disable Participant [${JSON.stringify(data)}] for [${partName}].`);

        try {
            const participant = await participantAgg.getParticipantByName(partName);
            if (!participant.isActive) {
                res.send(participant);
                return;
            }
            const disabled = await participantAgg.deActivateParticipant(participant);
            res.send(disabled);
        } catch (err: any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async participantEndpointDelete(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        const data: ParticipantEndpoint = req.body;
        this._logger.debug(`Removing Participant Endpoint [${JSON.stringify(data)}] for [${partName}].`);

        try {
            const participant = await participantAgg.getParticipantByName(partName);
            const removed = await participantAgg.removeParticipantEndpoint(participant, data);
            res.send(removed);
        } catch (err: any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }

    private async participantAccountDelete(req: express.Request, res: express.Response, next: express.NextFunction) {
        const partName = req.params["name"] ?? null;
        const data: ParticipantAccount = req.body;
        this._logger.debug(`Removing Participant Account [${JSON.stringify(data)}] for [${partName}].`);

        try {
            const participant = await participantAgg.getParticipantByName(partName);
            const removed = await participantAgg.removeParticipantAccount(participant, data);
            res.send(removed);
        } catch (err: any) {
            if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else {
                res.status(500).json({
                    status: "error",
                    msg: err.message
                });
            }
        }
    }
}
