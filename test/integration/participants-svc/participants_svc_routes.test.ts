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

process.env = Object.assign(process.env, {
    PLATFORM_CONFIG_BASE_SVC_URL: "http://localhost:3100/",
    AUDIT_KEY_FILE_PATH: "./packages/participants-svc/dist/audit_private_key.pem",
    MONGO_URL: "mongodb://root:mongoDbPas42@localhost:27017/"
});

import { Service } from "../../../packages/participants-svc/src/application/service";
import request from "supertest";


const server = process.env["PARTICIPANTS_SVC_URL"] || "http://localhost:3010";


describe("Participants Routes - Integration", () => {
    beforeAll(async () => {
        await Service.start();
    });

    afterAll(async () => {
        await Service.stop();
    });


    test("GET /health - should be able to ping healthcheck", async () => {
        // Act
        const response = await request(server).get(`/health`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({"status": "OK"});
    });

    test("GET /metrics - should be able to reach metrics endpoint", async () => {
        // Act
        const response = await request(server).get(`/metrics`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({});
    });
});