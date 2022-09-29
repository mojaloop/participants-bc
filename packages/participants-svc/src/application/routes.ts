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

import {
    InvalidParticipantError, NoAccountsError, NoEndpointsError, ParticipantCreateValidationError, ParticipantNotActive,
    ParticipantNotFoundError, UnauthorizedError
} from "../domain/errors";
import {CallSecurityContext, TokenHelper} from "@mojaloop/security-bc-client-lib";

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

    constructor(participantsAgg: ParticipantAggregate, tokenHelper: TokenHelper, logger: ILogger) {
        this._logger = logger;
        this._tokenHelper = tokenHelper;
        this._participantsAgg = participantsAgg;

        // inject authentication - all request below this require a valid token
        this._mainRouter.use(this._authenticationMiddleware.bind(this));

        // example
        this._mainRouter.get("/", this.getExample.bind(this));

        // participant
        this._mainRouter.get("/participants", this.getAllParticipants.bind(this));
        this._mainRouter.get("/participants/:ids/multi", this.getParticipantsByIds.bind(this));
        this._mainRouter.get("/participants/:id", this.participantById.bind(this));
        this._mainRouter.post("/participants", this.participantCreate.bind(this));
        this._mainRouter.put("/participants/:id/approve", this.participantApprove.bind(this));
        this._mainRouter.put("/participants/:id/disable", this.deActivateParticipant.bind(this));
        this._mainRouter.put("/participants/:id/enable", this.activateParticipant.bind(this));

        // endpoint
        this._mainRouter.get("/participants/:id/endpoints", this.endpointsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/endpoint", this.participantEndpointCreate.bind(this));
        this._mainRouter.delete("/participants/:id/endpoint", this.participantEndpointDelete.bind(this));

        // account
        this._mainRouter.get("/participants/:id/accounts", this.accountsByParticipantId.bind(this));
        this._mainRouter.post("/participants/:id/account", this.participantAccountCreate.bind(this));
        this._mainRouter.delete("/participants/:id/account", this.participantAccountDelete.bind(this));
    }

    private async _authenticationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
        const authorizationHeader = req.headers["authorization"];

        if (!authorizationHeader)
            return res.sendStatus(403);

        const bearer = authorizationHeader.trim().split(" ");
        if (bearer.length!=2) {
            return res.sendStatus(403);
        }

        const bearerToken = bearer[1];
        let verified;
        try{
            verified = await this._tokenHelper.verifyToken(bearerToken);
        }catch(err){
            this._logger.error(err,"unable to verify token");
            return res.sendStatus(403);
        }
        if (!verified) {
            return res.sendStatus(403);
        }

        const decoded = this._tokenHelper.decodeToken(bearerToken);
        if (!decoded.sub || decoded.sub.indexOf("::")== -1) {
            return res.sendStatus(403);
        }

        const subSplit = decoded.sub.split("::");
        const subjectType = subSplit[0];
        const subject = subSplit[1];

        req.securityContext = {
            accessToken: bearerToken,
            clientId: subjectType.toUpperCase().startsWith("APP") ? subject:null,
            username: subjectType.toUpperCase().startsWith("USER") ? subject:null,
            rolesIds: decoded.roles
        };

        return next();
    }

    get MainRouter(): express.Router {
        return this._mainRouter;
    }

    private async getExample(req: express.Request, res: express.Response, next: express.NextFunction) {
        return res.send({resp: "example worked"});
    }

    private async getAllParticipants(req: express.Request, res: express.Response, next: express.NextFunction) {
        this._logger.debug("Fetching all participants");

        try {
            const fetched = await this._participantsAgg.getAllParticipants(req.securityContext!);
            res.send(fetched);
        } catch (err: any) {
            this._logger.error(`Err All Participants [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: "No participants found."
                });
            }
        }
    }

    private async getParticipantsByIds(req: express.Request, res: express.Response, next: express.NextFunction) {
        const ids = req.params["ids"] ?? null;
        const idSplit : string[] = (ids == null) ? [] : ids.split(',')
        this._logger.debug(`Fetching Participant [${ids}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantsByIds(req.securityContext!, idSplit);
            res.send(fetched);
        } catch (err: any) {
            this._logger.error(`Err Participants By Ids [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: "No participants found."
                });
            }
        }
    }

    private async participantById(req: express.Request, res: express.Response, next: express.NextFunction) {
        const id = req.params["id"] ?? null;
        this._logger.debug(`Fetching Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantById(req.securityContext!, id);
            res.send(fetched);
        } catch (err: any) {
            this._logger.error(`Err Participant By Id [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: `No participant with id ${id}.`
                });
            }
        }
    }

    private async participantCreate(req: express.Request, res: express.Response, next: express.NextFunction) {
        const data: Participant = req.body;
        this._logger.debug(`Creating Participant [${JSON.stringify(data)}].`);

        try {
            const created = await this._participantsAgg.createParticipant(req.securityContext!, data);
            this._logger.debug(`Created Participant [${JSON.stringify(created)}].`);
            res.send(created);
        } catch (err: any) {
            this._logger.error(`Err Participant Create [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantCreateValidationError) {
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

    private async endpointsByParticipantId(req: express.Request, res: express.Response, next: express.NextFunction) {
        const id = req.params["id"] ?? null;

        this._logger.debug(`Fetching Endpoints for Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantEndpointsById(req.securityContext!, id);
            res.send(fetched);
        } catch (err: any) {
            this._logger.error(`Err Get Participant Endpoints [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError || err instanceof NoEndpointsError) {
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

    private async accountsByParticipantId(req: express.Request, res: express.Response, next: express.NextFunction) {
        const id = req.params["id"] ?? null;
        this._logger.debug(`Fetching Accounts for Participant [${id}].`);

        try {
            const fetched = await this._participantsAgg.getParticipantAccountsById(req.securityContext!, id);
            res.send(fetched);
        } catch (err: any) {
            this._logger.error(`Err Get Participant Accounts by Id [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError || err instanceof NoAccountsError) {
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
        const id = req.params["id"] ?? null;
        const data: ParticipantEndpoint = req.body;
        this._logger.debug(`Creating Participant Endpoint [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.addParticipantEndpoint(req.securityContext!, id, data);
            res.send();
        } catch (err: any) {
            this._logger.error(`Err Create Participant Endpoint [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
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
        const id = req.params["id"] ?? null;
        const data: ParticipantAccount = req.body;
        this._logger.debug(`Creating Participant Account [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.addParticipantAccount(req.securityContext!, id, data);
            res.send();
        } catch (err: any) {
            this._logger.error(`Err Add Participant Account [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
                res.status(404).json({
                    status: "error",
                    msg: err.message
                });
            } else if (err instanceof ParticipantNotActive) {
                res.status(451).json({
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
        const id = req.params["id"] ?? null;
        const data: ParticipantApproval = req.body;
        this._logger.debug(`Approving Participant [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.approveParticipant(
                    req.securityContext!,
                    id,
                    data.checker,
                    data.feedback
            );
            res.send();
        } catch (err: any) {
            this._logger.error(`Err Approve Participant [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
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
        const id = req.params["id"] ?? null;
        const data: ParticipantApproval = req.body;
        this._logger.debug(`Disable Participant [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.deActivateParticipant(req.securityContext!, id);
            res.send();
        } catch (err: any) {
            this._logger.error(`Err De-Activate Participant [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
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

    private async activateParticipant(req: express.Request, res: express.Response, next: express.NextFunction) {
        const id = req.params["id"] ?? null;
        const data: ParticipantApproval = req.body;
        this._logger.debug(`Enable Participant [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.activateParticipant(req.securityContext!, id);
            res.send();
        } catch (err: any) {
            this._logger.error(`Err Activate Participant [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
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
        const id = req.params["id"] ?? null;
        const data: ParticipantEndpoint = req.body.source;
        this._logger.debug(`Removing Participant Endpoint [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.removeParticipantEndpoint(req.securityContext!, id, data);
            res.send();
        } catch (err: any) {
            this._logger.error(`Err Remove Participant Endpoint [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
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
        const id = req.params["id"] ?? null;
        const data: ParticipantAccount = req.body.source;
        this._logger.debug(`Removing Participant Account [${JSON.stringify(data)}] for [${id}].`);

        try {
            await this._participantsAgg.removeParticipantAccount(req.securityContext!, id, data);
            res.send();
        } catch (err: any) {
            this._logger.error(`Err Remove Participant Account [${JSON.stringify(err)}].`);
            if (err instanceof UnauthorizedError) {
                res.status(403).json({
                    status: "error",
                    msg: "Unauthorized"
                });
            } else if (err instanceof ParticipantNotFoundError) {
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
