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
import { ApprovalRequestState, HUB_PARTICIPANT_ID, IParticipant, IParticipantContactInfoChangeRequest } from "@mojaloop/participant-bc-public-types-lib";
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


describe("Participants Contact Info Routes - Unit Test", () => {
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

    /**Contact Info */

    it("GET /participants/:id/contactInfo - Should return an array of participant contact info", async () => {
        // Arrange
        repoPartMock.store(mockedParticipant1);
        
        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${mockedParticipant1.id}/contactInfo`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
    
    it("GET /participants/:id/contactInfo - Should handle unauthorize error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        const participantId = mockedParticipant1.id;

        // Act
        const response = await request(participantSvcUrl)
            .get(`/participants/${participantId}/contactInfo`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should create a participant contact info", async () => {
        // Arrange
        const now = Date.now();
        const participant = mockedParticipant1;
        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should handle unauthorized error", async () => {
        // Arrange
        const now = Date.now();
        const participantId = mockedParticipant1.id;
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participantId}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should return status 422 when the participant is not active", async () => {
        // Arrange
        const inactiveParticipant = {
            ...mockedParticipant1,
            id: "10",
            isActive: false
        };

        repoPartMock.store(inactiveParticipant);

        const now = Date.now();

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${inactiveParticipant.id}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(422);
    });

    it("POST /participants/:id/contactInfoChangeRequests - Should return error if the participant is hub participantId", async () => {
        // Arrange
        const now = Date.now();

        const contactInfo: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        };

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${HUB_PARTICIPANT_ID}/contactInfoChangeRequests`)
            .set("authorization", AUTH_TOKEN)
            .send(contactInfo);

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should approve a contact info change request", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            participantContactInfoChangeRequests: [
                {
                    id: "1",
                    name: "someone",
                    email: "someone@test.com",
                    phoneNumber: "0988564554",
                    role: "portal-staff",
                    contactInfoId: "1",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(200);
    });
    

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should handle unauthorized error", async () => {
        // Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${mockedParticipant1.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should return error for invalid changeRequestId", async () => {
        // Arrange
        const nonExistingChangeReqId = "none";

        const now = Date.now();
        
        const changeRequest: IParticipantContactInfoChangeRequest = {
            id: "1",
            name: "someone",
            email: "someone@test.com",
            phoneNumber: "0988564554",
            role: "portal-staff",
            contactInfoId: "1",
            createdBy: "user",
            createdDate: now,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO"
        }

        const participant: IParticipant = {
            ...mockedParticipant1,
            participantContactInfoChangeRequests: [changeRequest]
        };
    

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/${nonExistingChangeReqId}/approve`)
            .set("authorization", AUTH_TOKEN)

        // Assert
        expect(response.status).toBe(500);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should return error when approve by an inactive participant", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            isActive:false,
            participantContactInfoChangeRequests: [
                {
                    id: "1",
                    name: "someone",
                    email: "someone@test.com",
                    phoneNumber: "0988564554",
                    role: "portal-staff",
                    contactInfoId: "1",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/${participant.id}/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(422);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/approve - Should throw error when approving the non existing participant", async () => {
        // Arrange

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/non_exiting_participant/contactInfoChangeRequests/1/approve`)
            .set("authorization", AUTH_TOKEN);

        // Assert
        expect(response.status).toBe(404);
    });

    /**Contact Info - Reject implementations*/

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/reject - Should reject a contact info change request", async () => {
        // Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            participantContactInfoChangeRequests: [
                {
                    id: "1",
                    name: "someone",
                    email: "someone@test.com",
                    phoneNumber: "0988564554",
                    role: "portal-staff",
                    contactInfoId: "1",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);

        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/11/contactInfoChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN).send();

        // Assert
        expect(response.status).toBe(200);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/reject - Should handle unauthorize error", async () => {
        //Arrange
        jest.spyOn(authZClientMock, "rolesHavePrivilege").mockReturnValue(false);
        
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/:id/contactInfoChangeRequests/:changereqid/reject`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(403);
    });

    it("POST /participants/:id/contactInfoChangeRequests/:changereqid/reject - Should throw error if participant is not active", async () => {
        //Arrange
        const now = Date.now();
        const participant: IParticipant = {
            ...mockedParticipant1,
            id: "11",
            isActive: false,
            participantContactInfoChangeRequests: [
                {
                    id: "1",
                    name: "someone",
                    email: "someone@test.com",
                    phoneNumber: "0988564554",
                    role: "portal-staff",
                    contactInfoId: "1",
                    createdBy: "user",
                    createdDate: now,
                    requestState: ApprovalRequestState.CREATED,
                    approvedBy: null,
                    approvedDate: null,
                    rejectedBy: null,
                    rejectedDate: null,
                    requestType: "ADD_PARTICIPANT_CONTACT_INFO"
                }
            ]
        }

        repoPartMock.store(participant);
        // Act
        const response = await request(participantSvcUrl)
            .post(`/participants/11/contactInfoChangeRequests/1/reject`)
            .set("authorization", AUTH_TOKEN);
        // Assert
        expect(response.status).toBe(422);
    });
});