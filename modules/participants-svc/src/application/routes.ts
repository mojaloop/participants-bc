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
import {Participant} from "@mojaloop/participant-bc-public-types-lib";
import {ParticipantAggregate} from "../domain/participant_agg";
import {ConsoleLogger} from "../logger_console";
import {IParticipantsRepository} from "../domain/iparticipant_repo";
import {MongoDBParticipantsRepo} from "../infrastructure/mongodb_participants_repo";

import {
    InvalidParticipantError, ParticipantCreateValidationError,
    ParticipantNotFoundError
} from "../domain/errors";

const logger: ILogger = new ConsoleLogger();
//TODO need to fetch properties with config bc.
const repo: IParticipantsRepository = new MongoDBParticipantsRepo("mongodb://root:example@localhost:27017/", logger);

const configSetAgg: ParticipantAggregate = new ParticipantAggregate(repo, logger);

export class ExpressRoutes {
    private _logger:ILogger;

    private _mainRouter = express.Router();

    constructor(logger: ILogger) {
        this._logger = logger;

        // main
        this._mainRouter.get("/", this.getExample.bind(this));
        this._mainRouter.get("/participant/:name", this.participantByName.bind(this));
        this._mainRouter.post("/create_participant", this.participantCreate.bind(this));
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
            const fetched = await configSetAgg.getParticipantByName(partName);
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
            const created = await configSetAgg.createParticipant(data);
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
}
