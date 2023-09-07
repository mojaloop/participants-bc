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
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {
    IParticipant,
    IParticipantAccount,
    IParticipantAccountChangeRequest,
    IParticipantEndpoint,
    IParticipantFundsMovement,
    IParticipantNetDebitCapChangeRequest,
} from "@mojaloop/participant-bc-public-types-lib";
import { ParticipantAggregate } from "../domain/participant_agg";

import {
    InvalidParticipantError,
    NoAccountsError,
    NoEndpointsError,
    ParticipantCreateValidationError,
    ParticipantNotActive,
    ParticipantNotFoundError,
} from "../domain/errors";
import { TokenHelper } from "@mojaloop/security-bc-client-lib";
import {
    TransferWouldExceedCreditsError,
    TransferWouldExceedDebitsError,
} from "../domain/iparticipant_account_balances_adapter";
import {
    ForbiddenError,
    MakerCheckerViolationError,
    UnauthorizedError,
    CallSecurityContext,
} from "@mojaloop/security-bc-public-types-lib";

// Extend express request to include our security fields
declare module "express-serve-static-core" {
    export interface Request {
        securityContext: null | CallSecurityContext;
    }
}

export class ExpressRoutes {
    private _logger: ILogger;
    private _tokenHelper: TokenHelper;
    private _participantsAgg: ParticipantAggregate;
    private _mainRouter = express.Router();

    constructor(
        participantsAgg: ParticipantAggregate,
        tokenHelper: TokenHelper,
        logger: ILogger
    ) {
        this._logger = logger.createChild("ExpressRoutes");
        this._tokenHelper = tokenHelper;
        this._participantsAgg = participantsAgg;

        // inject authentication - all request below this require a valid token
        this._mainRouter.use(this._authenticationMiddleware.bind(this));

        // example
        //        this._mainRouter.get("/", this.getExample.bind(this));

        // participant
        this._mainRouter.get("/participants", this._getAllParticipants.bind(this));
        this._mainRouter.get(
            "/participants/:ids/multi",
            this._getParticipantsByIds.bind(this)
        );
        this._mainRouter.get("/participants/:id", this._participantById.bind(this));
        this._mainRouter.post("/participants", this._participantCreate.bind(this));
        this._mainRouter.put("/participants/:id/approve", this._participantApprove.bind(this));
        this._mainRouter.put("/participants/:id/disable", this._deactivateParticipant.bind(this));
        this._mainRouter.put("/participants/:id/enable", this._activateParticipant.bind(this));

        // endpoint
        this._mainRouter.get("/participants/:id/endpoints", this._endpointsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/endpoints", this._participantEndpointCreate.bind(this));
        this._mainRouter.put("/participants/:id/endpoints/:endpointId", this._participantEndpointChange.bind(this));
        this._mainRouter.delete("/participants/:id/endpoints/:endpointId", this._participantEndpointDelete.bind(this));

        // account
        this._mainRouter.get("/participants/:id/accounts", this._accountsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/accountChangeRequest", this._participantAccountCreate.bind(this));
        this._mainRouter.post("/participants/:id/accountchangerequests/:changereqid/approve", this._participantAccountApprove.bind(this));
        // this._mainRouter.delete("/participants/:id/account", this.participantAccountDelete.bind(this));

        // funds management
        this._mainRouter.post("/participants/:id/funds", this._participantFundsMovCreate.bind(this));
        this._mainRouter.post(
            "/participants/:id/funds/:fundsMovId/approve",
            this._participantFundsMovApprove.bind(this)
        );

        // net debit cap management
        this._mainRouter.post("/participants/:id/ndcChangeRequests", this._participantNetDebitCapCreate.bind(this));
        this._mainRouter.post(
            "/participants/:id/ndcchangerequests/:ndcReqId/approve",
            this._participantNetDebitCapApprove.bind(this)
        );

    }

    private async _authenticationMiddleware(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        const authorizationHeader = req.headers["authorization"];

        if (!authorizationHeader) return res.sendStatus(401);

        const bearer = authorizationHeader.trim().split(" ");
        if (bearer.length != 2) {
            return res.sendStatus(401);
        }

        const bearerToken = bearer[1];
        let verified;
        try {
            verified = await this._tokenHelper.verifyToken(bearerToken);
        } catch (err) {
            this._logger.error(err, "unable to verify token");
            return res.sendStatus(401);
        }
        if (!verified) {
            return res.sendStatus(401);
        }

        const decoded = this._tokenHelper.decodeToken(bearerToken);
        if (!decoded.sub || decoded.sub.indexOf("::") == -1) {
            return res.sendStatus(401);
        }

        const subSplit = decoded.sub.split("::");
        const subjectType = subSplit[0];
        const subject = subSplit[1];

        req.securityContext = {
            accessToken: bearerToken,
            clientId: subjectType.toUpperCase().startsWith("APP") ? subject : null,
            username: subjectType.toUpperCase().startsWith("USER") ? subject : null,
            rolesIds: decoded.roles,
        };

        return next();
    }

    get MainRouter(): express.Router {
        return this._mainRouter;
    }

    private _handleUnauthorizedError(err: Error, res: express.Response): boolean {
        let handled = false;
        if (err instanceof UnauthorizedError) {
            this._logger.warn(err.message);
            res.status(401).json({
                status: "error",
                msg: err.message,
            });
            handled = true;
        } else if (err instanceof ForbiddenError) {
            this._logger.warn(err.message);
            res.status(403).json({
                status: "error",
                msg: err.message,
            });
            handled = true;
        } else if (err instanceof MakerCheckerViolationError) {
            this._logger.warn(err.message);
            res.status(403).json({
                status: "error",
                msg: err.message,
            });
            handled = true;
        } else if (err instanceof ParticipantNotFoundError) {
            res.status(404).json({
                status: "error",
                msg: "Participant not found.",
            });
            handled = true;
        }

        return handled;
    }

    private async _getAllParticipants(req: express.Request, res: express.Response): Promise<void> {
        const id = req.query.id as string;
        const name = req.query.name as string;
        const state = req.query.state as string;

        try {
            let fetched;

            if (id || name || state) {
                this._logger.info("Filtering participants");
                fetched = await this._participantsAgg.searchParticipants(
                    req.securityContext!,
                    id,
                    name,
                    state
                );
            } else {
                this._logger.debug("Fetching all participants");
                fetched = await this._participantsAgg.getAllParticipants(
                    req.securityContext!
                );
            }
            res.send(fetched);
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    private async _getParticipantsByIds(req: express.Request, res: express.Response): Promise<void> {
        const ids = req.params["ids"] ?? null;
        const idSplit: string[] = ids == null ? [] : ids.split(",");
        this._logger.debug(`Fetching Participant [${ids}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantsByIds(
                req.securityContext!,
                idSplit
            );
            res.send(fetched);
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    private async _participantById(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        this._logger.debug(`Fetching Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantById(
                req.securityContext!,
                id
            );
            res.send(fetched);
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    private async _participantCreate(req: express.Request, res: express.Response): Promise<void> {
        const data: IParticipant = req.body;
        this._logger.debug(`Creating Participant [${JSON.stringify(data)}].`);

        try {
            const createdId = await this._participantsAgg.createParticipant(
                req.securityContext!,
                data
            );
            this._logger.debug(`Created Participant with ID: ${createdId}.`);
            res.send({
                id: createdId,
            });
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantCreateValidationError) {
                res.status(400).json({
                    status: "error",
                    msg: `Validation failure: ${err.message}.`,
                });
            } else if (err instanceof InvalidParticipantError) {
                res.status(500).json({
                    status: "error",
                    msg: `Unable to store participant. ${err.message}.`,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const actionNote: string | null = req.body?.note || null;
        this._logger.debug(
            `Received request to approve Participant with ID: ${id}.`
        );

        try {
            await this._participantsAgg.approveParticipant(
                req.securityContext!,
                id,
                actionNote
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    private async _deactivateParticipant(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const actionNote: string | null = req.body?.note || null;
        this._logger.debug(
            `Received request to deActivateParticipant Participant with ID: ${id}.`
        );

        try {
            await this._participantsAgg.deactivateParticipant(
                req.securityContext!,
                id,
                actionNote
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    private async _activateParticipant(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const actionNote: string | null = req.body?.note || null;
        this._logger.debug(
            `Received request to activateParticipant Participant with ID: ${id}.`
        );

        try {
            await this._participantsAgg.activateParticipant(
                req.securityContext!,
                id,
                actionNote
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    /*
     * Accounts
     * */

    private async _accountsByParticipantId(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        this._logger.debug(`Fetching Accounts for Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantAccountsById(
                req.securityContext!,
                id
            );
            res.send(fetched);
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof NoAccountsError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantAccountCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const data: IParticipantAccountChangeRequest = req.body;
        this._logger.debug(
            `Received request to create participant account for participant with ID: ${id}.`
        );

        try {
            const createdId = await this._participantsAgg.createParticipantAccount(
                req.securityContext!,
                id,
                data
            );
            res.send({
                id: createdId,
            });
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(451).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantAccountApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const accountChangeRequestId = req.params["changereqid"] ?? null;

        this._logger.debug(
            `Received request to approve account change request for participant with ID: ${id} and accountChangeRequestId: ${accountChangeRequestId}`
        );

        try {
            await this._participantsAgg.approveParticipantAccount(
                req.securityContext!,
                id,
                accountChangeRequestId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(451).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    /* private async participantAccountDelete(req: express.Request, res: express.Response, next: express.NextFunction) {
         const id = req.params["id"] ?? null;
         const data: ParticipantAccount = req.body.source;
         this._logger.debug(`Removing Participant Account [${JSON.stringify(data)}] for [${id}].`);

         try {
             await this._participantsAgg.removeParticipantAccount(req.securityContext!, id, data);
             res.send();
         } catch (err: any) {
            if(this._handleUnauthorizedError(err, res)) return;

             this._logger.error(err);
             res.status(500).json({
                 status: "error",
                 msg: err.message
             });
         }
     }*/

    /*
     * Endpoints
     * */

    private async _endpointsByParticipantId(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;

        this._logger.debug(`Fetching Endpoints for Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantEndpointsById(
                req.securityContext!,
                id
            );
            res.send(fetched);
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof NoEndpointsError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantEndpointCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const data: IParticipantEndpoint = req.body;
        this._logger.debug(
            `Creating Participant Endpoint [${JSON.stringify(data)}] for [${id}].`
        );

        try {
            const endpointId = await this._participantsAgg.addParticipantEndpoint(
                req.securityContext!,
                id,
                data
            );
            res.send({
                id: endpointId,
            });
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    private async _participantEndpointChange(req: express.Request, res: express.Response): Promise<void> {
        const participantId = req.params["id"] ?? null;
        const endpointId = req.params["endpointId"] ?? null;
        const data: IParticipantEndpoint = req.body;

        if (endpointId !== data.id) {
            res.status(400).json({
                status: "error",
                msg: "endpoint id in url and object don't match",
            });
            return;
        }

        this._logger.debug(
            `Changing endpoints for Participant [${participantId}].`
        );

        try {
            await this._participantsAgg.changeParticipantEndpoint(
                req.securityContext!,
                participantId,
                data
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof NoEndpointsError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantEndpointDelete(req: express.Request, res: express.Response): Promise<void> {
        const participantId = req.params["id"] ?? null;
        const endpointId = req.params["endpointId"] ?? null;

        this._logger.debug(
            `Removing Participant Endpoint id: ${endpointId} from participant with ID: ${participantId}.`
        );

        try {
            await this._participantsAgg.removeParticipantEndpoint(
                req.securityContext!,
                participantId,
                endpointId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: err.message,
            });
        }
    }

    /*
     * Funds management
     * */

    private async _participantFundsMovCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const fundsMov: IParticipantFundsMovement = req.body;

        this._logger.debug(
            `Received request to create a funds movement for participant with ID: ${id}`
        );

        try {
            const createdId = await this._participantsAgg.createFundsMovement(
                req.securityContext!,
                id,
                fundsMov
            );
            res.send({
                id: createdId,
            });
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(451).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantFundsMovApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const fundsMovId = req.params["fundsMovId"] ?? null;

        this._logger.debug(
            `Received request to approve a funds movement for participant with ID: ${id} and fundsMovId: ${fundsMovId}`
        );

        try {
            await this._participantsAgg.approveFundsMovement(
                req.securityContext!,
                id,
                fundsMovId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(451).json({
                    status: "error",
                    msg: err.message,
                });
            } else if (err instanceof TransferWouldExceedCreditsError) {
                res.status(400).json({
                    status: "error",
                    msg: "Transfer would exceed credits on account",
                });
            } else if (err instanceof TransferWouldExceedDebitsError) {
                res.status(400).json({
                    status: "error",
                    msg: "Transfer would exceed debits on account",
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantNetDebitCapCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const netDebitCapChangeRequest: IParticipantNetDebitCapChangeRequest = req.body;

        this._logger.debug(
            `Received request to create an NDC for participant with ID: ${id}`
        );

        try {
            const createdId = await this._participantsAgg.createParticipantNetDebitCap(
                req.securityContext!,
                id,
                netDebitCapChangeRequest
            );
            res.send({
                id: createdId,
            });
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(451).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }

    private async _participantNetDebitCapApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const ndcReqId = req.params["ndcReqId"] ?? null;

        this._logger.debug(
            `Received request to approve an NDC change request for participant with ID: ${id} and ndcReqId: ${ndcReqId}`
        );

        try {
            await this._participantsAgg.approveParticipantNetDebitCap(
                req.securityContext!,
                id,
                ndcReqId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(451).json({
                    status: "error",
                    msg: err.message,
                });
            } else {
                this._logger.error(err);
                res.status(500).json({
                    status: "error",
                    msg: err.message,
                });
            }
        }
    }
}
