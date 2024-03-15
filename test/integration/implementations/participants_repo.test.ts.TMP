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

import { ILogger,ConsoleLogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import { MongoClient, Collection } from "mongodb";
import {
    mockedParticipant1,
    mockedParticipant2,
} from "@mojaloop/participants-bc-shared-mocks-lib";
import { MongoDBParticipantsRepo } from "../../../packages/participants-svc/src/implementations/mongodb_participants_repo";


const logger: ILogger = new ConsoleLogger();
logger.setLogLevel(LogLevel.FATAL);

const DB_NAME = process.env.PARTICIPANTS_DB_TEST_NAME ?? "participants";
const CONNECTION_STRING = process.env["MONGO_URL"] || "mongodb://root:mongoDbPas42@localhost:27017/";
const COLLECTION_NAME = "participant";

let participantsRepo: MongoDBParticipantsRepo;
let mongoClient: MongoClient;
let collection: Collection;


describe("Implementations - Mongo transfers Repo Integration tests", () => {
    beforeAll(async () => {
        participantsRepo = new MongoDBParticipantsRepo(CONNECTION_STRING, logger);
        await participantsRepo.init();
        
        mongoClient = await MongoClient.connect(CONNECTION_STRING);
        collection = mongoClient.db(DB_NAME).collection(COLLECTION_NAME);
    });

    beforeEach(async () => {
        await collection.deleteMany({id: {$ne: "hub"}});
    });

    afterAll(async () => {
        await collection.deleteMany({id: {$ne: "hub"}});
        await participantsRepo.destroy();
        await mongoClient.close();
    });


    test("Should be able to init mongo participants repo", async () => {
        expect(participantsRepo).toBeDefined();
    });

    test("Should throw error when unable to init participants repo", async () => {
        // Arrange
        const badMongoRepository = new MongoDBParticipantsRepo("invalid connection", logger);

        // Act & Assert
        await expect(badMongoRepository.init()).rejects.toThrow();
    });

    test("Should be able to fetch all participants", async () => {
        // Arrange
        const participant1 = mockedParticipant1;
        await participantsRepo.create(participant1);

        // Act
        const participants = await participantsRepo.fetchAll();

        // Assert
        expect(participants).toBeDefined();
        expect(Array.isArray(participants)).toBe(true);
        expect(participants.length).toBeGreaterThanOrEqual(1);
    });

    test("Should be able to fetch a participant by its ID", async () => {
        // Arrange
        const participant1 = mockedParticipant1;
        await participantsRepo.create(participant1);

        // Act
        const participant = await participantsRepo.fetchWhereId(participant1.id);

        // Assert
        expect(participant).toBeDefined();
        if (participant) {
            expect(participant.id).toEqual(participant1.id);
            expect(participant.name).toEqual(participant1.name);
        }
    });

    test("Should be able to fetch a participant by its name", async () => {
        // Arrange
        const participant1 = mockedParticipant1;
        await participantsRepo.create(participant1);

        // Act
        const participant = await participantsRepo.fetchWhereName(participant1.name);

        // Assert
        expect(participant).toBeDefined();
        if (participant) {
            expect(participant.id).toEqual(participant1.id);
            expect(participant.name).toEqual(participant1.name);
        }
    });

    test("Should be able to fetch participants by their IDs", async () => {
        // Arrange
        const participant1 = mockedParticipant1;
        const participant2 = mockedParticipant2;
        await participantsRepo.create(participant1);
        await participantsRepo.create(participant2);

        // Act
        const participants = await participantsRepo.fetchWhereIds([
            participant1.id,
            participant2.id
        ]);

        // Assert
        expect(participants).toBeDefined();
        expect(Array.isArray(participants)).toBe(true);
        expect(participants.length).toBe(2);
    });

    test("Should be able to search participants by criteria", async () => {
        // Arrange
        const participant1 = mockedParticipant1;
        await participantsRepo.create(participant1);

        // Act
        const participants = await participantsRepo.searchParticipants(
            participant1.id,
            participant1.name,
            participant1.approved ? "APPROVED" : "NOTAPPROVED",
            0,
            10
        );

        // Assert
        expect(participants).toBeDefined();
        expect(Array.isArray(participants.items)).toBe(true);
        expect(participants.items.length).toBe(1);
        expect(participants.items[0].id).toEqual(participant1.id);
    });

    test("Should be able to create a participant", async () => {
        // Arrange
        const participant1 = mockedParticipant1;

        // Act
        const result = await participantsRepo.create(participant1);

        // Assert
        expect(result).toBe(true);
        const participant = await participantsRepo.fetchWhereId(participant1.id);
        expect(participant).toBeDefined();
        if (participant) {
            expect(participant.id).toEqual(participant1.id);
        }
    });

    test("Should be able to update a participant", async () => {
        // Arrange
        const participant1 = { ...mockedParticipant1 };
        await participantsRepo.create(participant1);
        const now = Date.now();
        participant1.approved = true;
        participant1.approvedBy = "test-user";
        participant1.approvedDate = now;

        // Act
        const result = await participantsRepo.store(participant1);

        // Assert
        expect(result).toBe(true);
        const participant = await participantsRepo.fetchWhereId(participant1.id);
        expect(participant).toBeDefined();
        if (participant) {
            expect(participant.id).toEqual(participant1.id);
            expect(participant.approved).toEqual(participant1.approved);
            expect(participant.approvedBy).toEqual(participant1.approvedBy);
            expect(participant.approvedDate).toEqual(participant1.approvedDate);
        }
    });

    test("Should be able to fetch search keywords", async () => {
        // Arrange
        const participant1 = mockedParticipant1;
        const participant2 = {
            ...mockedParticipant2,
            approved: true
        };
        await participantsRepo.create(participant1);
        await participantsRepo.create(participant2);

        // Act
        const result = await participantsRepo.getSearchKeywords();

        // Assert
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
    });
});