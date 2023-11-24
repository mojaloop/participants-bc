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
    IParticipantContactInfoChangeRequest,
    IParticipantEndpoint,
    IParticipantFundsMovement,
    IParticipantNetDebitCapChangeRequest,
    IParticipantSourceIpChangeRequest,
    IParticipantStatusChangeRequest,
    IParticipantLiquidityBalanceAdjustment,
    IParticipantPendingApproval
} from "@mojaloop/participant-bc-public-types-lib";
import { ParticipantAggregate } from "../domain/participant_agg";

import {
    InvalidParticipantError,
    NoAccountsError,
    NoEndpointsError,
    ParticipantCreateValidationError,
    ParticipantNotActive,
    ParticipantNotFoundError,
    WithdrawalExceedsBalanceError,
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
    ITokenHelper,
} from "@mojaloop/security-bc-public-types-lib";
import { ParticipantSearchResults } from "../domain/server_types";
import multer from "multer";
import ExcelJS from "exceljs";

// Extend express request to include our security fields
declare module "express-serve-static-core" {
    export interface Request {
        securityContext: null | CallSecurityContext;
    }
}

export class ExpressRoutes {
    private _logger: ILogger;
    private _tokenHelper: ITokenHelper;
    private _participantsAgg: ParticipantAggregate;
    private _mainRouter = express.Router();

    constructor(
        participantsAgg: ParticipantAggregate,
        tokenHelper: ITokenHelper,
        logger: ILogger
    ) {
        this._logger = logger.createChild("ExpressRoutes");
        this._tokenHelper = tokenHelper;
        this._participantsAgg = participantsAgg;

        const storage = multer.memoryStorage();
        const uploadfile = multer({ storage: storage });

        // inject authentication - all request below this require a valid token
        this._mainRouter.use(this._authenticationMiddleware.bind(this));

        
        // participant's bulk approval
        this._mainRouter.get("/participants/pendingApprovalsSummary", this._participantPendingApprovalSummary.bind(this));
        this._mainRouter.get("/participants/pendingApprovals", this._participantPendingApprovals.bind(this));
        this._mainRouter.post("/participants/pendingApprovals", this._participantApprovePendingApprovals.bind(this));

        
        // participant
        this._mainRouter.get("/participants", this._getAllParticipants.bind(this));
        this._mainRouter.get(
            "/participants/:ids/multi",
            this._getParticipantsByIds.bind(this)
        );
        this._mainRouter.get("/participants/:id", this._participantById.bind(this));
        this._mainRouter.post("/participants", this._participantCreate.bind(this));
        this._mainRouter.put("/participants/:id/approve", this._participantApprove.bind(this));

        // endpoint
        this._mainRouter.get("/participants/:id/endpoints", this._endpointsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/endpoints", this._participantEndpointCreate.bind(this));
        this._mainRouter.put("/participants/:id/endpoints/:endpointId", this._participantEndpointChange.bind(this));
        this._mainRouter.delete("/participants/:id/endpoints/:endpointId", this._participantEndpointDelete.bind(this));

        // account
        this._mainRouter.get("/participants/:id/accounts", this._accountsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/accountChangeRequest", this._participantAccountCreateChangeRequest.bind(this));
        this._mainRouter.post("/participants/:id/accountchangerequests/:changereqid/approve", this._participantAccountApproveChangeRequest.bind(this));
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

        // particpant's sourceIPs
        this._mainRouter.get("/participants/:id/sourceIps", this._sourceIpsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/sourceIpChangeRequests", this._participantSourceIpChangeRequestCreate.bind(this));
        this._mainRouter.post("/participants/:id/SourceIpChangeRequests/:changereqid/approve", this._participantSourceIpChangeRequestApprove.bind(this));

        // participant's contactInfo
        this._mainRouter.get("/participants/:id/contactInfo", this._contactInfoByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/contactInfoChangeRequests", this._participantContactInfoChangeRequestCreate.bind(this));
        this._mainRouter.post("/participants/:id/contactInfoChangeRequests/:changereqid/approve", this._participantContactInfoChangeRequestApprove.bind(this));

        // participant's status (isActive)
        this._mainRouter.post("/participants/:id/statusChangeRequests", this._participantStatusChangeRequestCreate.bind(this));
        this._mainRouter.post("/participants/:id/statusChangeRequests/:changereqid/approve", this._participantStatusChangeRequestApprove.bind(this));

        this._mainRouter.get("/searchKeywords/", this._getSearchKeywords.bind(this));

        // liquidity balance adjust file import
        this._mainRouter.post("/participants/liquidityCheckValidate", uploadfile.single("settlementInitiation"), this._participantLiquidityCheckValidate.bind(this));
        this._mainRouter.post("/participants/liquidityCheckRequestAdjustment", this._participantLiquidityCheckRequestAdjustment.bind(this));

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
        const callSecCtx:  CallSecurityContext | null = await this._tokenHelper.getCallSecurityContextFromAccessToken(bearerToken);

        if(!callSecCtx){
            return res.sendStatus(401);
        }

        req.securityContext = callSecCtx;
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
        try {
            const id = req.query.id as string || null;
            const name = req.query.name as string || null;
            const state = req.query.state as string || null;


            // optional pagination
            const pageIndexStr = req.query.pageIndex as string || req.query.pageindex as string;
            const pageIndex = pageIndexStr ? parseInt(pageIndexStr) : undefined;

            const pageSizeStr = req.query.pageSize as string || req.query.pagesize as string;
            const pageSize = pageSizeStr ? parseInt(pageSizeStr) : undefined;

            this._logger.debug("Fetching all participants");

            const fetched:ParticipantSearchResults = await this._participantsAgg.searchParticipants(
                req.securityContext!,
                id,
                name,
                state,
                pageIndex,
                pageSize
            );

            res.send(fetched);
        } catch (err: unknown) {
            if (this._handleUnauthorizedError((err as Error), res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: (err as Error).message,
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
     * Contact Info
     * */

    private async _contactInfoByParticipantId(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        this._logger.debug(`Fetching contacts for Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getContactInfoByParticipantId(
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

    private async _participantContactInfoChangeRequestCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const data: IParticipantContactInfoChangeRequest = req.body;
        this._logger.debug(
            `Received request to create contact information for participant with ID: ${id}.`
        );

        try {
            const createdId = await this._participantsAgg.createParticipantContactInfoChangeRequest(
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
                res.status(422).json({
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

    private async _participantContactInfoChangeRequestApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const changeRequestId = req.params["changereqid"] ?? null;

        this._logger.debug(
            `Received request to approve contact info change request for participant with ID: ${id} and changeRequestId: ${changeRequestId}`
        );

        try {
            await this._participantsAgg.approveParticipantContactInfoChangeRequest(
                req.securityContext!,
                id,
                changeRequestId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(422).json({
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

    /*
     * Participant Status
     * */

    private async _participantStatusChangeRequestCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const data: IParticipantStatusChangeRequest = req.body;
        this._logger.debug(
            `Received request to update the status of participant with ID: ${id}.`
        );

        try {
            const createdId = await this._participantsAgg.createParticipantStatusChangeRequest(
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
                res.status(422).json({
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

    private async _participantStatusChangeRequestApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const changeRequestId = req.params["changereqid"] ?? null;
        this._logger.debug(
            `Received request to approve sourceIP change request for participant with ID: ${id} and changeRequestId: ${changeRequestId}`
        );

        try {
            await this._participantsAgg.approveParticipantStatusChangeRequest(
                req.securityContext!,
                id,
                changeRequestId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(422).json({
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

    /*
     * Allowed Source Ips
     * */

    private async _sourceIpsByParticipantId(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        this._logger.debug(`Fetching allowed sourceIps for Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getAllowedSourceIpsByParticipantId(
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

    private async _participantSourceIpChangeRequestCreate(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const data: IParticipantSourceIpChangeRequest = req.body;
        this._logger.debug(
            `Received request to create sourceIP record for participant with ID: ${id}.`
        );

        try {
            const createdId = await this._participantsAgg.createParticipantSourceIpChangeRequest(
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
                res.status(422).json({
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

    private async _participantSourceIpChangeRequestApprove(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const changeRequestId = req.params["changereqid"] ?? null;

        this._logger.debug(
            `Received request to approve sourceIP change request for participant with ID: ${id} and changeRequestId: ${changeRequestId}`
        );

        try {
            await this._participantsAgg.approveParticipantSourceIpChangeRequest(
                req.securityContext!,
                id,
                changeRequestId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(422).json({
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

    private async _participantAccountCreateChangeRequest(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const data: IParticipantAccountChangeRequest = req.body;
        this._logger.debug(
            `Received request to create participant account for participant with ID: ${id}.`
        );

        try {
            const createdId = await this._participantsAgg.createParticipantAccountChangeRequest(
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
                res.status(422).json({
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

    private async _participantAccountApproveChangeRequest(req: express.Request, res: express.Response): Promise<void> {
        const id = req.params["id"] ?? null;
        const accountChangeRequestId = req.params["changereqid"] ?? null;

        this._logger.debug(
            `Received request to approve account change request for participant with ID: ${id} and accountChangeRequestId: ${accountChangeRequestId}`
        );

        try {
            await this._participantsAgg.approveParticipantAccountChangeRequest(
                req.securityContext!,
                id,
                accountChangeRequestId
            );
            res.send();
        } catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            if (err instanceof ParticipantNotActive) {
                res.status(422).json({
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
                res.status(422).json({
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
                res.status(422).json({
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
            } else if (err instanceof WithdrawalExceedsBalanceError) {
                res.status(400).json({
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
                res.status(422).json({
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
                res.status(422).json({
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

    private async _participantLiquidityCheckValidate(req: express.Request, res: express.Response): Promise<void> {
		this._logger.debug(
            "Received request to validate liquidity adjustment."
        );

        try {
            if (!req.file) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }

            const excelBuffer = req.file.buffer;

            if(excelBuffer){
                await this._extractDataFromExcel(excelBuffer).then(async (data)=> {
                    const result = await this._participantsAgg.liquidityCheckValidate(req.securityContext!, data);
                    res.send(result);
                });
            }
		} catch (error: any) {
			this._logger.error(error);
			if (this._handleUnauthorizedError(error, res)) return;

            if (error instanceof ParticipantNotActive) {
                res.status(422).json({
                    status: "error",
                    msg: error.message,
                });
            } else {
                this._logger.error(error);
                res.status(500).json({
                    status: "error",
                    msg: error.message,
                });
            }
		}
	}

    //Function to read Excel file and extract data
    private async _extractDataFromExcel(buffer: Buffer): Promise<IParticipantLiquidityBalanceAdjustment[]> {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      // Assuming that the data is in the first worksheet
      const worksheet = workbook.worksheets[0];

      // Find the row index where Settlement ID is located
      let rowIndex = 1;
      while (rowIndex <= worksheet.rowCount && worksheet.getCell(rowIndex, 1).value !== "Settlement ID") {
        rowIndex++;
      }

      // If Settlement ID is found, extract data from subsequent rows
      if (rowIndex < worksheet.rowCount) {
        const settlementId = worksheet.getCell(rowIndex, 2).value as string;

        // Array to store extracted data
        const extractedData: IParticipantLiquidityBalanceAdjustment[] = [];

        // Iterate over rows starting from the row after Settlement ID
        for (let i = rowIndex + 5; i <= worksheet.rowCount; i++) {
          const rowData: IParticipantLiquidityBalanceAdjustment = {
            matrixId: settlementId,
            participantId: worksheet.getCell(i, 1).value as string,
            participantName: "",
            participantBankAccountInfo: worksheet.getCell(i, 2).value as string,
            bankBalance: worksheet.getCell(i, 3).value as string,
            settledTransferAmount: worksheet.getCell(i, 4).value as string,
            currencyCode: worksheet.getCell(i, 5).value as string,
            direction: null,
            updateAmount: "",
            settlementAccountId: "",
            isDuplicate: false,
          };

          extractedData.push(rowData);
        }

        return extractedData;
      } else {
        throw new Error("Settlement ID not found in the Excel file");
      }
    }

    private async _participantLiquidityCheckRequestAdjustment(req: express.Request, res: express.Response): Promise<void> {
        this._logger.debug(
            "Received request to check and create liquidity adjustment."
        );
        try {
            const ignoreDuplicate = (req.query.ignoreDuplicate !== undefined && (req.query.ignoreDuplicate as string).toUpperCase() === "TRUE");
            const liquidityBalanceAdjustments = req.body as IParticipantLiquidityBalanceAdjustment[];

            const result = await this._participantsAgg.createLiquidityCheckRequestAdjustment(
                req.securityContext!,
                liquidityBalanceAdjustments,
                ignoreDuplicate
            );
            res.send(result);
        } catch (error: any) {
			this._logger.error(error);
			if (this._handleUnauthorizedError(error, res)) return;

            if (error instanceof ParticipantNotActive) {
                res.status(422).json({
                    status: "error",
                    msg: error.message,
                });
            } else {
                this._logger.error(error);
                res.status(500).json({
                    status: "error",
                    msg: error.message,
                });
            }
		}
	}

    private async _getSearchKeywords(req: express.Request, res: express.Response){
        try{
            const ret = await this._participantsAgg.getSearchKeywords(
                req.securityContext!
            );
            res.send(ret);
        }   catch (err: any) {
            if (this._handleUnauthorizedError(err, res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: (err as Error).message,
            });
        }
    }

    private async _participantPendingApprovalSummary(req: express.Request, res: express.Response): Promise<void> {
        try {
            this._logger.debug("Fetching pending approval summary");

            const result = await this._participantsAgg.getPendingApprovalSummary(
                req.securityContext!
            );

            res.send(result);
        } catch (err: unknown) {
            if (this._handleUnauthorizedError((err as Error), res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: (err as Error).message,
            });
        }
    }

    private async _participantPendingApprovals(req: express.Request, res: express.Response): Promise<void> {
        try {

            this._logger.debug("Fetching all pending approvals");

            const pendingApprovals = await this._participantsAgg.getAllPendingApprovals(
                req.securityContext!
            );

            res.send(pendingApprovals);
        } catch (err: unknown) {
            if (this._handleUnauthorizedError((err as Error), res)) return;

            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: (err as Error).message,
            });
        }
    }

    private async _participantApprovePendingApprovals(req: express.Request, res: express.Response): Promise<void> {
        try {
            this._logger.debug("Bulk approve pending approvals");

            const pendingApprovals: IParticipantPendingApproval = req.body;
            const result = await this._participantsAgg.approveBulkPendingApprovalRequests(req.securityContext!, pendingApprovals);

            res.send(result);
        } catch (err: unknown) {
            if (this._handleUnauthorizedError((err as Error), res)) return;
            this._logger.error(err);
            res.status(500).json({
                status: "error",
                msg: (err as Error).message,
            });
        }
    }

}
