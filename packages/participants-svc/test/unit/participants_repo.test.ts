import { MongoClient, Collection, Db } from "mongodb";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { MongoDBParticipantsRepo } from "../../src/implementations/mongodb_participants_repo";
import { IParticipant, ParticipantTypes } from "@mojaloop/participant-bc-public-types-lib";

// Mocking MongoDB methods
jest.mock("mongodb", () => ({
    MongoClient: {
        connect: jest.fn(),
    },
}));

// Mock Data
const mockParticipants: IParticipant[] = [
    {
        id: "123",
        name: "Participant A",
        type: ParticipantTypes.DFSP,
        isActive: true,
        description: "A sample participant",
        createdBy: "admin",
        createdDate: Date.now(),
        approved: true,
        approvedBy: "approver",
        approvedDate: Date.now(),
        lastUpdated: Date.now(),
        participantEndpoints: [],
        participantAccounts: [],
        participantAccountsChangeRequest: [],
        participantAllowedSourceIps: [],
        participantSourceIpChangeRequests: [],
        fundsMovements: [],
        changeLog: [],
        netDebitCaps: [],
        netDebitCapChangeRequests: [],
        participantContacts: [],
        participantContactInfoChangeRequests: [],
        participantStatusChangeRequests: [],
    },
];

describe("MongoDBParticipantsRepo", () => {
    let repo: MongoDBParticipantsRepo;
    let mockClient: MongoClient;
    let mockDb: Db;
    let mockCollection: Collection;
    let mockLogger: ILogger;

    beforeEach(async () => {
        // Mock Logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            createChild: jest.fn().mockReturnValue({
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                isWarnEnabled: jest.fn().mockReturnValue(true),
            }),
            mockLogger: jest.fn(),
            
        } as unknown as ILogger;

        // Mock MongoDB Client
        mockCollection = {
            find: jest.fn(),
            findOne: jest.fn(),
            insertOne: jest.fn(),
            updateOne: jest.fn(),
            countDocuments: jest.fn(),
            createIndex: jest.fn(),
            aggregate: jest.fn(),
        } as unknown as Collection;

        mockDb = {
            collection: jest.fn().mockReturnValue(mockCollection),
            listCollections: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
            createCollection: jest.fn().mockResolvedValue(mockCollection),
        } as unknown as Db;

        mockClient = {
            db: jest.fn().mockReturnValue(mockDb),
            close: jest.fn(),
        } as unknown as MongoClient;

        (MongoClient.connect as jest.Mock).mockResolvedValue(mockClient);

        // Initialize the repository
        repo = new MongoDBParticipantsRepo("mongodb://localhost:27017", mockLogger);
        await repo.init();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should fetch all participants", async () => {
        (mockCollection.find as jest.Mock).mockReturnValue({
            project: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue(mockParticipants),
        });

        const participants = await repo.fetchAll();
        expect(participants).toEqual(mockParticipants);
        expect(mockCollection.find).toHaveBeenCalledWith({});
    });

    it("should fetch participant by ID", async () => {
        const participantId = "123";
        (mockCollection.findOne as jest.Mock).mockResolvedValue(mockParticipants[0]);

        const result = await repo.fetchWhereId(participantId);
        expect(result).toEqual(mockParticipants[0]);
        expect(mockCollection.findOne).toHaveBeenCalledWith(
            { id: participantId },
            { projection: { _id: 0 } }
        );
    });

    it("should create a new participant", async () => {
        const newParticipant = mockParticipants[0];
        (mockCollection.insertOne as jest.Mock).mockResolvedValue({ acknowledged: true });

        const result = await repo.create(newParticipant);
        expect(result).toBe(true);
        expect(mockCollection.insertOne).toHaveBeenCalledWith(newParticipant);
    });

    it("should update a participant", async () => {
        const updatedParticipant = { ...mockParticipants[0], name: "Updated Participant" };
        (mockCollection.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

        const result = await repo.store(updatedParticipant);
        expect(result).toBe(true);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { id: updatedParticipant.id },
            { $set: expect.objectContaining({ name: "Updated Participant" }) }
        );
    });

    it("should search participants with filters", async () => {
        (mockCollection.find as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue(mockParticipants),
        });
        (mockCollection.countDocuments as jest.Mock).mockResolvedValue(10);

        const results = await repo.searchParticipants("123", null, "APPROVED", 0, 2);
        expect(results.items).toEqual(mockParticipants);
        expect(results.totalPages).toBe(5); // 10 total, page size 2
        expect(mockCollection.find).toHaveBeenCalledWith(
            expect.objectContaining({ $and: [{ id: { $regex: "123", $options: "i" } }, { "approved": { "$eq": true } }] }),
            expect.any(Object)
        );
    });


    it("should return null when fetching a non-existing participant by ID", async () => {
        const nonExistentId = "non-existent-id";
        (mockCollection.findOne as jest.Mock).mockResolvedValue(null);

        const result = await repo.fetchWhereId(nonExistentId);
        expect(result).toBeNull();
        expect(mockCollection.findOne).toHaveBeenCalledWith(
            { id: nonExistentId },
            { projection: { _id: 0 } }
        );
    });

    it("should fetch participant by name", async () => {
        const participantName = "Participant A";
        (mockCollection.findOne as jest.Mock).mockResolvedValue(mockParticipants[0]);

        const result = await repo.fetchWhereName(participantName);
        expect(result).toEqual(mockParticipants[0]);
        expect(mockCollection.findOne).toHaveBeenCalledWith(
            { name: participantName },
            { projection: { _id: 0 } }
        );
    });

    it("should fetch multiple participants by IDs", async () => {
        const ids = ["123", "456"];
        (mockCollection.findOne as jest.Mock)
            .mockResolvedValueOnce(mockParticipants[0])
            .mockResolvedValueOnce(mockParticipants[0]);

        const results = await repo.fetchWhereIds(ids);
        expect(results).toEqual([mockParticipants[0], mockParticipants[0]]);
        expect(mockCollection.findOne).toHaveBeenCalledTimes(2);
    });

    it("should search participants by criteria", async () => {
        const searchCriteria = { id: "123", name: "Participant A", state: "APPROVED", pageIndex: 0, pageSize: 1 };
        (mockCollection.find as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([mockParticipants[0]]),
        });
        (mockCollection.countDocuments as jest.Mock).mockResolvedValue(1);

        const results = await repo.searchParticipants(
            searchCriteria.id,
            searchCriteria.name,
            searchCriteria.state,
            searchCriteria.pageIndex,
            searchCriteria.pageSize
        );
        expect(results.items).toEqual([mockParticipants[0]]);
        expect(results.totalPages).toEqual(1);
        expect(mockCollection.find).toHaveBeenCalledWith({
            $and: [
                { id: { $regex: searchCriteria.id, $options: "i" } },
                { name: { $regex: searchCriteria.name, $options: "i" } },
                { approved: { $eq: true } }
            ],
        }, { limit: 1, skip: 0, sort: ["updatedAt", "desc"] });
    });

    it("should return empty results for search with no matching criteria", async () => {
        (mockCollection.find as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
        });
        (mockCollection.countDocuments as jest.Mock).mockResolvedValue(0);

        const results = await repo.searchParticipants("non-existent", null, null);
        expect(results.items).toEqual([]);
        expect(results.totalPages).toEqual(0);
    });

    it("should get distinct search keywords", async () => {
        const mockAggregateResult = [
            { _id: { keyword: "keyword1" } },
            { _id: { keyword: "keyword2" } },
        ];

        // Mock the behavior of aggregate method
        (mockCollection.aggregate as jest.Mock).mockReturnValue({
            [Symbol.asyncIterator]: async function* () {
                yield* mockAggregateResult;
            },
        });

        const result = await repo.getSearchKeywords();
        expect(result).toEqual([{
            "distinctTerms": [
                "NOTAPPROVED"
            ],
            "fieldName": "state",
        },
        {
            "distinctTerms": [
                "NOTAPPROVED"
            ],
            "fieldName": "state",
        },]);
    });

    it("should close the MongoDB client when destroy is called", async () => {
        await repo.destroy();
        expect(mockClient.close).toHaveBeenCalled();
    });


    it("should handle database connection failure during init", async () => {
        const connectionError = new Error("Connection failed");
        (MongoClient.connect as jest.Mock).mockRejectedValueOnce(connectionError);
        
        const newRepo = new MongoDBParticipantsRepo("mongodb://localhost:27017", mockLogger);
        await expect(newRepo.init()).rejects.toThrow("Connection failed");
    });
    
    it("should handle error in getSearchKeywords", async () => {
        const mockError = new Error("Aggregate failed");
       
        (mockCollection.aggregate as jest.Mock).mockImplementationOnce(() => {
            throw mockError;
        });
    
        const result = await repo.getSearchKeywords();
    
        // Assertions
        expect(result).toEqual([]); 
    });
});


