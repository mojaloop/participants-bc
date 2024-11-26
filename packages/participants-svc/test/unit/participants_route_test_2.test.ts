import { ExpressRoutes } from "../../src/application/routes";
import { ParticipantAggregate } from "../../src/domain/participant_agg";
import { ITokenHelper } from "@mojaloop/security-bc-public-types-lib";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantCreateValidationError } from "../../src/domain/errors";
import express from "express";
import request from "supertest";


describe("ExpressRoutes - _participantCreate", () => {
    let app: express.Express;
    let mockParticipantsAgg: jest.Mocked<ParticipantAggregate>;
    let mockTokenHelper: jest.Mocked<ITokenHelper>;
    let mockLogger: jest.Mocked<ILogger>;

    beforeEach(() => {
        mockParticipantsAgg = {
            createParticipant: jest.fn(),
        } as any;

        mockTokenHelper = {
            getCallSecurityContextFromAccessToken: jest.fn(),
        } as any;

        mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            createChild: jest.fn().mockReturnValue(mockLogger),
        } as any;

        const routes = new ExpressRoutes(mockParticipantsAgg, mockTokenHelper, mockLogger);
        app = express();
        app.use(express.json());
        app.use(routes.MainRouter);
    });

    it("should return 401 if no authorization header is present", async () => {
        const response = await request(app)
            .post("/participants")
            .send({});

        expect(response.status).toBe(401);
    });

    it("should return 401 if token is invalid", async () => {
        mockTokenHelper.getCallSecurityContextFromAccessToken.mockResolvedValue(null);

        const response = await request(app)
            .post("/participants")
            .set("Authorization", "Bearer invalid-token")
            .send({});

        expect(response.status).toBe(401);
    });

    it("should return 400 for ParticipantCreateValidationError", async () => {
        const mockSecurityContext = {
            username: "user",
            clientId: "user",
            platformRoleIds: ["user"],
            accessToken: "mock-token",
        };

        mockTokenHelper.getCallSecurityContextFromAccessToken.mockResolvedValue(mockSecurityContext);

        mockParticipantsAgg.createParticipant.mockRejectedValue(
            new ParticipantCreateValidationError("Invalid data")
        );

        const response = await request(app)
            .post("/participants")
            .set("Authorization", "Bearer valid-token")
            .send({ name: "InvalidParticipant" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: "error",
            msg: "Validation failure: Invalid data",
        });
    });

    it("should return 500 for unexpected errors", async () => {
        const mockSecurityContext = {
            username: "user",
            clientId: "user",
            platformRoleIds: ["user"],
            accessToken: "mock-token",
        };

        mockTokenHelper.getCallSecurityContextFromAccessToken.mockResolvedValue(mockSecurityContext);

        mockParticipantsAgg.createParticipant.mockRejectedValue(new Error("Unexpected error"));

        const response = await request(app)
            .post("/participants")
            .set("Authorization", "Bearer valid-token")
            .send({ name: "TestParticipant" });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            status: "error",
            msg: "Unexpected error",
        });
    });

    it("should return 201 with created ID on success", async () => {
        const mockSecurityContext = {
            username: "user",
            clientId: "user",
            platformRoleIds: ["user"],
            accessToken: "mock-token",
        };

        mockTokenHelper.getCallSecurityContextFromAccessToken.mockResolvedValue(mockSecurityContext);

        mockParticipantsAgg.createParticipant.mockResolvedValue("new-participant-id");

        const response = await request(app)
            .post("/participants")
            .set("Authorization", "Bearer valid-token")
            .send({ name: "ValidParticipant" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: "new-participant-id",
        });
    });

    
});

