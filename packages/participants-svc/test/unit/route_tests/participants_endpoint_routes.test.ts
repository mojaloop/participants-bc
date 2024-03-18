/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
**/

"use strict";

import express, {Express} from "express";
import { ExpressRoutes } from "../../../src/application/routes";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantAggregate } from "../../../src/domain/participant_agg";
import request from "supertest";

import {
    MemoryConfigClientMock,
    ParticipantsRepoMock,
    AccountsBalancesAdapterMock,
    AuditClientMock,
    AuthorizationClientMock,
    MemoryMessageProducer,
    TokenHelperMock,
    mockedParticipant1
} from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { IParticipant, IParticipantEndpoint, ParticipantEndpointProtocols, ParticipantEndpointTypes } from "@mojaloop/participant-bc-public-types-lib";
import { Server } from "http";

const packageJSON = require("../../../package.json");


const APP_VERSION = packageJSON.version;
const SVC_DEFAULT_HTTP_PORT = 3010;
const AUTH_TOKEN = "bearer: MOCKTOKEN";

const authTokenUrl = "mocked_auth_url";
const hasPrivilege = true;

const participantSvcUrl = process.env["PARTICIPANTS_SVC_URL"] || `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

// Create necessary mocks
const logger: ILogger = new ConsoleLogger();
const configClientMock = new MemoryConfigClientMock(logger, authTokenUrl);
const repoPartMock = new ParticipantsRepoMock();
const accAndBalAdapterMock = new AccountsBalancesAdapterMock();
const auditClientMock = new AuditClientMock(logger);
const authZClientMock = new AuthorizationClientMock(logger, hasPrivilege);
const msgProducerMock = new MemoryMessageProducer(logger);
const metricsMock = new MetricsMock();
const tokenHelperMock = new TokenHelperMock(logger);


describe("Participants Endpoints' Routes - Unit Test", () => {
    let app: Express;
    let expressServer: Server;
    let participantAgg;

    beforeAll(async () => {
        app = express();
        app.use(express.json()); // for parsing application/json
        app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

        //Create mock anb accounts
        await accAndBalAdapterMock.createAccount("1","1234","POSITION","USD");
        await accAndBalAdapterMock.createAccount("2","1234", "SETTLEMENT","USD");

        participantAgg = new ParticipantAggregate(
            configClientMock,
            repoPartMock,
            accAndBalAdapterMock,
            auditClientMock,
            authZClientMock,
            msgProducerMock,
            metricsMock,
            logger,
        );

        await participantAgg.init();

        const expressRoutes = new ExpressRoutes(participantAgg, tokenHelperMock, logger);
        app.use("/", expressRoutes.MainRouter);

        let portNum = SVC_DEFAULT_HTTP_PORT;
        if (process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
            portNum = parseInt(process.env["SVC_HTTP_PORT"]);
        }

        return new Promise<void>(resolve => {
            expressServer = app.listen(portNum, () => {
                logger.info(`🚀 Server ready at port: ${portNum}`);
                logger.info(`Participants service v: ${APP_VERSION} started`);
                resolve();
            });
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        jest.clearAllMocks();

        if (expressServer){
            await new Promise((resolve) => {
                expressServer.close(() => {
                    resolve(true);
                });
            });
        }
    });

    //**Participant's Endpoint */
    it("POST /participants/:id/endpoints - Should add an endpoint to the participant", async () => {
        // Arrange
        const newParticipant:IParticipant = {
            ...mockedParticipant1,
            id: "newParticipant",
            participantEndpoints: []
        };

        const newEndPoint: IParticipantEndpoint = {
            id: "2",
            type: ParticipantEndpointTypes.FSPIOP,
            protocol: ParticipantEndpointProtocols["HTTPs/REST"],
            value: "https://someendpoint.com"
        }
        repoPartMock.store(newParticipant);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${newParticipant.id}/endpoints`)
            .send(newEndPoint)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
    });

    it("GET /participants/:id/endpoints - Should return an array of participant endpoints", async () => {
        // Arrange
       
        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${mockedParticipant1.id}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
    });

    it("GET /participants/:id/endpoints -Should handle unauthorized error", async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("GET /participants/:id/endpoints - Should return 404 if the participant is not found", async () => {
        // Arrange
        const nonExistingParticipant= "none";

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${nonExistingParticipant}/endpoints`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(404);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should update a participant endpoints and return status to be 200", async () => {
        // Arrange

        const participant:IParticipant = {
            ...mockedParticipant1
        }
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'http://56.45.45.162:4041'
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${participant.id}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(200);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 404 if participantId is null or empty", async () => {
        // Arrange
        const emptyParticipantId = "";
        const nullParticipantId = null;
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'http://56.45.45.162:4041'
        }

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        const response2 = await request(participantSvcUrl)
        .put(`/participants/${nullParticipantId}/endpoints/${endpointId}`)
        .set("authorization", AUTH_TOKEN)
        .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(404);
        expect(response2.status).toBe(404);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if participantId is hub participantId", async () => {
        // Arrange
        const emptyParticipantId = "hub";
        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'https://56.45.45.162:4041'
        }

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if the participant is not active", async () => {
        // Arrange
       
        const inActiveParticipant: IParticipant= {
            ...mockedParticipant1, 
            isActive: false
        }

        const endpointId = mockedParticipant1.participantEndpoints[0].id;
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            ...mockedParticipant1.participantEndpoints[0],
            value: 'https://56.45.45.162:4041'
        }

        repoPartMock.store(inActiveParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${inActiveParticipant.id}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 500 if endpointId not found in participantEndpoints", async () => {
        // Arrange
        const emptyParticipantId = mockedParticipant1.id;
        const endpointId = "4";//Non existing endpoint
        const modifiedParticipantEndpointData: IParticipantEndpoint = {
            id: "4",
            type: ParticipantEndpointTypes.FSPIOP,
            protocol: ParticipantEndpointProtocols["HTTPs/REST"],
            value: 'http://56.45.45.162:4041'
        }

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(participantSvcUrl)
            .put(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)
            .send(modifiedParticipantEndpointData);

        // Assert
        expect(response.status).toBe(500);
    });

    it("DELETE /participants/:id/endpoints/:endpointId - Should remove a participant endpoint", async () => {
        // Arrange
        const mockedParticipant:IParticipant = {
            ...mockedParticipant1,
            id: "mockedParticipant",
            isActive: true,
            participantEndpoints: [
                {
                    id: "1",
                    type: ParticipantEndpointTypes.FSPIOP,
                    protocol: ParticipantEndpointProtocols["HTTPs/REST"],
                    value: "https://someendpoint.com"
                }
            ]
        };
        
        repoPartMock.store(mockedParticipant);

        // Act
        const response = await request(participantSvcUrl)
            .delete(`/participants/mockedParticipant/endpoints/1`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(200);
    });

    it("PUT /participants/:id/endpoints/:endpointId - Should return status 404 on empty participantId", async () => {
        // Arrange
        const emptyParticipantId = "5";
        const endpointId = "1";

        repoPartMock.store(mockedParticipant1);

        // Act
        const response = await request(participantSvcUrl)
            .delete(`/participants/${emptyParticipantId}/endpoints/${endpointId}`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(404);
    });


});