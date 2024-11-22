import { GrpcAccountsAndBalancesAdapter } from "../../src/implementations/grpc_acc_bal_adapter";
import { AccountsAndBalancesGrpcClient } from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import { UnauthorizedError } from "@mojaloop/security-bc-public-types-lib";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { LoginHelper } from "@mojaloop/security-bc-client-lib";

jest.mock("@mojaloop/accounts-and-balances-bc-grpc-client-lib");
jest.mock("@mojaloop/security-bc-client-lib");

const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token";
const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "participants-bc-participants-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";

const mockLogger: ILogger = {
    info: jest.fn(),
    error: jest.fn(),
    createChild: jest.fn().mockReturnThis(),
} as unknown as ILogger;

const mockLoginHelper = new LoginHelper(AUTH_N_SVC_TOKEN_URL, mockLogger);
mockLoginHelper.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
mockLoginHelper.setToken = jest.fn();
mockLoginHelper.setUserCredentials = jest.fn();
mockLoginHelper.setAppCredentials = jest.fn();

const mockGrpcClient = new AccountsAndBalancesGrpcClient("", mockLoginHelper, mockLogger);
mockGrpcClient.init = jest.fn();
mockGrpcClient.createAccounts = jest.fn();
mockGrpcClient.createJournalEntries = jest.fn();
mockGrpcClient.getAccountsByIds = jest.fn();
mockGrpcClient.getAccountsByOwnerId = jest.fn();
mockGrpcClient.destroy = jest.fn();

describe("GrpcAccountsAndBalancesAdapter", () => {
    let adapter: GrpcAccountsAndBalancesAdapter;

    beforeEach(() => {
        adapter = new GrpcAccountsAndBalancesAdapter("grpc-url", mockLoginHelper, mockLogger);
        (adapter as any)._client = mockGrpcClient;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("init", () => {
        it("should initialize the gRPC client", async () => {
            const infoSpy = jest.spyOn(mockLogger, 'info');
            await adapter.init();
            expect(infoSpy).toHaveBeenCalledWith("GrpcAccountsAndBalancesAdapter initialised successfully");
            infoSpy.mockRestore();
        });
    });

    describe("createJournalEntries", () => {
        it("should create journal entries and return their IDs", async () => {
            const mockResponse = { grpcIdArray: [{ grpcId: "entry-id-1" }, { grpcId: "entry-id-2" }] };
            (mockGrpcClient.createJournalEntries as jest.Mock).mockResolvedValue(mockResponse);

            const entries = [
                {
                    requestedId: "entry1",
                    ownerId: "owner-id",
                    currencyCode: "USD",
                    amount: "100",
                    pending: true,
                    debitedAccountId: "debit-id",
                    creditedAccountId: "credit-id",
                },
            ];
            const entryIds = await adapter.createJournalEntries(entries);
            expect(entryIds).toEqual(["entry-id-1", "entry-id-2"]);
            expect(mockGrpcClient.createJournalEntries).toHaveBeenCalled();
        });

        it("should log and throw an error if the gRPC client call fails", async () => {
            const entries = [
                {
                    requestedId: "entry1",
                    ownerId: "owner-id",
                    currencyCode: "USD",
                    amount: "100",
                    pending: true,
                    debitedAccountId: "debit-id",
                    creditedAccountId: "credit-id",
                },
            ];

            const errorMessage = "Client error";
            (mockGrpcClient.createJournalEntries as jest.Mock).mockRejectedValue(new Error(errorMessage));

            await expect(adapter.createJournalEntries(entries)).rejects.toThrow(
                "Could not create journalEntries in remote system: Error: Client error"
            );
            expect(mockLogger.error).toHaveBeenCalledWith(new Error(errorMessage));
        });

        it("should throw an error if the response has no grpcIdArray", async () => {
            const entries = [
                {
                    requestedId: "entry1",
                    ownerId: "owner-id",
                    currencyCode: "USD",
                    amount: "100",
                    pending: true,
                    debitedAccountId: "debit-id",
                    creditedAccountId: "credit-id",
                },
            ];

            (mockGrpcClient.createJournalEntries as jest.Mock).mockResolvedValue({});

            await expect(adapter.createJournalEntries(entries)).rejects.toThrow(
                "Bad response on createJournalEntries - invalid createdIds.grpcIdArray"
            );
        });
    });

    describe("setToken", () => {
        it("should set the access token", () => {
            adapter.setToken("test-token");
            expect(mockLoginHelper.setToken).toHaveBeenCalledWith("test-token");
        });
    });

    describe("setUserCredentials", () => {
        it("should set user credentials", () => {
            adapter.setUserCredentials("client-id", "username", "password");
            expect(mockLoginHelper.setUserCredentials).toHaveBeenCalledWith("client-id", "username", "password");
        });
    });

    describe("setAppCredentials", () => {
        it("should set app credentials", () => {
            adapter.setAppCredentials("client-id", "client-secret");
            expect(mockLoginHelper.setAppCredentials).toHaveBeenCalledWith("client-id", "client-secret");
        });
    });

    describe("createAccount", () => {
        it("should create an account and return its ID", async () => {
            const mockResponse = { grpcIdArray: [{ grpcId: "test-account-id" }] };
            (mockGrpcClient.createAccounts as jest.Mock).mockResolvedValue(mockResponse);

            const accountId = await adapter.createAccount("requested-id", "owner-id", "FSP" as any, "USD");
            expect(accountId).toBe("test-account-id");
            expect(mockGrpcClient.createAccounts).toHaveBeenCalled();
        });

        it("should throw UnauthorizedError if UnauthorizedError is encountered", async () => {
            (mockGrpcClient.createAccounts as jest.Mock).mockRejectedValue(new UnauthorizedError("Unauthorized"));

            await expect(adapter.createAccount("requested-id", "owner-id", "FSP" as any, "USD")).rejects.toThrow(UnauthorizedError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getAccount", () => {
        it("should return an account by ID", async () => {
            const mockAccount = { id: "account-id" } as any;
            (mockGrpcClient.getAccountsByIds as jest.Mock).mockResolvedValue([mockAccount]);

            const account = await adapter.getAccount("account-id");
            expect(account).toBe(mockAccount);
            expect(mockGrpcClient.getAccountsByIds).toHaveBeenCalledWith(["account-id"]);
        });

        it("should return null if no account is found", async () => {
            (mockGrpcClient.getAccountsByIds as jest.Mock).mockResolvedValue([]);
            const account = await adapter.getAccount("non-existent-id");
            expect(account).toBeNull();
        });
    });

    describe("getParticipantAccounts", () => {
        it("should return accounts by participant's external ID", async () => {
            const mockAccounts = [{ id: "account1" }, { id: "account2" }] as any[];
            (mockGrpcClient.getAccountsByOwnerId as jest.Mock).mockResolvedValue(mockAccounts);

            const accounts = await adapter.getParticipantAccounts("external-id");
            expect(accounts).toEqual(mockAccounts);
            expect(mockGrpcClient.getAccountsByOwnerId).toHaveBeenCalledWith("external-id");
        });

        it("should return an empty array if no accounts are found", async () => {
            (mockGrpcClient.getAccountsByOwnerId as jest.Mock).mockResolvedValue([]);
            const accounts = await adapter.getParticipantAccounts("non-existent-id");
            expect(accounts).toEqual([]);
        });
    });

    describe("destroy", () => {
        it("should call destroy on the gRPC client", async () => {
            await adapter.destroy();
            expect(mockGrpcClient.destroy).toHaveBeenCalled();
        });
    });

});
