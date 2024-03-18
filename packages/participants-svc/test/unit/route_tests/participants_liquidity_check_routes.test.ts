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
import { IParticipant, IParticipantLiquidityBalanceAdjustment, ParticipantFundsMovementDirections } from "@mojaloop/participant-bc-public-types-lib";
import { Server } from "http";
import ExcelJS from "exceljs";

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


describe("Participants Routes - Unit Test", () => {
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

    /**Liquidity Check */

    it("POST /participants/liquidityCheckValidate - Should handle the case when no file is uploaded", async () => {
        // Arrange

        //Act
        await request(participantSvcUrl)
            .post('/participants/liquidityCheckValidate')
            .set("authorization", AUTH_TOKEN)
            .expect(400)
            .expect('Content-Type', /json/)
            .then((response) => {
                expect(response.body).toEqual({ error: 'No file uploaded' });
            });

    });

    it("POST /participants/liquidityCheckValidate - Should return error for invalid excel file", async () => {
        // Arrange
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        worksheet.addRow(['Header1', 'Header2']);
        worksheet.addRow(['Value1', 'Value2']);

        // Save the workbook to a buffer
        const excelBuffer = await workbook.xlsx.writeBuffer();

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckValidate')
            .set("authorization", AUTH_TOKEN)
            .attach('settlementInitiation', Buffer.from(excelBuffer), { filename: 'example.xlsx' }) // Attach the dynamically created Excel file
        
        //Assert

        expect(response.status).toBe(500);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should make adjustment successfully", async () => {
       
        //Arrange

        const participant: IParticipant = {
            ...mockedParticipant1,
            isActive:true
        };

        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "participant1",
                participantName: "Participant 1",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "USD",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        repoPartMock.store(participant);

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(200);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should return 422 when the participant is not active", async () => {
       
        //Arrange
        const participant: IParticipant = {
            ...mockedParticipant1,
            isActive:false
        };

        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "participant1",
                participantName: "Participant 1",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "USD",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        repoPartMock.store(participant);

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(422);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should return 404 if the participant is not found", async () => {
       
        //Arrange
        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "none_existing_participant",
                participantName: "Non existing participant",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "USD",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(404);

    });

    it("POST /participants/liquidityCheckRequestAdjustment - Should return 500 when the participant's account not found", async () => {
       
        //Arrange
        const participant: IParticipant = {
            ...mockedParticipant1,
            isActive:true
        };

        const liquidityBalanceAdjustment: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "001",
                isDuplicate: false,
                participantId: "participant1",
                participantName: "Participant 1",
                participantBankAccountInfo: "",
                bankBalance: "5000000",
                settledTransferAmount: "100000",
                currencyCode: "EUR",
                direction: ParticipantFundsMovementDirections.FUNDS_DEPOSIT,
                updateAmount: "110000",
                settlementAccountId: "1"
            }
        ];

        repoPartMock.store(participant);

        //Act
        const response = await request(participantSvcUrl)
            .post('/participants/liquidityCheckRequestAdjustment')
            .query({ ignoreDuplicate: "false" })
            .set("authorization", AUTH_TOKEN)
            .send(liquidityBalanceAdjustment);

        //Assert

        expect(response.status).toBe(500);

    });

});